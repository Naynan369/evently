import Link from "next/link";
import { redirect } from "next/navigation";
import { FiArrowUpRight } from "react-icons/fi";
import { currentUser } from "@/lib/auth";
import { categoryName } from "@/lib/catalog";
import AccountActions from "@/components/AccountActions";
export const metadata = { title: "Your account" };
export default async function Account() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <span className="eyebrow">YOUR LITTLE CORNER OF EVENTLY</span>
        <h1>Hey, {user.name.split(" ")[0]}.</h1>
        <p>Good to have you here. Keep your plans and preferences together.</p>
      </div>
      <div className="account-grid">
        <div className="panel">
          <h2>Your profile</h2>
          <div className="summary-row">
            <span>Name</span>
            <strong>{user.name}</strong>
          </div>
          <div className="summary-row">
            <span>Email</span>
            <strong style={{ overflowWrap: "anywhere" }}>{user.email}</strong>
          </div>
          <div className="notice">
            <strong>
              Email {user.emailVerified ? "verified ✓" : "not yet verified"}
            </strong>
            {!user.emailVerified && (
              <p>
                <Link href="/verify-email">Verify your email address</Link>
              </p>
            )}
          </div>
          <div className="notice">
            <strong>Your interests</strong>
            <br />
            {user.interests.length
              ? user.interests.map(categoryName).join(" · ")
              : "You haven’t picked any interests yet."}
            <br />
            <Link href="/for-you">Fine-tune your recommendations</Link>
          </div>
          <AccountActions />
        </div>
        <div className="panel">
          <h2>Where to next?</h2>
          <div className="account-links">
            {[
              ["/tickets", "Your tickets & bookings"],
              ["/saved", "Saved experiences"],
              ["/for-you", "Your recommendations"],
              ["/music", "Your music connections"],
              ["/forgot-password", "Reset your password"],
              ["/organizer", "Organizer studio"],
              ["/help", "Help & questions"],
            ].map(([href, label]) => (
              <Link href={href} key={href}>
                {label}
                <FiArrowUpRight />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
