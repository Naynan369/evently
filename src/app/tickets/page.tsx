import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { FiArrowUpRight, FiCalendar } from "react-icons/fi";
import { currentUser } from "@/lib/auth";
import { listTickets } from "@/lib/db";
import { eventDate } from "@/lib/format";
export const metadata = { title: "My tickets" };
export default async function Tickets() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/tickets");
  const tickets = await listTickets(user.id);
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <span className="eyebrow">YOU’VE GOT PLANS</span>
        <h1>Good times, booked.</h1>
        <p>
          Your tickets, your memories in the making. Everything you need to show
          up.
        </p>
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
                  {t.status}
                  {t.mode === "sample" ? " · sample" : ""}
                </span>
                <h2>
                  <Link href={"/tickets/" + t.id}>{t.event.title}</Link>
                </h2>
                <p>
                  {eventDate(t.event.startsAt, t.event.timezone)} ·{" "}
                  {t.event.city} · {t.quantity} ticket
                  {t.quantity > 1 ? "s" : ""}
                </p>
              </div>
              <Link
                href={"/tickets/" + t.id}
                className="button button-outline button-small"
              >
                {t.status === "pending" ? "Manage checkout" : "View booking"}
                <FiArrowUpRight />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FiCalendar />
          <h3>Your calendar has room for something good.</h3>
          <p>Once you book an event, your tickets will appear here.</p>
          <Link href="/events" className="button button-primary">
            Find your next experience
          </Link>
        </div>
      )}
    </main>
  );
}
