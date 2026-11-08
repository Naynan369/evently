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
  emailDelivery = "unavailable",
}: {
  mode: "verify" | "forgot" | "reset";
  token?: string;
  email?: string;
  deliveryFailed?: boolean;
  emailDelivery?: EmailDeliveryMode;
}) {
  const { user, setSession, t } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(
      deliveryFailed
        ? emailDelivery === "gmail"
          ? t("recovery.deliveryCodeFailed")
          : t("recovery.deliveryEmailFailed")
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
        throw new Error(t("recovery.passwordMismatch"));
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
            ? t("recovery.previewReset")
            : t("recovery.resetRequested"),
        );
      } else if (mode === "verify" && !token && emailDelivery !== "gmail") {
        const result = await api<{ delivery: EmailDeliveryMode }>(
          "auth/resend-verification",
          { method: "POST" },
        );
        setMessage(
          result.delivery === "preview"
            ? t("recovery.previewVerification")
            : t("recovery.verificationRequested"),
        );
      } else {
        const result = await api<{ user: User | null }>(
          mode === "verify" ? "auth/verify-email" : "auth/reset-password",
          {
            method: "POST",
            body:
              mode === "verify"
                ? token
                  ? { token }
                  : { code: data.code }
                : { token, password: data.password },
          },
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

  async function resendCode() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api<{ delivery: EmailDeliveryMode }>("auth/resend-verification", {
        method: "POST",
      });
      setMessage(t("recovery.codeSent"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const verified = mode === "verify" && user?.emailVerified && !token;
  const codeMode =
    mode === "verify" && emailDelivery === "gmail" && !token && Boolean(user);
  const successState = done || verified;
  const title = successState
    ? mode === "reset"
      ? t("recovery.titleFresh")
      : t("recovery.titleVerified")
    : mode === "forgot"
      ? t("recovery.titleForgot")
      : mode === "reset"
        ? t("recovery.titleReset")
        : token
          ? t("recovery.titleConfirm")
          : (emailDelivery === "gmail" || emailDelivery === "resend") &&
              !deliveryFailed
            ? t("recovery.titleInbox")
            : t("recovery.titleVerify");
  const description = successState
    ? mode === "reset"
      ? t("recovery.passwordUpdated")
      : t("recovery.emailConfirmed")
    : mode === "forgot"
      ? emailDelivery === "gmail" || emailDelivery === "resend"
        ? t("recovery.forgotEnabled")
        : t("recovery.forgotUnavailable")
      : mode === "reset"
        ? t("recovery.resetIntro")
        : token
          ? t("recovery.confirmIntro")
          : codeMode
            ? deliveryFailed
              ? t("recovery.codeFailed")
              : t("recovery.codeIntro", {
                  email: email || t("recovery.yourInbox"),
                })
            : deliveryFailed
              ? t("recovery.verifyFailed")
              : emailDelivery === "resend"
                ? t("recovery.linkIntro", {
                    email: email || t("recovery.yourInbox"),
                  })
                : t("recovery.verifyIntro");
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
        <span className="eyebrow">{t("recovery.eyebrow")}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        {done || verified ? (
          <Link
            className="button button-primary button-wide"
            href={mode === "verify" && user ? "/for-you" : "/login"}
          >
            {mode === "verify" && user
              ? t("recovery.findExperience")
              : t("recovery.backToSignIn")}{" "}
            <FiArrowRight />
          </Link>
        ) : (
          <form onSubmit={submit} className="form-stack">
            {!token &&
              emailDelivery !== "gmail" &&
              emailDelivery !== "resend" && (
                <div className="notice" role="status">
                  {emailDelivery === "preview"
                    ? t("recovery.previewMode")
                    : mode === "verify"
                      ? t("recovery.deliveryNotReadyVerify")
                      : t("recovery.deliveryNotReadyReset")}
                </div>
              )}
            {mode === "forgot" && (
              <div className="field">
                <label htmlFor="recovery-email">{t("recovery.email")}</label>
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
            {codeMode && (
              <div className="field">
                <label htmlFor="verification-code">{t("recovery.code")}</label>
                <input
                  id="verification-code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  placeholder="000000"
                  aria-describedby="verification-code-help"
                  required
                />
                <small id="verification-code-help">
                  {t("recovery.codeExpiry")}
                </small>
              </div>
            )}
            {mode === "reset" && token && (
              <>
                <div className="field">
                  <label htmlFor="new-password">
                    {t("recovery.newPassword")}
                  </label>
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
                  <label htmlFor="confirm-password">
                    {t("recovery.confirmPassword")}
                  </label>
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
                {t("recovery.linkMissing")}{" "}
                <Link href="/forgot-password">{t("recovery.requestNew")}</Link>.
              </div>
            ) : mode === "verify" && !token && !user ? (
              <Link
                className="button button-primary"
                href="/login?next=/verify-email"
              >
                {t("recovery.signInResend")}
              </Link>
            ) : (
              <button
                disabled={busy || (!token && emailDelivery === "unavailable")}
                className="button button-primary button-wide"
              >
                {busy
                  ? t("recovery.oneMoment")
                  : mode === "forgot"
                    ? t("recovery.sendReset")
                    : mode === "reset"
                      ? t("recovery.savePassword")
                      : token
                        ? t("recovery.verifyEmail")
                        : codeMode
                          ? t("recovery.verifyEmail")
                          : t("recovery.resendEmail")}{" "}
                <FiArrowRight />
              </button>
            )}
            {codeMode && (
              <button
                type="button"
                className="text-link"
                disabled={busy}
                onClick={resendCode}
              >
                {t("recovery.sendCode")}
              </button>
            )}
          </form>
        )}
        {mode === "reset" && !done && (
          <Link className="text-link" href="/forgot-password">
            {t("recovery.freshResetLink")}
          </Link>
        )}
        <Link className="recovery-back" href="/login">
          {t("recovery.backToSignIn")}
        </Link>
      </div>
    </main>
  );
}
