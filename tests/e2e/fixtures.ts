import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function mailLink(email: string, purpose = "verify-email") {
  const dir = resolve("test-results/mail");
  const messages = await Promise.all(
    (await readdir(dir)).map(
      async (name) =>
        JSON.parse(await readFile(resolve(dir, name), "utf8")) as {
          to: string;
          url: string;
          createdAt: number;
        },
    ),
  );
  const message = messages
    .filter((m) => m.to === email.toLowerCase() && m.url.includes("/" + purpose + "?"))
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!message) throw new Error("Expected test email was not delivered");
  return message.url;
}

export const englishStorageState = {
  cookies: [{
    name: "evently-language",
    value: "en",
    domain: "127.0.0.1",
    path: "/",
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: "Lax" as const,
  }],
  origins: [],
};
