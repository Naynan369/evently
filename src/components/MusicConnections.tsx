"use client";
import { useState, useRef, type FormEvent } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaSpotify, FaApple } from "react-icons/fa";
import {
  FiArrowUpRight,
  FiHeadphones,
  FiCheck,
  FiX,
  FiRefreshCw,
  FiShield,
} from "react-icons/fi";
import { api } from "@/lib/client";
import { useApp } from "./AppProvider";
import {
  musicGenres,
  musicProviderName,
  type MusicProvider,
  type MusicStatus,
  type MusicPlaylist,
} from "@/lib/music-types";
type MusicKitInstance = {
  authorize: () => Promise<string>;
  unauthorize: () => Promise<void>;
};
declare global {
  interface Window {
    MusicKit?: {
      configure: (options: {
        developerToken: string;
        app: { name: string; build: string };
      }) => Promise<MusicKitInstance>;
      getInstance: () => MusicKitInstance;
    };
  }
}
export default function MusicConnections({
  initial,
  connectionResult,
}: {
  initial: MusicStatus;
  connectionResult?: string;
}) {
  const { user, toast } = useApp(),
    router = useRouter();
  const [status, setStatus] = useState(initial),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const [consent, setConsent] = useState<MusicProvider | null>(null),
    [accepted, setAccepted] = useState(false);
  const [appleToken, setAppleToken] = useState(""),
    [appleReady, setAppleReady] = useState(false);
  const kit = useRef<MusicKitInstance | null>(null);
  const [choosing, setChoosing] = useState<MusicProvider | null>(null),
    [playlists, setPlaylists] = useState<MusicPlaylist[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [next, setNext] = useState<number | null>(null);
  const manual = initial.profiles.find((p) => p.source === "manual");
  const [artists, setArtists] = useState(
    manual?.artists.map((a) => a.name).join(", ") || "",
  );
  const [genres, setGenres] = useState<string[]>(
    manual?.genres.map((g) => g.name) || [],
  );
  async function attempt(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function update(data: MusicStatus) {
    setStatus(data);
    router.refresh();
  }
  async function connect() {
    if (!accepted || !consent) return;
    await attempt("connect", async () => {
      if (consent === "spotify") {
        const data = await api<{ url: string }>("music/spotify/connect", {
          method: "POST",
          body: { consent: true },
        });
        const url = new URL(data.url);
        if (url.origin !== "https://accounts.spotify.com")
          throw new Error("Unexpected authorization destination.");
        window.location.assign(data.url);
      } else if (!appleToken) {
        const data = await api<{ developerToken: string }>(
          "music/apple/config",
          { method: "POST", body: { consent: true } },
        );
        setAppleToken(data.developerToken);
      } else {
        if (!kit.current)
          throw new Error(
            "Apple Music is still loading. Try again in a moment.",
          );
        const token = await kit.current.authorize();
        update(
          await api<MusicStatus>("music/apple/connect", {
            method: "POST",
            body: { token, consent: true },
          }),
        );
        setConsent(null);
        toast("Apple Music connected. Choose the playlists you want to use.");
      }
    });
  }
  async function prepareApple() {
    try {
      if (!window.MusicKit)
        throw new Error("Apple Music couldn’t load. Please try again.");
      kit.current = await window.MusicKit.configure({
        developerToken: appleToken,
        app: { name: "Evently", build: "1.0" },
      });
      setAppleReady(true);
    } catch (e) {
      setError((e as Error).message);
      setAppleToken("");
      setAppleReady(false);
    }
  }
  async function load(provider: MusicProvider, offset = 0) {
    await attempt("playlists", async () => {
      const result = await api<{
        playlists: MusicPlaylist[];
        next: number | null;
      }>("music/" + provider + "/playlists?offset=" + offset);
      setChoosing(provider);
      setPlaylists((p) =>
        offset ? [...p, ...result.playlists] : result.playlists,
      );
      setNext(result.next);
      if (!offset)
        setSelected(
          status.profiles
            .find((p) => p.source === provider)
            ?.playlists.map((p) => p.id) || [],
        );
    });
  }
  async function sync() {
    if (!choosing) return;
    await attempt("sync", async () => {
      update(
        await api<MusicStatus>("music/" + choosing + "/sync", {
          method: "POST",
          body: { playlistIds: selected },
        }),
      );
      setChoosing(null);
      toast("Your music matches are ready.");
    });
  }
  async function manualSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await attempt("manual", async () => {
      update(
        await api<MusicStatus>("music/manual", {
          method: "PUT",
          body: { artists: data.get("artists"), genres },
        }),
      );
      toast("Your music preferences are saved.");
    });
  }
  const canConnect = Boolean(user?.emailVerified);
  const spotifyConnectionTest = status.providers.some(
    (p) => p.provider === "spotify" && p.status === "connection-test",
  );
  const consentConnectionTest = consent === "spotify" && spotifyConnectionTest;
  const choosingRecommendations = Boolean(
    status.providers.find((p) => p.provider === choosing)
      ?.recommendationsAvailable,
  );
  const PlaylistRow = choosingRecommendations ? "label" : "div";
  return (
    <div className="music-workspace">
      {connectionResult === "spotify" && (
        <div className="success-box" role="status">
          {spotifyConnectionTest
            ? "Spotify connected. View your playlists below to check access. Event recommendations are not enabled for this connection."
            : "Spotify connected. Choose the playlists you’d like to use below."}
        </div>
      )}
      {connectionResult === "cancelled" && (
        <div className="notice" role="status">
          You cancelled the connection. Your choices are always yours.
        </div>
      )}
      {connectionResult === "failed" && (
        <div className="error-box" role="alert">
          We couldn’t complete that music connection. Please try again.
        </div>
      )}
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {!canConnect && (
        <div className="notice">
          <Link href={user ? "/verify-email" : "/register?next=/music"}>
            {user ? "Verify your email" : "Create an account"}
          </Link>{" "}
          to save your music taste and connect playlists.
        </div>
      )}
      <div className="provider-grid">
        {status.providers.map((p) => {
          const profile = status.profiles.find(
            (profile) => profile.source === p.provider,
          );
          return (
            <section
              className={"provider-card provider-" + p.provider}
              key={p.provider}
            >
              <div className="provider-top">
                <span className="provider-icon">
                  {p.provider === "spotify" ? <FaSpotify /> : <FaApple />}
                </span>
                <span
                  className={
                    "connection-state" + (p.connected ? " connected" : "")
                  }
                >
                  {p.connected
                    ? "Connected"
                    : p.available
                      ? p.status === "connection-test"
                        ? "Connection test"
                        : "Ready to connect"
                      : "Unavailable"}
                </span>
              </div>
              <h2>{musicProviderName(p.provider)}</h2>
              <p>
                {p.status === "connection-test"
                  ? "Connect Spotify to check access to playlists you own or collaborate on."
                  : p.provider === "spotify"
                    ? "Bring the artists from playlists you own or collaborate on into your next night out."
                    : "Find live experiences inspired by the artists and genres in your Apple Music playlists."}
              </p>
              {p.available ? (
                <p className="provider-detail">
                  {p.status === "connection-test"
                    ? "Read-only connection test. Spotify event recommendations are not enabled. Disconnect whenever you like."
                    : "You choose the playlists. Read-only access. Disconnect whenever you like."}
                </p>
              ) : (
                <p className="provider-detail">
                  This connection is being prepared. Artist and genre selections
                  below are available now.
                </p>
              )}
              {profile && (
                <div className="music-summary">
                  <strong>{profile.trackCount} songs considered</strong>
                  <span>
                    {profile.playlists.length} playlists · Updated{" "}
                    {new Date(profile.updatedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      timeZone: "UTC",
                    })}
                  </span>
                  {profile.partial && (
                    <span>
                      First 500 readable songs. Some playlist content could not
                      be included.
                    </span>
                  )}
                </div>
              )}
              <div className="provider-actions">
                {p.connected ? (
                  <>
                    <button
                      disabled={Boolean(busy)}
                      className="button button-primary"
                      onClick={() => load(p.provider)}
                    >
                      <FiRefreshCw />{" "}
                      {p.recommendationsAvailable
                        ? "Choose playlists"
                        : "View playlists"}
                    </button>
                    <button
                      className="text-link"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        attempt("disconnect", async () => {
                          update(
                            await api<MusicStatus>("music/disconnect", {
                              method: "POST",
                              body: { provider: p.provider },
                            }),
                          );
                          if (p.provider === "apple" && kit.current)
                            await kit.current.unauthorize().catch(() => {});
                          toast(
                            "Connection and imported music preferences removed.",
                          );
                        })
                      }
                    >
                      Disconnect & remove data
                    </button>
                  </>
                ) : (
                  <button
                    className="button button-primary"
                    disabled={!p.available || !canConnect || Boolean(busy)}
                    onClick={() => {
                      setConsent(p.provider);
                      setAccepted(false);
                      setError("");
                    }}
                  >
                    Connect {musicProviderName(p.provider)} <FiArrowUpRight />
                  </button>
                )}
              </div>
              {profile && (
                <div className="playlist-sources">
                  <span>From {musicProviderName(p.provider)}</span>
                  {profile.playlists.map((p) => (
                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                      {p.name} ↗
                    </a>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
      {consent && (
        <section
          className="panel connection-consent"
          aria-labelledby="consent-heading"
        >
          <button
            className="icon-button close-consent"
            aria-label="Close music connection"
            onClick={() => setConsent(null)}
          >
            <FiX />
          </button>
          <span className="eyebrow">YOUR MUSIC. YOUR CHOICE.</span>
          <h2 id="consent-heading">Connect {musicProviderName(consent)}</h2>
          <p>
            {consentConnectionTest
              ? "Evently will read your Spotify account identifier and playlist names, links and track counts to test access. Connection credentials are encrypted. Playlist details are displayed here without saving them. Songs are not imported or used for event recommendations. You can disconnect and remove the connection at any time."
              : "Evently will read the playlists you select to match their artists and available genres with event lineups. Connection credentials are encrypted. Imported preferences are kept for up to 30 days. We never change playlists or play your music."}
          </p>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />{" "}
            {consentConnectionTest
              ? "I agree to connect Spotify and view my playlists for this connection test."
              : "I agree to use my selected playlists for event recommendations."}
          </label>
          <Link className="text-link" href="/music/privacy">
            How your music data is used
          </Link>
          <button
            className="button button-primary"
            disabled={
              !accepted ||
              Boolean(busy) ||
              (consent === "apple" && Boolean(appleToken) && !appleReady)
            }
            onClick={connect}
          >
            {busy
              ? "Connecting…"
              : consent === "apple" && appleToken
                ? appleReady
                  ? "Continue to Apple Music"
                  : "Preparing Apple Music…"
                : "Continue"}{" "}
            <FiArrowUpRight />
          </button>
        </section>
      )}
      {appleToken && (
        <Script
          src="https://js-cdn.music.apple.com/musickit/v3/musickit.js"
          strategy="afterInteractive"
          onReady={() => {
            void prepareApple();
          }}
          onError={() => {
            setAppleToken("");
            setAppleReady(false);
            setError(
              "Apple Music couldn’t load. Please check your connection and try again.",
            );
          }}
        />
      )}
      {choosing && (
        <section
          className="panel playlist-picker"
          aria-labelledby="playlist-heading"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">{musicProviderName(choosing)}</span>
              <h2 id="playlist-heading">
                {choosingRecommendations
                  ? "Which playlists feel like you?"
                  : "Your Spotify playlists"}
              </h2>
              <p>
                {choosingRecommendations
                  ? "Select up to five. We consider up to 500 songs per update."
                  : "Playlist access is working. These playlists are not imported or used for event recommendations."}
              </p>
            </div>
            <button
              className="icon-button"
              aria-label="Close playlist selection"
              onClick={() => setChoosing(null)}
            >
              <FiX />
            </button>
          </div>
          {playlists.length ? (
            <div className="playlist-options">
              {playlists.map((p) => (
                <PlaylistRow className="playlist-choice" key={p.id}>
                  {choosingRecommendations && (
                    <input
                      type="checkbox"
                      checked={selected.includes(p.id)}
                      disabled={
                        !selected.includes(p.id) && selected.length >= 5
                      }
                      onChange={() =>
                        setSelected((prev) =>
                          prev.includes(p.id)
                            ? prev.filter((id) => id !== p.id)
                            : [...prev, p.id],
                        )
                      }
                    />
                  )}
                  <FiHeadphones />
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.count === null ? "Your library" : p.count + " tracks"}
                    </small>
                  </span>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={
                      "Open " + p.name + " in " + musicProviderName(choosing)
                    }
                  >
                    ↗
                  </a>
                </PlaylistRow>
              ))}
            </div>
          ) : (
            <div className="notice">
              No readable playlists on this page.{" "}
              {choosing === "spotify"
                ? "Choose a playlist you own or collaborate on."
                : "Add a playlist to your Apple Music library first."}
            </div>
          )}
          {next !== null && (
            <button
              className="button button-outline"
              disabled={Boolean(busy)}
              onClick={() => load(choosing, next)}
            >
              Load more playlists
            </button>
          )}
          {choosingRecommendations && (
            <button
              className="button button-primary"
              disabled={!selected.length || Boolean(busy)}
              onClick={sync}
            >
              {busy === "sync" ? "Finding your sound…" : "Use these playlists"}{" "}
              <FiCheck />
            </button>
          )}
        </section>
      )}
      <section className="panel manual-music">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CURATE YOUR OWN SOUND</span>
            <h2>No playlist? Still your kind of night.</h2>
            <p>
              Choose artists and genres directly. Your music account is
              optional.
            </p>
          </div>
          <FiHeadphones size={34} />
        </div>
        <form onSubmit={manualSave} className="form-stack">
          <div className="field">
            <label htmlFor="favorite-artists">Artists you’d love to see</label>
            <input
              id="favorite-artists"
              name="artists"
              maxLength={2000}
              value={artists}
              onChange={(event) => setArtists(event.target.value)}
              placeholder="Artist names, separated by commas"
            />
            <small>
              We match these names with performers listed by event organizers.
            </small>
          </div>
          <fieldset className="genre-fieldset">
            <legend>Your genres</legend>
            <div className="chip-row">
              {musicGenres.map((g) => (
                <button
                  type="button"
                  className={"chip" + (genres.includes(g) ? " active" : "")}
                  aria-pressed={genres.includes(g)}
                  key={g}
                  onClick={() =>
                    setGenres((prev) =>
                      prev.includes(g)
                        ? prev.filter((v) => v !== g)
                        : [...prev, g],
                    )
                  }
                >
                  {g}
                  {genres.includes(g) && <FiCheck />}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="ticket-actions">
            <button
              disabled={!canConnect || Boolean(busy)}
              className="button button-primary"
            >
              {busy === "manual" ? "Saving…" : "Save my music taste"}{" "}
              <FiCheck />
            </button>
            <Link className="button button-outline" href="/for-you">
              See my recommendations <FiArrowUpRight />
            </Link>
          </div>
        </form>
        {status.profiles.some((p) => p.source === "manual") && (
          <button
            className="text-link clear-music"
            disabled={Boolean(busy)}
            onClick={() =>
              attempt("clear", async () => {
                update(
                  await api<MusicStatus>("music/disconnect", {
                    method: "POST",
                    body: { provider: "manual" },
                  }),
                );
                setGenres([]);
                setArtists("");
                toast("Saved music preferences removed.");
              })
            }
          >
            Clear saved music preferences
          </button>
        )}
      </section>
      <p className="music-privacy-note">
        <FiShield /> Your playlists stay yours.{" "}
        <Link href="/music/privacy">
          Read about music privacy and matching.
        </Link>
      </p>
    </div>
  );
}
