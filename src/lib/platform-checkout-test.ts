import type { Booking } from "./types.ts";

// Stored on a booking so its Stripe account cannot change when the preview flag changes.
export const PLATFORM_TEST_ACCOUNT = "evently_platform_test";

export function platformCheckoutTestEnabled(env: NodeJS.ProcessEnv = process.env) {
  const key = env.STRIPE_SECRET_KEY || "";
  const previewDeployment =
    env.NODE_ENV === "development" ||
    env.NODE_ENV === "test" ||
    env.VERCEL_ENV === "preview";
  return (
    previewDeployment &&
    env.EVENTLY_PLATFORM_CHECKOUT_TEST === "true" &&
    /^(sk|rk)_test_/.test(key) &&
    Boolean(env.APP_URL) &&
    env.EVENTLY_ORGANIZER_DEMO !== "true"
  );
}

export function isPlatformTestBooking(booking: Pick<Booking, "stripeAccount">) {
  return booking.stripeAccount === PLATFORM_TEST_ACCOUNT;
}

export function paymentAccountFromWebhook(
  connectedAccount: string | undefined,
  liveMode: boolean,
  paymentScope?: string,
) {
  if (connectedAccount) return connectedAccount;
  return !liveMode && paymentScope === PLATFORM_TEST_ACCOUNT
    ? PLATFORM_TEST_ACCOUNT
    : undefined;
}
