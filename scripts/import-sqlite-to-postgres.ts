import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import {
  closeDatabase,
  initializeDatabase,
  run,
  transaction,
} from "../src/lib/db.ts";

const sourcePath = resolve(process.argv[2] || "data/evently.sqlite");
loadEnvConfig(process.cwd());
// Import the source rows as-is; demo rows would otherwise occupy the same IDs
// and cause valid SQLite events to be skipped by the conflict-safe importer.
process.env.SEED_DEMO = "false";
const tables = [
  ["users", ["id", "name", "email", "password_hash", "interests", "stripe_account", "created_at", "email_verified_at"]],
  ["events", ["id", "slug", "owner_id", "data"]],
  ["sessions", ["token_hash", "user_id", "expires_at"]],
  ["saved", ["user_id", "event_id"]],
  ["bookings", ["id", "user_id", "event_id", "quantity", "total", "currency", "status", "mode", "code", "session_id", "checkout_url", "expires_at", "created_at", "checked_in", "request_key", "stripe_account", "refund_requested"]],
  ["account_tokens", ["token_hash", "user_id", "purpose", "expires_at", "created_at"]],
  ["music_connections", ["user_id", "provider", "credentials", "consent_at"]],
  ["music_profiles", ["user_id", "provider", "data", "updated_at"]],
  ["oauth_states", ["state_hash", "user_id", "session_hash", "verifier", "expires_at"]],
  ["rate_limits", ["key", "count", "resets_at"]],
] as const;

async function main() {
  const source = new DatabaseSync(sourcePath, { readOnly: true });
try {
  await initializeDatabase();
  const counts = await transaction(async () => {
    const imported: [string, number][] = [];
    for (const [table, columns] of tables) {
      const selection = columns.map((column) => '"' + column + '"').join(",");
      const rows = source
        .prepare("SELECT " + selection + ' FROM "' + table + '"')
        .all() as Record<string, unknown>[];
      const placeholders = columns.map(() => "?").join(",");
      const insert =
        "INSERT INTO \"" +
        table +
        "\"(" +
        selection +
        ") VALUES(" +
        placeholders +
        ") ON CONFLICT DO NOTHING";
      for (const row of rows) {
        const values = columns.map((column) => {
          const value = row[column];
          if (
            value === null ||
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean" ||
            value instanceof Date ||
            Buffer.isBuffer(value)
          )
            return value;
          if (typeof value === "bigint") return Number(value);
          throw new Error("Unsupported SQLite value in " + table + "." + column);
        });
        await run(insert, ...values);
      }
      imported.push([table, rows.length]);
    }
    return imported;
  });
  for (const [table, count] of counts)
    console.log(table + ": " + count + " source rows processed");
  console.log("SQLite import completed. Existing PostgreSQL rows were kept.");
} finally {
  source.close();
  await closeDatabase();
}
}

main().catch((error) => {
  console.error("SQLite import failed:", error);
  process.exitCode = 1;
});
