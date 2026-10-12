"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FiArrowRight, FiEye, FiEyeOff } from "react-icons/fi";
import { api } from "@/lib/client";
import { safeNext } from "@/lib/format";
import type { User, EmailDeliveryMode } from "@/lib/types";
import { useApp } from "./AppProvider";
export default function AuthForm({
  register = false,
  next,
  emailDelivery = "unavailable",
}: {
  register?: boolean;
  next?: string;
  emailDelivery?: EmailDeliveryMode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const { setSession } = useApp();
  const router = useRouter();
  const destination = safeNext(next);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{
        user: User;
        saved: string[];
        verificationSent?: boolean;
        verificationDelivery?: string;
      }>("auth/" + (register ? "register" : "login"), {
        method: "POST",
        body: Object.fromEntries(form),
      });
      setSession(result.user, result.saved);
      router.push(
        result.user.emailVerified
          ? destination
          : "/verify-email" +
              (result.verificationDelivery
                ? "?delivery=" + result.verificationDelivery
                : ""),
      );
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="auth-layout">
      <aside className="auth-visual">
        <Image
          src="/images/festival.jpg"
          alt="Festival lights above a lively crowd"
          fill
          sizes="50vw"
        />
        <div>
          <span className="eyebrow" style={{ color: "#f5cbb5" }}>
            YOU’VE GOT GOOD PLANS AHEAD.
          </span>
          <h2>
            More moments.
            <br />
            More memories.
            <br />
            More you.
          </h2>
          <p>Your next favorite experience starts with showing up.</p>
        </div>
      </aside>
      <div className="auth-form-wrap">
        <div className="auth-form">
          <span className="eyebrow">
            {register ? "LET’S GET YOU OUT THERE" : "GOOD TO SEE YOU AGAIN"}
          </span>
          <h1>{register ? "Create your account." : "Welcome back."}</h1>
          <p>
            {register
              ? "Save your favorites, find your people and keep every ticket in one place."
              : "Your next good story is waiting for you."}
          </p>
          <form onSubmit={submit} className="form-stack" aria-busy={busy}>
            {register && emailDelivery !== "resend" && (
              <div className="notice" role="status">
                {emailDelivery === "preview"
                  ? "Preview mode: no email will be sent to your inbox. Verification messages are saved locally for testing."
                  : "You can create your account now. Email delivery is being set up; verification will be needed before you can book or publish events."}
              </div>
            )}
            {register && (
              <div className="field">
                <label htmlFor="name">Your name</label>
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  placeholder="Alex Taylor"
                  minLength={2}
                  maxLength={80}
                  required
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                maxLength={254}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete={register ? "new-password" : "current-password"}
                  minLength={register ? 10 : undefined}
                  maxLength={128}
                  required
                  placeholder={
                    register ? "At least 10 characters" : "Enter your password"
                  }
                />
                <button
                  className="icon-button"
                  type="button"
                  aria-label={visible ? "Hide password" : "Show password"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              {register && (
                <small>
                  Use at least 10 characters. Make it unique to Evently.
                </small>
              )}
              {!register && (
                <Link className="forgot-link" href="/forgot-password">
                  Forgot password?
                </Link>
              )}
            </div>
            {error && (
              <div className="error-box" role="alert">
                {error}
                {register && error.includes("already exists") && (
                  <div className="auth-error-links">
                    <Link href="/login">Sign in</Link>
                    <Link href="/forgot-password">Reset password</Link>
                  </div>
                )}
              </div>
            )}
            <button
              className="button button-primary button-wide"
              disabled={busy}
            >
              {busy
                ? "One moment…"
                : register
                  ? "Create my account"
                  : "Sign in"}
              <FiArrowRight />
            </button>
          </form>
          <div className="auth-switch">
            {register ? "Already part of the good times?" : "New here?"}{" "}
            <Link
              href={
                (register ? "/login" : "/register") +
                "?next=" +
                encodeURIComponent(destination)
              }
            >
              {register ? "Sign in" : "Create an account"}
            </Link>
          </div>
          <p className="form-note" style={{ marginTop: 22 }}>
            {register
              ? "Free to join. Verify your email, then make your next plan."
              : "Your plans, tickets and favorites, all in one place."}
          </p>
        </div>
      </div>
    </main>
  );
}
