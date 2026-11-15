"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { useApp } from "./AppProvider";

export default function ReportForm({ eventId, bookingId, bookings }: { eventId: string; bookingId: string; bookings: { id: string; title: string }[] }) {
  const { language } = useApp();
  const it = language === "it";
  const event = eventId;
  const [booking, setBooking] = useState(bookingId);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await api("reports", { method: "POST", body: { eventId: event || undefined, bookingId: booking || undefined, subject, details } });
      setSent(true);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <main id="main" className="container page-main" style={{ maxWidth: 760 }}>
    <div className="page-heading"><span className="eyebrow">EVENTLY / SUPPORT</span><h1>{it ? "Segnala un problema" : "Report a problem"}</h1>
      <p>{it ? "Descrivi un problema con un evento o una prenotazione. Il team Evently lo esaminerà." : "Describe an issue with an event or booking. Evently's team will review it."}</p></div>
    {sent ? <div className="notice" role="status">{it ? "Segnalazione ricevuta. Conserva l'email di prenotazione per eventuali verifiche." : "Report received. Keep your booking email in case we need to follow up."} <Link href="/help">{it ? "Aiuto" : "Help"}</Link></div> :
      <form onSubmit={submit} className="section" style={{ display: "grid", gap: 18 }}>
        {eventId && <div className="field"><label htmlFor="report-event">{it ? "Evento" : "Event"}</label><input id="report-event" value={event} readOnly /></div>}
        {!eventId && <div className="field"><label htmlFor="report-booking">{it ? "La tua prenotazione" : "Your booking"}</label><select id="report-booking" value={booking} onChange={(e) => setBooking(e.target.value)}><option value="">{it ? "Scegli una prenotazione" : "Choose a booking"}</option>{bookings.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.id.slice(0, 8)}</option>)}</select></div>}
        {!eventId && !bookings.length && <p>{it ? "Apri la pagina dell'evento e usa il link Segnala un problema per iniziare." : "Open the event page and use its Report a problem link to begin."} <Link href="/events">{it ? "Esplora eventi" : "Explore events"}</Link></p>}
        <div className="field"><label htmlFor="report-subject">{it ? "Oggetto" : "Subject"}</label><input id="report-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={5} maxLength={120} /></div>
        <div className="field"><label htmlFor="report-details">{it ? "Dettagli" : "Details"}</label><textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} required minLength={10} maxLength={3000} rows={7} /></div>
        {error && <p role="alert" className="error-box">{error}</p>}
        <button className="button button-primary" disabled={busy || (!event && !booking)}>{busy ? (it ? "Invio…" : "Sending…") : (it ? "Invia segnalazione" : "Send report")}</button>
      </form>}
  </main>;
}
