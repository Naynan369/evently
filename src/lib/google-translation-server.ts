import "server-only";
import {
  englishMessages,
  setGoogleTranslations,
  type GoogleTranslationMap,
} from "./i18n";
import { translateMessageMap } from "./google-translation-engine";
import type { Event } from "./types";
import type { Language } from "./i18n";

let cachedBundle: Promise<GoogleTranslationMap | null> | null = null;
let retryAfter = 0;
const eventDescriptions = new Map<string, string>();
let eventRetryAfter = 0;

export async function getGoogleTranslationBundle() {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey || Date.now() < retryAfter) {
    setGoogleTranslations(null);
    return null;
  }
  if (!cachedBundle) {
    cachedBundle = translateMessageMap(englishMessages, apiKey)
      .then((translations) => {
        setGoogleTranslations(translations);
        return translations;
      })
      .catch((error: unknown) => {
        cachedBundle = null;
        retryAfter = Date.now() + 60_000;
        setGoogleTranslations(null);
        console.error(
          "Google Translate is unavailable:",
          error instanceof Error ? error.message : "unknown error",
        );
        return null;
      });
  }
  return cachedBundle;
}

export async function localizePublicEvents(events: Event[], language: Language) {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (
    language !== "it" ||
    !apiKey ||
    Date.now() < eventRetryAfter ||
    !(await getGoogleTranslationBundle())
  )
    return events;

  const missing = [
    ...new Set(
      events
        .filter((event) => !event.visibility || event.visibility === "published")
        .map((event) => event.description)
        .filter((description) => description.trim() && !eventDescriptions.has(description)),
    ),
  ];
  if (missing.length) {
    try {
      const translated = await translateMessageMap(
        Object.fromEntries(missing.map((description, index) => [String(index), description])),
        apiKey,
        fetch,
        { source: undefined },
      );
      missing.forEach((description, index) => {
        const value = translated[String(index)];
        if (value) eventDescriptions.set(description, value);
      });
      while (eventDescriptions.size > 500) {
        const oldest = eventDescriptions.keys().next().value;
        if (!oldest) break;
        eventDescriptions.delete(oldest);
      }
    } catch (error) {
      eventRetryAfter = Date.now() + 60_000;
      console.error(
        "Google event translation is unavailable:",
        error instanceof Error ? error.message : "unknown error",
      );
      return events;
    }
  }
  return events.map((event) => ({
    ...event,
    description: eventDescriptions.get(event.description) ?? event.description,
  }));
}
