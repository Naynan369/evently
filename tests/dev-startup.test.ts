import test from "node:test";
import assert from "node:assert/strict";
import { devAddress } from "../scripts/dev.mjs";

test("development uses the configured hostname and port as a single address", () => {
  assert.deepEqual(devAddress("http://127.0.0.1:3000", ["--webpack"]), {
    origin: "http://127.0.0.1:3000",
    hostname: "127.0.0.1",
    port: 3000,
  });
  assert.deepEqual(
    devAddress("http://localhost:3200", ["--port", "3200", "-H", "localhost"]),
    {
      origin: "http://localhost:3200",
      hostname: "localhost",
      port: 3200,
    },
  );
  assert.deepEqual(devAddress("http://[::1]:3100", [], "3100"), {
    origin: "http://[::1]:3100",
    hostname: "::1",
    port: 3100,
  });
  assert.equal(devAddress(undefined).origin, "http://127.0.0.1:3000");
});

test("conflicting command-line and environment addresses fail before starting", () => {
  for (const args of [
    ["--port", "3001"],
    ["--port=3001"],
    ["-p3001"],
    ["--hostname", "localhost"],
    ["-H", "0.0.0.0"],
    ["--experimental-https"],
  ])
    assert.throws(
      () => devAddress("http://127.0.0.1:3000", args),
      /must match APP_URL/,
    );
  assert.throws(
    () => devAddress("http://127.0.0.1:3000", [], "3001"),
    /must match APP_URL/,
  );
});

test("development does not accidentally use a deployment URL or URL with secrets", () => {
  for (const url of [
    "not a url",
    "https://events.example.com",
    "http://192.168.1.5:3000",
    "http://user:secret@localhost:3000",
    "http://localhost:3000/path",
    "http://localhost:3000/?token=test",
    "http://localhost:3000/#test",
  ])
    assert.throws(() => devAddress(url), /APP_URL/);
});
