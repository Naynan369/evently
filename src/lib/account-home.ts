import { one, userById } from "./db.ts";
import { isOperator } from "./operations.ts";

export async function accountHome(
  userId: string,
): Promise<"/account" | "/organizer" | "/admin"> {
  if (isOperator(await userById(userId))) return "/admin";
  const organizer = await one<{ id: string }>(
    "SELECT id FROM business_profiles WHERE owner_id=? AND kind='organizer' LIMIT 1",
    userId,
  );
  return organizer ? "/organizer" : "/account";
}
