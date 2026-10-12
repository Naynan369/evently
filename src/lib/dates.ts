export function localDateTime(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return (
    get("year") +
    "-" +
    get("month") +
    "-" +
    get("day") +
    "T" +
    get("hour") +
    ":" +
    get("minute")
  );
}
export function zonedToIso(local: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Choose a valid date and time.");
  const expected = Date.parse(local + ":00Z");
  if (!Number.isFinite(expected))
    throw new Error("Choose a valid date and time.");
  let instant = expected;
  for (let i = 0; i < 3; i++) {
    const represented = Date.parse(
      localDateTime(new Date(instant).toISOString(), timezone) + ":00Z",
    );
    instant += expected - represented;
  }
  const iso = new Date(instant).toISOString();
  if (localDateTime(iso, timezone) !== local)
    throw new Error(
      "That local time doesn’t exist because the clocks change. Choose another time.",
    );
  return iso;
}
