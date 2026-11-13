"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  FiArrowRight,
  FiBriefcase,
  FiCalendar,
  FiEye,
  FiEyeOff,
} from "react-icons/fi";
import { FaApple, FaGoogle } from "react-icons/fa";
import { api } from "@/lib/client";
import { safeNext } from "@/lib/format";
import { BUSINESS_COUNTRIES } from "@/lib/business-countries";
import { isOrganizerRoute } from "@/lib/organizer-routes";
import type { User, EmailDeliveryMode } from "@/lib/types";
import { useApp } from "./AppProvider";
export default function AuthForm({
  register = false,
  next,
  oauthError,
  emailDelivery = "unavailable",
  initialAccountType = "attendee",
}: {
  register?: boolean;
  next?: string;
  oauthError?: string;
  emailDelivery?: EmailDeliveryMode;
  initialAccountType?: "attendee" | "organizer";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const [accountType, setAccountType] = useState(initialAccountType);
  const { language, setSession, t } = useApp();
  const router = useRouter();
  const destination = safeNext(next);
  const loginDestination =
    register && accountType === "organizer" ? "/organizer" : destination;
  const socialDestination =
    register && accountType === "attendee" && isOrganizerRoute(destination)
      ? "/account"
      : destination;
  const countryNames = new Intl.DisplayNames(
    language === "it" ? "it-IT" : "en-GB",
    {
      type: "region",
    },
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(form);
    if (register && accountType === "attendee")
      payload.interests = form.getAll("interests");
    try {
      const result = await api<{
        user: User;
        saved: string[];
        verificationSent?: boolean;
        verificationDelivery?: string;
      }>("auth/" + (register ? "register" : "login"), {
        method: "POST",
        body: payload,
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
    <main
      id="main"
      className={`auth-layout auth-layout--${register ? "register" : "login"}`}
    >
      <aside className="auth-visual">
        <Image
          src={
            register ? "/images/festival.jpg" : "/images/community-photo.jpg"
          }
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 90vw"
        />
        <div className="auth-visual__top">
          <span className="eyebrow">
            {t(
              register && accountType === "organizer"
                ? "auth.organizerBanner"
                : "auth.banner",
            )}
          </span>
        </div>
        <div className="auth-visual__copy">
          <h2>
            <span>
              {t(
                register && accountType === "organizer"
                  ? "auth.organizerBannerLine1"
                  : "auth.bannerLine1",
              )}
            </span>
            <span>
              {t(
                register && accountType === "organizer"
                  ? "auth.organizerBannerLine2"
                  : "auth.bannerLine2",
              )}
            </span>
            <span>
              {t(
                register && accountType === "organizer"
                  ? "auth.organizerBannerLine3"
                  : "auth.bannerLine3",
              )}
            </span>
          </h2>
          <p>
            {t(
              register && accountType === "organizer"
                ? "auth.organizerNextExperience"
                : "auth.nextExperience",
            )}
          </p>
        </div>
      </aside>
      <div className="auth-form-wrap">
        <div className="auth-form">
          <div className="auth-form__intro">
            <span className="eyebrow">
              {register ? t("auth.registerEyebrow") : t("auth.signInEyebrow")}
            </span>
            <h1>{register ? t("auth.register") : t("auth.signIn")}</h1>
            <p>
              {register
                ? accountType === "organizer"
                  ? t("auth.organizerIntro")
                  : t("auth.registerIntro")
                : t("auth.signInIntro")}
            </p>
          </div>
          {register && (
            <fieldset className="auth-role-choice">
              <legend>{t("auth.accountTypeLabel")}</legend>
              <div className="auth-role-choice__options">
                <label className={accountType === "attendee" ? "selected" : ""}>
                  <input
                    type="radio"
                    name="signup-view"
                    value="attendee"
                    checked={accountType === "attendee"}
                    onChange={() => setAccountType("attendee")}
                  />
                  <FiCalendar aria-hidden="true" />
                  <span>
                    <strong>{t("auth.attendee")}</strong>
                    <small>{t("auth.attendeeDetail")}</small>
                  </span>
                </label>
                <label
                  className={accountType === "organizer" ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name="signup-view"
                    value="organizer"
                    checked={accountType === "organizer"}
                    onChange={() => setAccountType("organizer")}
                  />
                  <FiBriefcase aria-hidden="true" />
                  <span>
                    <strong>{t("auth.organizer")}</strong>
                    <small>{t("auth.organizerDetail")}</small>
                  </span>
                </label>
              </div>
              <p>{t("auth.sharedLogin")}</p>
            </fieldset>
          )}
          {oauthError && (
            <div className="error-box auth-social-error" role="alert">
              {oauthError === "unavailable"
                ? t("auth.socialUnavailable")
                : oauthError === "cancelled"
                  ? t("auth.socialCancelled")
                  : t("auth.socialFailed")}
            </div>
          )}
          {(!register || accountType === "attendee") && (
            <div className="auth-social">
              <div className="auth-social__buttons">
                <a
                  href={`/api/auth/oauth/google?from=${register ? "register" : "login"}&next=${encodeURIComponent(socialDestination)}`}
                >
                  <FaGoogle aria-hidden="true" />
                  <span>{t("auth.withGoogle")}</span>
                </a>
                <a
                  href={`/api/auth/oauth/apple?from=${register ? "register" : "login"}&next=${encodeURIComponent(socialDestination)}`}
                >
                  <FaApple aria-hidden="true" />
                  <span>{t("auth.withApple")}</span>
                </a>
              </div>
              <div className="auth-social__divider">
                <span>{t("auth.orEmail")}</span>
              </div>
            </div>
          )}
          {register && accountType === "organizer" && (
            <p className="auth-organizer-email-note">
              {t("auth.organizerEmailNote")}
            </p>
          )}
          <form onSubmit={submit} className="form-stack" aria-busy={busy}>
            {register && (
              <input type="hidden" name="accountType" value={accountType} />
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
            {register && accountType === "organizer" && (
              <>
                <div className="field">
                  <label htmlFor="organizationName">
                    {t("auth.organizationName")}
                  </label>
                  <input
                    id="organizationName"
                    name="organizationName"
                    autoComplete="organization"
                    placeholder={t("auth.organizationNamePlaceholder")}
                    minLength={2}
                    maxLength={120}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="countryCode">
                    {t("auth.businessCountry")}
                  </label>
                  <select
                    id="countryCode"
                    name="countryCode"
                    defaultValue="IT"
                    required
                  >
                    {BUSINESS_COUNTRIES.map((country) => (
                      <option key={country} value={country}>
                        {countryNames.of(country) ?? country}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {register && accountType === "attendee" && (
              <fieldset className="auth-interests">
                <legend>{t("auth.interests")}</legend>
                <p>{t("auth.interestsHint")}</p>
                <div className="auth-interests__options">
                  {(
                    [
                      "music",
                      "arts",
                      "food",
                      "technology",
                      "wellness",
                      "community",
                    ] as const
                  ).map((interest) => (
                    <label key={interest}>
                      <input
                        type="checkbox"
                        name="interests"
                        value={interest}
                      />
                      <span>{t(`category.${interest}`)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
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
              <div className="auth-password-label">
                <label htmlFor="password">{t("auth.password")}</label>
                {!register && (
                  <Link className="forgot-link" href="/forgot-password">
                    {t("auth.forgot")}
                  </Link>
                )}
              </div>
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
            </div>
            {register && emailDelivery !== "gmail" && (
              <div className="notice auth-delivery-note" role="status">
                {emailDelivery === "preview"
                  ? t("auth.previewNotice")
                  : t("auth.emailSetupNotice")}
              </div>
            )}
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
              className="button button-primary button-wide auth-submit"
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
          <div className="auth-form__footer">
            <div className="auth-switch">
              {register ? t("auth.haveAccount") : t("auth.noAccount")}{" "}
              <Link
                href={
                  (register ? "/login" : "/register") +
                  "?next=" +
                  encodeURIComponent(loginDestination)
                }
              >
                {register ? t("nav.signIn") : t("auth.createAccountLink")}
              </Link>
            </div>
            <p className="form-note">
              {register
                ? accountType === "organizer"
                  ? t("auth.organizerJoinNote")
                  : t("auth.joinNote")
                : t("auth.signInNote")}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
