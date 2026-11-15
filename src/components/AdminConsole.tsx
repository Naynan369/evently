"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { useApp } from "./AppProvider";
import type { operatorSnapshot } from "@/lib/operations";
import styles from "./AdminConsole.module.css";

type Snapshot = Awaited<ReturnType<typeof operatorSnapshot>>;

export default function AdminConsole({ initial }: { initial: Snapshot }) {
  const { language } = useApp();
  const it = language === "it";
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [caseKind, setCaseKind] = useState<"incident" | "payment" | "dispute">("incident");
  const [caseSubject, setCaseSubject] = useState("");
  const [caseDetails, setCaseDetails] = useState("");
  const refresh = async () => setData(await api<Snapshot>("admin"));
  const action = async (key: string, path: string, body: unknown) => {
    setBusy(key); setError(""); setMessage("");
    try {
      await api(path, { method: path.includes("/cases/") ? "PUT" : "POST", body });
      await refresh();
      setMessage(it ? "Aggiornato." : "Updated.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally { setBusy(""); }
  };
  const addCase = async (event: FormEvent) => {
    event.preventDefault(); setBusy("new-case"); setError(""); setMessage("");
    try {
      await api("admin/cases", { method: "POST", body: { kind: caseKind, subject: caseSubject, details: caseDetails } });
      setCaseSubject(""); setCaseDetails(""); await refresh();
      setMessage(it ? "Caso aperto." : "Case opened.");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(""); }
  };
  return (
    <main id="main" className={`container page-main ${styles.console}`}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>EVENTLY / OPERATIONS</span>
          <h1>{it ? "Centro operativo" : "Operations desk"}</h1>
          <p>{it ? "Esamina eventi, eccezioni di pagamento, segnalazioni e messaggi." : "Review listings, payment exceptions, reports and delivery."}</p>
        </div>
        <Link href="/policies">{it ? "Regole pubbliche" : "Public policies"} ↗</Link>
      </header>
      {(error || message) && <p className={error ? styles.error : styles.notice} role={error ? "alert" : "status"}>{error || message}</p>}
      <div className={styles.metrics}>
        <div><strong>{data.events.filter((event) => event.visibility === "review").length}</strong><span>{it ? "Da esaminare" : "Awaiting review"}</span></div>
        <div><strong>{data.cases.filter((item) => item.status === "open").length}</strong><span>{it ? "Casi aperti" : "Open cases"}</span></div>
        <div><strong>{data.refundRequests.length + data.pendingCancellations.length}</strong><span>{it ? "Pagamenti da seguire" : "Payment follow-ups"}</span></div>
        <div><strong>{data.pendingMessages}</strong><span>{it ? "Messaggi in attesa" : "Messages awaiting delivery"}</span></div>
      </div>
      <section className={styles.section}>
        <div className={styles.heading}><div><span>01 / MODERATION</span><h2>{it ? "Eventi" : "Listings"}</h2></div></div>
        <div className={styles.list}>{data.events.map((event) => (
          <article className={styles.row} key={event.id}>
            <div><span className={styles.state}>{event.visibility || "published"}</span>
              <h3>{event.title}</h3><p>{event.city} · {event.host} · {new Date(event.startsAt).toLocaleDateString(it ? "it-IT" : "en-GB")}</p>
              <Link href={`/events/${event.slug}`}>{it ? "Apri evento" : "Open event"} ↗</Link>
            </div>
            <div className={styles.actions}>
              {event.visibility !== "published" && event.visibility !== "cancelled" && <button disabled={Boolean(busy)} onClick={() => action(event.id, `admin/events/${event.id}`, { action: "approve" })}>{it ? "Approva" : "Approve"}</button>}
              {event.visibility === "review" && <button disabled={Boolean(busy)} onClick={() => action(event.id, `admin/events/${event.id}`, { action: "reject" })}>{it ? "Rifiuta" : "Reject"}</button>}
              {event.visibility === "published" && <button disabled={Boolean(busy)} onClick={() => { if (window.confirm(it ? "Annullare l'evento e avvisare gli ospiti?" : "Cancel the event and notify guests?")) void action(event.id, `admin/events/${event.id}`, { action: "cancel" }); }}>{it ? "Annulla evento" : "Cancel event"}</button>}
            </div>
          </article>
        ))}</div>
      </section>
      <section className={styles.section}>
        <div className={styles.heading}><div><span>02 / CASES</span><h2>{it ? "Segnalazioni e controversie" : "Reports and disputes"}</h2></div></div>
        <details className={styles.newCase}>
          <summary>{it ? "Apri un caso interno" : "Open an internal case"}</summary>
          <form onSubmit={addCase}>
            <select aria-label={it ? "Tipo di caso" : "Case type"} value={caseKind} onChange={(event) => setCaseKind(event.target.value as typeof caseKind)}><option value="incident">{it ? "Incidente" : "Incident"}</option><option value="payment">{it ? "Pagamento" : "Payment"}</option><option value="dispute">{it ? "Controversia" : "Dispute"}</option></select>
            <input aria-label={it ? "Oggetto" : "Subject"} placeholder={it ? "Oggetto" : "Subject"} value={caseSubject} onChange={(event) => setCaseSubject(event.target.value)} minLength={5} maxLength={120} required />
            <textarea aria-label={it ? "Dettagli" : "Details"} placeholder={it ? "Dettagli e prossimo passo" : "Details and next step"} value={caseDetails} onChange={(event) => setCaseDetails(event.target.value)} minLength={10} maxLength={3000} required rows={3} />
            <button disabled={Boolean(busy)}>{it ? "Crea caso" : "Create case"}</button>
          </form>
        </details>
        <div className={styles.list}>{data.cases.length ? data.cases.map((item) => (
          <article className={styles.row} key={item.id}>
            <div><span className={styles.state}>{item.kind} · {item.status}</span><h3>{item.subject}</h3><p>{item.details}</p><small>{item.eventTitle ? `${item.eventTitle} · ` : ""}{item.bookingId ? `${it ? "Prenotazione" : "Booking"} ${item.bookingId.slice(0, 8)} · ` : ""}{new Date(item.createdAt).toLocaleString(it ? "it-IT" : "en-GB")}</small>{item.reporterEmail && <p><a href={`mailto:${item.reporterEmail}`}>{item.reporterEmail}</a></p>}</div>
            <button disabled={Boolean(busy)} onClick={() => action(item.id, `admin/cases/${item.id}`, { status: item.status === "open" ? "resolved" : "open" })}>{item.status === "open" ? (it ? "Risolvi" : "Resolve") : (it ? "Riapri" : "Reopen")}</button>
          </article>
        )) : <p className={styles.empty}>{it ? "Nessun caso." : "No cases yet."}</p>}</div>
      </section>
      <section className={styles.section}>
        <div className={styles.heading}><div><span>03 / PAYMENTS & DELIVERY</span><h2>{it ? "Eccezioni da seguire" : "Exceptions to follow up"}</h2></div>
          <button disabled={Boolean(busy)} onClick={() => action("dispatch", "admin/messages/dispatch", {})}>{it ? "Invia o riprova messaggi" : "Send or retry messages"}</button>
        </div>
        <div className={styles.list}>{data.refundRequests.length ? data.refundRequests.map((item) => (
          <article className={styles.row} key={item.id}><div><span className={styles.state}>REFUND REQUEST</span><h3>{item.eventTitle}</h3><p>{item.email}</p></div><button disabled={Boolean(busy)} onClick={() => { if (window.confirm(it ? "Emettere un rimborso completo?" : "Issue a full refund?")) void action(item.id, `admin/refunds/${item.id}`, {}); }}>{it ? "Rimborso completo" : "Issue full refund"}</button></article>
        )) : <p className={styles.empty}>{it ? "Nessun rimborso in attesa." : "No refund requests waiting."}</p>}</div>
        {data.pendingCancellations.length > 0 && <div className={styles.list}>{data.pendingCancellations.map((item) => (
          <article className={styles.row} key={item.id}><div><span className={styles.state}>{it ? "CHECKOUT APERTO · EVENTO ANNULLATO" : "OPEN CHECKOUT · CANCELLED EVENT"}</span><h3>{item.eventTitle}</h3><p>{item.email}</p></div><button disabled={Boolean(busy)} onClick={() => action(item.id, `admin/checkouts/${item.id}/expire`, {})}>{it ? "Chiudi checkout" : "Close checkout"}</button></article>
        ))}</div>}
        {data.messageIssues.length > 0 && <div className={styles.list}>{data.messageIssues.map((item) => (
          <article className={styles.row} key={item.id}><div><span className={styles.state}>{it ? "EMAIL NON CONSEGNATA" : "EMAIL DELIVERY FAILED"}</span><h3>{item.kind}</h3><p>{item.email} · {item.attempts} {it ? "tentativi" : "attempts"}</p><small>{item.lastError}</small></div></article>
        ))}</div>}
      </section>
    </main>
  );
}
