import { loadEnvConfig } from "@next/env";
import { all, closeDatabase } from "../src/lib/db.ts";

async function main() {
  loadEnvConfig(process.cwd());
  try {
    const entries = await all<{
      createdAt: number;
      organizer: string;
      email: string;
      feedback: string;
    }>(
      'SELECT f.created_at AS "createdAt", u.name AS organizer, u.email, f.body AS feedback FROM demo_feedback f JOIN users u ON u.id=f.user_id ORDER BY f.created_at DESC',
    );
    process.stdout.write(JSON.stringify(entries, null, 2) + "\n");
  } finally {
    await closeDatabase();
  }
}

main().catch((error) => {
  console.error("Could not read organizer feedback:", error);
  process.exitCode = 1;
});
