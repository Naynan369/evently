import test from "node:test";
import assert from "node:assert/strict";
import {
  translate,
  setGoogleTranslations,
} from "../src/lib/i18n.ts";
import { translateMessageMap } from "../src/lib/google-translation-engine.ts";

test("Google translation preserves interpolation values and decodes entities", async () => {
  let request: RequestInit | undefined;
  const fetcher = async (_url: RequestInfo | URL, init?: RequestInit) => {
    request = init;
    const body = JSON.parse(String(init?.body)) as { q: string[] };
    assert.match(body.q[0], /__EVENTLY_PLACEHOLDER_0__/);
    return new Response(
      JSON.stringify({
        data: {
          translations: body.q.map((value) => ({
            translatedText: value.replace("Welcome", "Benvenuto").replace("&", "&amp;"),
          })),
        },
      }),
      { status: 200 },
    );
  };
  const result = await translateMessageMap(
    { greeting: "Welcome {name} & friends" },
    "fixture-key",
    fetcher as typeof fetch,
  );
  assert.equal(result.greeting, "Benvenuto {name} & friends");
  assert.equal(new Headers(request?.headers).get("X-goog-api-key"), "fixture-key");
  assert.equal(
    (JSON.parse(String(request?.body)) as { source: string }).source,
    "en",
  );
});

test("Italian text falls back to the existing copy when Google is unavailable", () => {
  const original = translate("it", "nav.explore");
  setGoogleTranslations({ "nav.explore": "Esplora con Google" });
  assert.equal(translate("it", "nav.explore"), "Esplora con Google");
  assert.equal(translate("en", "nav.explore"), "Explore");
  setGoogleTranslations(null);
  assert.equal(translate("it", "nav.explore"), original);
});

test("public event translation can use automatic source detection", async () => {
  const fetcher = async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { source?: string; q: string[] };
    assert.equal(body.source, undefined);
    return new Response(
      JSON.stringify({
        data: { translations: body.q.map(() => ({ translatedText: "Una serata" })) },
      }),
      { status: 200 },
    );
  };
  const result = await translateMessageMap(
    { description: "An evening together" },
    "fixture-key",
    fetcher as typeof fetch,
    { source: undefined },
  );
  assert.equal(result.description, "Una serata");
});
