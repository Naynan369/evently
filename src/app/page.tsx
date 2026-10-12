import Link from "next/link";
import { FiArrowUpRight, FiArrowRight, FiCheck } from "react-icons/fi";
import EventCard from "@/components/EventCard";
import { CategoryIcon } from "@/components/CategoryIcon";
import EventCinema from "@/components/EventCinema";
import { categories } from "@/lib/catalog";
import { discoveryData } from "@/lib/db";
export default function Home() {
  const events = discoveryData().events;
  const featured = [
    ...events.filter((e) => !e.sample),
    ...events.filter((e) =>
      ["sample-1", "sample-2", "sample-3"].includes(e.id),
    ),
  ].slice(0, 3);
  return (
    <main id="main" className="home-cinema">
      <EventCinema />
      <section className="featured-section">
        <div className="container section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                PUT SOMETHING GOOD ON THE CALENDAR
              </span>
              <h2>Worth showing up for.</h2>
            </div>
            <Link href="/events" className="text-link">
              Explore all events <FiArrowUpRight />
            </Link>
          </div>
          {featured.length ? (
            <div className="featured-grid">
              {featured.map((event, index) => (
                <EventCard
                  key={event.id}
                  event={event}
                  variant={index === 0 ? "featured" : "compact"}
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
            <span className="eyebrow">FOLLOW YOUR CURIOSITY</span>
            <h2>What’s your kind of good time?</h2>
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
            <span className="eyebrow">A LITTLE MORE YOU</span>
            <h2>Your interests. Your next adventure.</h2>
            <p>
              Tell us what you love. We’ll connect the dots between your
              interests, saved events and something you might just love next.
            </p>
            <Link href="/for-you" className="button button-dark">
              Find my kind of events <FiArrowRight />
            </Link>
          </div>
        </div>
      </section>
      <section className="container organizer-banner">
        <div>
          <span className="eyebrow">BRING YOUR IDEA TO LIFE</span>
          <h2>
            Good things happen
            <br />
            when you bring people together.
          </h2>
          <p>
            Create your event, sell tickets and welcome your community.
            <br />
            We’ll help with the details.
          </p>
          <Link className="button button-primary" href="/create-event">
            Let’s make it happen <FiArrowUpRight />
          </Link>
        </div>
        <div className="organizer-points">
          {[
            "A beautiful page for your event",
            "Secure checkout with Stripe",
            "Your guest list, all in one place",
          ].map((text, i) => (
            <div key={text}>
              <span>0{i + 1}</span>
              <strong>{text}</strong>
              <FiCheck />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
