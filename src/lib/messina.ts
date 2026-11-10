import type { Language } from "./i18n";

export const messinaAreas = [
  { id: "centro", it: "Centro", en: "City centre" },
  { id: "sud", it: "Messina Sud", en: "South Messina" },
  { id: "nord", it: "Messina Nord", en: "North Messina" },
  { id: "ganzirri", it: "Ganzirri", en: "Ganzirri" },
  { id: "torre-faro", it: "Torre Faro", en: "Torre Faro" },
  { id: "colli", it: "Colli Peloritani", en: "Peloritani hills" },
] as const;

export type MessinaArea = (typeof messinaAreas)[number]["id"];

export function isMessinaCity(city: string) {
  return city.trim().toLocaleLowerCase("it") === "messina";
}

export function isMessinaArea(value: unknown): value is MessinaArea {
  return messinaAreas.some((area) => area.id === value);
}

export function messinaAreaLabel(area: MessinaArea, language: Language) {
  return messinaAreas.find((item) => item.id === area)?.[language] ?? area;
}
