import Link from "next/link";
export const metadata = { title: "Your music & privacy" };
export default function MusicPrivacy() {
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <span className="eyebrow">YOUR MUSIC. YOUR CONTROL.</span>
        <h1>
          Good matches.
          <br />
          Clear choices.
        </h1>
        <p>
          Connecting music is optional. You can always choose artists and genres
          yourself.
        </p>
      </div>
      <div className="panel prose-panel">
        <h2>Spotify connection testing</h2>
        <p>
          During a local Spotify connection test, Evently reads your account
          identifier and shows playlist names, links and track counts. Playlist
          details are not saved. No songs are imported or used for event
          recommendations in this mode. Encrypted connection credentials and
          your Spotify account identifier remain until you disconnect.
        </p>
        <h2>What you share</h2>
        <p>
          For services with event recommendations enabled, Evently asks for
          permission to read your playlists. You choose up to five playlists to
          use. We read up to 500 songs, then retain artist and available genre
          counts, playlist names and links, and the date of your update. We
          don’t keep a copy of song audio or use your library to train an AI
          model.
        </p>
        <h2>How recommendations work</h2>
        <p>
          We compare artist names with the lineup supplied by an event’s
          organizer, then consider matching genres, your selected interests,
          saved categories and upcoming availability. Artist matches carry more
          weight than broad genres. Reasons describe actual matching
          information; they are not predictions or guarantees. Choose one music
          source at a time in For you.
        </p>
        <h2>Storage and removal</h2>
        <p>
          Connection credentials are encrypted on the server. Imported
          preferences expire after 30 days; refresh your selections to keep
          recommendations current. Credentials remain until you disconnect;
          rejected authorizations are removed when you next use the connection.
          Disconnecting removes that connection and its imported data from
          Evently. To withdraw the provider’s permission too, use your Spotify
          account’s Apps page or Apple Music’s account permissions. Event
          organizers do not receive your music preferences.
        </p>
        <h2>A few practical details</h2>
        <p>
          A valid Apple Music subscription and authorization may be required. A
          configured Spotify app can be tested locally with its allowed test
          users. Spotify event recommendations are enabled separately after
          approval for that use. Readable playlists depend on the provider’s
          permissions. Music services are independent of Evently; connecting an
          account doesn’t imply endorsement of an event.
        </p>
        <Link href="/music" className="button button-primary">
          Manage my music connections →
        </Link>
      </div>
    </main>
  );
}
