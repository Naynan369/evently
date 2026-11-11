import { organizerDemoMode } from "./demo.ts";

// A Stripe test key enables a payment-flow preview, including on Vercel previews.
// This is not a tax determination or an Italian fiscal ticketing integration.
export function ticketPreviewEnabled() {
  return (
    !organizerDemoMode() &&
    /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY || "")
  );
}

export function previewVatPercent() {
  if (!ticketPreviewEnabled()) return 0;
  const value = Number(process.env.EVENTLY_TEST_TICKET_VAT_PERCENT || "10");
  if (!Number.isInteger(value) || value < 1 || value > 30)
    throw new Error(
      "EVENTLY_TEST_TICKET_VAT_PERCENT must be a whole number from 1 to 30.",
    );
  return value;
}

export function previewIncludedVat(grossCents: number, percent: number) {
  return Math.round((grossCents * percent) / (100 + percent));
}

export function previewTicketReferences(bookingId: string, quantity: number) {
  return Array.from(
    { length: quantity },
    (_, index) => `PREVIEW-${bookingId.toUpperCase()}-${index + 1}`,
  );
}
