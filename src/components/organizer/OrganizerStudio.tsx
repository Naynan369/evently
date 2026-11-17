"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  FiArrowUpRight,
  FiCalendar,
  FiCamera,
  FiCheckCircle,
  FiCreditCard,
  FiDownload,
  FiMapPin,
  FiPlus,
  FiTag,
  FiUsers,
} from "react-icons/fi";
import { api } from "@/lib/client";
import { BUSINESS_COUNTRIES } from "@/lib/business-countries";
import { categoryName } from "@/lib/catalog";
import { eventDate, money } from "@/lib/format";
import { useApp } from "../AppProvider";
import type { Event, Booking, BusinessProfile } from "@/lib/types";
import type { TranslationKey } from "@/lib/i18n";
import { PLATFORM_TEST_ACCOUNT } from "@/lib/platform-checkout-test";
import TicketQrScanner from "./TicketQrScanner";

type Guest = Booking & { name: string; email: string };

function coverFor(event: Event) {
  return event.coverImage || "/images/" + event.image + ".jpg";
}

export default function OrganizerStudio({
  events,
  bookings,
  profiles,
  demoMode = false,
  platformTestCheckout = false,
}: {
  events: Event[];
  bookings: Guest[];
  profiles: BusinessProfile[];
  demoMode?: boolean;
  platformTestCheckout?: boolean;
}) {
  const { toast, language, t } = useApp();
  const countryNames = new Intl.DisplayNames(language === "it" ? "it-IT" : "en-GB", {
    type: "region",
  });
  const router = useRouter();
  const [paymentState, setPaymentState] = useState<{
    profileId: string;
    data: {
      configured: boolean;
      connected: boolean;
      ready: boolean;
    };
  } | null>(null);
  const [paymentErrorState, setPaymentErrorState] = useState<{
    profileId: string;
    message: string;
  } | null>(null);
  const [countryChoices, setCountryChoices] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState(false);
  const [statusRetry, setStatusRetry] = useState(0);
  const [profileId, setProfileId] = useState(profiles[0]?.id || "");
  const selectedProfile =
    profiles.find((profile) => profile.id === profileId) || profiles[0];
  const selectedProfileId = selectedProfile?.id;
  const payment = paymentState?.profileId === selectedProfileId
    ? paymentState.data
    : null;
  const paymentError = paymentErrorState?.profileId === selectedProfileId
    ? paymentErrorState.message
    : "";
  let paymentStatus = t("studio.checkingStatus");
  if (platformTestCheckout)
    paymentStatus = language === "it" ? "Test attivo" : "Test active";
  else if (payment?.ready) paymentStatus = t("studio.ready");
  else if (payment?.connected) paymentStatus = t("studio.setupProgress");
  else if (payment) paymentStatus = t("studio.notConnected");
  else if (paymentError) paymentStatus = t("studio.statusUnavailable");
  const country = selectedProfile
    ? countryChoices[selectedProfile.id] || selectedProfile.countryCode || "IT"
    : "IT";
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [checkResult, setCheckResult] = useState("");
  const [checkError, setCheckError] = useState("");
  const [refund, setRefund] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [practiceGuest, setPracticeGuest] = useState<{
    eventId: string;
    id: string;
    name: string;
    code: string;
  } | null>(null);
  const [practiceBusy, setPracticeBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    if (!selectedProfileId || demoMode || platformTestCheckout) return;
    let active = true;
    api<{ configured: boolean; connected: boolean; ready: boolean }>(
      "stripe/status?profileId=" + encodeURIComponent(selectedProfileId),
    )
      .then((data) => {
        if (active) setPaymentState({ profileId: selectedProfileId, data });
      })
      .catch((error) => {
        if (active)
          setPaymentErrorState({ profileId: selectedProfileId, message: error.message });
      });
    return () => {
      active = false;
    };
  }, [selectedProfileId, demoMode, platformTestCheckout, statusRetry]);

  const defaultProfileId = profiles[0]?.id;
  const profileEvents = events.filter(
    (event) =>
      event.organizerProfileId === selectedProfile?.id ||
      (!event.organizerProfileId && selectedProfile?.id === defaultProfileId),
  );
  const publishedCount = profileEvents.filter(
    (event) => !event.visibility || event.visibility === "published",
  ).length;
  const profileEventIds = new Set(profileEvents.map((event) => event.id));
  const profileBookings = bookings.filter((booking) =>
    profileEventIds.has(booking.eventId),
  );
  const confirmed = profileBookings.filter((booking) => booking.status === "confirmed");
  const ticketCount = confirmed.reduce((total, booking) => total + booking.quantity, 0);
  const checkedInCount = confirmed
    .filter((booking) => booking.checkedIn)
    .reduce((total, booking) => total + booking.quantity, 0);
  const eventById = new Map(profileEvents.map((event) => [event.id, event]));

  async function connect() {
    setConnecting(true);
    setPaymentErrorState(null);
    try {
      const data = await api<{ url: string }>("stripe/connect", {
        method: "POST",
        body: { country, profileId: selectedProfile?.id },
      });
      const url = new URL(data.url);
      if (url.protocol !== "https:" || !url.hostname.endsWith(".stripe.com"))
        throw new Error("Unexpected onboarding destination.");
      window.location.assign(data.url);
    } catch (error) {
      if (selectedProfile)
        setPaymentErrorState({
          profileId: selectedProfile.id,
          message: (error as Error).message,
        });
    } finally {
      setConnecting(false);
    }
  }

  async function admitCode(code: string) {
    if (checkingRef.current) return false;
    checkingRef.current = true;
    setChecking(true);
    setCheckResult("");
    setCheckError("");
    try {
      const result = await api<{
        quantity: number;
        name: string;
        event: string;
      }>("organizer/check-in", {
        method: "POST",
        body: {
          code,
          organizerProfileId: selectedProfile?.id,
        },
      });
      setCheckResult(
        t("studio.checkInResult", {
          name: result.name,
          count: result.quantity,
          event: result.event,
        }),
      );
      router.refresh();
      return true;
    } catch (error) {
      setCheckError((error as Error).message);
      return false;
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }

  async function checkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const code = String(new FormData(form).get("code") || "");
    setScannerOpen(false);
    if (await admitCode(code)) form.reset();
  }

  async function doRefund() {
    setRefunding(true);
    try {
      const result = await api<{ status: string }>("organizer/refund", {
        method: "POST",
        body: { bookingId: refund },
      });
      toast(
        result.status === "succeeded"
          ? t("studio.refundedToast")
          : t("studio.refundPendingToast"),
      );
      setRefund(null);
      router.refresh();
    } catch (error) {
      toast((error as Error).message);
    } finally {
      setRefunding(false);
    }
  }

  async function createPracticeGuest(eventId: string) {
    setPracticeBusy(eventId);
    try {
      const result = await api<{ guest: { id: string; name: string; code: string } }>(
        "organizer/demo-guest",
        { method: "POST", body: { eventId } },
      );
      setPracticeGuest({ eventId, ...result.guest });
      router.refresh();
    } catch (error) {
      toast((error as Error).message);
    } finally {
      setPracticeBusy(null);
    }
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedbackBusy(true);
    try {
      await api("organizer/demo-feedback", {
        method: "POST",
        body: { feedback },
      });
      setFeedback("");
      setFeedbackSent(true);
    } catch (error) {
      toast((error as Error).message);
    } finally {
      setFeedbackBusy(false);
    }
  }

  function exportGuests() {
    const quote = (value: string) => '"' + value.replace(/"/g, '""') + '"';
    const rows = [
      [
        t("account.name"),
        t("auth.email"),
        t("studio.event"),
        t("booking.ticketType"),
        t("booking.numberOfTickets"),
        t("studio.status"),
        t("studio.checkedIn"),
      ],
      ...profileBookings.map((booking) => [
        booking.name,
        booking.email,
        eventById.get(booking.eventId)?.title || "",
        booking.ticketType === "vip" ? "VIP" : t("booking.standard"),
        String(booking.quantity),
        booking.status,
        booking.checkedIn ? (language === "it" ? "Sì" : "Yes") : "No",
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => quote(/^[=+@\-\t\r]/.test(cell) ? "'" + cell : cell))
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "evently-guests.csv";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="organizer-studio">
      {selectedProfile && (
        <section className="org-profile-context" aria-label={t("studio.activeProfile")}>
          <div className="org-profile-context-copy">
            <span>{t("studio.activeProfile")}</span>
            <strong>{selectedProfile.name}</strong>
            <p>{t("studio.profileSummary")}</p>
          </div>
          <div className="org-profile-context-controls">
            {profiles.length > 1 && (
              <div className="field">
                <label htmlFor="active-organizer-profile">{t("studio.workingAs")}</label>
                <select
                  id="active-organizer-profile"
                  value={selectedProfile.id}
                  onChange={(event) => setProfileId(event.target.value)}
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
              </div>
            )}
            <Link href="/business-profiles">{t("studio.manageProfiles")} <FiArrowUpRight aria-hidden="true" /></Link>
          </div>
        </section>
      )}
      <section className="org-overview" aria-label={t("studio.overview")}>
        <article className="org-stat">
          <span className="org-stat-icon"><FiCalendar aria-hidden="true" /></span>
          <span className="org-stat-label">{demoMode ? (language === "it" ? "Eventi in bozza" : "Draft events") : t("studio.publishedEvents")}</span>
          <strong>{demoMode ? profileEvents.length : publishedCount}</strong>
          <small>{language === "it" ? "Per " : "For "}{selectedProfile?.name || t("studio.thisProfile")}</small>
        </article>
        <article className="org-stat">
          <span className="org-stat-icon"><FiTag aria-hidden="true" /></span>
          <span className="org-stat-label">{demoMode ? (language === "it" ? "Ospiti" : "Guests") : t("studio.ticketsReserved")}</span>
          <strong>{ticketCount}</strong>
          <small>{t("studio.confirmedBookings")}</small>
        </article>
        <article className="org-stat">
          <span className="org-stat-icon"><FiUsers aria-hidden="true" /></span>
          <span className="org-stat-label">{t("studio.guestsCheckedIn")}</span>
          <strong>{checkedInCount}</strong>
          <small>{t("studio.welcomeMore")}</small>
        </article>
      </section>

      <section className="org-section" id="org-event-list" aria-labelledby="org-events-title">
        <div className="org-section-heading">
          <div>
            <span className="org-section-kicker">{demoMode ? (language === "it" ? "I TUOI EVENTI" : "YOUR EVENTS") : t("studio.publishedByYou")}</span>
            <h2 id="org-events-title">{t("studio.events")}</h2>
            <p>{demoMode
              ? (language === "it" ? "Prepara il tuo evento, controlla l'anteprima e prova la gestione degli ospiti." : "Plan your event, check its preview, and try guest management.")
              : t("studio.eventsIntro")}</p>
          </div>
            <span className="org-section-count">{t("studio.eventsCount", { count: String(profileEvents.length).padStart(2, "0") })}</span>
        </div>

        {profileEvents.length ? (
          <div className="org-event-grid">
            {profileEvents.map((event) => {
              const reserved = Math.max(0, event.capacity - event.available);
              const fill = event.capacity > 0
                ? Math.min(100, Math.round((reserved / event.capacity) * 100))
                : 0;
              return (
                <article className="org-event-card" key={event.id}>
                  <Link
                    href={"/events/" + event.slug}
                    className="org-event-cover"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <Image src={coverFor(event)} alt="" fill sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw" />
                    <time dateTime={event.startsAt}><FiCalendar aria-hidden="true" />{eventDate(event.startsAt, event.timezone, true, language)}</time>
                    {event.sample && <span className="org-sample-tag">{t("studio.sample")}</span>}
                  </Link>
                  <div className="org-event-content">
                    <div className="org-event-meta">
                      <span className="org-event-category">{categoryName(event.category, language)}</span>
                      {event.visibility && event.visibility !== "published" && (
                        <span className="org-event-draft">{event.visibility === "draft" ? t("studio.draft") : event.visibility === "review" ? (language === "it" ? "In revisione" : "In review") : event.visibility === "rejected" ? (language === "it" ? "Da correggere" : "Needs changes") : (language === "it" ? "Annullato" : "Cancelled")}</span>
                      )}
                    </div>
                    <h3><Link href={"/events/" + event.slug}>{event.title}</Link></h3>
                    <p className="org-event-venue"><FiMapPin aria-hidden="true" />{event.venue} · {event.city}</p>
                    <div className="org-ticket-progress">
                      <div className="org-ticket-progress-label">
                        <span>{demoMode ? (language === "it" ? "Ospiti" : "Guests") : t("studio.ticketsReserved")}</span>
                        <strong>{reserved} <small>/ {event.capacity}</small></strong>
                      </div>
                      <div
                        className="org-progress-track"
                        role="progressbar"
                        aria-label={(demoMode ? (language === "it" ? "Ospiti" : "Guests") : t("studio.ticketsReserved")) + " · " + event.title}
                        aria-valuemin={0}
                        aria-valuemax={event.capacity}
                        aria-valuenow={reserved}
                      >
                        <span style={{ width: fill + "%" }} />
                      </div>
                    </div>
                    <div className="org-event-footer">
                      <span>{money(event.price, event.currency, language)} <small>{demoMode ? (language === "it" ? "prezzo indicativo" : "planned price") : t("studio.perTicket")}</small></span>
                      <div>
                        <Link href={"/events/" + event.slug} aria-label={t("studio.view") + " " + event.title}>
                          {demoMode ? (language === "it" ? "Anteprima" : "Preview") : t("studio.view")} <FiArrowUpRight aria-hidden="true" />
                        </Link>
                        {event.visibility !== "cancelled" && <Link href={"/create-event?edit=" + event.id} aria-label={t("studio.edit") + " " + event.title}>
                          {t("studio.edit")} <FiArrowUpRight aria-hidden="true" />
                        </Link>}
                      </div>
                    </div>
                    {demoMode && event.visibility === "draft" && (
                      <div className="org-demo-event-actions">
                        <button
                          className="button button-outline button-small"
                          type="button"
                          disabled={practiceBusy === event.id || (event.standardAvailable ?? event.available) < 1}
                          onClick={() => createPracticeGuest(event.id)}
                        >
                          <FiPlus aria-hidden="true" /> {practiceBusy === event.id
                            ? (language === "it" ? "Aggiunta..." : "Adding...")
                            : (language === "it" ? "Aggiungi ospite di esempio" : "Add sample guest")}
                        </button>
                        {practiceGuest?.eventId === event.id && (
                          <div className="org-practice-result" role="status">
                            <strong>{practiceGuest.name}</strong>
                            <code>{practiceGuest.code}</code>
                            <Link href={"/tickets/" + practiceGuest.id}>
                              {language === "it" ? "Apri biglietto di esempio" : "Open sample ticket"}
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="org-empty-events">
            <span className="org-empty-mark"><FiCalendar aria-hidden="true" /></span>
            <div>
              <h3>{t("studio.eventsEmptyTitle")}</h3>
              <p>{demoMode
                ? (language === "it" ? "Crea la tua prima bozza privata per iniziare la prova." : "Create your first private draft to begin the trial.")
                : t("studio.eventsEmptyBody")}</p>
            </div>
            <Link href="/create-event" className="button button-primary"><FiPlus aria-hidden="true" />{t("studio.createFirst")}</Link>
          </div>
        )}
      </section>

      <section className={"org-section org-operations" + (demoMode ? " is-demo" : "")} aria-label={t("studio.operations")}>
        <article className="org-tool-card" id="org-checkin">
          <div className="org-tool-head">
            <span className="org-tool-icon"><FiCheckCircle aria-hidden="true" /></span>
            <span className="org-tool-state">{t("studio.guestOperations")}</span>
          </div>
          <h2>{t("studio.welcomeGuests")}</h2>
          <p>{t("studio.checkinIntro")}</p>
          <form onSubmit={checkIn} className="org-checkin-form">
            <div className="field">
              <label htmlFor="checkin-code">{t("studio.ticketCode")}</label>
              <input
                id="checkin-code"
                name="code"
                placeholder="EV-…"
                autoComplete="off"
                required
                maxLength={40}
              />
            </div>
            <div className="org-checkin-actions">
              <button className="button button-primary" disabled={checking}>
                {checking ? t("studio.checking") : t("studio.checkInGuest")}
                <FiArrowUpRight aria-hidden="true" />
              </button>
              <button
                className="button button-outline"
                type="button"
                disabled={checking}
                aria-expanded={scannerOpen}
                onClick={() => setScannerOpen((current) => !current)}
              >
                <FiCamera aria-hidden="true" />
                {scannerOpen ? t("studio.cameraClose") : t("studio.scanTicket")}
              </button>
            </div>
          </form>
          {scannerOpen && (
            <TicketQrScanner
              key={selectedProfileId}
              onCode={(code) => {
                setScannerOpen(false);
                void admitCode(code);
              }}
              onClose={() => setScannerOpen(false)}
            />
          )}
          {checkResult && <div className="org-inline-success" role="status">{checkResult}</div>}
          {checkError && <div className="error-box" role="alert">{checkError}</div>}
        </article>

        {!demoMode && <article className="org-tool-card org-payment-card" id="org-payments">
          <div className="org-tool-head">
            <span className="org-tool-icon"><FiCreditCard aria-hidden="true" /></span>
            <span className="org-tool-state">{t("studio.payments")}</span>
            <span className={"org-payment-status" + (platformTestCheckout || payment?.ready ? " is-ready" : "")}>
              <i aria-hidden="true" />
              {paymentStatus}
            </span>
          </div>
          <h2>{platformTestCheckout
            ? language === "it" ? "Prova i pagamenti dei biglietti." : "Try ticket checkout."
            : t("studio.keepPayouts")}</h2>
          <p>
            {platformTestCheckout
              ? language === "it"
                ? "I biglietti a pagamento usano l'account Stripe di test di Evently. Non servono dati legali dell'organizzatore. Non si sposta denaro reale."
                : "Paid tickets use Evently’s Stripe test account. No organizer legal details are needed, and no real money moves."
              : t("studio.connectStripe", { profile: selectedProfile?.name || t("studio.thisOrganizer") })}
          </p>
          {platformTestCheckout ? (
            <div className="org-payment-ready"><FiCheckCircle aria-hidden="true" /> {language === "it" ? "Checkout di prova disponibile" : "Test checkout available"}</div>
          ) : payment?.ready ? (
            <div className="org-payment-ready"><FiCheckCircle aria-hidden="true" /> {t("studio.stripeReady")}</div>
          ) : payment && !payment.configured ? (
            <div className="org-payment-notice">
              <strong>{t("studio.platformSetup")}</strong>
              <span>{t("studio.platformSetupHelp")}</span>
            </div>
          ) : (
            <div className="org-connect-form">
              <div className="field">
                <label htmlFor="business-country">{t("studio.businessCountry")}</label>
                <select
                  id="business-country"
                  value={country}
                  onChange={(event) => {
                    if (selectedProfile)
                      setCountryChoices((current) => ({
                        ...current,
                        [selectedProfile.id]: event.target.value,
                      }));
                  }}
                  disabled={Boolean(payment?.connected)}
                >
                  {BUSINESS_COUNTRIES.map((code) => (
                    <option value={code} key={code}>
                      {countryNames.of(code) || code}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="button button-outline"
                disabled={connecting || !payment}
                onClick={connect}
              >
                {connecting ? t("studio.openingStripe") : payment?.connected ? t("studio.finishSetup") : t("studio.connect")}
                <FiArrowUpRight aria-hidden="true" />
              </button>
            </div>
          )}
          {paymentError && (
            <div className="error-box" role="alert">
              {paymentError}
              {!payment && (
                <button
                  className="button button-outline button-small"
                  onClick={() => {
                    setPaymentErrorState(null);
                    setStatusRetry((current) => current + 1);
                  }}
                  type="button"
                >
                  {t("studio.retryStatus")}
                </button>
              )}
            </div>
          )}
          <div className="org-payment-footnote">{platformTestCheckout
            ? language === "it" ? "Solo prova · nessun accredito agli organizzatori · biglietti non validi per l'ingresso" : "Testing only · no organizer payouts · tickets are not valid for entry"
            : t("studio.fees")}</div>
        </article>}
      </section>

      <section className="org-section org-guests" aria-labelledby="org-guests-title">
        <div className="org-section-heading">
          <div>
            <span className="org-section-kicker">{t("studio.guestSection")}</span>
            <h2 id="org-guests-title">{t("studio.guestList")}</h2>
            <p>{t("studio.guestIntro")}</p>
          </div>
          {profileBookings.length > 0 && (
            <button className="button button-outline org-export-button" onClick={exportGuests}>
              <FiDownload aria-hidden="true" /> {t("studio.downloadGuests")}
            </button>
          )}
        </div>

        {profileBookings.length ? (
          <div className="org-table-wrap">
            <table className="org-table">
              <caption className="sr-only">{t("studio.guestBookings")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("studio.guest")}</th>
                  <th scope="col">{t("studio.event")}</th>
                  <th scope="col">{t("studio.ticketsType")}</th>
                  <th scope="col">{t("studio.status")}</th>
                  {!demoMode && <th scope="col">{t("studio.payment")}</th>}
                  <th scope="col">{t("studio.action")}</th>
                </tr>
              </thead>
              <tbody>
                {profileBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td data-label={t("studio.guest")}><strong>{booking.name}</strong><small>{booking.email}</small></td>
                    <td data-label={t("studio.event")}>{eventById.get(booking.eventId)?.title || t("studio.eventUnavailable")}</td>
                    <td data-label={t("studio.ticketsType")}>
                      <strong>{booking.quantity}</strong>
                      <small>{booking.ticketType === "vip" ? "VIP" : t("booking.standard")}</small>
                      {booking.checkedIn ? <small>{t("studio.checkedIn")}</small> : null}
                    </td>
                    <td data-label={t("studio.status")}>
                      <span className={"org-booking-status is-" + booking.status}>{t(("tickets." + booking.status) as TranslationKey)}</span>
                      {booking.stripeAccount === PLATFORM_TEST_ACCOUNT && <small>{language === "it" ? "Pagamento di prova" : "Test payment"}</small>}
                      {booking.refundRequested > 0 && booking.status === "confirmed" && <small>{t("studio.refundRequested")}</small>}
                    </td>
                    {!demoMode && <td data-label={t("studio.payment")}>{money(booking.total, booking.currency, language)}</td>}
                    <td data-label={t("studio.action")}>
                      {demoMode && booking.demoGuestName ? (
                        <Link className="org-refund-button" href={"/tickets/" + booking.id}>
                          {language === "it" ? "Biglietto di esempio" : "Sample ticket"}
                        </Link>
                      ) : !demoMode && booking.status === "confirmed" && booking.mode === "stripe" ? (
                        <button className="org-refund-button" onClick={() => setRefund(booking.id)}>{t("studio.refund")}</button>
                      ) : <span className="org-no-action">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="org-empty-guests">
            <FiUsers aria-hidden="true" />
            <div><strong>{t("studio.guestEmptyTitle")}</strong><span>{t("studio.guestEmptyBody")}</span></div>
          </div>
        )}

        {!demoMode && refund && (
          <div className="org-refund-confirm" role="alert">
            <div>
              <strong>{t("studio.refundTitle")}</strong>
              <p>{t("studio.refundBody")}</p>
            </div>
            <div className="org-refund-actions">
              <button className="button button-danger" disabled={refunding} onClick={doRefund}>
                {refunding ? t("studio.refunding") : t("studio.confirmRefund")}
              </button>
              <button className="button button-outline" onClick={() => setRefund(null)}>{t("studio.keepBooking")}</button>
            </div>
          </div>
        )}
      </section>
      {demoMode && (
        <section className="org-section org-demo-feedback" aria-labelledby="org-feedback-title">
          <div className="org-section-heading">
            <div>
              <span className="org-section-kicker">{language === "it" ? "AIUTACI A MIGLIORARE" : "HELP SHAPE EVENTLY"}</span>
              <h2 id="org-feedback-title">{language === "it" ? "Com'è andata?" : "How did it go?"}</h2>
              <p>{language === "it"
                ? "Dopo aver creato una bozza e provato l'ingresso, raccontaci cosa era poco chiaro o cosa manca per i tuoi eventi a Messina."
                : "After creating a draft and trying check-in, tell us what was unclear or what you need for your events in Messina."}</p>
            </div>
          </div>
          <form className="org-feedback-form" onSubmit={submitFeedback}>
            <label htmlFor="organizer-demo-feedback">
              {language === "it" ? "Il tuo feedback" : "Your feedback"}
            </label>
            <textarea
              id="organizer-demo-feedback"
              maxLength={3000}
              minLength={10}
              onChange={(event) => { setFeedback(event.target.value); setFeedbackSent(false); }}
              placeholder={language === "it" ? "Cosa cambieresti? Quale funzione ti serve?" : "What would you change? Which feature do you need?"}
              required
              rows={5}
              value={feedback}
            />
            <button className="button button-primary" disabled={feedbackBusy || feedback.trim().length < 10} type="submit">
              {feedbackBusy ? (language === "it" ? "Invio..." : "Sending...") : (language === "it" ? "Invia feedback" : "Send feedback")}
            </button>
            {feedbackSent && <span role="status">{language === "it" ? "Grazie! Il tuo feedback è stato salvato." : "Thank you! Your feedback was saved."}</span>}
          </form>
        </section>
      )}
    </div>
  );
}
