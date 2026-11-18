"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { categories, categoryName } from "@/lib/catalog";
import { eventDate, money } from "@/lib/format";
import { messinaAreas, messinaAreaLabel, type MessinaArea } from "@/lib/messina";
import type { EventIntent } from "@/lib/intents";
import type { Category, Event } from "@/lib/types";
import { useApp } from "./AppProvider";
import styles from "@/styles/IntentMarketplace.module.css";

type IntentMatch = { intentId: string; events: Event[] };
type Snapshot = { intents: EventIntent[]; matches: IntentMatch[] };

export default function IntentStudio({ initialIntents, initialMatches, months }: {
  initialIntents: EventIntent[];
  initialMatches: IntentMatch[];
  months: string[];
}) {
  const { language } = useApp();
  const it = language === "it";
  const [intents, setIntents] = useState(initialIntents);
  const [matches, setMatches] = useState(initialMatches);
  const [editingId, setEditingId] = useState("");
  const [category, setCategory] = useState<Category>("music");
  const [area, setArea] = useState<MessinaArea | "">("");
  const [desiredMonth, setDesiredMonth] = useState(months[0]);
  const [maxPriceEuros, setMaxPriceEuros] = useState("30");
  const [partySize, setPartySize] = useState("1");
  const [note, setNote] = useState("");
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const monthLabel = (month: string) => new Intl.DateTimeFormat(it ? "it-IT" : "en-GB", {
    month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(month + "-01T12:00:00Z"));

  const refresh = async () => {
    const snapshot = await api<Snapshot>("intents");
    setIntents(snapshot.intents);
    setMatches(snapshot.matches);
  };
  const reset = () => {
    setEditingId(""); setCategory("music"); setArea("");
    setDesiredMonth(months[0]); setMaxPriceEuros("30");
    setPartySize("1"); setNote(""); setEmailOptIn(false);
  };
  const edit = (intent: EventIntent) => {
    setEditingId(intent.id); setCategory(intent.category); setArea(intent.area);
    setDesiredMonth(intent.desiredMonth);
    setMaxPriceEuros(String(intent.maxPriceCents / 100));
    setPartySize(String(intent.partySize)); setNote(intent.note);
    setEmailOptIn(intent.emailOptIn); setError(""); setNotice("");
    document.getElementById("intent-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const body = {
        category, area, desiredMonth,
        maxPriceCents: Math.round(Number(maxPriceEuros) * 100),
        partySize: Number(partySize), note, emailOptIn,
      };
      await api("intents" + (editingId ? `/${editingId}` : ""), {
        method: editingId ? "PUT" : "POST", body,
      });
      await refresh(); reset();
      setNotice(it ? "La tua idea è stata salvata." : "Your idea was saved.");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await api(`intents/${id}`, { method: "DELETE" });
      if (editingId === id) reset();
      await refresh();
      setNotice(it ? "Idea rimossa. Non riceverai nuove email per questa idea." : "Idea removed. No new emails will be sent for it.");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };

  return <main id="main" className={`container page-main ${styles.shell}`}>
    <div className={styles.hero}>
      <div><span className={styles.eyebrow}>EVENTLY / YOUR NEXT EXPERIENCE</span>
        <h1>{it ? "Immagina il prossimo evento." : "Imagine what comes next."}</h1>
        <p>{it ? "Descrivi l'esperienza che vorresti trovare a Messina. Evently raccoglie gli interessi della comunità e ti mostra gli eventi che corrispondono." : "Tell Evently what you would love to do in Messina. We group community interest and show you events that fit."}</p>
      </div>
      <div className={styles.heroIndex}><span>{it ? "LE TUE IDEE" : "YOUR IDEAS"}</span><strong>{String(intents.length).padStart(2, "0")}</strong></div>
    </div>
    <div className={styles.layout}>
      <section className={styles.formPanel} id="intent-form">
        <div className={styles.sectionHeading}><div><span>01 / TICKET INTENT</span><h2>{editingId ? (it ? "Modifica la tua idea" : "Refine your idea") : (it ? "Cosa vorresti vivere?" : "What would you go to?")}</h2></div></div>
        <form onSubmit={save} className={styles.form}>
          <div className={styles.formGrid}>
            <label>{it ? "Tipo di evento" : "Event type"}<select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{categories.map((item) => <option key={item.id} value={item.id}>{categoryName(item.id, language)}</option>)}</select></label>
            <label>{it ? "Zona" : "Area"}<select value={area} onChange={(event) => setArea(event.target.value as MessinaArea | "")}><option value="">{it ? "Tutta Messina" : "Anywhere in Messina"}</option>{messinaAreas.map((item) => <option key={item.id} value={item.id}>{messinaAreaLabel(item.id, language)}</option>)}</select></label>
            <label>{it ? "Quando" : "When"}<select value={desiredMonth} onChange={(event) => setDesiredMonth(event.target.value)}>{months.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</select></label>
            <label>{it ? "Budget massimo per persona (€)" : "Maximum per-person budget (€)"}<input type="number" inputMode="decimal" min="0" max="500" step="0.5" required value={maxPriceEuros} onChange={(event) => setMaxPriceEuros(event.target.value)} /></label>
            <label>{it ? "Persone nel tuo gruppo" : "People in your group"}<input type="number" min="1" max="10" step="1" required value={partySize} onChange={(event) => setPartySize(event.target.value)} /></label>
            <label className={styles.wide}>{it ? "Il dettaglio che lo renderebbe speciale" : "What would make it special?"}<textarea maxLength={240} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder={it ? "Per esempio: una serata afrobeat con musica dal vivo." : "For example: an Afrobeat night with live music."} /><small>{it ? "Questa nota è privata; gli organizzatori vedono solo numeri aggregati." : "This note stays private. Organizers see grouped numbers only."}</small></label>
          </div>
          <label className={styles.optIn}><input type="checkbox" checked={emailOptIn} onChange={(event) => setEmailOptIn(event.target.checked)} /><span>{it ? "Mandami un'email quando viene pubblicato un evento corrispondente. Posso cambiare idea in qualsiasi momento." : "Email me when a matching event is published. I can change this preference at any time."}</span></label>
          <div className={styles.formFooter}><p>{it ? "Nessun addebito o prenotazione. La tua idea non garantisce la creazione di un evento." : "No charge or reservation. Saving an idea does not guarantee an event."}</p><div><button className={styles.primaryButton} disabled={busy}>{busy ? (it ? "Salvataggio…" : "Saving…") : editingId ? (it ? "Salva modifiche" : "Save changes") : (it ? "Salva la mia idea" : "Save my idea")}</button>{editingId && <button type="button" className={styles.ghostButton} onClick={reset}>{it ? "Annulla" : "Cancel"}</button>}</div></div>
        </form>
      </section>
      <aside className={styles.aside}><span>02 / HOW IT WORKS</span><h2>{it ? "Da un'idea a una serata vera." : "From a thought to a real night out."}</h2><ol><li>{it ? "Tu descrivi quello che cerchi." : "You describe what you want."}</li><li>{it ? "Evently raggruppa interessi simili senza rivelare chi sei." : "Evently groups similar ideas without identifying you."}</li><li>{it ? "Gli organizzatori possono creare un evento per quella domanda." : "Organizers can create an event for that demand."}</li><li>{it ? "Ti mostriamo gli eventi corrispondenti e, se vuoi, ti scriviamo." : "We show matching events and email you if you opt in."}</li></ol></aside>
    </div>
    {(error || notice) && <p className={error ? styles.error : styles.notice} role={error ? "alert" : "status"}>{error || notice}</p>}
    <section className={styles.savedSection}><div className={styles.sectionHeading}><div><span>03 / YOUR IDEAS</span><h2>{it ? "Interessi salvati" : "Your saved ideas"}</h2></div><Link href="/events">{it ? "Esplora gli eventi" : "Explore events"} ↗</Link></div>
      {intents.length ? <div className={styles.savedGrid}>{intents.map((intent) => {
        const matched = matches.find((item) => item.intentId === intent.id)?.events || [];
        return <article className={styles.savedCard} key={intent.id}>
          <div className={styles.cardTop}><span>{categoryName(intent.category, language)}</span><span>{monthLabel(intent.desiredMonth)}</span></div>
          <h3>{intent.area ? messinaAreaLabel(intent.area, language) : (it ? "Tutta Messina" : "Anywhere in Messina")}</h3>
          <p>{it ? "Fino a" : "Up to"} {money(intent.maxPriceCents, "eur", language)} / {it ? "persona" : "person"} · {intent.partySize} {intent.partySize === 1 ? (it ? "persona" : "person") : (it ? "persone" : "people")}</p>
          {intent.note && <blockquote>{intent.note}</blockquote>}
          <span className={styles.emailState}>{intent.emailOptIn ? (it ? "Email attive" : "Email on") : (it ? "Solo aggiornamenti qui" : "Updates here only")}</span>
          {matched.length ? <div className={styles.matches}><strong>{it ? "Eventi corrispondenti" : "Matching events"}</strong>{matched.map((event) => <Link key={event.id} href={`/events/${event.slug}`}><span>{event.title}<small>{eventDate(event.startsAt, event.timezone, false, language)}</small></span><span aria-hidden="true">↗</span></Link>)}</div> : <p className={styles.noMatch}>{it ? "Nessun evento corrispondente ancora. Torna a controllare." : "No matching event yet. Check back soon."}</p>}
          <div className={styles.cardActions}><button disabled={busy} onClick={() => edit(intent)}>{it ? "Modifica" : "Edit"}</button><button disabled={busy} onClick={() => void remove(intent.id)}>{it ? "Rimuovi" : "Remove"}</button></div>
        </article>;
      })}</div> : <div className={styles.empty}><span>EVENTLY / FIRST IDEA</span><h3>{it ? "La tua prossima esperienza inizia qui." : "Your next experience begins here."}</h3><p>{it ? "Salva un'idea per vedere gli eventi corrispondenti e aiutare gli organizzatori a capire cosa manca in città." : "Save an idea to discover matching events and help organizers see what the city is missing."}</p></div>}
    </section>
  </main>;
}
