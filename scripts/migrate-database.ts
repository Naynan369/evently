import nextEnv from "@next/env";
import { closeDatabase, initializeDatabase } from "../src/lib/db.ts";

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  try {
    await initializeDatabase();
    console.log("Evently PostgreSQL schema is ready.");
  } finally {
    await closeDatabase();
  }
}

main().catch((error) => {
  console.error("PostgreSQL setup failed:", error);
  process.exitCode = 1;
});
