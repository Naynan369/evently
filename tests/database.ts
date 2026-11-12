import nextEnv from "@next/env";
import { resetDatabaseForTests } from "../src/lib/db.ts";

export async function prepareTestDatabase(name: string) {
  nextEnv.loadEnvConfig(process.cwd());
  if (!process.env.TEST_DATABASE_URL)
    throw new Error(
      "Set TEST_DATABASE_URL to an isolated PostgreSQL test database before running tests.",
    );
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_SCHEMA = "evently_test_" + name.replace(/[^a-z0-9_]/gi, "_");
  process.env.EVENTLY_TEST_MODE = "true";
  process.env.EVENTLY_PLATFORM_CHECKOUT_TEST = "false";
  process.env.SEED_DEMO = "false";
  await resetDatabaseForTests();
}
