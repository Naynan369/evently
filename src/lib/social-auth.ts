import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";
import { createSession } from "./auth.ts";
import { accountHome } from "./account-home.ts";
import { one, run, transaction } from "./db.ts";
import { safeNext } from "./format.ts";
import { hashPassword, randomToken, tokenHash } from "./security.ts";

type SocialProvider = "google" | "apple";
type LoginState = {
  binding_hash: string;
  nonce: string;
  verifier: string;
  next_path: string;
  auth_page: string;
  expires_at: number;
};
type Identity = { subject: string; email: string; name: string };

const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const appleKeys = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export function socialProvider(value: string): SocialProvider | null {
  return value === "google" || value === "apple" ? value : null;
}

function origin() {
  const value = process.env.APP_URL;
  if (!value) throw new Error("APP_URL is required for social sign-in.");
  const url = new URL(value);
  if (
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("APP_URL must be a secure origin or a local loopback URL.");
  return url.origin;
}

function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function appleConfig() {
  const clientId = process.env.APPLE_SIGN_IN_CLIENT_ID;
  const teamId = process.env.APPLE_SIGN_IN_TEAM_ID;
  const keyId = process.env.APPLE_SIGN_IN_KEY_ID;
  const privateKey = process.env.APPLE_SIGN_IN_PRIVATE_KEY;
  return clientId && teamId && keyId && privateKey
    ? { clientId, teamId, keyId, privateKey }
    : null;
}

function providerConfig(provider: SocialProvider) {
  return provider === "google" ? googleConfig() : appleConfig();
}

function callbackUrl(provider: SocialProvider) {
  return origin() + "/api/auth/oauth/" + provider + "/callback";
}

function bindingCookie(provider: SocialProvider) {
  return "evently_oauth_" + provider;
}

function errorRedirect(
  page: string,
  code: "unavailable" | "cancelled" | "failed",
  next = "/account",
) {
  const url = new URL(page === "register" ? "/register" : "/login", origin());
  url.searchParams.set("oauthError", code);
  url.searchParams.set("next", safeNext(next));
  return NextResponse.redirect(url, 303);
}

export async function startSocialSignIn(
  request: NextRequest,
  provider: SocialProvider,
) {
  const page = request.nextUrl.searchParams.get("from") === "register" ? "register" : "login";
  const config = providerConfig(provider);
  if (!config || (provider === "apple" && !origin().startsWith("https://")))
    return errorRedirect(page, "unavailable", request.nextUrl.searchParams.get("next") || undefined);

  const state = randomToken();
  const binding = randomToken();
  const nonce = randomToken();
  const verifier = randomToken();
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next = requestedNext ? safeNext(requestedNext) : "";
  await run("DELETE FROM oauth_login_states WHERE expires_at<?", Date.now());
  await run(
    "INSERT INTO oauth_login_states(state_hash,provider,binding_hash,nonce,verifier,next_path,auth_page,expires_at) VALUES(?,?,?,?,?,?,?,?)",
    tokenHash(state), provider, tokenHash(binding), nonce, verifier, next, page,
    Date.now() + 10 * 60_000,
  );

  const authorization = new URL(
    provider === "google"
      ? "https://accounts.google.com/o/oauth2/v2/auth"
      : "https://appleid.apple.com/auth/authorize",
  );
  authorization.searchParams.set("client_id", config.clientId);
  authorization.searchParams.set("redirect_uri", callbackUrl(provider));
  authorization.searchParams.set("response_type", provider === "google" ? "code" : "code id_token");
  authorization.searchParams.set("scope", provider === "google" ? "openid email profile" : "name email");
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("nonce", nonce);
  if (provider === "google") {
    authorization.searchParams.set("code_challenge_method", "S256");
    authorization.searchParams.set(
      "code_challenge",
      createHash("sha256").update(verifier).digest("base64url"),
    );
  } else {
    authorization.searchParams.set("response_mode", "form_post");
  }
  const response = NextResponse.redirect(authorization, 302);
  response.cookies.set(bindingCookie(provider), binding, {
    httpOnly: true,
    sameSite: provider === "apple" ? "none" : "lax",
    secure: provider === "apple" || origin().startsWith("https://"),
    path: "/api/auth/oauth/" + provider,
    maxAge: 600,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function appleClientSecret(config: {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
}) {
  const key = await importPKCS8(config.privateKey.replace(/\\n/g, "\n"), "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setSubject(config.clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

async function exchangeCode(provider: SocialProvider, code: string, state: LoginState) {
  const config = providerConfig(provider);
  if (!config) throw new Error("Provider is not configured.");
  let clientSecret: string;
  if (provider === "apple") {
    const apple = appleConfig();
    if (!apple) throw new Error("Apple sign-in is not configured.");
    clientSecret = await appleClientSecret(apple);
  } else {
    const google = googleConfig();
    if (!google) throw new Error("Google sign-in is not configured.");
    clientSecret = google.clientSecret;
  }
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: callbackUrl(provider),
  });
  if (provider === "google") params.set("code_verifier", state.verifier);
  const response = await fetch(
    provider === "google" ? "https://oauth2.googleapis.com/token" : "https://appleid.apple.com/auth/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error("Provider token exchange failed.");
  const value = await response.json() as { id_token?: unknown };
  if (typeof value.id_token !== "string" || value.id_token.length > 20_000)
    throw new Error("Provider did not return an identity token.");
  return value.id_token;
}

async function verifyIdentity(
  provider: SocialProvider,
  token: string,
  nonce: string,
  appleUser: string | null,
): Promise<Identity> {
  const config = providerConfig(provider);
  if (!config) throw new Error("Provider is not configured.");
  const { payload } = await jwtVerify(token, provider === "google" ? googleKeys : appleKeys, {
    issuer: provider === "google"
      ? ["https://accounts.google.com", "accounts.google.com"]
      : "https://appleid.apple.com",
    audience: config.clientId,
    algorithms: ["RS256"],
  });
  if (
    payload.nonce !== nonce ||
    typeof payload.sub !== "string" || !payload.sub ||
    typeof payload.iat !== "number" || payload.iat > Date.now() / 1000 + 120 ||
    typeof payload.exp !== "number" ||
    (payload.azp !== undefined && payload.azp !== config.clientId)
  )
    throw new Error("Provider identity did not match this sign-in request.");
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  if (email && (
    (payload.email_verified !== true && payload.email_verified !== "true") ||
    email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )) throw new Error("Provider did not return a verified email address.");
  let name = typeof payload.name === "string" ? payload.name : "";
  if (provider === "apple" && appleUser && appleUser.length < 4096) {
    try {
      const parsed = JSON.parse(appleUser) as { name?: { firstName?: string; lastName?: string } };
      const given = [parsed.name?.firstName, parsed.name?.lastName]
        .filter((part): part is string => typeof part === "string").join(" ");
      if (given) name = given;
    } catch { /* Apple returns the name only on the first authorization. */ }
  }
  name = name.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 80);
  if (name.length < 2) name = "Evently member";
  return { subject: payload.sub, email, name };
}

async function userForIdentity(provider: SocialProvider, identity: Identity) {
  return transaction(async () => {
    const linked = await one<{ user_id: string }>(
      "SELECT user_id FROM social_identities WHERE provider=? AND subject=?",
      provider, identity.subject,
    );
    if (linked) return linked.user_id;
    if (!identity.email)
      throw new Error("Provider did not return an email for this new account.");
    let user = await one<{ id: string; email_verified_at: number }>(
      "SELECT id,email_verified_at FROM users WHERE email=?", identity.email,
    );
    if (!user) {
      const id = randomUUID();
      const password = await hashPassword(randomToken());
      await run(
        "INSERT INTO users(id,name,email,password_hash,created_at,email_verified_at) VALUES(?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING",
        id, identity.name, identity.email, password, Date.now(), Date.now(),
      );
      user = await one<{ id: string; email_verified_at: number }>(
        "SELECT id,email_verified_at FROM users WHERE email=?", identity.email,
      );
    }
    if (!user) throw new Error("Could not create the account.");
    await run(
      "INSERT INTO social_identities(provider,subject,user_id,created_at) VALUES(?,?,?,?) ON CONFLICT(provider,subject) DO NOTHING",
      provider, identity.subject, user.id, Date.now(),
    );
    const finalLink = await one<{ user_id: string }>(
      "SELECT user_id FROM social_identities WHERE provider=? AND subject=?",
      provider, identity.subject,
    );
    if (!finalLink) throw new Error("Could not link the account.");
    if (finalLink.user_id === user.id && !user.email_verified_at)
      await run("UPDATE users SET email_verified_at=? WHERE id=?", Date.now(), user.id);
    return finalLink.user_id;
  });
}

export async function finishSocialSignIn(
  request: NextRequest,
  provider: SocialProvider,
) {
  let params: URLSearchParams;
  if (request.method === "POST") {
    if (
      !request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded") ||
      Number(request.headers.get("content-length") || 0) > 16_000
    )
      return errorRedirect("login", "failed");
    const body = await request.text();
    if (body.length > 16_000) return errorRedirect("login", "failed");
    params = new URLSearchParams(body);
  } else {
    params = request.nextUrl.searchParams;
  }
  const state = params.get("state") || "";
  const binding = request.cookies.get(bindingCookie(provider))?.value || "";
  let page = "login";
  let target = "/account";
  let error: "cancelled" | "failed" | null = "failed";
  if (/^[a-f0-9]{64}$/.test(state) && /^[a-f0-9]{64}$/.test(binding)) {
    const stored = await one<LoginState>(
      "SELECT binding_hash,nonce,verifier,next_path,auth_page,expires_at FROM oauth_login_states WHERE state_hash=? AND provider=?",
      tokenHash(state), provider,
    );
    if (stored) {
      await run("DELETE FROM oauth_login_states WHERE state_hash=?", tokenHash(state));
      page = stored.auth_page;
      target = safeNext(stored.next_path);
      const actualHash = Buffer.from(tokenHash(binding), "hex");
      const expectedHash = Buffer.from(stored.binding_hash, "hex");
      if (
        stored.expires_at > Date.now() &&
        expectedHash.length === actualHash.length &&
        timingSafeEqual(actualHash, expectedHash)
      ) {
        if (params.get("error")) {
          error = ["access_denied", "user_cancelled_authorize"].includes(params.get("error") || "")
            ? "cancelled" : "failed";
        } else {
          const code = params.get("code");
          if (code && code.length < 8192) {
            try {
              const token = await exchangeCode(provider, code, stored);
              const identity = await verifyIdentity(
                provider, token, stored.nonce, params.get("user"),
              );
              const userId = await userForIdentity(provider, identity);
              await createSession(userId);
              if (!stored.next_path) target = await accountHome(userId);
              error = null;
            } catch {
              error = "failed";
            }
          }
        }
      }
    }
  }
  const destination = error
    ? errorRedirect(page, error, target)
    : NextResponse.redirect(new URL(target, origin()), 303);
  destination.cookies.set(bindingCookie(provider), "", {
    path: "/api/auth/oauth/" + provider,
    maxAge: 0,
  });
  destination.headers.set("Cache-Control", "no-store");
  destination.headers.set("Referrer-Policy", "no-referrer");
  return destination;
}
