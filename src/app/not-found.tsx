import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="container section page-main">
      <div className="empty-state">
        <span className="eyebrow">A SMALL DETOUR</span>
        <h1 style={{ marginTop: 15 }}>This one got away.</h1>
        <p>
          We couldn’t find that page or event. There are plenty of other good
          things waiting for you.
        </p>
        <Link href="/events" className="button button-primary">
          Discover events
        </Link>
      </div>
    </main>
  );
}
