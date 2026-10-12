export function money(cents: number, currency = "gbp") {
  return cents === 0
    ? "Free"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
      }).format(cents / 100);
}
export function eventDate(
  date: string,
  timezone = "Europe/London",
  short = false,
) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: short ? undefined : "short",
    day: "numeric",
    month: short ? "short" : "long",
    timeZone: timezone,
  }).format(new Date(date));
}
export function eventTime(
  date: string,
  timezone = "Europe/London",
  includeTimezone = false,
) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: includeTimezone ? "short" : undefined,
  }).format(new Date(date));
}
export function safeNext(value: string | null | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\x00-\x20\x7f\\]/.test(value)
  )
    return "/account";
  try {
    const url = new URL(value, "https://evently.local");
    return url.origin === "https://evently.local"
      ? url.pathname + url.search + url.hash
      : "/account";
  } catch {
    return "/account";
  }
}
