import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { demandSignals } from "@/lib/intents";
import { categoryName } from "@/lib/catalog";
import { money } from "@/lib/format";
import { getLanguage } from "@/lib/i18n-server";
import { messinaAreaLabel } from "@/lib/messina";
import { isOperator } from "@/lib/operations";
import styles from "@/components/IntentMarketplace.module.css";

export const metadata = { title: "Demand in Messina", robots: { index: false, follow: false } };

export default async function OrganizerDemandPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/organizer/demand");
  if (!user.emailVerified) redirect("/verify-email");
  if (isOperator(user)) redirect("/admin");
  if (!user.isOrganizer) redirect("/account");
  const [signals, language] = await Promise.all([demandSignals(), getLanguage()]);
  const it = language === "it";
  const monthLabel = (month: string) => new Intl.DateTimeFormat(it ? "it-IT" : "en-GB", {
    month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(month + "-01T12:00:00Z"));

  return <main id="main" className={`container page-main ${styles.shell}`}>
    <div className={styles.hero}>
      <div><span className={styles.eyebrow}>EVENTLY / DEMAND</span>
        <h1>{it ? "Quello che Messina vorrebbe vivere." : "What Messina wants next."}</h1>
        <p>{it ? "Scopri gli interessi condivisi prima di creare il prossimo evento. Questi segnali non sono prenotazioni o vendite garantite." : "See shared interest before creating your next event. These signals are not reservations or guaranteed sales."}</p>
      </div>
      <div className={styles.heroIndex}><span>{it ? "SEGNALI VISIBILI" : "VISIBLE SIGNALS"}</span><strong>{String(signals.length).padStart(2, "0")}</strong></div>
    </div>
    <div className={styles.sectionHeading}><div><span>01 / REVERSE MARKETPLACE</span><h2>{it ? "Domanda da esplorare" : "Demand to explore"}</h2></div><Link href="/organizer">{it ? "Torna allo studio" : "Back to studio"} ↗</Link></div>
    {signals.length ? <div className={styles.demandGrid}>{signals.map((signal) => {
      const query = new URLSearchParams({ demandCategory: signal.category, demandArea: signal.area, demandMonth: signal.desiredMonth });
      return <article className={styles.demandCard} key={`${signal.category}-${signal.area}-${signal.desiredMonth}`}>
        <div className={styles.cardTop}><span>{categoryName(signal.category, language)}</span><span>{monthLabel(signal.desiredMonth)}</span></div>
        <h3>{signal.area ? messinaAreaLabel(signal.area, language) : (it ? "Tutta Messina" : "Anywhere in Messina")}</h3>
        <div className={styles.demandMetrics}>
          <div><strong>{signal.attendees}</strong><span>{it ? "persone interessate" : "interested people"}</span></div>
          <div><strong>{signal.potentialGuests}</strong><span>{it ? "posti potenziali" : "potential guests"}</span></div>
        </div>
        <p>{it ? "Budget massimo medio" : "Average maximum budget"} <strong>{money(signal.averageBudgetCents, "eur", language)}</strong></p>
        <Link className={styles.primaryLink} href={`/create-event?${query}`}>{it ? "Crea un evento per questo interesse" : "Create for this interest"} <span aria-hidden="true">↗</span></Link>
      </article>;
    })}</div> : <div className={styles.empty}><span>EVENTLY / EARLY SIGNALS</span><h3>{it ? "La domanda prende forma con la comunità." : "Demand grows with the community."}</h3><p>{it ? "Un gruppo appare qui quando almeno tre partecipanti scelgono la stessa categoria, zona e mese. Nessuna idea individuale o indirizzo email viene mostrato." : "A group appears here once at least three attendees choose the same category, area and month. Individual notes and email addresses are never shown."}</p></div>}
    <p className={styles.finePrint}>{it ? "I segnali sono aggregati e anonimi. Gli organizzatori possono creare eventi in autonomia; Evently non promette che ogni idea diventi un evento." : "Signals are grouped and anonymous. Organizers choose what to create; Evently does not promise that every idea becomes an event."}</p>
  </main>;
}
