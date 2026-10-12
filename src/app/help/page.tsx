import Link from "next/link";
export const metadata = { title: "Help & questions" };
export default function Help() {
  const questions = [
    [
      "How do I find events I’ll enjoy?",
      "Browse Discover to search by name or city, then filter by category, price or date. On For you, select your interests to get recommendations. Saving events also helps shape the suggestions.",
    ],
    [
      "How do I get my tickets?",
      "Create an account or sign in, open an event and choose your ticket quantity. Free and sample bookings are confirmed immediately. Paid bookings go through Stripe’s secure checkout and are confirmed only after payment is verified. Find every booking in My tickets.",
    ],
    [
      "Are the sample events real?",
      "No. Listings marked Sample event are examples so you can explore the platform. Their sample prices are illustrative, and trying a sample booking never charges you. A sample ticket does not admit you to a real event.",
    ],
    [
      "What happens if I leave a paid checkout?",
      "The booking stays pending while Stripe holds your checkout open. You can resume or cancel it from My tickets. An expired checkout releases its places after Stripe confirms expiration. Payment delays do not cause Evently to issue an unverified ticket.",
    ],
    [
      "How do refunds and cancellations work?",
      "You can cancel a free or sample reservation before the event begins, provided it hasn’t been checked in. For a paid booking, open your ticket and choose Request a refund. The request appears in the organizer’s guest list for review. Your ticket stays valid until the organizer issues a refund. Check the event description for refund terms.",
    ],
    [
      "How do I create a paid event?",
      "Open Organizer studio and connect your Stripe account. Finish Stripe’s identity and payout setup. Once the account can accept payments and payouts, you can publish an event with a paid ticket. The platform’s Stripe integration must also be configured. You can publish free events without Stripe.",
    ],
    [
      "How does check-in work?",
      "Each confirmed booking has one unique QR code and ticket code for the entire group. The organizer enters that code in their studio to admit the group. A code can be used only once, and another organizer cannot check in your event’s tickets.",
    ],
    [
      "What information is stored?",
      "Evently stores your profile, selected interests, saved events and booking records in its application database. Passwords are stored as salted hashes. Stripe handles card details, which are never stored by Evently. Event organizers can see the names and emails of people who booked their events.",
    ],
    [
      "Can I recover a forgotten password?",
      "Automated password recovery is not configured in this edition. A verified email delivery service is needed before recovery emails can be enabled. Keep your password in a password manager and stay signed in on a trusted device.",
    ],
  ];
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <span className="eyebrow">A LITTLE HELP ALONG THE WAY</span>
        <h1>Good questions. Clear answers.</h1>
        <p>Everything you need to discover, book and bring people together.</p>
      </div>
      {questions.map(([q, a]) => (
        <details className="faq" key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
      <div className="notice section-spacer">
        Your plans are always in <Link href="/tickets">My tickets</Link>.
        Creating something of your own? Head to{" "}
        <Link href="/organizer">Organizer studio</Link>.
      </div>
    </main>
  );
}
