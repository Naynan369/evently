"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { FiArrowUpRight, FiCheck } from "react-icons/fi";
import { categories, imageOptions } from "@/lib/catalog";
import { localDateTime, zonedToIso } from "@/lib/dates";
import { api } from "@/lib/client";
import type { Event } from "@/lib/types";
export default function EventForm({ initial }: { initial?: Event }) {
  const router = useRouter();
  const [image, setImage] = useState(initial?.image || "festival");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timezone = initial?.timezone || "Europe/London";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const body = {
        ...data,
        image,
        price: Math.round(Number(data.price) * 100),
        capacity: Number(data.capacity),
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
  return (
    <div className="form-layout">
      <form className="panel" onSubmit={submit}>
        <section className="form-section">
          <h2>01. Give it a little personality.</h2>
          <p>
            A clear title and a thoughtful description help the right people
            find you.
          </p>
          <div className="form-stack">
            <div className="field">
              <label htmlFor="title">Event title</label>
              <input
                id="title"
                name="title"
                defaultValue={initial?.title}
                placeholder="Something worth showing up for"
                minLength={5}
                maxLength={100}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                name="category"
                defaultValue={initial?.category || "music"}
              >
                {categories.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="description">Tell people what to expect</label>
              <textarea
                id="description"
                name="description"
                defaultValue={initial?.description}
                minLength={40}
                maxLength={8000}
                placeholder="The experience, the atmosphere, who it’s for, and anything guests should bring…"
                required
              />
              <small>
                At least 40 characters. Include accessibility, age restrictions
                and refund arrangements where relevant.
              </small>
            </div>
            <div className="field">
              <label htmlFor="artists">Performers / artist lineup</label>
              <input
                id="artists"
                name="artists"
                defaultValue={initial?.artists?.join(", ")}
                placeholder="Artist names, separated by commas"
                maxLength={2000}
              />
              <small>
                Use accurate artist names so fans can find events featuring the
                people they listen to.
              </small>
            </div>
            <div className="field">
              <label htmlFor="genres">Music genres</label>
              <input
                id="genres"
                name="genres"
                defaultValue={initial?.genres?.join(", ")}
                placeholder="For example: Electronic, House, Jazz"
                maxLength={800}
              />
              <small>
                Optional. Include only genres represented at your event.
              </small>
            </div>
          </div>
        </section>
        <section className="form-section">
          <h2>02. Set the scene.</h2>
          <p>Choose a cover from our image collection.</p>
          <div className="cover-options" role="group" aria-label="Event cover">
            {imageOptions.map((i) => (
              <button
                key={i.id}
                type="button"
                className={"cover-option" + (image === i.id ? " active" : "")}
                aria-pressed={image === i.id}
                onClick={() => setImage(i.id)}
              >
                <Image
                  src={"/images/" + i.id + ".jpg"}
                  alt=""
                  fill
                  sizes="160px"
                />
                <span>
                  {i.name}
                  {image === i.id ? " ✓" : ""}
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="form-section">
          <h2>03. A time and a place.</h2>
          <p>
            All dates below use the selected timezone, including daylight
            saving.
          </p>
          <div className="form-grid">
            <div className="field span-full">
              <label htmlFor="timezone">Event timezone</label>
              <select id="timezone" name="timezone" defaultValue={timezone}>
                {[
                  "Europe/London",
                  "Europe/Rome",
                  "Europe/Paris",
                  "America/New_York",
                  "America/Los_Angeles",
                  "Asia/Tokyo",
                  "Australia/Sydney",
                  "UTC",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="start">Starts</label>
              <input
                id="start"
                name="start"
                type="datetime-local"
                defaultValue={
                  initial ? localDateTime(initial.startsAt, timezone) : ""
                }
                required
              />
            </div>
            <div className="field">
              <label htmlFor="end">Ends</label>
              <input
                id="end"
                name="end"
                type="datetime-local"
                defaultValue={
                  initial ? localDateTime(initial.endsAt, timezone) : ""
                }
                required
              />
            </div>
            <div className="field">
              <label htmlFor="venue">Venue name</label>
              <input
                id="venue"
                name="venue"
                defaultValue={initial?.venue}
                placeholder="The perfect place"
                minLength={2}
                maxLength={120}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="city">City</label>
              <input
                id="city"
                name="city"
                defaultValue={initial?.city}
                placeholder="London"
                minLength={2}
                maxLength={80}
                required
              />
            </div>
            <div className="field span-full">
              <label htmlFor="address">Full address</label>
              <input
                id="address"
                name="address"
                defaultValue={initial?.address}
                placeholder="Street, postcode and country"
                minLength={5}
                maxLength={300}
                required
              />
            </div>
          </div>
        </section>
        <section className="form-section">
          <h2>04. Save them a place.</h2>
          <p>
            One clear general-admission ticket. Set the price to zero for a free
            event.
          </p>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="capacity">Total capacity</label>
              <input
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                max={100000}
                defaultValue={initial?.capacity || 100}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="currency">Currency</label>
              <select
                id="currency"
                name="currency"
                defaultValue={initial?.currency || "gbp"}
              >
                <option value="gbp">GBP — British pound</option>
                <option value="eur">EUR — Euro</option>
                <option value="usd">USD — US dollar</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="price">Price per ticket</label>
              <input
                id="price"
                name="price"
                type="number"
                min={0}
                max={10000}
                step="0.01"
                defaultValue={initial ? initial.price / 100 : 0}
                required
              />
            </div>
          </div>
          <div className="notice">
            Paid tickets require an active Stripe account.{" "}
            <Link href="/organizer">Connect payouts in Organizer studio</Link>.
            Evently adds no platform fee; Stripe’s processing fees apply.
          </div>
        </section>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <button disabled={busy} className="button button-primary button-wide">
          {busy
            ? "Saving your event…"
            : initial
              ? "Save event changes"
              : "Publish my event"}
          {initial ? <FiCheck /> : <FiArrowUpRight />}
        </button>
        <p className="form-note" style={{ marginTop: 15 }}>
          Publishing makes this event visible on Evently. Dates and prices
          cannot change once tickets are reserved.
        </p>
      </form>
      <aside className="panel form-sidebar">
        <span className="eyebrow">SMALL DETAILS, GREAT EXPERIENCES</span>
        <h3 style={{ marginTop: 15 }}>Make it easy to say yes.</h3>
        <ul>
          <li>Give your event a specific, memorable name.</li>
          <li>Tell guests exactly what their ticket includes.</li>
          <li>Include arrival details and accessibility information.</li>
          <li>Set a realistic capacity. Every reservation counts.</li>
          <li>Manage guests and check-in from your studio.</li>
        </ul>
        <Link className="text-link" href="/help">
          A little help along the way <FiArrowUpRight />
        </Link>
      </aside>
    </div>
  );
}
