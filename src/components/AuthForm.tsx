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
  const { setSession, t } = useApp();
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
          <span className="eyebrow" style={{ color: "#ffe2c2" }}>
            {t("auth.banner")}
          </span>
          <h2>
            {t("auth.bannerLine1")}
            <br />
            {t("auth.bannerLine2")}
            <br />
            {t("auth.bannerLine3")}
          </h2>
          <p>{t("auth.nextExperience")}</p>
        </div>
      </aside>
      <div className="auth-form-wrap">
        <div className="auth-form">
          <span className="eyebrow">
            {register ? t("auth.registerEyebrow") : t("auth.signInEyebrow")}
          </span>
          <h1>{register ? t("auth.register") : t("auth.signIn")}</h1>
          <p>{register ? t("auth.registerIntro") : t("auth.signInIntro")}</p>
          <form onSubmit={submit} className="form-stack" aria-busy={busy}>
            {register &&
              emailDelivery !== "gmail" &&
              emailDelivery !== "resend" && (
                <div className="notice" role="status">
                  {emailDelivery === "preview"
                    ? t("auth.previewNotice")
                    : t("auth.emailSetupNotice")}
                </div>
              )}
            {register && (
              <div className="field">
                <label htmlFor="name">{t("auth.name")}</label>
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  placeholder={t("auth.namePlaceholder")}
                  minLength={2}
                  maxLength={80}
                  required
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">{t("auth.email")}</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={t("auth.emailPlaceholder")}
                maxLength={254}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">{t("auth.password")}</label>
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
                    register
                      ? t("auth.passwordCreatePlaceholder")
                      : t("auth.passwordSignInPlaceholder")
                  }
                />
                <button
                  className="icon-button"
                  type="button"
                  aria-label={
                    visible ? t("auth.hidePassword") : t("auth.showPassword")
                  }
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              {register && <small>{t("auth.passwordHint")}</small>}
              {!register && (
                <Link className="forgot-link" href="/forgot-password">
                  {t("auth.forgot")}
                </Link>
              )}
            </div>
            {error && (
              <div className="error-box" role="alert">
                {error}
                {register && error.includes("already exists") && (
                  <div className="auth-error-links">
                    <Link href="/login">{t("nav.signIn")}</Link>
                    <Link href="/forgot-password">
                      {t("auth.resetPassword")}
                    </Link>
                  </div>
                )}
              </div>
            )}
            <button
              className="button button-primary button-wide"
              disabled={busy}
            >
              {busy
                ? t("auth.oneMoment")
                : register
                  ? t("auth.createAccountButton")
                  : t("nav.signIn")}
              <FiArrowRight />
            </button>
          </form>
          <div className="auth-switch">
            {register ? t("auth.haveAccount") : t("auth.noAccount")}{" "}
            <Link
              href={
                (register ? "/login" : "/register") +
                "?next=" +
                encodeURIComponent(destination)
              }
            >
              {register ? t("nav.signIn") : t("auth.createAccountLink")}
            </Link>
          </div>
          <p className="form-note" style={{ marginTop: 22 }}>
            {register ? t("auth.joinNote") : t("auth.signInNote")}
          </p>
        </div>
      </div>
    </main>
  );
}
