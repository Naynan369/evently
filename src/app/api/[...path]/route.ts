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
  listEvents,
  getEvent,
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
import { musicApi } from "@/lib/music-api";
import { eventIsPrivate, organizerDemoMode } from "@/lib/demo";

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
    if (session.metadata?.booking_id) await confirmPayment(session, event.account);
  } else if (
    event.type === "checkout.session.expired" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    const session = event.data.object;
    const booking = session.client_reference_id
      ? await bookingById(session.client_reference_id)
      : undefined;
    if (booking && booking.stripeAccount === event.account)
      await expireBooking(session.id, booking.id);
  } else if (event.type === "charge.refunded") {
    const charge = event.data.object;
    const booking = charge.metadata?.booking_id
      ? await bookingById(charge.metadata.booking_id)
      : undefined;
    if (
      booking &&
      booking.stripeAccount === event.account &&
      charge.refunded &&
      charge.amount_refunded >= booking.total
    )
      await run(
        "UPDATE bookings SET status='refunded' WHERE id=? AND status='confirmed'",
        booking.id,
      );
  }
  return json({ received: true });
}
async function handle(request: Request, context: Context) {
  try {
    const { path } = await context.params;
    const route = path.join("/");
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
      const user = publicUser(row)!;
      await createSession(user.id);
      return json({ user, saved: await savedIds(user.id) });
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
      const profileId = new URL(request.url).searchParams.get("profileId");
      const profile = profileId
        ? await getOwnedBusinessProfile(profileId, user.id, "organizer")
        : null;
      if (profileId && !profile)
        throw new AppError("Choose one of your organizer profiles.", 400);
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
        !(await accountStatus(user, organizerProfile)).ready
      )
        throw new AppError(
          "Connect and activate your Stripe account in Organizer studio before publishing paid tickets.",
          409,
        );
      return json({ event: await createEvent(input, user, organizerProfile) }, 201);
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
      if (
        !organizerDemoMode() &&
        ((updated.price > 0 &&
          updated.capacity > (updated.vipCapacity || 0)) ||
          (updated.vipCapacity && (updated.vipPrice || 0) > 0)) &&
        !(await accountStatus(user, organizerProfile)).ready
      )
        throw new AppError(
          "Activate Stripe before publishing paid tickets.",
          409,
        );
      const event = await transaction(async () => {
        await one<{ id: string }>(
          "SELECT id FROM events WHERE id=? FOR UPDATE",
          original.id,
        );
        const reserved = await one<{
          n: number;
          standard: number;
          vip: number;
        }>(
          "SELECT COALESCE(SUM(quantity),0) AS n, COALESCE(SUM(quantity) FILTER (WHERE ticket_type='standard'),0) AS standard, COALESCE(SUM(quantity) FILTER (WHERE ticket_type='vip'),0) AS vip FROM bookings WHERE event_id=? AND status IN ('pending','confirmed')",
          original.id,
        );
        const reservedTotal = reserved?.n || 0;
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
          id: original.id,
          slug: original.slug,
          visibility: original.visibility,
        };
        await run(
          "UPDATE events SET data=? WHERE id=?",
          JSON.stringify(value),
          original.id,
        );
        return value;
      });
      return json({ event });
    }
    if (route === "checkout" && method === "POST") {
      await takeRateLimit("checkout:" + user.id, 30);
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
          !(await accountStatus(owner, organizerProfile || undefined)).ready
        )
          throw new AppError(
            "The organizer has not activated payments yet.",
            409,
          );
        const expired = await all<{ id: string }>(
          "SELECT id FROM bookings WHERE event_id=? AND status='pending' AND session_id IS NOT NULL AND expires_at<? LIMIT 10",
          event.id,
          Date.now() / 1000,
        );
        await Promise.all(
          expired.map(async (b) =>
            reconcileBooking((await bookingById(b.id))!),
          ),
        );
      }
      const booking = await reserveBooking(
        user.id,
        event.id,
        input.quantity as number,
        textField(input.requestKey, "Request"),
        requestedTicketType,
      );
      if (
        booking.status === "cancelled" ||
        booking.status === "expired" ||
        booking.status === "refunded"
      )
        throw new AppError("This booking has ended. Start a new booking.", 409);
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
        return json({ booking, event });
      }
      if (path[2] === "cancel" && method === "POST") {
        if (booking.mode === "stripe") await cancelCheckout(booking);
        else await cancelFreeBooking(booking.id, user.id);
        return json({ ok: true });
      }
      if (path[2] === "resume" && method === "POST")
        return json(await startCheckout(booking, event, user));
      if (path[2] === "refund-request" && method === "POST")
        return json({ booking: await requestRefund(booking.id, user.id) });
      if (booking.status !== "confirmed")
        throw new AppError("Your ticket is available after confirmation.", 409);
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
      return json({ status: await refundBooking(booking) });
    }
    throw new AppError("Not found.", 404);
  } catch (error) {
    if (error instanceof AppError)
      return json({ error: error.message }, error.status);
    if (error instanceof Stripe.errors.StripeError)
      return json(
        {
          error:
            "The payment service could not complete this request. Please try again, or check your Stripe configuration.",
        },
        502,
      );
    console.error(
      "Evently request failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
