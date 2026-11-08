import Stripe from "stripe";
import { AppError } from "./security.ts";
import {
  attachCheckout,
  bookingById,
  confirmPayment,
  expireBooking,
  saveBusinessProfileStripeAccount,
  updateBusinessProfile,
  run,
} from "./db.ts";
import type { Booking, BusinessProfile, Event, User } from "./types.ts";
import { organizerDemoMode } from "./demo.ts";

export function paymentConfigured() {
  return Boolean(
    !organizerDemoMode() &&
    process.env.STRIPE_SECRET_KEY &&
    process.env.APP_URL,
  );
}
export function appUrl() {
  const value = process.env.APP_URL || "http://localhost:3000";
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol))
    throw new AppError("Invalid application URL.", 503);
  if (
    process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") &&
    url.protocol !== "https:"
  )
    throw new AppError("Live payments require HTTPS.", 503);
  return url.origin;
}
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new AppError(
      "Payments are not connected yet. The platform owner needs to finish Stripe setup.",
      503,
    );
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2,
    timeout: 20000,
  });
}
export async function accountStatus(
  user: User,
  profile?: BusinessProfile,
) {
  if (!paymentConfigured())
    return { configured: false, connected: false, ready: false };
  const stripeAccount = profile ? profile.stripeAccount : user.stripeAccount;
  if (!stripeAccount)
    return { configured: true, connected: false, ready: false };
  const account = await stripe().accounts.retrieve(stripeAccount);
  return {
    configured: true,
    connected: true,
    ready: Boolean(account.charges_enabled && account.payouts_enabled),
    detailsSubmitted: account.details_submitted,
  };
}
export async function connectAccount(
  user: User,
  country: string,
  selectedProfile?: BusinessProfile,
) {
  if (!paymentConfigured())
    throw new AppError(
      "Stripe setup is required before connecting an organizer account.",
      503,
    );
  if (
    !["GB", "US", "IT", "DE", "FR", "ES", "NL", "IE", "CA", "AU"].includes(
      country,
    )
  )
    throw new AppError("Choose a supported country.");
  const client = stripe();
  let profile = selectedProfile;
  if (profile && !profile.stripeAccount) {
    profile = await updateBusinessProfile(profile.id, user.id, {
      kind: profile.kind,
      name: profile.name,
      countryCode: country,
    });
  }
  let accountId = profile ? profile.stripeAccount : user.stripeAccount;
  if (!accountId) {
    const account = await client.accounts.create(
      {
        country,
        email: user.email,
        metadata: {
          evently_user_id: user.id,
          ...(profile ? { evently_business_profile_id: profile.id } : {}),
        },
        controller: {
          stripe_dashboard: { type: "full" },
          fees: { payer: "account" },
          losses: { payments: "stripe" },
          requirement_collection: "stripe",
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      },
      {
        idempotencyKey:
          "evently-account-" + user.id + (profile ? "-" + profile.id : ""),
      },
    );
    accountId = account.id;
    if (profile)
      await saveBusinessProfileStripeAccount(profile.id, user.id, accountId);
    else
      await run("UPDATE users SET stripe_account=? WHERE id=?", accountId, user.id);
  }
  return client.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: appUrl() + "/organizer?connect=refresh",
    return_url: appUrl() + "/organizer?connect=returned",
  });
}
export async function startCheckout(
  booking: Booking,
  event: Event,
  user: User,
) {
  if (!paymentConfigured())
    throw new AppError("Payments are not connected yet.", 503);
  if (booking.status !== "pending")
    return { bookingId: booking.id, url: "/tickets/" + booking.id };
  if (!booking.stripeAccount)
    throw new AppError("The organizer has not connected payouts yet.", 409);
  if (booking.sessionId) {
    const session = await stripe().checkout.sessions.retrieve(
      booking.sessionId,
      {},
      { stripeAccount: booking.stripeAccount },
    );
    if (session.payment_status === "paid") {
      await confirmPayment(session, booking.stripeAccount);
      return { bookingId: booking.id, url: "/tickets/" + booking.id };
    }
    if (session.status === "expired") {
      await expireBooking(session.id, booking.id);
      throw new AppError("This checkout expired. Start a new booking.", 409);
    }
    if (session.url) return { bookingId: booking.id, url: session.url };
    throw new AppError(
      "Your payment is processing. Check My tickets for its status.",
      409,
    );
  }
  if (booking.expiresAt < Date.now() / 1000 + 1800)
    throw new AppError(
      "This checkout needs reconciliation. Please contact the organizer; no new charge was created.",
      409,
    );
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email,
      client_reference_id: booking.id,
      metadata: { booking_id: booking.id },
      payment_intent_data: { metadata: { booking_id: booking.id } },
      line_items: [
        {
          quantity: booking.quantity,
          price_data: {
            currency: booking.currency,
            unit_amount: Math.round(booking.total / booking.quantity),
            product_data: {
              name:
                event.title +
                " — " +
                (booking.ticketType === "vip" ? "VIP" : "Standard"),
              description:
                (booking.ticketType === "vip"
                  ? "VIP admission"
                  : "Standard admission") +
                " • " +
                event.venue,
            },
          },
        },
      ],
      expires_at: booking.expiresAt,
      success_url: appUrl() + "/tickets/" + booking.id + "?checkout=success",
      cancel_url: appUrl() + "/tickets/" + booking.id + "?checkout=cancelled",
    },
    {
      stripeAccount: booking.stripeAccount,
      idempotencyKey: "evently-checkout-" + booking.id,
    },
  );
  await attachCheckout(booking.id, session.id, session.url);
  if (!session.url)
    throw new AppError("Checkout is unavailable. Please try again.", 502);
  return { bookingId: booking.id, url: session.url };
}
export async function reconcileBooking(booking: Booking) {
  if (
    booking.status !== "pending" ||
    !booking.sessionId ||
    !booking.stripeAccount ||
    !paymentConfigured()
  )
    return booking;
  const session = await stripe().checkout.sessions.retrieve(
    booking.sessionId,
    {},
    { stripeAccount: booking.stripeAccount },
  );
  if (session.payment_status === "paid")
    await confirmPayment(session, booking.stripeAccount);
  else if (session.status === "expired") await expireBooking(session.id, booking.id);
  return (await bookingById(booking.id))!;
}
export async function cancelCheckout(booking: Booking) {
  if (booking.status !== "pending")
    throw new AppError("This booking is no longer awaiting payment.", 409);
  if (!booking.sessionId || !booking.stripeAccount)
    throw new AppError(
      "Checkout is still being established. Retry shortly.",
      409,
    );
  const session = await stripe().checkout.sessions.expire(
    booking.sessionId,
    {},
    { stripeAccount: booking.stripeAccount },
  );
  if (session.status === "expired") await expireBooking(session.id, booking.id);
}
export async function refundBooking(booking: Booking) {
  if (
    booking.mode !== "stripe" ||
    booking.status !== "confirmed" ||
    !booking.sessionId ||
    !booking.stripeAccount
  )
    throw new AppError("This booking cannot be refunded.", 409);
  const client = stripe();
  const session = await client.checkout.sessions.retrieve(
    booking.sessionId,
    {},
    { stripeAccount: booking.stripeAccount },
  );
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntent)
    throw new AppError("The payment could not be found.", 409);
  const refund = await client.refunds.create(
    { payment_intent: paymentIntent },
    {
      stripeAccount: booking.stripeAccount,
      idempotencyKey: "evently-refund-" + booking.id,
    },
  );
  if (refund.status === "succeeded")
    await run("UPDATE bookings SET status='refunded' WHERE id=?", booking.id);
  return refund.status;
}
