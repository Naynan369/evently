"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FiArrowUpRight, FiCheckCircle, FiPlus } from "react-icons/fi";
import { api } from "@/lib/client";
import { eventDate, money } from "@/lib/format";
import { useApp } from "./AppProvider";
import type { Event, Booking } from "@/lib/types";
type Guest = Booking & { name: string; email: string };
export default function OrganizerStudio({
  events,
  bookings,
}: {
  events: Event[];
  bookings: Guest[];
}) {
  const { toast } = useApp();
  const router = useRouter();
  const [payment, setPayment] = useState<{
    configured: boolean;
    connected: boolean;
    ready: boolean;
  } | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [country, setCountry] = useState("GB");
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState("");
  const [checkError, setCheckError] = useState("");
  const [refund, setRefund] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);
  useEffect(() => {
    let active = true;
    api<{ configured: boolean; connected: boolean; ready: boolean }>(
      "stripe/status",
    )
      .then((data) => {
        if (active) setPayment(data);
      })
      .catch((e) => {
        if (active) setPaymentError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  async function connect() {
    setConnecting(true);
    setPaymentError("");
    try {
      const data = await api<{ url: string }>("stripe/connect", {
        method: "POST",
        body: { country },
      });
      const url = new URL(data.url);
      if (url.protocol !== "https:" || !url.hostname.endsWith(".stripe.com"))
        throw new Error("Unexpected onboarding destination.");
      window.location.assign(data.url);
    } catch (e) {
      setPaymentError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }
  async function checkIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setChecking(true);
    setCheckResult("");
    setCheckError("");
    const form = e.currentTarget;
    try {
      const result = await api<{
        quantity: number;
        name: string;
        event: string;
      }>("organizer/check-in", {
        method: "POST",
        body: { code: new FormData(form).get("code") },
      });
      setCheckResult(
        result.name +
          " · " +
          result.quantity +
          " guest" +
          (result.quantity > 1 ? "s" : "") +
          " checked in for " +
          result.event,
      );
      form.reset();
      router.refresh();
    } catch (error) {
      setCheckError((error as Error).message);
    } finally {
      setChecking(false);
    }
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
          ? "The booking has been refunded."
          : "Refund submitted. Stripe is processing it.",
      );
      setRefund(null);
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setRefunding(false);
    }
  }
  function exportGuests() {
    const quote = (s: string) => '"' + s.replace(/"/g, '""') + '"';
    const rows = [
      ["Name", "Email", "Event", "Tickets", "Status", "Checked in"],
      ...bookings.map((b) => [
        b.name,
        b.email,
        events.find((e) => e.id === b.eventId)?.title || "",
        String(b.quantity),
        b.status,
        b.checkedIn ? "Yes" : "No",
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
    const a = document.createElement("a");
    a.href = url;
    a.download = "evently-guests.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="metrics">
        <div className="metric">
          <span>Published events</span>
          <strong>{events.length}</strong>
        </div>
        <div className="metric">
          <span>Confirmed tickets</span>
          <strong>{confirmed.reduce((n, b) => n + b.quantity, 0)}</strong>
        </div>
        <div className="metric">
          <span>Guests checked in</span>
          <strong>
            {confirmed
              .filter((b) => b.checkedIn)
              .reduce((n, b) => n + b.quantity, 0)}
          </strong>
        </div>
      </div>
      <div className="studio-grid">
        <section className="panel">
          <h2>Ready to welcome people.</h2>
          <p>
            Enter a ticket’s code to check in its whole group. Codes can only be
            used once, and only for your events.
          </p>
          <form onSubmit={checkIn} className="connect-row">
            <div className="field">
              <label htmlFor="checkin-code">Ticket code</label>
              <input
                id="checkin-code"
                name="code"
                placeholder="EV-…"
                autoComplete="off"
                required
                maxLength={40}
              />
            </div>
            <button className="button button-dark" disabled={checking}>
              {checking ? "Checking…" : "Check in"}
              <FiCheckCircle />
            </button>
          </form>
          {checkResult && (
            <div className="success-box" role="status">
              {checkResult}
            </div>
          )}
          {checkError && (
            <div className="error-box" role="alert">
              {checkError}
            </div>
          )}
        </section>
        <section className="panel">
          <h2>Your payments, connected.</h2>
          <p>
            Use Stripe to accept payments directly into your organizer account.
            Free events work without Stripe.
          </p>
          {payment?.ready ? (
            <div className="success-box">
              <FiCheckCircle /> Stripe is connected and ready for paid tickets.
            </div>
          ) : (
            <>
              {payment && !payment.configured ? (
                <div className="notice notice-warm">
                  <strong>Platform setup is needed.</strong>
                  <br />
                  The platform owner needs to configure Stripe before organizers
                  can connect. You can create free events now.
                </div>
              ) : (
                <div className="connect-row">
                  <div className="field">
                    <label htmlFor="country">Business country</label>
                    <select
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      disabled={Boolean(payment?.connected)}
                    >
                      {[
                        ["GB", "United Kingdom"],
                        ["US", "United States"],
                        ["IT", "Italy"],
                        ["DE", "Germany"],
                        ["FR", "France"],
                        ["ES", "Spain"],
                        ["NL", "Netherlands"],
                        ["IE", "Ireland"],
                        ["CA", "Canada"],
                        ["AU", "Australia"],
                      ].map(([code, name]) => (
                        <option value={code} key={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="button button-outline"
                    disabled={connecting || !payment}
                    onClick={connect}
                  >
                    {connecting
                      ? "Opening Stripe…"
                      : payment?.connected
                        ? "Finish setup"
                        : "Connect Stripe"}
                    <FiArrowUpRight />
                  </button>
                </div>
              )}
            </>
          )}
          {paymentError && (
            <div className="error-box" role="alert">
              {paymentError}
            </div>
          )}
          <p className="form-note" style={{ textAlign: "left", marginTop: 13 }}>
            Evently adds no platform fee. Stripe processing fees apply.
          </p>
        </section>
      </div>
      <section>
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR IDEAS, OUT IN THE WORLD</span>
            <h2>Your events.</h2>
          </div>
          <Link
            href="/create-event"
            className="button button-dark button-small"
          >
            <FiPlus />
            Create an event
          </Link>
        </div>
        {events.length ? (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Your published events</caption>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Date</th>
                  <th scope="col">Tickets</th>
                  <th scope="col">Price</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.title}</strong>
                      <small>
                        {e.venue} · {e.city}
                      </small>
                    </td>
                    <td>{eventDate(e.startsAt, e.timezone, true)}</td>
                    <td>
                      {e.capacity - e.available} reserved / {e.capacity}
                    </td>
                    <td>{money(e.price, e.currency)}</td>
                    <td>
                      <Link className="text-link" href={"/events/" + e.slug}>
                        View <FiArrowUpRight />
                      </Link>
                      <span style={{ paddingInline: 8 }}>·</span>
                      <Link
                        className="text-link"
                        href={"/create-event?edit=" + e.id}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>Your next great idea belongs here.</h3>
            <p>Publish an event and start bringing your community together.</p>
            <Link href="/create-event" className="button button-primary">
              Create your first event
            </Link>
          </div>
        )}
      </section>
      <section className="section-spacer">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE PEOPLE MAKING IT HAPPEN</span>
            <h2>Your guest list.</h2>
          </div>
          {bookings.length > 0 && (
            <button
              className="button button-outline button-small"
              onClick={exportGuests}
            >
              Download guest list
            </button>
          )}
        </div>
        {bookings.length ? (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Guest bookings</caption>
              <thead>
                <tr>
                  <th scope="col">Guest</th>
                  <th scope="col">Event</th>
                  <th scope="col">Tickets</th>
                  <th scope="col">Status</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.name}</strong>
                      <small>{b.email}</small>
                    </td>
                    <td>{events.find((e) => e.id === b.eventId)?.title}</td>
                    <td>
                      {b.quantity}
                      {b.checkedIn ? <small>Checked in</small> : null}
                    </td>
                    <td>
                      <span className={"status status-" + b.status}>
                        {b.status}
                      </span>
                      {b.refundRequested > 0 && b.status === "confirmed" && (
                        <small>Refund requested</small>
                      )}
                    </td>
                    <td>{money(b.total, b.currency)}</td>
                    <td>
                      {b.status === "confirmed" && b.mode === "stripe" ? (
                        <button
                          className="button button-outline button-small"
                          onClick={() => setRefund(b.id)}
                        >
                          Refund
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="notice">
            When someone books one of your events, their reservation will appear
            here.
          </div>
        )}
        {refund && (
          <div className="notice">
            <strong>Refund this entire booking?</strong>
            <p>
              This returns the full ticket payment through Stripe and
              invalidates the tickets. This action cannot be undone.
            </p>
            <div className="ticket-actions">
              <button
                className="button button-danger"
                disabled={refunding}
                onClick={doRefund}
              >
                {refunding ? "Submitting refund…" : "Confirm full refund"}
              </button>
              <button
                className="button button-outline"
                onClick={() => setRefund(null)}
              >
                Keep booking
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
