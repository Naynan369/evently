import type { Booking } from "./types.ts";

// Stored on a booking so its Stripe account cannot change when the preview flag changes.
export const PLATFORM_TEST_ACCOUNT = "evently_platform_test";

export function platformCheckoutTestReadiness(env: NodeJS.ProcessEnv = process.env) {
  const key = env.STRIPE_SECRET_KEY || "";
  const flagEnabled = env.EVENTLY_PLATFORM_CHECKOUT_TEST === "true";
  const testKey = /^(sk|rk)_test_/.test(key);
  const appUrlSet = Boolean(env.APP_URL);
  const organizerDemoOff = env.EVENTLY_ORGANIZER_DEMO !== "true";
  return {
    flagEnabled,
    testKey,
    appUrlSet,
    organizerDemoOff,
    enabled: flagEnabled && testKey && appUrlSet && organizerDemoOff,
  };
}

export function platformCheckoutTestEnabled(env: NodeJS.ProcessEnv = process.env) {
  return platformCheckoutTestReadiness(env).enabled;
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
