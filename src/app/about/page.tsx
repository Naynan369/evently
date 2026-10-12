import Link from "next/link";
import Image from "next/image";
import { FiArrowRight } from "react-icons/fi";
export const metadata = { title: "About Evently" };
export default function About() {
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <span className="eyebrow">A LITTLE LESS SCROLLING</span>
        <h1>Life is better when you’re there.</h1>
      </div>
      <div className="about-hero">
        <div className="about-copy">
          <h2>Make room for the good stuff.</h2>
          <p>
            Evently is a place for people who want to experience more. The
            intimate gig. The conversation that opens a door. The morning
            outside that turns your whole week around.
          </p>
          <p>
            Find events by your interests, save the ones that catch your eye and
            keep every ticket together. If you have an idea of your own, create
            an event and bring your people with you.
          </p>
          <p>
            We’re building around a simple belief: the best things in life
            usually involve showing up.
          </p>
          <Link
            href="/events"
            className="button button-primary"
            style={{ marginTop: 25 }}
          >
            Find your next good story <FiArrowRight />
          </Link>
        </div>
        <div className="about-photo">
          <Image
            src="/images/community.jpg"
            alt="People connecting over coffee"
            fill
            sizes="(max-width: 760px) 90vw, 45vw"
          />
        </div>
      </div>
      <div className="notice section-spacer">
        <strong>Exploring the first edition?</strong> The initial collection
        includes clearly marked sample events. They are illustrative listings,
        and sample tickets never charge you or grant real-world admission. New
        events published by organizers are separate from this sample collection.
      </div>
    </main>
  );
}
