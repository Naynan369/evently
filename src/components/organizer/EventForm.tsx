"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  FiArrowLeft,
  FiArrowRight,
  FiArrowUpRight,
  FiCheck,
  FiUpload,
} from "react-icons/fi";
import { categories, categoryName } from "@/lib/catalog";
import { isMessinaCity, messinaAreas } from "@/lib/messina";
import { localDateTime, zonedToIso } from "@/lib/dates";
import { api } from "@/lib/client";
import { MAX_EVENT_IMAGE_BYTES } from "@/lib/event-image";
import type { BusinessProfile, Event, Venue } from "@/lib/types";
import { useApp } from "../AppProvider";

const wizardSteps = [
  { title: "create.step1", summary: "create.step1Summary" },
  { title: "create.step2", summary: "create.step2Summary" },
  { title: "create.step3", summary: "create.step3Summary" },
  { title: "create.step4", summary: "create.step4Summary" },
] as const;
async function prepareCover(file: File) {
  if (file.size > 20_000_000)
    throw new Error("Choose an image smaller than 20 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This image could not be prepared. Try a JPG or PNG.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob || blob.size > MAX_EVENT_IMAGE_BYTES)
      throw new Error("This image is too large after resizing. Try another photo.");
    return new File([blob], "event-cover.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

export default function EventForm({
  initial,
  venues,
  organizerProfiles,
  venueProfiles,
  demoMode = false,
  platformTestCheckout = false,
  testVatPercent = 0,
}: {
  initial?: Event;
  venues: Venue[];
  organizerProfiles: BusinessProfile[];
  venueProfiles: BusinessProfile[];
  demoMode?: boolean;
  platformTestCheckout?: boolean;
  testVatPercent?: number;
}) {
  const { language, t } = useApp();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const confirmIntentRef = useRef(false);
  const image = initial?.image || "festival";
  const [coverImage, setCoverImage] = useState(
    initial?.coverImage?.startsWith("/api/event-images/") ? initial.coverImage : "",
  );
  const coverPreview =
    coverImage || (initial ? initial.coverImage || `/images/${image}.jpg` : "");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverError, setCoverError] = useState("");
  const initialVenue = venues.find((venue) => venue.id === initial?.venueId);
  const [venueId, setVenueId] = useState(initialVenue?.id || "");
  const [venueName, setVenueName] = useState(
    initialVenue?.name || initial?.venue || "",
  );
  const [venueCity, setVenueCity] = useState(
    initialVenue?.city || initial?.city || "Messina",
  );
  const [venueArea, setVenueArea] = useState(initial?.area || "");
  const [venueAddress, setVenueAddress] = useState(
    initialVenue
      ? initialVenue.address + ", " + initialVenue.postalCode
      : initial?.address || "",
  );
  const [capacity, setCapacity] = useState(
    String(initial?.capacity || initialVenue?.capacity || 100),
  );
  const [eventTimezone, setEventTimezone] = useState(
    initial?.timezone || initialVenue?.timezone || "Europe/Rome",
  );
  const [organizerProfileId, setOrganizerProfileId] = useState(
    initial?.organizerProfileId || organizerProfiles[0]?.id || "",
  );
  const [activeStep, setActiveStep] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedVenue = venues.find((venue) => venue.id === venueId);
  const selectedVenueProfile = venueProfiles.find(
    (profile) => profile.id === selectedVenue?.hostProfileId,
  );

  function chooseVenue(nextVenueId: string) {
    const nextVenue = venues.find((venue) => venue.id === nextVenueId);
    setVenueId(nextVenue?.id || "");
    if (!nextVenue) {
      setVenueName("");
      setVenueCity("");
      setVenueArea("");
      setVenueAddress("");
      setCapacity("100");
      setEventTimezone("Europe/Rome");
      return;
    }
    setVenueName(nextVenue.name);
    setVenueCity(nextVenue.city);
    setVenueArea("");
    setVenueAddress(nextVenue.address + ", " + nextVenue.postalCode);
    setCapacity(String(nextVenue.capacity));
    setEventTimezone(nextVenue.timezone);
  }

  async function uploadCover(file: File) {
    setUploadingCover(true);
    setCoverError("");
    try {
      const prepared = await prepareCover(file);
      const form = new FormData();
      form.set("image", prepared);
      const response = await fetch("/api/event-images", {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url)
        throw new Error(result.error || "The image could not be uploaded.");
      setCoverImage(result.url);
    } catch (error) {
      setCoverError((error as Error).message);
    } finally {
      setUploadingCover(false);
    }
  }

  function validateStep(stepIndex: number) {
    const form = formRef.current;
    const section = form?.querySelector<HTMLElement>(
      '[data-wizard-step="' + stepIndex + '"]',
    );
    if (!form || !section) return false;

    if (stepIndex === 1 && !coverImage && !initial) {
      setCoverError(t("create.photoRequired"));
      form.querySelector<HTMLInputElement>("#cover-upload")?.focus();
      return false;
    }

    if (stepIndex === 2) {
      const start = form.elements.namedItem("start") as HTMLInputElement;
      const end = form.elements.namedItem("end") as HTMLInputElement;
      end.setCustomValidity(
        start.value && end.value && end.value <= start.value
          ? language === "it"
            ? "L'orario di fine deve essere successivo all'orario di inizio."
            : "The end time must be after the start time."
          : "",
      );
    }

    const fields = section.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input, select, textarea");
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  }

  function continueToNextStep() {
    if (!validateStep(activeStep)) return;
    setError("");
    setActiveStep((step) => Math.min(step + 1, wizardSteps.length - 1));
  }

  function goBack() {
    setError("");
    setReviewOpen(false);
    setActiveStep((step) => Math.max(step - 1, 0));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (activeStep < wizardSteps.length - 1) {
      continueToNextStep();
      return;
    }
    if (!validateStep(activeStep)) {
      confirmIntentRef.current = false;
      return;
    }
    if (!confirmIntentRef.current) {
      setReviewOpen(true);
      return;
    }
    confirmIntentRef.current = false;
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const body = {
        ...data,
        image,
        coverImage,
        price: Math.round(Number(data.price) * 100),
        capacity: Number(data.capacity),
        vipCapacity: Number(data.vipCapacity || 0),
        vipPrice:
          String(data.vipPrice || "").trim() === ""
            ? null
            : Math.round(Number(data.vipPrice) * 100),
        startsAt: zonedToIso(String(data.start), String(data.timezone)),
        endsAt: zonedToIso(String(data.end), String(data.timezone)),
      };
      const result = await api<{ event: Event }>(
        "events" + (initial ? "/" + initial.id : ""),
        { method: initial ? "PUT" : "POST", body },
      );
      router.push("/events/" + result.event.slug);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function confirmPublish() {
    confirmIntentRef.current = true;
    formRef.current?.requestSubmit();
  }

  return (
    <div className="form-layout event-form-layout">
      <form
        className="panel event-wizard"
        noValidate
        onSubmit={submit}
        ref={formRef}
      >
        <div className="event-wizard-progress">
          <div className="event-wizard-progress-heading">
            <span className="eyebrow">
              {language === "it" ? "PASSAGGIO" : "STEP"} {String(activeStep + 1).padStart(2, "0")} {language === "it" ? "DI" : "OF"}{" "}
              {String(wizardSteps.length).padStart(2, "0")}
            </span>
            <span>{t(wizardSteps[activeStep].summary)}</span>
          </div>
          <ol
            aria-label={language === "it" ? "Avanzamento creazione evento" : "Event creation progress"}
            className="event-wizard-steps"
          >
            {wizardSteps.map((step, index) => {
              const complete = index < activeStep;
              const current = index === activeStep;
              return (
                <li
                  aria-current={current ? "step" : undefined}
                  className={
                    "event-wizard-step" +
                    (current ? " current" : "") +
                    (complete ? " complete" : "")
                  }
                  key={step.title}
                >
                  <span aria-hidden="true" className="event-wizard-step-mark">
                    {complete ? <FiCheck /> : index + 1}
                  </span>
                  <span className="event-wizard-step-title">{t(step.title)}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <section
          aria-labelledby="event-step-one-title"
          className="form-section event-wizard-panel"
          data-wizard-step="0"
          hidden={activeStep !== 0}
        >
          <h2 id="event-step-one-title">{t("create.essentials")}</h2>
          <p>{t("create.profileIntro")}</p>
          <div className="form-stack event-basics-grid">
            <div className="field event-field-full">
              <label htmlFor="title">{t("create.title")}</label>
              <input
                autoComplete="off"
                defaultValue={initial?.title}
                id="title"
                maxLength={100}
                minLength={5}
                name="title"
                placeholder={t("create.titlePlaceholder")}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="organizer-profile">{t("create.organizerProfile")}</label>
              <select
                id="organizer-profile"
                name="organizerProfileId"
                onChange={(event) => setOrganizerProfileId(event.target.value)}
                required
                value={organizerProfileId}
              >
                {organizerProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              <small>
                {t("create.organizerOwnership")}{" "}
                <Link href="/business-profiles" target="_blank" rel="noreferrer">
                  {t("create.manageProfiles")}
                </Link>
              </small>
            </div>
            <div className="field">
              <label htmlFor="category">{t("create.category")}</label>
              <select
                defaultValue={initial?.category || "music"}
                id="category"
                name="category"
              >
                {categories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {categoryName(category.id, language)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field event-field-full">
              <label htmlFor="description">{t("create.description")}</label>
              <textarea
                defaultValue={initial?.description}
                id="description"
                maxLength={8000}
                minLength={40}
                name="description"
                placeholder={t("create.descriptionPlaceholder")}
                required
              />
              <small>
                {t("create.descriptionHelp")}
              </small>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="event-step-two-title"
          className="form-section event-wizard-panel"
          data-wizard-step="1"
          hidden={activeStep !== 1}
        >
          <h2 id="event-step-two-title">{t("create.scene")}</h2>
          <p>{t("create.coverIntro")}</p>
          <div className="cover-upload-panel">
            <div className="cover-upload-preview">
              {coverPreview ? (
                <Image alt="" fill sizes="(max-width: 700px) 100vw, 360px" src={coverPreview} />
              ) : (
                <FiUpload aria-hidden="true" />
              )}
            </div>
            <div className="cover-upload-content">
              <span className="eyebrow">{t("create.yourPhoto")}</span>
              <strong>{coverImage ? t("create.photoReady") : initial ? t("create.currentPhoto") : t("create.uploadPrompt")}</strong>
              <p>{t("create.uploadHelp")}</p>
              <label aria-disabled={uploadingCover} className="button button-outline cover-upload-button" htmlFor="cover-upload">
                <FiUpload aria-hidden="true" />
                {uploadingCover ? t("create.uploading") : coverPreview ? t("create.replacePhoto") : t("create.uploadPhoto")}
              </label>
              <input
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadingCover}
                id="cover-upload"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void uploadCover(file);
                  event.currentTarget.value = "";
                }}
                type="file"
              />
              {coverError && <small className="cover-upload-error" role="alert">{coverError}</small>}
            </div>
          </div>
          <div className="form-stack event-lineup-fields">
            <div className="field">
              <label htmlFor="artists">{t("create.performers")}</label>
              <input
                defaultValue={initial?.artists?.join(", ")}
                id="artists"
                maxLength={2000}
                name="artists"
                placeholder={t("create.performersPlaceholder")}
              />
              <small>{t("create.performersHelp")}</small>
            </div>
            <div className="field">
              <label htmlFor="genres">{t("create.genres")}</label>
              <input
                defaultValue={initial?.genres?.join(", ")}
                id="genres"
                maxLength={800}
                name="genres"
                placeholder={t("create.genresPlaceholder")}
              />
              <small>{t("create.genresHelp")}</small>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="event-step-three-title"
          className="form-section event-wizard-panel"
          data-wizard-step="2"
          hidden={activeStep !== 2}
        >
          <h2 id="event-step-three-title">{t("create.place")}</h2>
          <p>{t("create.placeIntro")}</p>
          <div className="form-grid">
            <div className="field span-full">
              <label htmlFor="venue-select">{t("create.venueProfile")}</label>
              <select
                id="venue-select"
                name="venueId"
                onChange={(event) => chooseVenue(event.target.value)}
                value={venueId}
              >
                <option value="">{t("create.enterVenue")}</option>
                {venues
                  .filter((venue) => venue.active || venue.id === initial?.venueId)
                  .map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} · {venue.city}
                      {!venue.active ? " · " + t("create.hidden") : ""}
                    </option>
                  ))}
              </select>
              <small>
                {venues.length ? (
                  <>
                    {t("create.savedVenueHelp")}{" "}
                    <Link href="/venues" target="_blank" rel="noreferrer">
                      {t("create.manageVenues")}
                    </Link>
                  </>
                ) : (
                  <>
                    {t("create.createVenueHelp")}{" "}
                    <Link href="/venues" target="_blank" rel="noreferrer">
                      {t("create.venues")}
                    </Link>
                    {t("create.orContinueLocation")}
                  </>
                )}
              </small>
              {selectedVenue && (
                <small className="event-venue-owner">
                  {t("create.venueHost")} {selectedVenueProfile?.name || t("create.venueProfile")}
                </small>
              )}
            </div>
            <div className="field span-full">
              <label htmlFor="timezone">{t("create.timezone")}</label>
              <select
                id="timezone"
                name="timezone"
                onChange={(event) => setEventTimezone(event.target.value)}
                value={eventTimezone}
              >
                {[
                  "Europe/Rome",
                  "Europe/Paris",
                  "Europe/London",
                  "America/New_York",
                  "America/Los_Angeles",
                  "Asia/Tokyo",
                  "Australia/Sydney",
                  "UTC",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="start">{t("create.starts")}</label>
              <input
                defaultValue={
                  initial ? localDateTime(initial.startsAt, eventTimezone) : ""
                }
                id="start"
                name="start"
                required
                type="datetime-local"
              />
            </div>
            <div className="field">
              <label htmlFor="end">{t("create.ends")}</label>
              <input
                defaultValue={
                  initial ? localDateTime(initial.endsAt, eventTimezone) : ""
                }
                id="end"
                name="end"
                required
                type="datetime-local"
              />
            </div>
            <div className="field">
              <label htmlFor="venue">{t("create.venueName")}</label>
              <input
                id="venue"
                maxLength={120}
                minLength={2}
                name="venue"
                onChange={(event) => setVenueName(event.target.value)}
                placeholder={t("create.venuePlaceholder")}
                readOnly={Boolean(venueId)}
                required
                value={venueName}
              />
            </div>
            <div className="field">
              <label htmlFor="city">{t("create.city")}</label>
              <input
                id="city"
                maxLength={80}
                minLength={2}
                name="city"
                onChange={(event) => {
                  setVenueCity(event.target.value);
                  setVenueArea("");
                }}
                placeholder={t("create.cityPlaceholder")}
                readOnly={Boolean(venueId)}
                required
                value={venueCity}
              />
            </div>
            {isMessinaCity(venueCity) && (
              <div className="field">
                <label htmlFor="area">{t("create.messinaArea")}</label>
                <select
                  id="area"
                  name="area"
                  onChange={(event) => setVenueArea(event.target.value)}
                  required
                  value={venueArea}
                >
                  <option value="">{t("create.chooseArea")}</option>
                  {messinaAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area[language]}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field span-full">
              <label htmlFor="address">{t("create.address")}</label>
              <input
                id="address"
                maxLength={300}
                minLength={5}
                name="address"
                onChange={(event) => setVenueAddress(event.target.value)}
                placeholder={t("create.addressPlaceholder")}
                readOnly={Boolean(venueId)}
                required
                value={venueAddress}
              />
            </div>
            <div className="field span-full">
              <label htmlFor="accessNotes">{t("create.accessNotes")}</label>
              <textarea
                defaultValue={initial?.accessNotes || ""}
                id="accessNotes"
                maxLength={500}
                name="accessNotes"
                placeholder={t("create.accessNotesPlaceholder")}
                rows={3}
              />
              <small>{t("create.accessNotesHelp")}</small>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="event-step-four-title"
          className="form-section event-wizard-panel"
          data-wizard-step="3"
          hidden={activeStep !== 3}
        >
          <h2 id="event-step-four-title">{t("create.savePlace")}</h2>
          <p>{language === "it"
            ? "Imposta il biglietto Standard e, se vuoi, aggiungi un numero limitato di biglietti VIP. I posti VIP rientrano nella capienza totale."
            : "Set a Standard ticket and optionally add a limited VIP allocation. VIP places count toward your total capacity."}</p>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="capacity">{t("create.capacity")}</label>
              <input
                max={selectedVenue?.capacity || 100000}
                onChange={(event) => setCapacity(event.target.value)}
                id="capacity"
                min={1}
                name="capacity"
                required
                type="number"
                value={capacity}
              />
            </div>
            <div className="field">
              <label htmlFor="currency">{t("create.currency")}</label>
              <select
                defaultValue={initial?.currency || "eur"}
                id="currency"
                name="currency"
              >
                <option value="gbp">GBP — {language === "it" ? "Sterlina britannica" : "British pound"}</option>
                <option value="eur">EUR — Euro</option>
                <option value="usd">USD — {language === "it" ? "Dollaro statunitense" : "US dollar"}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="price">{t("create.standardPrice")}</label>
              <input
                defaultValue={initial ? initial.price / 100 : 0}
                id="price"
                max={10000}
                min={0}
                name="price"
                required
                step="0.01"
                type="number"
              />
            </div>
            <div className="field">
              <label htmlFor="vipCapacity">{t("create.vipAllocation")}</label>
              <input
                defaultValue={initial?.vipCapacity || ""}
                id="vipCapacity"
                max={capacity}
                min={1}
                name="vipCapacity"
                placeholder={t("create.vipPlaceholder")}
                type="number"
              />
              <small>{t("create.vipAllocationHelp")}</small>
            </div>
            <div className="field">
              <label htmlFor="vipPrice">{t("create.vipPrice")}</label>
              <input
                defaultValue={
                  initial?.vipPrice !== undefined ? initial.vipPrice / 100 : ""
                }
                id="vipPrice"
                max={10000}
                min={0}
                name="vipPrice"
                placeholder={t("create.vipPricePlaceholder")}
                step="0.01"
                type="number"
              />
              <small>{t("create.vipPriceHelp")}</small>
            </div>
          </div>
          {demoMode ? (
            <div className="notice notice-warm">
              {language === "it"
                ? "Le vendite non sono ancora disponibili. I prezzi vengono salvati per la pianificazione."
                : "Ticket sales are not available yet. Prices are saved for planning."}
            </div>
          ) : platformTestCheckout ? (
            <div className="notice notice-warm">
              {language === "it"
                ? "Checkout di prova attivo: usa prezzi Standard e VIP per simulare gli acquisti. Non servono dati legali dell'organizzatore. I biglietti di prova non sono validi per l'ingresso."
                : "Test checkout is active: use Standard and VIP prices to try purchases. Organizer legal details are not needed. Test tickets are not valid for entry."}
            </div>
          ) : (
            <div className="notice">
              {t("create.stripeNotice")}{" "}
              <Link href="/organizer">{t("create.connectPayouts")}</Link>.{" "}
              {t("create.stripeFees")}
            </div>
          )}
          <p className="event-compliance-note">
            {demoMode
              ? t("create.demoTicketNote")
              : testVatPercent > 0
                ? t("create.taxPreviewNote", { rate: testVatPercent })
                : t("create.taxNote")}
          </p>
        </section>

        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}

        <div className="event-wizard-actions">
          {activeStep > 0 ? (
            <button
              className="button button-outline"
              disabled={busy}
              onClick={goBack}
              type="button"
            >
              <FiArrowLeft /> {t("create.back")}
            </button>
          ) : (
            <span />
          )}
          {activeStep < wizardSteps.length - 1 ? (
            <button
              className="button button-primary"
              disabled={busy || uploadingCover}
              key="continue-step"
              onClick={continueToNextStep}
              type="button"
            >
              {t("create.continue")} <FiArrowRight />
            </button>
          ) : (
            <button
              className="button button-primary event-wizard-submit"
              disabled={busy}
              key="publish-event"
              onClick={() => setReviewOpen(true)}
              type="button"
            >
              {demoMode ? (language === "it" ? "Rivedi la bozza" : "Review draft") : initial ? t("create.reviewChanges") : t("create.reviewEvent")}
              <FiArrowRight />
            </button>
          )}
        </div>
        {reviewOpen && activeStep === wizardSteps.length - 1 && (
          <div className="event-wizard-confirm" role="group" aria-label={t("create.reviewHeading")}>
            <div>
              <strong>{t("create.reviewHeading")}</strong>
              <p>{demoMode
                ? (language === "it" ? "La bozza resterà privata e potrai modificarla in seguito." : "Your draft stays private and you can edit it later.")
                : initial ? t("create.editIntro") : t("create.publishedNote")}</p>
            </div>
            <div className="event-wizard-confirm-actions">
              <button
                className="button button-outline"
                disabled={busy}
                onClick={() => setReviewOpen(false)}
                type="button"
              >
                {t("create.keepEditing")}
              </button>
              <button
                className="button button-primary"
                disabled={busy}
                onClick={confirmPublish}
                type="button"
              >
                {busy
                  ? t("create.saving")
                  : initial
                    ? t("create.saveChanges")
                    : demoMode
                      ? language === "it" ? "Salva bozza" : "Save draft"
                      : t("create.publish")}
                {initial ? <FiCheck /> : <FiArrowUpRight />}
              </button>
            </div>
          </div>
        )}
        {!reviewOpen && (
          <p className="form-note event-wizard-note">
            {activeStep === wizardSteps.length - 1
              ? demoMode
                ? (language === "it" ? "Questa bozza è visibile solo a te." : "This draft is visible only to you.")
                : t("create.publishedNote")
              : t("create.progressNote")}
          </p>
        )}
      </form>

    </div>
  );
}
