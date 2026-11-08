"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiPrinter, FiCalendar, FiArrowRight } from "react-icons/fi";
import { api } from "@/lib/client";
import { useApp } from "./AppProvider";
import type { Booking } from "@/lib/types";
export default function TicketActions({ booking }: { booking: Booking }) {
  const router = useRouter();
  const { toast, t } = useApp();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (booking.status !== "pending") return;
    let attempts = 0;
    const timer = window.setInterval(async () => {
      if (++attempts > 12) {
        window.clearInterval(timer);
        return;
      }
      try {
        const data = await api<{ booking: Booking }>("tickets/" + booking.id);
        if (data.booking.status !== booking.status) {
          window.clearInterval(timer);
          router.refresh();
        }
      } catch {
        /* A failed refresh can be retried manually. */
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [booking.id, booking.status, router]);
  async function action(kind: string) {
    setBusy(true);
    try {
      const data = await api<{ url?: string }>(
        "tickets/" + booking.id + "/" + kind,
        { method: "POST" },
      );
      if (data.url) {
        if (data.url.startsWith("/")) router.push(data.url);
        else {
          const url = new URL(data.url);
          if (
            url.protocol !== "https:" ||
            url.hostname !== "checkout.stripe.com"
          )
            throw new Error("Unexpected checkout destination.");
          window.location.assign(data.url);
        }
      } else {
        setConfirm(false);
        router.refresh();
        toast(
          kind === "refund-request"
            ? t("ticketActions.refundToast")
            : t("ticketActions.cancelledToast"),
        );
      }
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="ticket-actions">
        {booking.status === "confirmed" &&
          booking.mode === "stripe" &&
          (booking.refundRequested ? (
            <p role="status">
              {t("ticketActions.refundRequested")}
            </p>
          ) : (
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => action("refund-request")}
            >
              {busy ? t("ticketActions.sending") : t("ticketActions.requestRefund")}
            </button>
          ))}
        {booking.status === "confirmed" && (
          <>
            <button
              className="button button-dark"
              onClick={() => window.print()}
            >
              <FiPrinter />
              {t("ticketActions.print")}
            </button>
            <a
              className="button button-outline"
              href={"/api/tickets/" + booking.id + "/calendar"}
            >
              <FiCalendar />
              {t("ticketActions.calendar")}
            </a>
          </>
        )}
        {booking.status === "pending" && (
          <>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => action("resume")}
            >
              {t("ticketActions.resume")} <FiArrowRight />
            </button>
            <button
              className="button button-outline"
              onClick={() => router.refresh()}
            >
              {t("ticketActions.checkStatus")}
            </button>
          </>
        )}
        {(booking.status === "pending" ||
          (booking.status === "confirmed" &&
            booking.mode !== "stripe" &&
            !booking.checkedIn)) && (
          <button
            className="button button-outline"
            disabled={busy}
            onClick={() => setConfirm(!confirm)}
          >
            {booking.status === "pending" ? t("ticketActions.cancelCheckout") : t("ticketActions.cancelReservation")}
          </button>
        )}
      </div>
      {confirm && (
        <div className="notice">
          <strong>{t("ticketActions.cancelTitle")}</strong>
          <p>{t("ticketActions.cancelBody")}</p>
          <button
            className="button button-danger button-small"
            style={{ marginTop: 10 }}
            disabled={busy}
            onClick={() => action("cancel")}
          >
            {busy ? t("ticketActions.cancelling") : t("ticketActions.confirmCancel")}
          </button>{" "}
          <button
            className="button button-outline button-small"
            onClick={() => setConfirm(false)}
          >
            {t("ticketActions.keep")}
          </button>
        </div>
      )}
    </>
  );
}
