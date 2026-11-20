const GOOGLE_TRANSLATE_URL =
  "https://translation.googleapis.com/language/translate/v2";
const MAX_BATCH_CHARACTERS = 4500;
const MAX_BATCH_STRINGS = 128;

export function decodeTranslatedText(value: string) {
  return value.replace(
    /&(#(?:x[0-9a-f]+|[0-9]+)|amp|lt|gt|quot|apos|nbsp);/gi,
    (match, entity: string) => {
      if (entity.startsWith("#")) {
        const hex = entity[1]?.toLowerCase() === "x";
        const codePoint = Number.parseInt(
          entity.slice(hex ? 2 : 1),
          hex ? 16 : 10,
        );
        return Number.isInteger(codePoint) &&
          codePoint >= 0 &&
          codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : match;
      }
      const named: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        nbsp: "\u00a0",
      };
      return named[entity.toLowerCase()] ?? match;
    },
  );
}

function protectPlaceholders(source: string) {
  const placeholders: string[] = [];
  const protectedText = source.replace(/\{[a-zA-Z][\w]*\}/g, (placeholder) => {
    const token = `__EVENTLY_PLACEHOLDER_${placeholders.length}__`;
    placeholders.push(placeholder);
    return token;
  });
  return {
    protectedText,
    restore(translated: string) {
      let result = translated;
      for (const [index, placeholder] of placeholders.entries()) {
        const token = `__EVENTLY_PLACEHOLDER_${index}__`;
        if (!result.includes(token)) return null;
        result = result.replaceAll(token, placeholder);
      }
      return result;
    },
  };
}

export async function translateMessageMap(
  messages: Record<string, string>,
  apiKey: string,
  fetcher: typeof fetch = fetch,
  options: { source?: string } = { source: "en" },
) {
  const unique = [...new Set(Object.values(messages).filter((value) => value.trim()))];
  const batches: string[][] = [];
  let batch: string[] = [];
  let characters = 0;
  for (const source of unique) {
    const length = source.length;
    if (
      batch.length &&
      (batch.length >= MAX_BATCH_STRINGS ||
        characters + length > MAX_BATCH_CHARACTERS)
    ) {
      batches.push(batch);
      batch = [];
      characters = 0;
    }
    batch.push(source);
    characters += length;
  }
  if (batch.length) batches.push(batch);

  const translated = new Map<string, string>();
  for (const sources of batches) {
    const protectedStrings = sources.map(protectPlaceholders);
    const response = await fetcher(GOOGLE_TRANSLATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        q: protectedStrings.map((item) => item.protectedText),
        ...(options.source ? { source: options.source } : {}),
        target: "it",
        format: "text",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      throw new Error(`Google Translate returned HTTP ${response.status}`);
    const result = await response.json();
    const values = result?.data?.translations;
    if (!Array.isArray(values) || values.length !== sources.length)
      throw new Error("Google Translate returned an incomplete response");
    sources.forEach((source, index) => {
      const value = values[index]?.translatedText;
      if (typeof value !== "string")
        throw new Error("Google Translate returned invalid text");
      const restored = protectedStrings[index].restore(
        decodeTranslatedText(value),
      );
      if (restored) translated.set(source, restored);
    });
  }

  return Object.fromEntries(
    Object.entries(messages)
      .map(([key, source]) => [key, translated.get(source)] as const)
      .filter((entry): entry is readonly [string, string] =>
        typeof entry[1] === "string"),
  );
}
