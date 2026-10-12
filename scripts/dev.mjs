import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

/**
 * @param {string | undefined} appUrl
 * @param {string[]} [args]
 * @param {string | undefined} [environmentPort]
 */
export function devAddress(appUrl, args = [], environmentPort) {
  let url;
  try {
    url = new URL(appUrl || "http://127.0.0.1:3000");
  } catch {
    throw new Error(
      "Set APP_URL in .env.local to a local address, such as http://127.0.0.1:3000.",
    );
  }
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "For npm run dev, APP_URL must be a local HTTP origin, such as http://127.0.0.1:3000.",
    );
  }
  const { values } = parseArgs({
    args,
    options: {
      port: { type: "string", short: "p" },
      hostname: { type: "string", short: "H" },
    },
    strict: false,
    allowPositionals: true,
  });
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const port = Number(url.port || 80);
  const requestedPort = values.port ?? environmentPort;
  const requestedHost = values.hostname?.replace(/^\[|\]$/g, "");
  if (
    (requestedPort !== undefined && Number(requestedPort) !== port) ||
    (requestedHost !== undefined && requestedHost !== hostname) ||
    args.some((arg) => arg.startsWith("--experimental-https"))
  ) {
    throw new Error(
      "The development address must match APP_URL. Change APP_URL in .env.local instead of using a different host, port or protocol.",
    );
  }
  return { origin: url.origin, hostname, port };
}

function start() {
  process.env.NODE_ENV = "development";
  const require = createRequire(import.meta.url);
  // Use the same dotenv loader/version as the installed Next.js application.
  const nextRequire = createRequire(require.resolve("next/package.json"));
  nextRequire("@next/env").loadEnvConfig(process.cwd(), true);
  const args = process.argv.slice(2);
  const address = devAddress(process.env.APP_URL, args, process.env.PORT);
  console.log("Evently development address: " + address.origin);
  const child = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      "dev",
      ...args,
      "--hostname",
      address.hostname,
      "--port",
      String(address.port),
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        APP_URL: address.origin,
        // Native watcher limits can otherwise cause missing pages/API routes.
        WATCHPACK_POLLING: process.env.WATCHPACK_POLLING ?? "1000",
      },
    },
  );
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("error", (error) => {
    console.error("Could not start Evently: " + error.message);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    start();
  } catch (error) {
    console.error("Evently: " + error.message);
    process.exitCode = 1;
  }
}
