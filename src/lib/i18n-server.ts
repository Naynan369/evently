import { cookies } from "next/headers";
import {
  isLanguage,
  LANGUAGE_COOKIE,
  type Language,
} from "./i18n";
import { getGoogleTranslationBundle } from "./google-translation-server";

export async function getLanguage(): Promise<Language> {
  const value = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  const language = isLanguage(value) ? value : "it";
  if (language === "it") await getGoogleTranslationBundle();
  return language;
}
