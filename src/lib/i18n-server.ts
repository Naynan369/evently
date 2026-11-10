import { cookies } from "next/headers";
import {
  isLanguage,
  LANGUAGE_COOKIE,
  type Language,
} from "./i18n";

export async function getLanguage(): Promise<Language> {
  const value = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  return isLanguage(value) ? value : "it";
}
