"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiArrowRight, FiMail, FiCheckCircle, FiLock } from "react-icons/fi";
import { api } from "@/lib/client";
import { useApp } from "./AppProvider";
import type { User, EmailDeliveryMode } from "@/lib/types";
export default function EmailActions({
  mode,
  token,
  email,
  deliveryFailed = false,
  emailDelivery = "resend",
}: {
  mode: "verify" | "forgot" | "reset";
  token?: string;
  email?: string;
  deliveryFailed?: boolean;
  emailDelivery?: EmailDeliveryMode;
}) {
  const { user, setSession } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(
      deliveryFailed
        ? "Your account was created, but we couldn’t send the verification email. Please try resending it below."
        : "",
    ),
    [message, setMessage] = useState(""),
    [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === "reset" && data.password !== data.confirm)
        throw new Error("Your passwords don’t match.");
      if (mode === "forgot") {
        const result = await api<{ delivery: EmailDeliveryMode }>(
          "auth/forgot-password",
          {
            method: "POST",
            body: { email: data.email },
          },
        );
        setMessage(
          result.delivery === "preview"
            ? "Preview only: if an account exists, its reset message was saved locally. No email was sent."
            : "If an account exists for that email, we’ve requested a reset email. Check your inbox and spam folder.",
        );
      } else if (mode === "verify" && !token) {
        const result = await api<{ delivery: EmailDeliveryMode }>(
          "auth/resend-verification",
          { method: "POST" },
        );
        setMessage(
          result.delivery === "preview"
            ? "Preview only: your verification message was saved locally. No email was sent."
            : "A new verification email has been submitted for delivery. Check your inbox and spam folder.",
        );
      } else {
        const result = await api<{ user: User | null }>(
          mode === "verify" ? "auth/verify-email" : "auth/reset-password",
          { method: "POST", body: { token, password: data.password } },
        );
        if (mode === "verify") setSession(result.user);
        else setSession(null, []);
        setDone(true);
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const verified = mode === "verify" && user?.emailVerified && !token;
  return (
    <main id="main" className="auth-recovery page-main container">
      <div className="panel recovery-card">
        <div className="recovery-symbol">
          {done || verified ? (
            <FiCheckCircle />
          ) : mode === "reset" ? (
            <FiLock />
          ) : (
            <FiMail />
          )}
        </div>
        <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
        <h1>
          {done || verified
            ? mode === "reset"
              ? "A fresh start."
              : "You’re verified."
            : mode === "forgot"
              ? "Forgot your password?"
              : mode === "reset"
                ? "Make it yours again."
                : token
                  ? "Confirm your email."
                  : emailDelivery === "resend" && !deliveryFailed
                    ? "Check your inbox."
                    : "Verify your email."}
        </h1>
        <p>
          {done || verified
            ? mode === "reset"
              ? "Your password has been updated and existing sessions have been signed out. Sign in with your new password."
              : "Your email is confirmed. You’re ready to book, create and connect."
            : mode === "forgot"
              ? emailDelivery === "resend"
                ? "It happens. We’ll send you a secure link to choose a new password."
                : "Use a secure email link to choose a new password."
              : mode === "reset"
                ? "Choose a unique password with at least 10 characters. This link can only be used once."
                : token
                  ? "Confirm your email address to unlock your next experience."
                  : emailDelivery !== "resend"
                    ? "Your account needs email verification before you can book events or connect music."
                    : deliveryFailed
                      ? "Your account is saved. Request another verification email below."
                      : "Check" +
                        (email ? " " + email : " your email") +
                        " for your verification link. Open it to finish setting up your account, or request a fresh link below."}
        </p>
        {done || verified ? (
          <Link
            className="button button-primary button-wide"
            href={mode === "verify" && user ? "/for-you" : "/login"}
          >
            {mode === "verify" && user
              ? "Find my next experience"
              : "Back to sign in"}{" "}
            <FiArrowRight />
          </Link>
        ) : (
          <form onSubmit={submit} className="form-stack">
            {!token && emailDelivery !== "resend" && (
              <div className="notice" role="status">
                {emailDelivery === "preview"
                  ? "Preview mode: messages are saved locally for testing. No email is sent to your inbox."
                  : mode === "verify"
                    ? "Your account is created and saved. Email delivery is not ready yet, so no verification email has been sent. You can browse events and return here to verify once delivery is available."
                    : "Email delivery is not ready yet. Password reset emails cannot be sent until delivery is available."}
              </div>
            )}
            {mode === "forgot" && (
              <div className="field">
                <label htmlFor="recovery-email">Email address</label>
                <input
                  id="recovery-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="you@example.com"
                />
              </div>
            )}
            {mode === "reset" && token && (
              <>
                <div className="field">
                  <label htmlFor="new-password">New password</label>
                  <input
                    id="new-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={128}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="confirm-password">Confirm new password</label>
                  <input
                    id="confirm-password"
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={128}
                    required
                  />
                </div>
              </>
            )}
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
            {message && (
              <div className="success-box" role="status">
                {message}
              </div>
            )}
            {mode === "reset" && !token ? (
              <div className="notice">
                This reset link is missing.{" "}
                <Link href="/forgot-password">Request a new one</Link>.
              </div>
            ) : mode === "verify" && !token && !user ? (
              <Link
                className="button button-primary"
                href="/login?next=/verify-email"
              >
                Sign in to resend verification
              </Link>
            ) : (
              <button
                disabled={busy || (!token && emailDelivery === "unavailable")}
                className="button button-primary button-wide"
              >
                {busy
                  ? "One moment…"
                  : mode === "forgot"
                    ? "Send reset link"
                    : mode === "reset"
                      ? "Save new password"
                      : token
                        ? "Verify my email"
                        : "Resend verification email"}{" "}
                <FiArrowRight />
              </button>
            )}
          </form>
        )}
        {mode === "reset" && !done && (
          <Link className="text-link" href="/forgot-password">
            Need a fresh reset link?
          </Link>
        )}
        <Link className="recovery-back" href="/login">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
