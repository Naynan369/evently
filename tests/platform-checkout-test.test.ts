import test from "node:test";
import assert from "node:assert/strict";
import {
  isPlatformTestBooking,
  paymentAccountFromWebhook,
  PLATFORM_TEST_ACCOUNT,
  platformCheckoutTestEnabled,
} from "../src/lib/platform-checkout-test.ts";

test("platform checkout runs only in an explicit Stripe test preview", () => {
  const preview: NodeJS.ProcessEnv = {
    STRIPE_SECRET_KEY: "sk_test_fixture",
    APP_URL: "https://preview.example.test",
    EVENTLY_PLATFORM_CHECKOUT_TEST: "true",
    EVENTLY_ORGANIZER_DEMO: "false",
    NODE_ENV: "production",
    VERCEL_ENV: "preview",
  };
  assert.equal(platformCheckoutTestEnabled(preview), true);
  assert.equal(
    platformCheckoutTestEnabled({ ...preview, STRIPE_SECRET_KEY: "sk_live_fixture" }),
    false,
  );
  assert.equal(
    platformCheckoutTestEnabled({ ...preview, VERCEL_ENV: "production" }),
    false,
  );
  assert.equal(
    platformCheckoutTestEnabled({ ...preview, EVENTLY_ORGANIZER_DEMO: "true" }),
    false,
  );
});

test("platform test payments resolve only from non-live platform webhooks", () => {
  assert.equal(isPlatformTestBooking({ stripeAccount: PLATFORM_TEST_ACCOUNT }), true);
  assert.equal(isPlatformTestBooking({ stripeAccount: "acct_organizer" }), false);
  assert.equal(
    paymentAccountFromWebhook(undefined, false, PLATFORM_TEST_ACCOUNT),
    PLATFORM_TEST_ACCOUNT,
  );
  assert.equal(paymentAccountFromWebhook(undefined, true, PLATFORM_TEST_ACCOUNT), undefined);
  assert.equal(paymentAccountFromWebhook(undefined, false, undefined), undefined);
  assert.equal(
    paymentAccountFromWebhook("acct_organizer", false, PLATFORM_TEST_ACCOUNT),
    "acct_organizer",
  );
});
