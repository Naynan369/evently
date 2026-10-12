import Link from "next/link";
import { Brand } from "./Brand";
import { FiArrowUpRight } from "react-icons/fi";
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <Brand light />
          <p>
            Less scrolling.
            <br />
            More being there.
          </p>
        </div>
        <div className="footer-links">
          <div>
            <span>Discover</span>
            <Link href="/events">Explore events</Link>
            <Link href="/for-you">Recommendations</Link>
            <Link href="/music">Music preferences</Link>
            <Link href="/categories">Browse categories</Link>
          </div>
          <div>
            <span>Your account</span>
            <Link href="/tickets">Tickets & bookings</Link>
            <Link href="/saved">Saved events</Link>
            <Link href="/account">Account overview</Link>
          </div>
          <div>
            <span>Organizers</span>
            <Link href="/create-event">Create an event</Link>
            <Link href="/organizer">Organizer dashboard</Link>
          </div>
          <div>
            <span>Support</span>
            <Link href="/about">
              About Evently <FiArrowUpRight />
            </Link>
            <Link href="/help">Help center</Link>
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} Evently. Make room for real life.
        </span>
        <span>
          Made for moments that matter <span aria-hidden="true">✳</span>
        </span>
      </div>
    </footer>
  );
}
