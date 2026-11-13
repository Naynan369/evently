import { one } from "./db.ts";

export async function accountHome(
  userId: string,
): Promise<"/account" | "/organizer"> {
  const organizer = await one<{ id: string }>(
    "SELECT id FROM business_profiles WHERE owner_id=? AND kind='organizer' LIMIT 1",
    userId,
  );
  return organizer ? "/organizer" : "/account";
}
