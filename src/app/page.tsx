import Link from "next/link";
import {
  FiArrowUpRight,
  FiArrowRight,
  FiCreditCard,
  FiLayout,
  FiUsers,
} from "react-icons/fi";
import EventCard from "@/components/EventCard";
import { CategoryIcon } from "@/components/CategoryIcon";
import EventCinema from "@/components/EventCinema";
import { categories } from "@/lib/catalog";
import { discoveryData } from "@/lib/db";

const organizerTools = [
  {
    label: "Branded event pages",
    description: "Present each experience with your own identity.",
    icon: FiLayout,
  },
  {
    label: "Secure ticket checkout",
    description: "Give guests a clear, protected way to book.",
    icon: FiCreditCard,
  },
  {
    label: "Live guest management",
    description: "Keep attendee details organized as bookings arrive.",
    icon: FiUsers,
  },
];

export default async function Home() {
  const events = (await discoveryData()).events;
  const featured = [
    ...events.filter((e) => !e.sample),
    ...events.filter((e) => e.sample),
  ].slice(0, 3);
  return (
    <main id="main" className="home-cinema">
      <EventCinema />
      <section className="featured-section">
        <div className="container section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FEATURED EXPERIENCES</span>
              <h2>Worth making time for.</h2>
            </div>
            <Link href="/events" className="text-link">
              Explore all events <FiArrowUpRight />
            </Link>
          </div>
          {featured.length ? (
            <div className="featured-grid" data-count={featured.length}>
              {featured.map((event, index) => (
                <EventCard
                  key={event.id}
                  event={event}
                  variant="compact"
                  sequence={index}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>Great experiences start with someone.</h3>
              <p>Be the first to bring people together.</p>
              <Link className="button button-primary" href="/create-event">
                Create an event
              </Link>
            </div>
          )}
          <p className="section-footnote">
            Sample listings let you explore Evently. They’re clearly marked, and
            sample bookings never charge you.
          </p>
        </div>
      </section>
      <section className="container section category-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">EXPLORE BY CATEGORY</span>
            <h2>Find the right experience.</h2>
          </div>
        </div>
        <div className="category-grid">
          {categories.map((c) => (
            <Link
              href={"/events?category=" + c.id}
              className="category-card"
              key={c.id}
            >
              <span className={"category-icon " + c.color}>
                <CategoryIcon id={c.id} />
              </span>
              <span className="category-copy">
                <strong>{c.name}</strong>
                <span>{c.label}</span>
              </span>
              <FiArrowUpRight className="category-arrow" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
      <section className="container section">
        <div className="personal-banner">
          <div className="personal-art" aria-hidden="true">
            <span>✳</span>
            <span>✦</span>
            <span>✹</span>
          </div>
          <div>
            <span className="eyebrow">PERSONALIZED DISCOVERY</span>
            <h2>A more relevant way to discover.</h2>
            <p>
              Set a few interests and save what catches your eye. Evently will
              bring related experiences together in one useful shortlist.
            </p>
            <Link href="/for-you" className="button button-dark">
              View recommendations <FiArrowRight />
            </Link>
          </div>
        </div>
      </section>
      <section className="container organizer-banner">
        <div className="organizer-intro">
          <span className="eyebrow organizer-label">
            <span className="organizer-label-dot" aria-hidden="true" />
            BUILT FOR ORGANIZERS
          </span>
          <h2>A smoother way to run events.</h2>
          <p>
            Give your team one place to prepare an event and keep plans moving
            through event day.
          </p>
          <Link className="button button-primary" href="/create-event">
            Start organizing <FiArrowUpRight />
          </Link>
        </div>
        <ul className="organizer-points" aria-label="Organizer tools">
          {organizerTools.map(({ label, description, icon: Icon }) => (
            <li key={label}>
              <span className="organizer-tool-icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="organizer-tool-copy">
                <strong>{label}</strong>
                <span>{description}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
