import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { FiArrowUpRight, FiCalendar } from "react-icons/fi";
import { currentUser } from "@/lib/auth";
import { listTickets } from "@/lib/db";
import { eventDate } from "@/lib/format";
import { getLanguage } from "@/lib/i18n-server";
import { translate, type TranslationKey } from "@/lib/i18n";
import { isPlatformTestBooking } from "@/lib/platform-checkout-test";
export const metadata = { title: "My tickets" };
export default async function Tickets() {
  const language = await getLanguage();
  const t = (key: TranslationKey) => translate(language, key);
  const user = await currentUser();
  if (!user) redirect("/login?next=/tickets");
  const tickets = await listTickets(user.id);
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <span className="eyebrow">{t("tickets.eyebrow")}</span>
        <h1>{t("tickets.title")}</h1>
        <p>{t("tickets.intro")}</p>
      </div>
      {tickets.length ? (
        <div className="ticket-list">
          {tickets.map((t) => (
            <article className="ticket-row" key={t.id}>
              <div className="ticket-thumb">
                <Image
                  src={"/images/" + t.event.image + ".jpg"}
                  alt=""
                  fill
                  sizes="150px"
                />
              </div>
              <div>
                <span className={"status status-" + t.status}>
                  {translate(language, ("tickets." + t.status) as TranslationKey)}
                  {t.mode === "sample" ? " · " + translate(language, "tickets.sample") : ""}
                  {isPlatformTestBooking(t) ? " · " + (language === "it" ? "Prova" : "Test") : ""}
                </span>
                <h2>
                  <Link href={"/tickets/" + t.id}>{t.event.title}</Link>
                </h2>
                <p>
                  {eventDate(t.event.startsAt, t.event.timezone, false, language)} ·{" "}
                  {t.event.city} ·{" "}
                  {t.ticketType === "vip" ? "VIP" : translate(language, "booking.standard")} · {t.quantity} {translate(language, t.quantity > 1 ? "booking.ticketMany" : "booking.ticketOne")}
                </p>
              </div>
              <Link
                href={"/tickets/" + t.id}
                className="button button-outline button-small"
              >
                {t.status === "pending" ? translate(language, "tickets.manageCheckout") : translate(language, "tickets.viewBooking")}
                <FiArrowUpRight />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FiCalendar />
          <h3>{t("tickets.emptyTitle")}</h3>
          <p>{t("tickets.emptyBody")}</p>
          <Link href="/events" className="button button-primary">
            {t("tickets.findNext")}
          </Link>
        </div>
      )}
    </main>
  );
}
