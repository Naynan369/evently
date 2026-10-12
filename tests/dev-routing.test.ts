import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server.js";
import nextConfig from "../next.config.ts";

function environment(t: TestContext, values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
}

test("local page aliases redirect without losing paths or query parameters", async (t) => {
  environment(t, { NODE_ENV: "development", APP_URL: "http://127.0.0.1" });
  const response = await unstable_getResponseFromNextConfig({
    url: "http://localhost/login?next=%2Fsaved",
    headers: { host: "localhost", accept: "text/html" },
    nextConfig,
  });
  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "http://127.0.0.1/login?next=%2Fsaved",
  );
});

test("local canonicalization leaves APIs, assets and other origins alone", async (t) => {
  environment(t, { NODE_ENV: "development", APP_URL: "http://127.0.0.1" });
  for (const [host, path, accept] of [
    ["localhost", "/api/auth/login", "text/html"],
    ["localhost", "/api/music/spotify/callback?code=fixture", "text/html"],
    ["localhost", "/_next/static/chunk.js", "text/html"],
    ["localhost", "/events", "application/json"],
    ["127.0.0.1", "/events", "text/html"],
    ["localhost:3100", "/events", "text/html"],
    ["untrusted.example", "/events", "text/html"],
  ]) {
    const response = await unstable_getResponseFromNextConfig({
      url: "http://" + host + path,
      headers: { host, accept },
      nextConfig,
    });
    assert.equal(response.headers.get("location"), null, host + path);
  }
});

test("reverse alias matching is exact and production never redirects local hosts", async (t) => {
  environment(t, { NODE_ENV: "development", APP_URL: "http://localhost" });
  const request = (host: string) =>
    unstable_getResponseFromNextConfig({
      url: "http://" + host + "/register",
      headers: { host, accept: "text/html" },
      nextConfig,
    });
  assert.equal(
    (await request("127.0.0.1")).headers.get("location"),
    "http://localhost/register",
  );
  assert.equal((await request("127x0x0x1")).headers.get("location"), null);
  Object.assign(process.env, { NODE_ENV: "production" });
  assert.equal((await request("127.0.0.1")).headers.get("location"), null);
});
