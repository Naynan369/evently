"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="container section page-main">
      <div className="empty-state">
        <h1>A little pause in the plans.</h1>
        <p>Something didn’t load correctly. Give it another try.</p>
        <button className="button button-primary" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
