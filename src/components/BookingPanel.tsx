"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FiArrowRight, FiShield, FiHeart, FiShare2 } from "react-icons/fi";
import { api } from "@/lib/client";
import { money } from "@/lib/format";
import type { Event, TicketType } from "@/lib/types";
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
  const { user, saved, toggleSave, toast, language, t } = useApp();
  const router = useRouter();
  const standardAvailable = event.standardAvailable ?? event.available;
  const vipConfigured =
    Boolean(event.vipCapacity) && event.vipPrice !== undefined;
  const vipAvailable = event.vipAvailable || 0;
  const [quantity, setQuantity] = useState(1);
  const [ticketType, setTicketType] = useState<TicketType>(() =>
    standardAvailable > 0
      ? "standard"
      : vipConfigured && vipAvailable > 0
        ? "vip"
        : "standard",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const selectedAvailable =
    ticketType === "vip" ? vipAvailable : standardAvailable;
  const selectedPrice =
    ticketType === "vip" && event.vipPrice !== undefined
      ? event.vipPrice
      : event.price;
  const unavailable = past || selectedAvailable < 1;
  const payable = selectedPrice > 0 && !event.sample;

  function chooseTicketType(nextType: TicketType) {
    const nextAvailable = nextType === "vip" ? vipAvailable : standardAvailable;
    if (nextAvailable < 1 || (nextType === "vip" && !vipConfigured)) return;
    setTicketType(nextType);
    setQuantity((current) => Math.min(current, nextAvailable));
    setError("");
  }

  async function book() {
    if (!user) {
      router.push("/login?next=" + encodeURIComponent("/events/" + event.slug));
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    const key =
      "evently-checkout:" +
      user.id +
      ":" +
      event.id +
      ":" +
      ticketType +
      ":" +
      quantity;
    try {
      let nonce = sessionStorage.getItem(key);
      if (!nonce) {
        nonce = crypto.randomUUID();
        sessionStorage.setItem(key, nonce);
      }
      const result = await api<{ url: string }>("checkout", {
        method: "POST",
        body: { eventId: event.id, quantity, ticketType, requestKey: nonce },
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
      toast(language === "it" ? "Link dell'evento copiato" : "Event link copied");
    } catch {
      toast(language === "it"
        ? "Copia l'indirizzo dell'evento dal browser per condividerlo."
        : "Copy this event’s address from your browser to share it.");
    }
  }
  return (
    <aside aria-label={t("booking.aria")}>
      <div className="booking-panel">
        <h2>
          {unavailable
            ? past
              ? t("booking.closed")
              : t("booking.full")
            : event.sample
              ? t("booking.try")
              : t("booking.makePlan")}
        </h2>
        <p>
          {event.sample
            ? t("booking.sampleIntro")
            : ticketType === "vip"
              ? t("booking.vipAvailable", { count: selectedAvailable })
              : t("booking.standardAvailable", { count: selectedAvailable })}
        </p>
        <span className="ticket-option-label">{t("booking.chooseTicket")}</span>
        <div
          className="ticket-type-options"
          role="group"
          aria-label={t("booking.ticketType")}
        >
          <button
            aria-pressed={ticketType === "standard"}
            className={
              "ticket-type-option" +
              (ticketType === "standard" ? " is-selected" : "")
            }
            disabled={past || standardAvailable < 1}
            onClick={() => chooseTicketType("standard")}
            type="button"
          >
            <span className="ticket-type-option-copy">
              <strong>Standard</strong>
              <small>
                {past
                  ? t("booking.salesClosed")
                  : standardAvailable > 0
                    ? t("booking.available", { count: standardAvailable })
                    : t("booking.soldOut")}
              </small>
            </span>
            <strong className="ticket-type-option-price">
              {money(event.price, event.currency, language)}
            </strong>
          </button>
          <button
            aria-pressed={ticketType === "vip"}
            className={
              "ticket-type-option ticket-type-option-vip" +
              (ticketType === "vip" ? " is-selected" : "")
            }
            disabled={past || !vipConfigured || vipAvailable < 1}
            onClick={() => chooseTicketType("vip")}
            type="button"
          >
            <span className="ticket-type-option-copy">
              <strong>VIP</strong>
              <small>
                {past
                  ? t("booking.salesClosed")
                  : !vipConfigured
                    ? t("booking.notOffered")
                    : vipAvailable > 0
                      ? t("booking.available", { count: vipAvailable })
                      : t("booking.soldOut")}
              </small>
            </span>
            <strong className="ticket-type-option-price">
              {vipConfigured ? money(event.vipPrice!, event.currency, language) : "—"}
            </strong>
          </button>
        </div>
        <div className="price-display">
          {money(selectedPrice, event.currency, language)}
          <small>{t("booking.perPerson")}{event.sample ? " · " + t("booking.samplePrice") : ""}</small>
        </div>
        {!unavailable && (
          <div className="field">
            <label htmlFor="ticket-quantity">{t("booking.numberOfTickets")}</label>
            <select
              id="ticket-quantity"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            >
              {Array.from(
                { length: Math.min(10, selectedAvailable) },
                (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1} {t(i > 0 ? "booking.ticketMany" : "booking.ticketOne")}
                  </option>
                ),
              )}
            </select>
          </div>
        )}
        <div className="summary-row total">
          <span>{event.sample ? t("booking.dueSample") : t("booking.total")}</span>
          <span>
            {money(event.sample ? 0 : selectedPrice * quantity, event.currency, language)}
          </span>
        </div>
        {payable && !acceptingPayments && (
          <div className="notice">
            {t("booking.paymentsUnavailable")}
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
            ? t("booking.reserving")
            : unavailable
              ? t("booking.unavailable")
              : event.sample
                ? t("booking.trySample")
                : payable
                  ? t("booking.secureCheckout")
                  : t("booking.reserve")}
          <FiArrowRight />
        </button>
        <div className="secure-note">
          <FiShield />
          {event.sample
            ? t("booking.noSamplePayment")
            : payable
              ? t("booking.stripe")
              : t("booking.freeBooking")}
        </div>
        <div className="detail-actions">
          <button
            className="button button-outline button-small"
            onClick={() => toggleSave(event.id)}
            aria-pressed={saved.includes(event.id)}
          >
            <FiHeart />
            {saved.includes(event.id) ? t("booking.saved") : t("booking.save")}
          </button>
          <button
            className="button button-outline button-small"
            onClick={share}
          >
            <FiShare2 />
            {t("booking.shareLabel")}
          </button>
        </div>
        {!event.sample && (
          <p className="form-note" style={{ marginTop: 17 }}>
            {t("booking.refundNote")}
          </p>
        )}
      </div>
    </aside>
  );
}
