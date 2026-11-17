"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { useApp } from "@/components/AppProvider";
import type { operatorSnapshot, OperatorUser } from "@/lib/operations";
import { adminViewFromParam } from "./adminViews";
import AdminCrm from "./AdminCrm";
import styles from "./AdminConsole.module.css";

type Snapshot = Awaited<ReturnType<typeof operatorSnapshot>>;

type ViewHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
};

function ViewHeading({ eyebrow, title, description, aside }: ViewHeadingProps) {
  return (
    <header className={styles.heading}>
      <div>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {aside}
    </header>
  );
}

function Status({ value }: { value: string }) {
  return (
    <span className={styles.status} data-status={value}>
      <i aria-hidden="true" />
      {value}
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

export default function AdminConsole({ initial }: { initial: Snapshot }) {
  const { language, user } = useApp();
  const view = adminViewFromParam(useSearchParams().get("view"));
  const it = language === "it";
  const locale = it ? "it-IT" : "en-GB";
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [caseKind, setCaseKind] = useState<"incident" | "payment" | "dispute">(
    "incident",
  );
  const [caseSubject, setCaseSubject] = useState("");
  const [caseDetails, setCaseDetails] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [foundUser, setFoundUser] = useState<OperatorUser | null>(null);
  const [searched, setSearched] = useState(false);

  const count = (value: number) => new Intl.NumberFormat(locale).format(value);
  const euros = (cents: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  const date = (value: string | number) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  const reviewCount = data.events.filter(
    (event) => event.visibility === "review",
  ).length;
  const openCases = data.cases.filter((item) => item.status === "open").length;
  const paymentFollowUps =
    data.refundRequests.length + data.pendingCancellations.length;
  const recentEvents = [...data.events]
    .filter(
      (event) =>
        event.visibility === "review" || event.visibility === "published",
    )
    .sort(
      (a, b) =>
        Number(b.visibility === "review") - Number(a.visibility === "review") ||
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    .slice(0, 5);
  const visibleAccounts = searched
    ? foundUser ? [foundUser] : []
    : data.users;

  async function perform(
    path: string,
    payload: unknown,
    method: "POST" | "PUT" = "POST",
  ) {
    setBusy(path);
    setError("");
    setMessage("");
    try {
      await api(path, { method, body: payload });
      setData(await api<Snapshot>("admin"));
      setMessage(it ? "Aggiornato." : "Updated.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function addCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("new-case");
    setError("");
    setMessage("");
    try {
      await api("admin/cases", {
        method: "POST",
        body: { kind: caseKind, subject: caseSubject, details: caseDetails },
      });
      setCaseSubject("");
      setCaseDetails("");
      setData(await api<Snapshot>("admin"));
      setMessage(it ? "Caso aperto." : "Case opened.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function findAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSearched(false);
    try {
      const result = await api<{ user: OperatorUser | null }>(
        `admin/users?email=${encodeURIComponent(searchEmail.trim())}`,
      );
      setFoundUser(result.user);
      setSearched(true);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function updateRole(account: OperatorUser, role: "USER" | "ADMIN") {
    if (!window.confirm(
      role === "ADMIN"
        ? it
          ? `Concedere l'accesso amministratore a ${account.email}?`
          : `Grant administrator access to ${account.email}?`
        : it
          ? `Rimuovere l'accesso amministratore a ${account.email}?`
          : `Remove administrator access from ${account.email}?`,
    )) return;
    const path = `admin/users/${account.id}/role`;
    setBusy(path);
    setError("");
    setMessage("");
    try {
      await api(path, { method: "POST", body: { role } });
      setData(await api<Snapshot>("admin"));
      if (foundUser?.id === account.id)
        setFoundUser({ ...account, role });
      setMessage(it ? "Ruolo aggiornato." : "Account role updated.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <main id="main" className={styles.console}>
      {(error || message) && (
        <p
          className={error ? styles.error : styles.notice}
          role={error ? "alert" : "status"}
        >
          {error || message}
        </p>
      )}

      {view === "crm" && <AdminCrm />}

      {view === "overview" && (
        <>
          <ViewHeading
            eyebrow="EVENTLY / ADMIN"
            title={it ? "Panoramica" : "Overview"}
            description={
              it
                ? "Attività della piattaforma e operazioni da seguire."
                : "Platform activity and work that needs attention."
            }
          />
          <section
            className={styles.metrics}
            aria-label={
              it ? "Statistiche della piattaforma" : "Platform statistics"
            }
          >
            <div className={styles.metric}>
              <span>{it ? "Eventi totali" : "Total events"}</span>
              <strong>{count(data.events.length)}</strong>
            </div>
            <div className={styles.metric}>
              <span>{it ? "Organizzatori" : "Organizers"}</span>
              <strong>{count(data.totals.organizerCount)}</strong>
            </div>
            <div className={styles.metric}>
              <span>{it ? "Biglietti pagati" : "Paid tickets"}</span>
              <strong>{count(data.totals.paidTickets)}</strong>
              <small>
                {it
                  ? "Prenotazioni Stripe confermate"
                  : "Confirmed Stripe bookings"}
              </small>
            </div>
            <div className={styles.metric}>
              <span>{it ? "Vendite confermate" : "Confirmed sales"}</span>
              <strong>{euros(data.totals.confirmedSalesCents)}</strong>
              <small>
                {it ? "Biglietti Stripe in EUR" : "EUR Stripe tickets"}
              </small>
            </div>
          </section>
          <div className={styles.overviewColumns}>
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <span className={styles.eyebrow}>01 / ACTIVITY</span>
                  <h2>{it ? "Eventi in evidenza" : "Events at a glance"}</h2>
                </div>
                <Link href="/admin?view=events">
                  {it ? "Tutti gli eventi" : "All events"}{" "}
                  <span aria-hidden="true">↗</span>
                </Link>
              </div>
              {recentEvents.length ? (
                recentEvents.map((event) => (
                  <div className={styles.activityRow} key={event.id}>
                    <div>
                      <strong>{event.title}</strong>
                      <span>
                        {event.city} · {date(event.startsAt)}
                      </span>
                    </div>
                    <Status value={event.visibility || "published"} />
                  </div>
                ))
              ) : (
                <Empty>
                  {it ? "Nessun evento imminente." : "No upcoming events yet."}
                </Empty>
              )}
            </section>
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <span className={styles.eyebrow}>02 / PRIORITIES</span>
                  <h2>{it ? "Da seguire" : "Needs attention"}</h2>
                </div>
              </div>
              <Link className={styles.priorityRow} href="/admin?view=events">
                <span>
                  {it ? "Eventi da esaminare" : "Listings awaiting review"}
                </span>
                <strong>{count(reviewCount)}</strong>
              </Link>
              <Link
                className={styles.priorityRow}
                href="/admin?view=moderation"
              >
                <span>{it ? "Casi aperti" : "Open cases"}</span>
                <strong>{count(openCases)}</strong>
              </Link>
              <Link className={styles.priorityRow} href="/admin?view=payments">
                <span>
                  {it ? "Pagamenti da seguire" : "Payment follow-ups"}
                </span>
                <strong>{count(paymentFollowUps)}</strong>
              </Link>
              <Link className={styles.priorityRow} href="/admin?view=crm">
                <span>{it ? "Contatti da seguire" : "Contacts to follow up"}</span>
                <strong>{count(data.crmDue)}</strong>
              </Link>
              <Link
                className={styles.priorityRow}
                href="/admin?view=moderation"
              >
                <span>
                  {it ? "Messaggi in attesa" : "Messages awaiting delivery"}
                </span>
                <strong>{count(data.pendingMessages)}</strong>
              </Link>
            </section>
          </div>
        </>
      )}

      {view === "events" && (
        <>
          <ViewHeading
            eyebrow="01 / EVENTS"
            title={it ? "Eventi" : "Events"}
            description={
              it
                ? "Esamina le pubblicazioni e gestisci gli eventi pubblicati."
                : "Review submissions and manage published events."
            }
            aside={
              <span className={styles.headingCount}>
                {count(data.events.length)} {it ? "eventi" : "events"}
              </span>
            }
          />
          <section
            className={styles.panel}
            aria-label={it ? "Elenco eventi" : "Event list"}
          >
            {data.events.length ? (
              data.events.map((event) => (
                <article className={styles.managementRow} key={event.id}>
                  <div className={styles.rowMain}>
                    <Status value={event.visibility || "published"} />
                    <h2>{event.title}</h2>
                    <p>
                      {event.host} · {event.city} · {date(event.startsAt)}
                    </p>
                    <Link href={`/events/${event.slug}`}>
                      {it ? "Apri evento" : "Open event"} ↗
                    </Link>
                  </div>
                  <div className={styles.actions}>
                    {(event.visibility === "review" ||
                      event.visibility === "rejected") && (
                      <button
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void perform(`admin/events/${event.id}`, {
                            action: "approve",
                          })
                        }
                      >
                        {it ? "Approva" : "Approve"}
                      </button>
                    )}
                    {event.visibility === "review" && (
                      <button
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void perform(`admin/events/${event.id}`, {
                            action: "reject",
                          })
                        }
                      >
                        {it ? "Rifiuta" : "Reject"}
                      </button>
                    )}
                    {event.visibility === "published" && (
                      <button
                        disabled={Boolean(busy)}
                        onClick={() => {
                          if (
                            window.confirm(
                              it
                                ? "Annullare l'evento e avvisare gli ospiti?"
                                : "Cancel the event and notify guests?",
                            )
                          )
                            void perform(`admin/events/${event.id}`, {
                              action: "cancel",
                            });
                        }}
                      >
                        {it ? "Annulla evento" : "Cancel event"}
                      </button>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <Empty>
                {it
                  ? "Nessun evento pubblicato dagli organizzatori."
                  : "No organizer events yet."}
              </Empty>
            )}
          </section>
        </>
      )}

      {view === "organizers" && (
        <>
          <ViewHeading
            eyebrow="02 / ORGANIZERS"
            title={it ? "Organizzatori" : "Organizers"}
            description={
              it
                ? "Profili degli organizzatori registrati sulla piattaforma."
                : "Organizer profiles registered on the platform."
            }
            aside={
              <span className={styles.headingCount}>
                {count(data.totals.organizerCount)}{" "}
                {it ? "profili" : "profiles"}
              </span>
            }
          />
          <section
            className={styles.panel}
            aria-label={it ? "Elenco organizzatori" : "Organizer list"}
          >
            {data.organizers.length ? (
              data.organizers.map((organizer) => (
                <article className={styles.managementRow} key={organizer.id}>
                  <div className={styles.rowMain}>
                    <span className={styles.eyebrow}>
                      {organizer.countryCode}
                    </span>
                    <h2>{organizer.name}</h2>
                    <p>
                      {organizer.ownerName} ·{" "}
                      <a href={`mailto:${organizer.ownerEmail}`}>
                        {organizer.ownerEmail}
                      </a>
                    </p>
                  </div>
                  <span className={styles.rowMeta}>
                    {count(
                      data.events.filter(
                        (event) => event.ownerId === organizer.ownerId,
                      ).length,
                    )}{" "}
                    {it ? "eventi dell'account" : "account events"}
                  </span>
                </article>
              ))
            ) : (
              <Empty>
                {it
                  ? "Nessun profilo organizzatore."
                  : "No organizer profiles yet."}
              </Empty>
            )}
          </section>
          {data.totals.organizerCount > data.organizers.length && (
            <p className={styles.footnote}>
              {it
                ? "Sono mostrati i primi 100 profili."
                : "Showing the first 100 profiles."}
            </p>
          )}
        </>
      )}

      {view === "users" && (
        <>
          <ViewHeading
            eyebrow="03 / ACCOUNTS"
            title={it ? "Account" : "Accounts"}
            description={
              it
                ? "Trova un account verificato e assegna l'accesso amministratore."
                : "Find a verified account and manage administrator access."
            }
          />
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <span className={styles.eyebrow}>ACCESS</span>
                <h2>{it ? "Trova un account" : "Find an account"}</h2>
              </div>
            </div>
            <form className={styles.accountSearch} onSubmit={findAccount}>
              <label htmlFor="admin-account-email">
                {it ? "Email dell'account" : "Account email"}
              </label>
              <div>
                <input
                  id="admin-account-email"
                  type="email"
                  value={searchEmail}
                  onChange={(event) => setSearchEmail(event.target.value)}
                  placeholder="name@example.com"
                  required
                />
                <button type="submit">{it ? "Cerca" : "Search"}</button>
                {searched && (
                  <button
                    type="button"
                    onClick={() => { setSearched(false); setFoundUser(null); setSearchEmail(""); }}
                  >
                    {it ? "Mostra recenti" : "Show recent"}
                  </button>
                )}
              </div>
            </form>
          </section>
          <section className={styles.panel} aria-label={it ? "Elenco account" : "Account list"}>
            {visibleAccounts.length ? (
              visibleAccounts.map((account) => (
                <article className={styles.managementRow} key={account.id}>
                  <div className={styles.rowMain}>
                    <Status value={account.role.toLowerCase()} />
                    <h2>{account.name}</h2>
                    <p>{account.email} · {date(account.createdAt)}</p>
                    <small>
                      {account.emailVerified
                        ? it ? "Email verificata" : "Verified email"
                        : it ? "Email da verificare" : "Email not verified"}
                      {account.hasBusinessProfile && (it ? " · Profilo attività" : " · Business profile")}
                    </small>
                  </div>
                  <div className={styles.actions}>
                    {account.role === "USER" && account.emailVerified && !account.hasBusinessProfile && (
                      <button
                        disabled={Boolean(busy)}
                        onClick={() => void updateRole(account, "ADMIN")}
                      >
                        {it ? "Rendi admin" : "Make admin"}
                      </button>
                    )}
                    {account.role === "ADMIN" && account.id !== user?.id && (
                      <button
                        disabled={Boolean(busy)}
                        onClick={() => void updateRole(account, "USER")}
                      >
                        {it ? "Rimuovi admin" : "Remove admin"}
                      </button>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <Empty>{searched
                ? it ? "Nessun account con questa email." : "No account with this email."
                : it ? "Nessun account registrato." : "No accounts yet."}</Empty>
            )}
          </section>
          {!searched && <p className={styles.footnote}>
            {it ? "Sono mostrati i 100 account più recenti. Cerca per email per trovare gli altri." : "Showing the 100 most recent accounts. Search by email to find others."}
          </p>}
        </>
      )}

      {view === "tickets" && (
        <>
          <ViewHeading
            eyebrow="03 / TICKETS"
            title={it ? "Biglietti" : "Tickets"}
            description={
              it
                ? "Le ultime prenotazioni e il loro stato."
                : "Recent bookings and their current status."
            }
            aside={
              <span className={styles.headingCount}>
                {it ? "Ultime 100" : "Latest 100"}
              </span>
            }
          />
          <section
            className={styles.panel}
            aria-label={it ? "Elenco prenotazioni" : "Booking list"}
          >
            {data.bookings.length ? (
              data.bookings.map((booking) => (
                <article className={styles.managementRow} key={booking.id}>
                  <div className={styles.rowMain}>
                    <Status value={booking.status} />
                    <h2>
                      <Link href={`/events/${booking.eventSlug}`}>
                        {booking.eventTitle}
                      </Link>
                    </h2>
                    <p>
                      {booking.attendeeEmail} · {date(booking.createdAt)}
                    </p>
                  </div>
                  <div className={styles.ticketMeta}>
                    <strong>
                      {booking.quantity} ×{" "}
                      {booking.ticketType === "vip" ? "VIP" : "Standard"}
                    </strong>
                    <span>
                      {booking.mode === "stripe"
                        ? new Intl.NumberFormat(locale, {
                            style: "currency",
                            currency: booking.currency,
                          }).format(booking.total / 100)
                        : booking.mode === "free"
                          ? it
                            ? "Gratis"
                            : "Free"
                          : "Demo"}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <Empty>{it ? "Nessuna prenotazione." : "No bookings yet."}</Empty>
            )}
          </section>
        </>
      )}

      {view === "payments" && (
        <>
          <ViewHeading
            eyebrow="04 / PAYMENTS"
            title={it ? "Pagamenti" : "Payments"}
            description={
              it
                ? "Rimborsi richiesti e checkout da chiudere dopo una cancellazione."
                : "Refund requests and open checkouts after event cancellation."
            }
          />
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <span className={styles.eyebrow}>REFUNDS</span>
                <h2>{it ? "Rimborsi da esaminare" : "Refunds to review"}</h2>
              </div>
            </div>
            {data.refundRequests.length ? (
              data.refundRequests.map((item) => (
                <article className={styles.managementRow} key={item.id}>
                  <div className={styles.rowMain}>
                    <h2>{item.eventTitle}</h2>
                    <p>{item.email}</p>
                  </div>
                  <button
                    className={styles.actionButton}
                    disabled={Boolean(busy)}
                    onClick={() => {
                      if (
                        window.confirm(
                          it
                            ? "Emettere un rimborso completo?"
                            : "Issue a full refund?",
                        )
                      )
                        void perform(`admin/refunds/${item.id}`, {});
                    }}
                  >
                    {it ? "Rimborso completo" : "Issue full refund"}
                  </button>
                </article>
              ))
            ) : (
              <Empty>
                {it
                  ? "Nessun rimborso in attesa."
                  : "No refund requests waiting."}
              </Empty>
            )}
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <span className={styles.eyebrow}>CANCELLED EVENTS</span>
                <h2>{it ? "Checkout ancora aperti" : "Open checkouts"}</h2>
              </div>
            </div>
            {data.pendingCancellations.length ? (
              data.pendingCancellations.map((item) => (
                <article className={styles.managementRow} key={item.id}>
                  <div className={styles.rowMain}>
                    <h2>{item.eventTitle}</h2>
                    <p>{item.email}</p>
                  </div>
                  <button
                    className={styles.actionButton}
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void perform(`admin/checkouts/${item.id}/expire`, {})
                    }
                  >
                    {it ? "Chiudi checkout" : "Close checkout"}
                  </button>
                </article>
              ))
            ) : (
              <Empty>
                {it
                  ? "Nessun checkout da chiudere."
                  : "No checkouts need closing."}
              </Empty>
            )}
          </section>
        </>
      )}

      {view === "moderation" && (
        <>
          <ViewHeading
            eyebrow="05 / MODERATION"
            title={it ? "Moderazione" : "Moderation"}
            description={
              it
                ? "Gestisci segnalazioni, controversie e problemi di consegna."
                : "Manage reports, disputes and message delivery issues."
            }
          />
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <span className={styles.eyebrow}>CASES</span>
                <h2>
                  {it ? "Segnalazioni e controversie" : "Reports and disputes"}
                </h2>
              </div>
              <span className={styles.panelCount}>
                {count(openCases)} {it ? "aperti" : "open"}
              </span>
            </div>
            <details className={styles.newCase}>
              <summary>
                {it ? "Apri un caso interno" : "Open an internal case"}
              </summary>
              <form onSubmit={addCase}>
                <select
                  aria-label={it ? "Tipo di caso" : "Case type"}
                  value={caseKind}
                  onChange={(event) =>
                    setCaseKind(event.target.value as typeof caseKind)
                  }
                >
                  <option value="incident">
                    {it ? "Incidente" : "Incident"}
                  </option>
                  <option value="payment">
                    {it ? "Pagamento" : "Payment"}
                  </option>
                  <option value="dispute">
                    {it ? "Controversia" : "Dispute"}
                  </option>
                </select>
                <input
                  aria-label={it ? "Oggetto" : "Subject"}
                  placeholder={it ? "Oggetto" : "Subject"}
                  value={caseSubject}
                  onChange={(event) => setCaseSubject(event.target.value)}
                  minLength={5}
                  maxLength={120}
                  required
                />
                <textarea
                  aria-label={it ? "Dettagli" : "Details"}
                  placeholder={
                    it ? "Dettagli e prossimo passo" : "Details and next step"
                  }
                  value={caseDetails}
                  onChange={(event) => setCaseDetails(event.target.value)}
                  minLength={10}
                  maxLength={3000}
                  required
                  rows={3}
                />
                <button disabled={Boolean(busy)}>
                  {it ? "Crea caso" : "Create case"}
                </button>
              </form>
            </details>
            {data.cases.length ? (
              data.cases.map((item) => (
                <article className={styles.managementRow} key={item.id}>
                  <div className={styles.rowMain}>
                    <Status value={item.status} />
                    <h2>{item.subject}</h2>
                    <p>{item.details}</p>
                    <small>
                      {item.eventTitle ? `${item.eventTitle} · ` : ""}
                      {item.bookingId
                        ? `${it ? "Prenotazione" : "Booking"} ${item.bookingId.slice(0, 8)} · `
                        : ""}
                      {date(item.createdAt)}
                    </small>
                    {item.reporterEmail && (
                      <a href={`mailto:${item.reporterEmail}`}>
                        {item.reporterEmail}
                      </a>
                    )}
                  </div>
                  <button
                    className={styles.actionButton}
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void perform(
                        `admin/cases/${item.id}`,
                        {
                          status: item.status === "open" ? "resolved" : "open",
                        },
                        "PUT",
                      )
                    }
                  >
                    {item.status === "open"
                      ? it
                        ? "Risolvi"
                        : "Resolve"
                      : it
                        ? "Riapri"
                        : "Reopen"}
                  </button>
                </article>
              ))
            ) : (
              <Empty>{it ? "Nessun caso." : "No cases yet."}</Empty>
            )}
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <span className={styles.eyebrow}>DELIVERY</span>
                <h2>{it ? "Consegna dei messaggi" : "Message delivery"}</h2>
              </div>
              <button
                className={styles.actionButton}
                disabled={Boolean(busy)}
                onClick={() => void perform("admin/messages/dispatch", {})}
              >
                {it ? "Invia o riprova" : "Send or retry"}
              </button>
            </div>
            <p className={styles.panelIntro}>
              {count(data.pendingMessages)}{" "}
              {it
                ? "messaggi in attesa o non consegnati."
                : "messages pending or failed."}
            </p>
            {data.messageIssues.length ? (
              data.messageIssues.map((item) => (
                <div className={styles.managementRow} key={item.id}>
                  <div className={styles.rowMain}>
                    <h2>{item.kind}</h2>
                    <p>
                      {item.email} · {item.attempts}{" "}
                      {it ? "tentativi" : "attempts"}
                    </p>
                    <small>{item.lastError}</small>
                  </div>
                </div>
              ))
            ) : (
              <Empty>
                {it ? "Nessun errore di consegna." : "No delivery failures."}
              </Empty>
            )}
          </section>
        </>
      )}

      {view === "settings" && (
        <>
          <ViewHeading
            eyebrow="06 / SETTINGS"
            title={it ? "Impostazioni" : "Settings"}
            description={
              it
                ? "Configurazione operativa visibile agli amministratori."
                : "Operational configuration visible to administrators."
            }
          />
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <span className={styles.eyebrow}>PLATFORM</span>
                <h2>{it ? "Stato della piattaforma" : "Platform status"}</h2>
              </div>
            </div>
            <div className={styles.settingRow}>
              <div>
                <strong>
                  {it ? "Revisione degli eventi" : "Event approval"}
                </strong>
                <p>
                  {it
                    ? "Il controllo viene configurato nell'ambiente dell'app."
                    : "Controlled by the app environment."}
                </p>
              </div>
              <span>
                {data.settings.approvalRequired
                  ? it
                    ? "Richiesta"
                    : "Required"
                  : it
                    ? "Non richiesta"
                    : "Not required"}
              </span>
            </div>
            <div className={styles.settingRow}>
              <div>
                <strong>{it ? "Consegna email" : "Email delivery"}</strong>
                <p>
                  {it
                    ? "Modalità di invio attualmente configurata."
                    : "Current delivery mode."}
                </p>
              </div>
              <span>{data.settings.emailDelivery}</span>
            </div>
            <div className={styles.settingRow}>
              <div>
                <strong>
                  {it ? "Accesso amministratore" : "Admin access"}
                </strong>
                <p>
                  {it
                    ? "L'accesso amministratore è salvato nell'account. Gestisci i ruoli dalla pagina Account."
                    : "Administrator access is stored on the account. Manage roles from Accounts."}
                </p>
              </div>
              <Link href="/admin?view=users">{it ? "Gestisci" : "Manage"} ↗</Link>
            </div>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <span className={styles.eyebrow}>PUBLIC</span>
                <h2>{it ? "Regole pubbliche" : "Public policies"}</h2>
              </div>
              <Link href="/policies">
                {it ? "Apri le regole" : "Open policies"} ↗
              </Link>
            </div>
            <p className={styles.panelIntro}>
              {it
                ? "Controlla le informazioni pubblicate per organizzatori e partecipanti."
                : "Review the information published for organizers and attendees."}
            </p>
          </section>
        </>
      )}
    </main>
  );
}
