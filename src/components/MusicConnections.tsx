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
} from "@/lib/music/music-types";
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
  const { user, toast, t, language } = useApp(),
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
          throw new Error(t("musicConnect.unexpectedDestination"));
        window.location.assign(data.url);
      } else if (!appleToken) {
        const data = await api<{ developerToken: string }>(
          "music/apple/config",
          { method: "POST", body: { consent: true } },
        );
        setAppleToken(data.developerToken);
      } else {
        if (!kit.current) throw new Error(t("musicConnect.appleLoading"));
        const token = await kit.current.authorize();
        update(
          await api<MusicStatus>("music/apple/connect", {
            method: "POST",
            body: { token, consent: true },
          }),
        );
        setConsent(null);
        toast(t("musicConnect.appleConnected"));
      }
    });
  }
  async function prepareApple() {
    try {
      if (!window.MusicKit) throw new Error(t("musicConnect.appleLoadError"));
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
      toast(t("musicConnect.matchesReady"));
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
      toast(t("musicConnect.preferencesSaved"));
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
          {t(
            spotifyConnectionTest
              ? "musicConnect.spotifyTestResult"
              : "musicConnect.spotifyConnectedResult",
          )}
        </div>
      )}
      {connectionResult === "cancelled" && (
        <div className="notice" role="status">
          {t("musicConnect.cancelled")}
        </div>
      )}
      {connectionResult === "failed" && (
        <div className="error-box" role="alert">
          {t("musicConnect.failed")}
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
            {user
              ? t("musicConnect.verifyEmail")
              : t("musicConnect.createAccount")}
          </Link>{" "}
          {t("musicConnect.connectPrompt")}
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
                    ? t("musicConnect.connected")
                    : p.available
                      ? p.status === "connection-test"
                        ? t("musicConnect.test")
                        : t("musicConnect.ready")
                      : t("musicConnect.unavailable")}
                </span>
              </div>
              <h2>{musicProviderName(p.provider)}</h2>
              <p>
                {t(
                  p.status === "connection-test"
                    ? "musicConnect.testDescription"
                    : p.provider === "spotify"
                      ? "musicConnect.spotifyDescription"
                      : "musicConnect.appleDescription",
                )}
              </p>
              {p.available ? (
                <p className="provider-detail">
                  {t(
                    p.status === "connection-test"
                      ? "musicConnect.testDetail"
                      : "musicConnect.readOnly",
                  )}
                </p>
              ) : (
                <p className="provider-detail">{t("musicConnect.preparing")}</p>
              )}
              {profile && (
                <div className="music-summary">
                  <strong>
                    {t("musicConnect.songsConsidered", {
                      count: profile.trackCount.toLocaleString(
                        language === "it" ? "it-IT" : "en-GB",
                      ),
                    })}
                  </strong>
                  <span>
                    {profile.playlists.length} {t("musicConnect.playlists")} ·{" "}
                    {t("musicConnect.updated", {
                      date: new Date(profile.updatedAt).toLocaleDateString(
                        language === "it" ? "it-IT" : "en-GB",
                        {
                          day: "numeric",
                          month: "short",
                          timeZone: "UTC",
                        },
                      ),
                    })}
                  </span>
                  {profile.partial && <span>{t("musicConnect.partial")}</span>}
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
                        ? t("musicConnect.choosePlaylists")
                        : t("musicConnect.viewPlaylists")}
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
                          toast(t("musicConnect.disconnectedToast"));
                        })
                      }
                    >
                      {t("musicConnect.disconnect")}
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
                    {t("musicConnect.connectProvider", {
                      provider: musicProviderName(p.provider),
                    })}{" "}
                    <FiArrowUpRight />
                  </button>
                )}
              </div>
              {profile && (
                <div className="playlist-sources">
                  <span>
                    {t("musicConnect.from", {
                      provider: musicProviderName(p.provider),
                    })}
                  </span>
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
            aria-label={t("musicConnect.closeConnection")}
            onClick={() => setConsent(null)}
          >
            <FiX />
          </button>
          <span className="eyebrow">{t("musicConnect.choiceEyebrow")}</span>
          <h2 id="consent-heading">
            {t("musicConnect.connectProvider", {
              provider: musicProviderName(consent),
            })}
          </h2>
          <p>
            {t(
              consentConnectionTest
                ? "musicConnect.testConsent"
                : "musicConnect.recommendationConsent",
            )}
          </p>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />{" "}
            {consentConnectionTest
              ? t("musicConnect.agreeTest")
              : t("musicConnect.agreeRecommendations")}
          </label>
          <Link className="text-link" href="/music/privacy">
            {t("musicConnect.privacyLink")}
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
              ? t("musicConnect.connecting")
              : consent === "apple" && appleToken
                ? appleReady
                  ? t("musicConnect.continueApple")
                  : t("musicConnect.preparingApple")
                : t("musicConnect.continue")}{" "}
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
            setError(t("musicConnect.appleLoadError"));
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
                  ? t("musicConnect.playlistQuestion")
                  : t("musicConnect.spotifyPlaylists")}
              </h2>
              <p>
                {choosingRecommendations
                  ? t("musicConnect.selectPlaylists")
                  : t("musicConnect.testPlaylists")}
              </p>
            </div>
            <button
              className="icon-button"
              aria-label={t("musicConnect.closePlaylists")}
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
                      {p.count === null
                        ? t("musicConnect.library")
                        : t("musicConnect.tracks", { count: p.count })}
                    </small>
                  </span>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t("musicConnect.openPlaylist", {
                      name: p.name,
                      provider: musicProviderName(choosing),
                    })}
                  >
                    ↗
                  </a>
                </PlaylistRow>
              ))}
            </div>
          ) : (
            <div className="notice">
              {t("musicConnect.noPlaylists")}{" "}
              {choosing === "spotify"
                ? t("musicConnect.spotifyPlaylistHelp")
                : t("musicConnect.applePlaylistHelp")}
            </div>
          )}
          {next !== null && (
            <button
              className="button button-outline"
              disabled={Boolean(busy)}
              onClick={() => load(choosing, next)}
            >
              {t("musicConnect.loadMore")}
            </button>
          )}
          {choosingRecommendations && (
            <button
              className="button button-primary"
              disabled={!selected.length || Boolean(busy)}
              onClick={sync}
            >
              {busy === "sync"
                ? t("musicConnect.findingSound")
                : t("musicConnect.usePlaylists")}{" "}
              <FiCheck />
            </button>
          )}
        </section>
      )}
      <section className="panel manual-music">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("musicConnect.manualEyebrow")}</span>
            <h2>{t("musicConnect.manualTitle")}</h2>
            <p>{t("musicConnect.manualIntro")}</p>
          </div>
          <FiHeadphones size={34} />
        </div>
        <form onSubmit={manualSave} className="form-stack">
          <div className="field">
            <label htmlFor="favorite-artists">
              {t("musicConnect.artists")}
            </label>
            <input
              id="favorite-artists"
              name="artists"
              maxLength={2000}
              value={artists}
              onChange={(event) => setArtists(event.target.value)}
              placeholder={t("musicConnect.artistsPlaceholder")}
            />
            <small>{t("musicConnect.artistHelp")}</small>
          </div>
          <fieldset className="genre-fieldset">
            <legend>{t("musicConnect.genres")}</legend>
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
              {busy === "manual"
                ? t("musicConnect.saving")
                : t("musicConnect.saveTaste")}{" "}
              <FiCheck />
            </button>
            <Link className="button button-outline" href="/for-you">
              {t("musicConnect.myRecommendations")} <FiArrowUpRight />
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
                toast(t("musicConnect.preferencesRemoved"));
              })
            }
          >
            {t("musicConnect.clearPreferences")}
          </button>
        )}
      </section>
      <p className="music-privacy-note">
        <FiShield /> {t("musicConnect.privacyNote")}{" "}
        <Link href="/music/privacy">{t("musicConnect.privacyRead")}</Link>
      </p>
    </div>
  );
}
