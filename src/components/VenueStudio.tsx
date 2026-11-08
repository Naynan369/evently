"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FiArrowUpRight,
  FiCheck,
  FiEdit3,
  FiMapPin,
  FiPlus,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { api } from "@/lib/client";
import type { BusinessProfile, Venue } from "@/lib/types";
import { useApp } from "./AppProvider";

const venueTypes = [
  ["club", "venue.club"],
  ["concert-hall", "venue.concert"],
  ["bar-restaurant", "venue.barRestaurant"],
  ["outdoor", "venue.outdoor"],
  ["gallery", "venue.gallery"],
  ["community", "venue.community"],
  ["other", "venue.other"],
] as const;

function tags(values: string[]) {
  return values.join(", ");
}

export default function VenueStudio({
  initialVenues,
  profiles,
}: {
  initialVenues: Venue[];
  profiles: BusinessProfile[];
}) {
  const { language, t } = useApp();
  const router = useRouter();
  const [venues, setVenues] = useState(initialVenues);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeVenues = venues.filter((venue) => venue.active);
  const combinedCapacity = activeVenues.reduce(
    (total, venue) => total + venue.capacity,
    0,
  );
  const spaceCount = activeVenues.reduce(
    (total, venue) => total + venue.spaces.length,
    0,
  );

  function openNewVenue() {
    setEditing(null);
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function openEditVenue(venue: Venue) {
    setEditing(venue);
    setError("");
    setNotice("");
    setFormOpen(true);
    document
      .getElementById("venue-editor")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveVenue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const body = {
      ...data,
      capacity: Number(data.capacity),
      active: editing?.active ?? true,
    };
    try {
      const result = await api<{ venue: Venue }>(
        editing ? "venues/" + editing.id : "venues",
        { method: editing ? "PUT" : "POST", body },
      );
      setVenues((current) => {
        const next = current.filter((venue) => venue.id !== result.venue.id);
        return [...next, result.venue].sort(
          (a, b) =>
            Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
        );
      });
      setEditing(result.venue);
      setNotice(editing ? t("venue.updated") : t("venue.created"));
      router.refresh();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleVenue(venue: Venue) {
    setError("");
    setNotice("");
    try {
      const result = await api<{ venue: Venue }>("venues/" + venue.id, {
        method: "PUT",
        body: { ...venue, active: !venue.active },
      });
      setVenues((current) =>
        current
          .map((item) => (item.id === result.venue.id ? result.venue : item))
          .sort(
            (a, b) =>
              Number(b.active) - Number(a.active) ||
              a.name.localeCompare(b.name),
          ),
      );
      if (editing?.id === venue.id) setEditing(result.venue);
      setNotice(
        result.venue.active ? t("venue.nowAvailable") : t("venue.nowHidden"),
      );
      router.refresh();
    } catch (toggleError) {
      setError((toggleError as Error).message);
    }
  }

  return (
    <div className="venue-workspace">
      <header className="venue-hero">
        <div className="venue-hero-copy">
          <span className="venue-kicker">
            <i aria-hidden="true" /> {t("venue.kicker")}
          </span>
          <h1>
            {t("venue.heroTitle")}
            <br />
            <em>{t("venue.heroEmphasis")}</em>
          </h1>
          <p>{t("venue.heroIntro")}</p>
          <div className="venue-hero-actions">
            <button
              className="button button-primary"
              onClick={openNewVenue}
              type="button"
            >
              <FiPlus aria-hidden="true" /> {t("venue.add")}
            </button>
            <Link className="venue-guide-link" href="/create-event">
              {t("venue.createEvent")} <FiArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="venue-hero-aside">
          <span className="venue-aside-label">
            {t("venue.responsibilities")}
          </span>
          <strong>{t("venue.distinctRoles")}</strong>
          <p>{t("venue.roleDescription")}</p>
          <div className="venue-aside-location">
            <FiMapPin aria-hidden="true" /> Messina, Sicilia
          </div>
        </div>
      </header>

      <section className="venue-overview" aria-label={t("venue.overview")}>
        <article className="venue-stat">
          <span className="venue-stat-icon">
            <FiMapPin aria-hidden="true" />
          </span>
          <span>{t("venue.active")}</span>
          <strong>{activeVenues.length}</strong>
          <small>{t("venue.ready")}</small>
        </article>
        <article className="venue-stat">
          <span className="venue-stat-icon">
            <FiUsers aria-hidden="true" />
          </span>
          <span>{t("venue.capacity")}</span>
          <strong>
            {combinedCapacity.toLocaleString(
              language === "it" ? "it-IT" : "en-GB",
            )}
          </strong>
          <small>{t("venue.activeSpaces")}</small>
        </article>
        <article className="venue-stat">
          <span className="venue-stat-icon">
            <FiCheck aria-hidden="true" />
          </span>
          <span>{t("venue.configured")}</span>
          <strong>{spaceCount}</strong>
          <small>{t("venue.roomsRecorded")}</small>
        </article>
      </section>

      {(error || notice) && (
        <div
          className={error ? "venue-feedback error-box" : "venue-feedback"}
          role={error ? "alert" : "status"}
        >
          {error || notice}
        </div>
      )}

      <div className="venue-content">
        <section
          className="venue-list-section"
          aria-labelledby="venue-list-title"
        >
          <div className="venue-section-heading">
            <div>
              <span className="eyebrow">{t("venue.portfolio")}</span>
              <h2 id="venue-list-title">{t("venue.managed")}</h2>
              <p>{t("venue.reusable")}</p>
            </div>
            <button
              className="button button-outline venue-add-secondary"
              onClick={openNewVenue}
              type="button"
            >
              <FiPlus aria-hidden="true" /> {t("venue.addSecondary")}
            </button>
          </div>

          {venues.length ? (
            <div className="venue-card-grid">
              {venues.map((venue) => (
                <article className="venue-card" key={venue.id}>
                  <div className="venue-card-top">
                    <span className="venue-card-type">
                      {t(
                        venueTypes.find(
                          ([value]) => value === venue.type,
                        )?.[1] ?? "venue.eventVenue",
                      )}
                    </span>
                    <span
                      className={
                        "venue-status" + (venue.active ? " active" : "")
                      }
                    >
                      <i aria-hidden="true" />
                      {venue.active ? t("venue.available") : t("venue.hidden")}
                    </span>
                  </div>
                  <h3>{venue.name}</h3>
                  <p className="venue-card-address">
                    <FiMapPin aria-hidden="true" /> {venue.city},{" "}
                    {venue.postalCode}
                  </p>
                  <p className="venue-card-host">
                    {t("venue.hostProfile")}{" "}
                    {profiles.find(
                      (profile) => profile.id === venue.hostProfileId,
                    )?.name || t("venue.legacyProfile")}
                  </p>
                  <p className="venue-card-description">
                    {venue.description || t("venue.descriptionFallback")}
                  </p>
                  <div className="venue-card-details">
                    <span>
                      <strong>
                        {venue.capacity.toLocaleString(
                          language === "it" ? "it-IT" : "en-GB",
                        )}
                      </strong>
                      <small>{t("venue.maximumGuests")}</small>
                    </span>
                    <span>
                      <strong>{venue.spaces.length}</strong>
                      <small>
                        {t(
                          venue.spaces.length === 1
                            ? "venue.space"
                            : "venue.spaces",
                        )}
                      </small>
                    </span>
                    <span>
                      <strong>{venue.facilities.length}</strong>
                      <small>{t("venue.facilities")}</small>
                    </span>
                  </div>
                  {venue.spaces.length > 0 && (
                    <div
                      className="venue-chip-row"
                      aria-label={t("venue.spacesAria")}
                    >
                      {venue.spaces.slice(0, 4).map((space) => (
                        <span key={space}>{space}</span>
                      ))}
                      {venue.spaces.length > 4 && (
                        <span>+{venue.spaces.length - 4}</span>
                      )}
                    </div>
                  )}
                  <div className="venue-card-actions">
                    <button
                      className="venue-edit-action"
                      onClick={() => openEditVenue(venue)}
                      type="button"
                    >
                      <FiEdit3 aria-hidden="true" /> {t("venue.edit")}
                    </button>
                    <button
                      className="venue-toggle-action"
                      onClick={() => void toggleVenue(venue)}
                      type="button"
                    >
                      {venue.active ? t("venue.hide") : t("venue.makeActive")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="venue-empty">
              <span className="venue-empty-mark">
                <FiMapPin aria-hidden="true" />
              </span>
              <h3>{t("venue.emptyTitle")}</h3>
              <p>{t("venue.emptyBody")}</p>
              <button
                className="button button-primary"
                onClick={openNewVenue}
                type="button"
              >
                <FiPlus aria-hidden="true" /> {t("venue.createFirst")}
              </button>
            </div>
          )}
        </section>

        {formOpen && (
          <section
            className="venue-editor panel"
            id="venue-editor"
            aria-labelledby="venue-editor-title"
          >
            <div className="venue-editor-heading">
              <div>
                <span className="eyebrow">
                  {t(editing ? "venue.configuration" : "venue.newProfile")}
                </span>
                <h2 id="venue-editor-title">
                  {t(editing ? "venue.refine" : "venue.addSpace")}
                </h2>
              </div>
              <button
                aria-label={t("venue.closeEditor")}
                className="venue-close"
                onClick={() => setFormOpen(false)}
                type="button"
              >
                <FiX aria-hidden="true" />
              </button>
            </div>
            <p className="venue-editor-intro">{t("venue.editorIntro")}</p>
            <form
              className="venue-form"
              key={editing?.id || "new-venue"}
              onSubmit={saveVenue}
            >
              <div className="venue-form-grid">
                <div className="field venue-form-full">
                  <label htmlFor="venue-host-profile">
                    {t("venue.hostProfileLabel")}
                  </label>
                  <select
                    defaultValue={
                      editing?.hostProfileId || profiles[0]?.id || ""
                    }
                    id="venue-host-profile"
                    name="hostProfileId"
                    required
                  >
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                  <small>
                    {t("venue.needBusiness")}{" "}
                    <Link
                      href="/business-profiles"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("venue.manageProfiles")}
                    </Link>
                  </small>
                </div>
                <div className="field">
                  <label htmlFor="venue-name">{t("venue.name")}</label>
                  <input
                    defaultValue={editing?.name}
                    id="venue-name"
                    maxLength={120}
                    minLength={2}
                    name="name"
                    placeholder={t("venue.namePlaceholder")}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="venue-type">{t("venue.type")}</label>
                  <select
                    defaultValue={editing?.type || "club"}
                    id="venue-type"
                    name="type"
                  >
                    {venueTypes.map(([value, label]) => (
                      <option key={value} value={value}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field venue-form-full">
                  <label htmlFor="venue-description">
                    {t("venue.description")}
                  </label>
                  <textarea
                    defaultValue={editing?.description}
                    id="venue-description"
                    maxLength={800}
                    name="description"
                    placeholder={t("venue.descriptionPlaceholder")}
                    rows={3}
                  />
                </div>
                <div className="field venue-form-full">
                  <label htmlFor="venue-address">{t("venue.address")}</label>
                  <input
                    defaultValue={editing?.address}
                    id="venue-address"
                    maxLength={300}
                    minLength={5}
                    name="address"
                    placeholder={t("venue.addressPlaceholder")}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="venue-city">{t("venue.city")}</label>
                  <input
                    defaultValue={editing?.city || "Messina"}
                    id="venue-city"
                    maxLength={80}
                    minLength={2}
                    name="city"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="venue-postcode">{t("venue.postcode")}</label>
                  <input
                    defaultValue={editing?.postalCode}
                    id="venue-postcode"
                    maxLength={20}
                    minLength={3}
                    name="postalCode"
                    placeholder="98100"
                    required
                  />
                </div>
                <div className="field venue-form-full">
                  <label htmlFor="venue-capacity">
                    {t("venue.capacityLabel")}
                  </label>
                  <input
                    defaultValue={editing?.capacity || 100}
                    id="venue-capacity"
                    max={100000}
                    min={1}
                    name="capacity"
                    required
                    type="number"
                  />
                  <small>{t("venue.capacityHelp")}</small>
                </div>
                <div className="field venue-form-full">
                  <label htmlFor="venue-spaces">{t("venue.rooms")}</label>
                  <input
                    defaultValue={tags(editing?.spaces || [])}
                    id="venue-spaces"
                    maxLength={1000}
                    name="spaces"
                    placeholder={t("venue.roomsPlaceholder")}
                  />
                </div>
                <div className="field venue-form-full">
                  <label htmlFor="venue-facilities">
                    {t("venue.equipment")}
                  </label>
                  <input
                    defaultValue={tags(editing?.facilities || [])}
                    id="venue-facilities"
                    maxLength={1500}
                    name="facilities"
                    placeholder={t("venue.equipmentPlaceholder")}
                  />
                </div>
                <div className="field venue-form-full">
                  <label htmlFor="venue-accessibility">
                    {t("venue.access")}
                  </label>
                  <input
                    defaultValue={tags(editing?.accessibility || [])}
                    id="venue-accessibility"
                    maxLength={1200}
                    name="accessibility"
                    placeholder={t("venue.accessPlaceholder")}
                  />
                </div>
                <div className="field venue-form-full">
                  <label htmlFor="venue-setup">{t("venue.setup")}</label>
                  <textarea
                    defaultValue={editing?.setupNotes}
                    id="venue-setup"
                    maxLength={2000}
                    name="setupNotes"
                    placeholder={t("venue.setupPlaceholder")}
                    rows={3}
                  />
                </div>
                <div className="field venue-form-full">
                  <label htmlFor="venue-rules">{t("venue.houseRules")}</label>
                  <textarea
                    defaultValue={editing?.houseRules}
                    id="venue-rules"
                    maxLength={2000}
                    name="houseRules"
                    placeholder={t("venue.rulesPlaceholder")}
                    rows={3}
                  />
                </div>
              </div>
              <div className="venue-form-footer">
                <p>{t("venue.profileNote")}</p>
                <div>
                  <button
                    className="button button-outline"
                    onClick={() => setFormOpen(false)}
                    type="button"
                  >
                    {t("venue.cancel")}
                  </button>
                  <button
                    className="button button-primary"
                    disabled={busy}
                    type="submit"
                  >
                    {busy
                      ? t("venue.saving")
                      : editing
                        ? t("venue.save")
                        : t("venue.create")}
                    <FiArrowUpRight aria-hidden="true" />
                  </button>
                </div>
              </div>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
