"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FiArrowRight, FiShield, FiHeart, FiShare2 } from "react-icons/fi";
import { api } from "@/lib/client";
import { money } from "@/lib/format";
import type { Event } from "@/lib/types";
import { useApp } from "./AppProvider";
export default function BookingPanel({
  event,
  acceptingPayments,
  past,
}: {
  event: Event;
  acceptingPayments: boolean;
  past: boolean;
}) {
  const { user, saved, toggleSave, toast } = useApp();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const unavailable = past || event.available < 1;
  const payable = event.price > 0 && !event.sample;
  async function book() {
    if (!user) {
      router.push("/login?next=" + encodeURIComponent("/events/" + event.slug));
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    const key = "evently-checkout:" + user.id + ":" + event.id + ":" + quantity;
    try {
      let nonce = sessionStorage.getItem(key);
      if (!nonce) {
        nonce = crypto.randomUUID();
        sessionStorage.setItem(key, nonce);
      }
      const result = await api<{ url: string }>("checkout", {
        method: "POST",
        body: { eventId: event.id, quantity, requestKey: nonce },
      });
      sessionStorage.removeItem(key);
      if (result.url.startsWith("/")) {
        router.push(result.url);
        router.refresh();
      } else {
        const target = new URL(result.url);
        if (
          target.protocol !== "https:" ||
          target.hostname !== "checkout.stripe.com"
        )
          throw new Error("Unexpected checkout destination.");
        window.location.assign(result.url);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Event link copied");
    } catch {
      toast("Copy this event’s address from your browser to share it.");
    }
  }
  return (
    <aside>
      <div className="booking-panel">
        <h2>
          {unavailable
            ? past
              ? "Booking has closed"
              : "This one’s full"
            : event.sample
              ? "Try the experience"
              : "Make it a plan."}
        </h2>
        <p>
          {event.sample
            ? "An illustrative event. Sample bookings are free."
            : "General admission · " + event.available + " tickets available"}
        </p>
        <div className="price-display">
          {money(event.price, event.currency)}
          <small>per person{event.sample ? " · sample price" : ""}</small>
        </div>
        {!unavailable && (
          <div className="field">
            <label htmlFor="ticket-quantity">Number of tickets</label>
            <select
              id="ticket-quantity"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            >
              {Array.from({ length: Math.min(10, event.available) }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1} ticket{i > 0 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="summary-row total">
          <span>{event.sample ? "Due for sample booking" : "Total"}</span>
          <span>
            {money(event.sample ? 0 : event.price * quantity, event.currency)}
          </span>
        </div>
        {payable && !acceptingPayments && (
          <div className="notice">
            Payments aren’t available yet. Please check back after the organizer
            finishes payment setup.
          </div>
        )}
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <button
          onClick={book}
          disabled={busy || unavailable || (payable && !acceptingPayments)}
          className="button button-primary button-wide"
        >
          {busy
            ? "Reserving your place…"
            : unavailable
              ? "Booking unavailable"
              : event.sample
                ? "Try a sample booking"
                : payable
                  ? "Continue to secure checkout"
                  : "Reserve my spot"}
          <FiArrowRight />
        </button>
        <div className="secure-note">
          <FiShield />
          {event.sample
            ? "No payment. No real event admission."
            : payable
              ? "Secure payment, hosted by Stripe"
              : "Free booking. No card needed."}
        </div>
        <div className="detail-actions">
          <button
            className="button button-outline button-small"
            onClick={() => toggleSave(event.id)}
            aria-pressed={saved.includes(event.id)}
          >
            <FiHeart />
            {saved.includes(event.id) ? "Saved" : "Save event"}
          </button>
          <button
            className="button button-outline button-small"
            onClick={share}
          >
            <FiShare2 />
            Share
          </button>
        </div>
        {!event.sample && (
          <p className="form-note" style={{ marginTop: 17 }}>
            Paid refunds are handled by the organizer. Free reservations can be
            cancelled before the event, until check-in.
          </p>
        )}
      </div>
    </aside>
  );
}
