"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FiBriefcase, FiMapPin, FiPlus, FiUsers } from "react-icons/fi";
import { api } from "@/lib/client";
import { BUSINESS_COUNTRIES } from "@/lib/business-countries";
import type { BusinessProfile, BusinessProfileKind } from "@/lib/types";
import { useApp } from "../AppProvider";
import type { TranslationKey } from "@/lib/i18n";

const profileCopy: Record<
  BusinessProfileKind,
  { title: TranslationKey; detail: TranslationKey }
> = {
  organizer: {
    title: "business.organizer",
    detail: "business.organizerDetail",
  },
  venue: {
    title: "business.venueHost",
    detail: "business.venueDetail",
  },
};

export default function BusinessProfileStudio({
  initialProfiles,
}: {
  initialProfiles: BusinessProfile[];
}) {
  const { language, t } = useApp();
  const countryNames = new Intl.DisplayNames(
    language === "it" ? "it-IT" : "en-GB",
    {
      type: "region",
    },
  );
  const router = useRouter();
  const [profiles, setProfiles] = useState(initialProfiles);
  const [editing, setEditing] = useState<BusinessProfile | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<BusinessProfileKind>("organizer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!formOpen) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("business-profile-editor")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [formOpen, editing?.id]);

  function startCreate() {
    setEditing(null);
    setKind("organizer");
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function startEdit(profile: BusinessProfile) {
    setEditing(profile);
    setKind(profile.kind);
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const details = {
      name: data.name,
      ...(kind === "organizer"
        ? { countryCode: data.countryCode || editing?.countryCode || "IT" }
        : {}),
    };
    try {
      const result = await api<{ profile: BusinessProfile }>(
        editing ? "business-profiles/" + editing.id : "business-profiles",
        {
          method: editing ? "PUT" : "POST",
          body: editing ? details : { kind, ...details },
        },
      );
      setProfiles((current) => {
        const remaining = current.filter(
          (profile) => profile.id !== result.profile.id,
        );
        return [...remaining, result.profile].sort(
          (a, b) =>
            a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
        );
      });
      setEditing(result.profile);
      setNotice(editing ? t("business.saved") : t("business.created"));
      router.refresh();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="business-profile-workspace">
      <header className="business-profile-hero">
        <div>
          <span className="eyebrow">{t("business.heroEyebrow")}</span>
          <h1>{t("business.heroTitle")}</h1>
          <p>{t("business.heroIntro")}</p>
        </div>
        <button
          className="button button-primary"
          onClick={startCreate}
          type="button"
        >
          <FiPlus aria-hidden="true" /> {t("business.add")}
        </button>
      </header>

      {(error || notice) && (
        <div
          className={error ? "venue-feedback error-box" : "venue-feedback"}
          role={error ? "alert" : "status"}
        >
          {error || notice}
        </div>
      )}

      {profiles.length ? (
        <section
          className="business-profile-grid"
          aria-label={t("business.profilesAria")}
        >
          {profiles.map((profile) => {
            const detail = profileCopy[profile.kind];
            const Icon = profile.kind === "organizer" ? FiUsers : FiMapPin;
            return (
              <article className="business-profile-card" key={profile.id}>
                <span className="business-profile-icon">
                  <Icon aria-hidden="true" />
                </span>
                <span className="eyebrow">{t(detail.title)}</span>
                <h2>{profile.name}</h2>
                <p>{t(detail.detail)}</p>
                {profile.kind === "organizer" && (
                  <>
                    <span className="business-profile-country">
                      {t("business.country")}:{" "}
                      {countryNames.of(profile.countryCode) ||
                        profile.countryCode}
                    </span>
                    <span className="business-profile-payout">
                      <FiBriefcase aria-hidden="true" />
                      {profile.stripeAccount
                        ? t("business.payoutConnected")
                        : t("business.payoutSeparate")}
                    </span>
                  </>
                )}
                <button
                  className="button button-outline"
                  onClick={() => startEdit(profile)}
                  type="button"
                >
                  {t("business.edit")}
                </button>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="business-profile-empty">
          <span className="business-profile-icon">
            <FiBriefcase aria-hidden="true" />
          </span>
          <h2>{t("business.emptyTitle")}</h2>
          <p>{t("business.emptyBody")}</p>
          <button
            className="button button-primary"
            onClick={startCreate}
            type="button"
          >
            <FiPlus aria-hidden="true" /> {t("business.create")}
          </button>
        </section>
      )}

      {formOpen && (
        <section
          className="business-profile-editor panel"
          id="business-profile-editor"
          aria-labelledby="business-profile-editor-title"
        >
          <div className="venue-editor-heading">
            <div>
              <span className="eyebrow">
                {editing ? t("business.details") : t("business.new")}
              </span>
              <h2 id="business-profile-editor-title">
                {editing ? t("business.nameThis") : t("business.whatDoes")}
              </h2>
            </div>
            <button
              className="venue-close"
              onClick={() => setFormOpen(false)}
              type="button"
              aria-label={t("business.closeEditor")}
            >
              ×
            </button>
          </div>
          <form
            className="business-profile-form"
            key={editing?.id ?? "new"}
            onSubmit={save}
          >
            {!editing && (
              <div className="field">
                <label htmlFor="business-profile-kind">
                  {t("business.type")}
                </label>
                <select
                  id="business-profile-kind"
                  onChange={(event) =>
                    setKind(event.target.value as BusinessProfileKind)
                  }
                  value={kind}
                >
                  <option value="organizer">
                    {t("business.typeOrganizer")}
                  </option>
                  <option value="venue">{t("business.typeVenue")}</option>
                </select>
                <small>{t(profileCopy[kind].detail)}</small>
              </div>
            )}
            <div className="field">
              <label htmlFor="business-profile-name">
                {t("business.nameLabel")}
              </label>
              <input
                autoComplete="organization"
                defaultValue={editing?.name}
                id="business-profile-name"
                maxLength={120}
                minLength={2}
                name="name"
                placeholder={
                  kind === "organizer"
                    ? t("business.exampleOrganizer")
                    : t("business.exampleVenue")
                }
                required
              />
            </div>
            {kind === "organizer" && (
              <div className="field">
                <label htmlFor="business-profile-country">
                  {t("business.country")}
                </label>
                <select
                  defaultValue={editing?.countryCode ?? "IT"}
                  disabled={Boolean(editing?.stripeAccount)}
                  id="business-profile-country"
                  name="countryCode"
                  required
                >
                  {BUSINESS_COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {countryNames.of(country) || country}
                    </option>
                  ))}
                </select>
                {editing?.stripeAccount && (
                  <small>{t("business.countryLocked")}</small>
                )}
              </div>
            )}
            <div className="business-profile-form-actions">
              <button
                className="button button-outline"
                onClick={() => setFormOpen(false)}
                type="button"
              >
                {t("business.cancel")}
              </button>
              <button
                className="button button-primary"
                disabled={busy}
                type="submit"
              >
                {busy
                  ? t("business.saving")
                  : editing
                    ? t("business.save")
                    : t("business.create")}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
