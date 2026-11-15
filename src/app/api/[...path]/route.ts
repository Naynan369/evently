import QRCode from "qrcode";
import Stripe from "stripe";
import {
  currentUser,
  requireUser,
  requireVerifiedUser,
  createSession,
  endSession,
} from "@/lib/auth";
import { AppError, checkPassword, textField, tokenHash } from "@/lib/security";
import {
  all,
  one,
  run,
  publicUser,
  userById,
  listEvents,
  getEvent,
  eventImageById,
  saveEventImage,
  assertOwnedEventImage,
  saveEvent,
  savedIds,
  updateInterests,
  createEvent,
  createBusinessProfile,
  createVenue,
  businessProfilesForOwner,
  ensureBusinessProfile,
  getOwnedVenue,
  getOwnedBusinessProfile,
  validateEvent,
  venuesForOwner,
  updateVenue,
  updateBusinessProfile,
  reserveBooking,
  bookingById,
  listTickets,
  cancelFreeBooking,
  requestRefund,
  checkIn,
  organizerData,
  addDemoGuest,
  saveDemoFeedback,
  takeRateLimit,
  confirmPayment,
  expireBooking,
  transaction,
} from "@/lib/db";
import {
  accountStatus,
  appUrl,
  cancelCheckout,
  connectAccount,
  paymentConfigured,
  reconcileBooking,
  refundBooking,
  startCheckout,
  stripe,
} from "@/lib/payments";
import type { Event, TicketType } from "@/lib/types";
import { assertEmailConfigured, emailDeliveryMode } from "@/lib/mail";
import {
  deliverAccountToken,
  deliverVerificationCode,
  verifyEmail,
  verifyEmailCode,
  resetPassword,
} from "@/lib/account-tokens";
import { registerAccount } from "@/lib/registration";
import { accountHome } from "@/lib/account-home";
import { musicApi } from "@/lib/music/music-api";
import { eventIsPrivate, organizerDemoMode } from "@/lib/demo";
import {
  paymentAccountFromWebhook,
  platformCheckoutTestEnabled,
  platformCheckoutTestReadiness,
} from "@/lib/platform-checkout-test";
import {
  eventImageMime,
  MAX_EVENT_IMAGE_BYTES,
  uploadedEventImageId,
} from "@/lib/event-image";
import { assertOperator, createCase, deliverMessagesBestEffort, moderateEvent, operatorSnapshot, resolveCase, retryFailedMessages } from "@/lib/operations";
import { deleteIntent, demandSignals, intentMatchesForUser, intentsForUser, queueIntentMatchesForEvent, saveIntent } from "@/lib/intents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
async function body(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 64000)
    throw new AppError("Request is too large.", 413);
  const raw = await request.text();
  if (raw.length > 64000) throw new AppError("Request is too large.", 413);
  try {
    const value = JSON.parse(raw || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new AppError("Invalid request body.");
  }
}
async function attachOwnedVenue(
  input: Record<string, unknown>,
  ownerId: string,
  existingVenueId?: string,
) {
  const venueId =
    typeof input.venueId === "string" ? input.venueId.trim() : "";
  if (!venueId) {
    input.venueId = "";
    return;
  }
  const venue = await getOwnedVenue(venueId, ownerId);
  if (!venue || (!venue.active && venue.id !== existingVenueId))
    throw new AppError("Choose an active venue from your workspace.", 400);
  const eventCapacity = Number(input.capacity);
  if (Number.isFinite(eventCapacity) && eventCapacity > venue.capacity)
    throw new AppError(
      "Event ticket capacity cannot exceed the venue’s approved capacity.",
      400,
    );
  input.venue = venue.name;
  input.city = venue.city;
  input.address = venue.address + ", " + venue.postalCode;
  input.venueId = venue.id;
}
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_URL ? appUrl() : new URL(request.url).origin;
  if (!origin || origin !== expected)
    throw new AppError("Request origin is not allowed.", 403);
}
async function bookingForStripeEvent(
  paymentIntent: string | Stripe.PaymentIntent | null,
  metadata: Record<string, string> | null,
  event: Stripe.Event,
) {
  let bookingId = metadata?.booking_id;
  let scope = metadata?.evently_payment_scope;
  if (!bookingId && paymentIntent) {
    const id = typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
    const intent = await stripe().paymentIntents.retrieve(
      id, {}, event.account ? { stripeAccount: event.account } : undefined,
    );
    bookingId = intent.metadata?.booking_id;
    scope = intent.metadata?.evently_payment_scope;
  }
  const booking = bookingId ? await bookingById(bookingId) : undefined;
  return booking && booking.stripeAccount === paymentAccountFromWebhook(event.account, event.livemode, scope)
    ? booking
    : undefined;
}
async function webhook(request: Request) {
  if (organizerDemoMode())
    throw new AppError("Payments are disabled during the organizer demo.", 503);
  if (!process.env.STRIPE_WEBHOOK_SECRET)
    throw new AppError("Webhook setup is incomplete.", 503);
  const signature = request.headers.get("stripe-signature");
  if (!signature) throw new AppError("Missing webhook signature.");
  const raw = await request.text();
  if (raw.length > 1000000) throw new AppError("Request is too large.", 413);
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      raw,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new AppError("Invalid webhook signature.");
  }
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    if (session.metadata?.booking_id)
      await confirmPayment(
        session,
        paymentAccountFromWebhook(
          event.account,
          event.livemode,
          session.metadata.evently_payment_scope,
        ),
      );
    await deliverMessagesBestEffort(5);
  } else if (
    event.type === "checkout.session.expired" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    const session = event.data.object;
    const booking = session.client_reference_id
      ? await bookingById(session.client_reference_id)
      : undefined;
    if (
      booking &&
      booking.stripeAccount ===
        paymentAccountFromWebhook(
          event.account,
          event.livemode,
          session.metadata?.evently_payment_scope,
        )
    )
      await expireBooking(session.id, booking.id);
  } else if (event.type === "charge.refunded") {
    const charge = event.data.object;
    const booking = await bookingForStripeEvent(charge.payment_intent, charge.metadata, event);
    if (
      booking &&
      charge.refunded &&
      charge.amount_refunded >= booking.total
    )
      {
        await run("UPDATE bookings SET status='refunded' WHERE id=? AND status='confirmed'", booking.id);
        await run(
          "INSERT INTO message_outbox(id,kind,booking_id,user_id,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
          "refund-issued:" + booking.id, "refund-issued", booking.id, booking.userId, Date.now(),
        );
      }
  } else if (event.type === "charge.dispute.created") {
    const dispute = event.data.object;
    const booking = await bookingForStripeEvent(dispute.payment_intent, dispute.metadata, event);
    await run(
      "INSERT INTO operator_cases(id,kind,subject,details,status,event_id,booking_id,created_at,updated_at) VALUES(?,?,?,?,'open',?,?,?,?) ON CONFLICT(id) DO NOTHING",
      "stripe-dispute:" + dispute.id, "dispute", "Stripe dispute requires review",
      `Stripe dispute ${dispute.id} on connected account ${event.account || "platform"}. Review it in Stripe and record the outcome here.`,
      booking?.eventId || null, booking?.id || null,
      Date.now(), Date.now(),
    );
  }
  return json({ received: true });
}
async function handle(request: Request, context: Context) {
  let route = "";
  let checkoutStep = "";
  try {
    const { path } = await context.params;
    route = path.join("/");
    const method = request.method;
    if (route === "stripe/webhook" && method === "POST")
      return await webhook(request);
    if (method !== "GET") sameOrigin(request);
    if (route === "session" && method === "GET") {
      const user = await currentUser();
      return json({ user, saved: user ? await savedIds(user.id) : [] });
    }
    if (route === "events" && method === "GET")
      return json({ events: await listEvents() });
    if (path[0] === "event-images" && path.length === 2 && method === "GET") {
      const id = uploadedEventImageId("/api/" + route);
      if (!id) throw new AppError("Image not found.", 404);
      const image = await eventImageById(id);
      if (!image) throw new AppError("Image not found.", 404);
      return new Response(new Uint8Array(image.bytes), {
        headers: {
          "Content-Type": image.mediaType,
          "Content-Length": String(image.bytes.length),
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (route === "auth/register" && method === "POST") {
      const registered = await registerAccount(await body(request));
      await createSession(registered.user.id);
      return json(registered, 201);
    }
    if (route === "auth/login" && method === "POST") {
      const input = await body(request);
      const email = textField(input.email, "Email", 5, 254).toLowerCase();
      const password =
        typeof input.password === "string" && input.password.length <= 128
          ? input.password
          : "";
      await takeRateLimit("login:" + tokenHash(email), 10);
      const row = await one<Record<string, unknown>>(
        "SELECT * FROM users WHERE email=?",
        email,
      );
      const dummy = "00000000000000000000000000000000:" + "0".repeat(128);
      const valid = await checkPassword(
        password,
        row ? String(row.password_hash) : dummy,
      );
      if (!row || !valid)
        throw new AppError("Email or password is incorrect.", 401);
      await run("DELETE FROM rate_limits WHERE key=?", "login:" + tokenHash(email));
      const user = (await userById(String(row.id)))!;
      await createSession(user.id);
      return json({
        user,
        saved: await savedIds(user.id),
        home: await accountHome(user.id),
      });
    }
    if (route === "auth/logout" && method === "POST") {
      await endSession();
      return json({ ok: true });
    }
    if (route === "auth/verify-email" && method === "POST") {
      const input = await body(request);
      if (typeof input.code === "string") {
        const codeUser = await requireUser();
        await takeRateLimit("verify-code:" + codeUser.id, 10, 15 * 60 * 1000);
        const userId = await verifyEmailCode(input.code, codeUser.id);
        await createSession(userId);
        return json({ user: await currentUser() });
      }
      const userId = await verifyEmail(input.token);
      const signedIn = await currentUser();
      if (signedIn?.id === userId) await createSession(userId);
      return json({ user: await currentUser() });
    }
    if (route === "auth/resend-verification" && method === "POST") {
      const unverified = await requireUser();
      if (!unverified.emailVerified) {
        assertEmailConfigured();
        await takeRateLimit("verify-minute:" + unverified.id, 1, 60000);
        await takeRateLimit("verify-hour:" + unverified.id, 6, 3600000);
        if (emailDeliveryMode() === "gmail")
          await deliverVerificationCode(unverified.id);
        else await deliverAccountToken(unverified.id, "verify");
      }
      return json({ ok: true, delivery: emailDeliveryMode() });
    }
    if (route === "auth/forgot-password" && method === "POST") {
      assertEmailConfigured();
      const email = textField(
        (await body(request)).email,
        "Email",
        5,
        254,
      ).toLowerCase();
      await takeRateLimit("reset-minute:" + tokenHash(email), 1, 60000);
      await takeRateLimit("reset-hour:" + tokenHash(email), 5, 3600000);
      const account = await one<{ id: string }>(
        "SELECT id FROM users WHERE email=?",
        email,
      );
      if (account) {
        try {
          await deliverAccountToken(account.id, "reset");
        } catch {
          console.error("Password reset email delivery failed");
        }
      }
      return json({ ok: true, delivery: emailDeliveryMode() });
    }
    if (route === "auth/reset-password" && method === "POST") {
      const input = await body(request);
      await resetPassword(input.token, input.password);
      await endSession();
      return json({ ok: true, user: null });
    }
    const user = await requireVerifiedUser();
    if (path[0] === "admin") {
      assertOperator(user);
      if (route === "admin" && method === "GET") return json(await operatorSnapshot());
      if (route === "admin/messages/dispatch" && method === "POST")
        return json(await retryFailedMessages());
      if (route === "admin/cases" && method === "POST") {
        const input = await body(request);
        return json({ id: await createCase({
          kind: input.kind as "incident" | "payment" | "dispute",
          subject: input.subject,
          details: input.details,
          eventId: typeof input.eventId === "string" ? input.eventId : undefined,
          bookingId: typeof input.bookingId === "string" ? input.bookingId : undefined,
        }) }, 201);
      }
      if (path.length === 3 && path[1] === "cases" && method === "PUT") {
        await resolveCase(path[2], (await body(request)).status as "open" | "resolved");
        return json({ ok: true });
      }
      if (path.length === 3 && path[1] === "events" && method === "POST") {
        const event = await moderateEvent(path[2], (await body(request)).action as "approve" | "reject" | "cancel");
        if (event.visibility === "cancelled" || event.visibility === "published") await deliverMessagesBestEffort(5);
        return json({ event });
      }
      if (path.length === 3 && path[1] === "refunds" && method === "POST") {
        const booking = await bookingById(path[2]);
        if (!booking) throw new AppError("Booking not found.", 404);
        const status = await refundBooking(booking);
        if (status === "succeeded")
          await run("UPDATE operator_cases SET status='resolved',updated_at=? WHERE id=?", Date.now(), "cancellation-refund:" + booking.id);
        await deliverMessagesBestEffort(5);
        return json({ status });
      }
      if (path.length === 4 && path[1] === "checkouts" && path[3] === "expire" && method === "POST") {
        const booking = await bookingById(path[2]);
        if (!booking || (await getEvent(booking.eventId))?.visibility !== "cancelled")
          throw new AppError("Cancelled event booking not found.", 404);
        const current = await reconcileBooking(booking);
        if (current.status === "pending") await cancelCheckout(current);
        await deliverMessagesBestEffort(5);
        return json({ status: (await bookingById(booking.id))?.status });
      }
    }
    if (route === "reports" && method === "POST") {
      await takeRateLimit("reports:" + user.id, 5, 3600000);
      const input = await body(request);
      const bookingId = typeof input.bookingId === "string" ? input.bookingId : undefined;
      const reportedBooking = bookingId ? await bookingById(bookingId) : null;
      if (bookingId && reportedBooking?.userId !== user.id)
        throw new AppError("Booking not found.", 404);
      const eventId = typeof input.eventId === "string" ? input.eventId : undefined;
      if (eventId && reportedBooking && reportedBooking.eventId !== eventId)
        throw new AppError("The booking and event do not match.", 400);
      if (!eventId && !bookingId) throw new AppError("Choose an event or booking.");
      return json({ id: await createCase({
        kind: "incident", subject: input.subject, details: input.details,
        eventId, bookingId, reporterId: user.id,
      }) }, 201);
    }
    if (path[0] === "intents") {
      if (user.isOrganizer) throw new AppError("An attendee account is required.", 403);
      if (route === "intents" && method === "GET")
        return json({ intents: await intentsForUser(user.id), matches: await intentMatchesForUser(user.id) });
      if (route === "intents" && method === "POST") {
        await takeRateLimit("intents:" + user.id, 8, 3600000);
        return json({ intent: await saveIntent(user.id, await body(request)) }, 201);
      }
      if (path.length === 2 && method === "PUT") {
        await takeRateLimit("intents-edit:" + user.id, 30, 3600000);
        return json({ intent: await saveIntent(user.id, await body(request), path[1]) });
      }
      if (path.length === 2 && method === "DELETE") {
        await deleteIntent(user.id, path[1]);
        return json({ ok: true });
      }
    }
    const organizerRoute =
      (route === "event-images" && method === "POST") ||
      path[0] === "business-profiles" ||
      path[0] === "venues" ||
      path[0] === "organizer" ||
      path[0] === "stripe" ||
      (path[0] === "events" && method !== "GET");
    if (organizerRoute && !user.isOrganizer)
      throw new AppError("An organizer account is required.", 403);
    if (route === "organizer/demand" && method === "GET")
      return json({ signals: await demandSignals() });
    if (route === "event-images" && method === "POST") {
      await takeRateLimit("event-images:" + user.id, 20, 3600000);
      if (Number(request.headers.get("content-length") || 0) > MAX_EVENT_IMAGE_BYTES + 10000)
        throw new AppError("Choose an image smaller than 3.5 MB.", 413);
      const file = (await request.formData()).get("image");
      if (!(file instanceof File) || file.size === 0 || file.size > MAX_EVENT_IMAGE_BYTES)
        throw new AppError("Choose a JPG, PNG, or WebP image smaller than 3.5 MB.", 400);
      const bytes = Buffer.from(await file.arrayBuffer());
      const mediaType = eventImageMime(bytes);
      if (!mediaType)
        throw new AppError("Choose a JPG, PNG, or WebP image.", 400);
      return json({ url: await saveEventImage(user.id, mediaType, bytes) }, 201);
    }
    if (path[0] === "music")
      return await musicApi(
        request,
        path,
        user,
        method === "GET" ? {} : await body(request),
      );
    if (route === "interests" && method === "PUT")
      return json({
        user: await updateInterests(user.id, (await body(request)).interests),
      });
    if (route === "saved" && method === "PUT") {
      const input = await body(request);
      if (typeof input.saved !== "boolean")
        throw new AppError("Choose a saved state.");
      return json({
        saved: await saveEvent(
          user.id,
          textField(input.eventId, "Event"),
          input.saved,
        ),
      });
    }
    if (route === "business-profiles" && method === "GET")
      return json({ profiles: await businessProfilesForOwner(user.id) });
    if (route === "business-profiles" && method === "POST") {
      await takeRateLimit("business-profiles:" + user.id, 20, 3600000);
      return json(
        { profile: await createBusinessProfile(await body(request), user) },
        201,
      );
    }
    if (
      path[0] === "business-profiles" &&
      path.length === 2 &&
      method === "PUT"
    ) {
      await takeRateLimit("business-profiles:" + user.id, 40, 3600000);
      return json({
        profile: await updateBusinessProfile(path[1], user.id, await body(request)),
      });
    }
    if (route === "stripe/status" && method === "GET") {
      if (new URL(request.url).searchParams.get("diagnostics") === "1")
        return json({
          ...platformCheckoutTestReadiness(),
          vercelEnvironment: process.env.VERCEL_ENV || null,
          commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
        });
      const profileId = new URL(request.url).searchParams.get("profileId");
      const profile = profileId
        ? await getOwnedBusinessProfile(profileId, user.id, "organizer")
        : null;
      if (profileId && !profile)
        throw new AppError("Choose one of your organizer profiles.", 400);
      if (platformCheckoutTestEnabled())
        return json({ configured: true, connected: false, ready: false, testCheckout: true });
      return json(await accountStatus(user, profile || undefined));
    }
    if (route === "venues" && method === "GET")
      return json({ venues: await venuesForOwner(user.id) });
    if (route === "venues" && method === "POST") {
      await takeRateLimit("venues:" + user.id, 20, 3600000);
      return json({ venue: await createVenue(await body(request), user) }, 201);
    }
    if (path[0] === "venues" && path.length === 2 && method === "PUT") {
      await takeRateLimit("venues:" + user.id, 40, 3600000);
      return json({
        venue: await updateVenue(path[1], user.id, await body(request)),
      });
    }
    if (route === "stripe/connect" && method === "POST") {
      await takeRateLimit("connect:" + user.id, 10);
      const input = await body(request);
      const profile = input.profileId
        ? await getOwnedBusinessProfile(
            textField(input.profileId, "Organizer profile"),
            user.id,
            "organizer",
          )
        : await ensureBusinessProfile(user, "organizer");
      if (!profile)
        throw new AppError("Choose one of your organizer profiles.", 400);
      return json({
        url: (
          await connectAccount(
            user,
            textField(input.country, "Country"),
            profile,
          )
        )
          .url,
      });
    }
    if (route === "events" && method === "POST") {
      await takeRateLimit("events:" + user.id, 20, 3600000);
      const input = await body(request);
      await attachOwnedVenue(input, user.id);
      const organizerProfile = input.organizerProfileId
        ? await getOwnedBusinessProfile(
            textField(input.organizerProfileId, "Organizer profile"),
            user.id,
            "organizer",
          )
        : await ensureBusinessProfile(user, "organizer");
      if (!organizerProfile)
        throw new AppError("Choose one of your organizer profiles.", 400);
      if (
        !organizerDemoMode() &&
        ((Number(input.price) > 0 &&
          Number(input.capacity) > Number(input.vipCapacity || 0)) ||
          (Number(input.vipCapacity) > 0 && Number(input.vipPrice) > 0)) &&
        !platformCheckoutTestEnabled() &&
        !(await accountStatus(user, organizerProfile)).ready
      )
        throw new AppError(
          "Connect and activate your Stripe account in Organizer studio before publishing paid tickets.",
          409,
        );
      const event = await transaction(async () => {
        const created = await createEvent(input, user, organizerProfile);
        await queueIntentMatchesForEvent(created);
        return created;
      });
      if (event.visibility === "published") await deliverMessagesBestEffort(5);
      return json({ event }, 201);
    }
    if (path[0] === "events" && path.length === 2 && method === "PUT") {
      const original = await getEvent(path[1]);
      if (!original || original.ownerId !== user.id)
        throw new AppError("Event not found.", 404);
      const input = await body(request);
      await attachOwnedVenue(input, user.id, original.venueId);
      const legacyDefaultOrganizerProfile = original.organizerProfileId
        ? null
        : await ensureBusinessProfile(user, "organizer");
      const organizerProfile = input.organizerProfileId
        ? await getOwnedBusinessProfile(
            textField(input.organizerProfileId, "Organizer profile"),
            user.id,
            "organizer",
          )
        : original.organizerProfileId
          ? await getOwnedBusinessProfile(
              original.organizerProfileId,
              user.id,
              "organizer",
            )
          : legacyDefaultOrganizerProfile;
      if (!organizerProfile)
        throw new AppError("Choose one of your organizer profiles.", 400);
      input.organizerProfileId = organizerProfile.id;
      const updated = validateEvent(input, user, organizerProfile);
      await assertOwnedEventImage(updated.coverImage, user.id);
      if (
        !organizerDemoMode() &&
        ((updated.price > 0 &&
          updated.capacity > (updated.vipCapacity || 0)) ||
          (updated.vipCapacity && (updated.vipPrice || 0) > 0)) &&
        !platformCheckoutTestEnabled() &&
        !(await accountStatus(user, organizerProfile)).ready
      )
        throw new AppError(
          "Activate Stripe before publishing paid tickets.",
          409,
        );
      const event = await transaction(async () => {
        const currentRow = await one<{ data: string }>(
          "SELECT data FROM events WHERE id=? FOR UPDATE",
          original.id,
        );
        if (!currentRow) throw new AppError("Event not found.", 404);
        const current = JSON.parse(currentRow.data) as Event;
        const reserved = await one<{
          n: number;
          standard: number;
          vip: number;
        }>(
          "SELECT COALESCE(SUM(quantity),0) AS n, COALESCE(SUM(quantity) FILTER (WHERE ticket_type='standard'),0) AS standard, COALESCE(SUM(quantity) FILTER (WHERE ticket_type='vip'),0) AS vip FROM bookings WHERE event_id=? AND status IN ('pending','confirmed')",
          original.id,
        );
        const reservedTotal = reserved?.n || 0;
        if (current.visibility === "cancelled")
          throw new AppError("A cancelled event cannot be edited.", 409);
        if (process.env.EVENTLY_REQUIRE_EVENT_APPROVAL === "true" && reservedTotal > 0)
          throw new AppError("Contact Evently to change a reviewed event after tickets have been reserved.", 409);
        const reservedStandard = reserved?.standard || 0;
        const reservedVip = reserved?.vip || 0;
        const previousOrganizerProfileId =
          original.organizerProfileId || legacyDefaultOrganizerProfile?.id;
        if (
          reservedTotal > 0 &&
          previousOrganizerProfileId !== organizerProfile.id
        )
          throw new AppError(
            "An event’s organizer profile cannot change after tickets have been reserved.",
            409,
          );
        if (updated.capacity < reservedTotal)
          throw new AppError(
            "Capacity cannot be below the number of reserved tickets.",
            409,
          );
        if (updated.capacity - (updated.vipCapacity || 0) < reservedStandard)
          throw new AppError(
            "Standard capacity cannot be below the number of reserved standard tickets.",
            409,
          );
        if ((updated.vipCapacity || 0) < reservedVip)
          throw new AppError(
            "VIP capacity cannot be below the number of reserved VIP tickets.",
            409,
          );
        if (
          reservedTotal &&
          (updated.price !== original.price ||
            updated.vipPrice !== original.vipPrice ||
            (updated.vipCapacity || 0) !== (original.vipCapacity || 0) ||
            updated.currency !== original.currency ||
            updated.startsAt !== original.startsAt ||
            updated.endsAt !== original.endsAt)
        )
          throw new AppError(
            "Ticket prices, allocations, and dates cannot change while there are active bookings.",
            409,
          );
        const value: Event = {
          ...updated,
          ...(original.coverImage && !updated.coverImage
            ? { coverImage: original.coverImage }
            : {}),
          id: original.id,
          slug: original.slug,
          visibility: process.env.EVENTLY_REQUIRE_EVENT_APPROVAL === "true" && !organizerDemoMode()
            ? "review"
            : current.visibility,
        };
        await run(
          "UPDATE events SET data=? WHERE id=?",
          JSON.stringify(value),
          original.id,
        );
        await queueIntentMatchesForEvent(value);
        return value;
      });
      if (event.visibility === "published") await deliverMessagesBestEffort(5);
      return json({ event });
    }
    if (route === "checkout" && method === "POST") {
      checkoutStep = "rate_limit";
      await takeRateLimit("checkout:" + user.id, 30);
      checkoutStep = "load_event";
      const input = await body(request);
      const event = await getEvent(textField(input.eventId, "Event"));
      if (!event) throw new AppError("Event not found.", 404);
      if (eventIsPrivate(event))
        throw new AppError("This event is a private draft.", 409);
      const requestedTicketType = textField(
        input.ticketType === undefined ? "standard" : input.ticketType,
        "Ticket type",
      ) as TicketType;
      if (requestedTicketType !== "standard" && requestedTicketType !== "vip")
        throw new AppError("Choose a valid ticket type.");
      const ticketPrice =
        requestedTicketType === "vip" ? event.vipPrice || 0 : event.price;
      if (!event.sample && ticketPrice > 0) {
        checkoutStep = "verify_payments";
        if (!paymentConfigured())
          throw new AppError(
            "Paid bookings will open once Stripe setup is complete.",
            503,
          );
        const owner = event.ownerId
          ? publicUser(
              await one<Record<string, unknown>>(
                "SELECT * FROM users WHERE id=?",
                event.ownerId,
              ),
            )
          : null;
        const organizerProfile = event.organizerProfileId
          ? await getOwnedBusinessProfile(
              event.organizerProfileId,
              event.ownerId || "",
              "organizer",
            )
          : null;
        if (
          !owner ||
          (!platformCheckoutTestEnabled() &&
            !(await accountStatus(owner, organizerProfile || undefined)).ready)
        )
          throw new AppError(
            "The organizer has not activated payments yet.",
            409,
          );
        checkoutStep = "reconcile_expired";
        const expired = await all<{ id: string }>(
          "SELECT id FROM bookings WHERE event_id=? AND status='pending' AND session_id IS NOT NULL AND expires_at<? LIMIT 10",
          event.id,
          Math.floor(Date.now() / 1000),
        );
        await Promise.all(
          expired.map(async (b) =>
            reconcileBooking((await bookingById(b.id))!),
          ),
        );
      }
      checkoutStep = "reserve_booking";
      const booking = await reserveBooking(
        user.id,
        event.id,
        input.quantity as number,
        textField(input.requestKey, "Request"),
        requestedTicketType,
      );
      if (booking.status === "confirmed") await deliverMessagesBestEffort(1);
      if (
        booking.status === "cancelled" ||
        booking.status === "expired" ||
        booking.status === "refunded"
      )
        throw new AppError("This booking has ended. Start a new booking.", 409);
      checkoutStep = "create_checkout_session";
      return json(
        booking.mode === "stripe"
          ? await startCheckout(booking, event, user)
          : { bookingId: booking.id, url: "/tickets/" + booking.id },
      );
    }
    if (route === "tickets" && method === "GET")
      return json({ tickets: await listTickets(user.id) });
    if (path[0] === "tickets" && path.length >= 2 && path.length <= 3) {
      let booking = await bookingById(path[1]);
      if (!booking || booking.userId !== user.id)
        throw new AppError("Ticket not found.", 404);
      const event = (await getEvent(booking.eventId))!;
      if (path.length === 2 && method === "GET") {
        booking = await reconcileBooking(booking);
        if (booking.status === "confirmed") await deliverMessagesBestEffort(1);
        return json({ booking, event });
      }
      if (path[2] === "cancel" && method === "POST") {
        if (booking.mode === "stripe") await cancelCheckout(booking);
        else {
          await cancelFreeBooking(booking.id, user.id);
          await deliverMessagesBestEffort(1);
        }
        return json({ ok: true });
      }
      if (path[2] === "resume" && method === "POST")
        return json(await startCheckout(booking, event, user));
      if (path[2] === "refund-request" && method === "POST")
        return json({ booking: await requestRefund(booking.id, user.id) });
      if (booking.status !== "confirmed")
        throw new AppError("Your ticket is available after confirmation.", 409);
      if (event.visibility === "cancelled")
        throw new AppError("This event has been cancelled. Tickets are not valid for entry.", 409);
      if (path[2] === "qr" && method === "GET") {
        const svg = await QRCode.toString(booking.code, {
          type: "svg",
          margin: 1,
          color: { dark: "#182322", light: "#ffffff" },
        });
        return new Response(svg, {
          headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "private, no-store",
            "Content-Security-Policy": "default-src 'none'",
          },
        });
      }
      if (path[2] === "calendar" && method === "GET") {
        const escape = (s: string) =>
          s
            .replace(/\\/g, "\\\\")
            .replace(/\r?\n/g, "\\n")
            .replace(/,/g, "\\,")
            .replace(/;/g, "\\;");
        const date = (s: string) =>
          new Date(s)
            .toISOString()
            .replace(/[-:]/g, "")
            .replace(/\.\d{3}/, "");
        const ics = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Evently//Tickets//EN",
          "BEGIN:VEVENT",
          "UID:" + booking.id + "@evently",
          "DTSTAMP:" + date(new Date().toISOString()),
          "DTSTART:" + date(event.startsAt),
          "DTEND:" + date(event.endsAt),
          "SUMMARY:" + escape((event.sample ? "SAMPLE: " : "") + event.title),
          "LOCATION:" + escape(event.venue + ", " + event.address),
          "DESCRIPTION:" +
            escape(
              "Booking " +
                booking.code +
                (event.sample ? " — illustrative sample event only." : ""),
            ),
          "END:VEVENT",
          "END:VCALENDAR",
          "",
        ].join("\r\n");
        return new Response(ics, {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'attachment; filename="evently-event.ics"',
            "Cache-Control": "private, no-store",
          },
        });
      }
    }
    if (route === "organizer" && method === "GET")
      return json(await organizerData(user.id));
    if (route === "organizer/demo-guest" && method === "POST") {
      await takeRateLimit("demo-guest:" + user.id, 30, 3600000);
      const input = await body(request);
      return json({ guest: await addDemoGuest(textField(input.eventId, "Event"), user.id) }, 201);
    }
    if (route === "organizer/demo-feedback" && method === "POST") {
      await takeRateLimit("demo-feedback:" + user.id, 10, 3600000);
      const input = await body(request);
      await saveDemoFeedback(user.id, textField(input.feedback, "Feedback", 10, 3000));
      return json({ ok: true }, 201);
    }
    if (route === "organizer/check-in" && method === "POST") {
      await takeRateLimit("checkin:" + user.id, 100);
      const input = await body(request);
      const organizerProfileId = input.organizerProfileId
        ? textField(input.organizerProfileId, "Organizer profile")
        : undefined;
      if (
        organizerProfileId &&
        !(await getOwnedBusinessProfile(
          organizerProfileId,
          user.id,
          "organizer",
        ))
      )
        throw new AppError("Choose one of your organizer profiles.", 400);
      return json(
        await checkIn(
          textField(input.code, "Ticket code").toUpperCase(),
          user.id,
          organizerProfileId,
        ),
      );
    }
    if (route === "organizer/refund" && method === "POST") {
      const booking = await bookingById(
        textField((await body(request)).bookingId, "Booking"),
      );
      if (!booking || (await getEvent(booking.eventId))?.ownerId !== user.id)
        throw new AppError("Booking not found.", 404);
      const status = await refundBooking(booking);
      await deliverMessagesBestEffort(5);
      return json({ status });
    }
    throw new AppError("Not found.", 404);
  } catch (error) {
    if (error instanceof AppError)
      return json({ error: error.message }, error.status);
    if (error instanceof Stripe.errors.StripeError) {
      // Keep Stripe's full diagnostic on the server; never send key material to the browser.
      console.error("Evently Stripe request failed:", {
        route,
        type: error.type,
        code: error.code || null,
        param: error.param || null,
        statusCode: error.statusCode || null,
        requestId: error.requestId || null,
        message: error.message.replace(
          /\b(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9]+\b/g,
          "[redacted Stripe key]",
        ),
      });
      if (route === "stripe/connect" || route === "stripe/status") {
        const reason =
          error instanceof Stripe.errors.StripeAuthenticationError
            ? "Stripe rejected this deployment's API key. Check the key assigned to this Vercel environment."
            : error instanceof Stripe.errors.StripePermissionError
              ? "The Stripe key cannot access connected accounts. Check its Connect permissions and platform setup."
              : error instanceof Stripe.errors.StripeInvalidRequestError
                ? "Stripe rejected the connected-account request. Check your Connect setup and the Stripe request log."
                : "Stripe could not complete the connected-account request. Check the Stripe request log.";
        const detail = error.code ? ` Code: ${error.code}.` : "";
        const reference = error.requestId
          ? ` Stripe request: ${error.requestId}.`
          : "";
        return json({ error: reason + detail + reference }, 502);
      }
      return json(
        {
          error:
            "The payment service could not complete this request. Please try again, or check your Stripe configuration.",
        },
        502,
      );
    }
    const databaseError = error as {
      code?: string;
      table?: string;
      column?: string;
      constraint?: string;
    };
    console.error("Evently request failed:", {
      route,
      ...(checkoutStep ? { checkoutStep } : {}),
      type: error instanceof Error ? error.name : "Unknown error",
      message:
        error instanceof Error
          ? error.message.replace(
              /\b(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9]+\b/g,
              "[redacted Stripe key]",
            )
          : "Unknown error",
      code: databaseError?.code || null,
      table: databaseError?.table || null,
      column: databaseError?.column || null,
      constraint: databaseError?.constraint || null,
    });
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
