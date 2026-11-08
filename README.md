# Evently

A working event discovery and ticketing application built with Next.js, React, PostgreSQL and Stripe Connect.

## What works

- A cinematic homepage with a procedural Three.js music visualizer, pause/select controls, reduced-motion support, neutral charcoal dark mode and responsive discovery pages.
- Featured events arranged as one lead card and a shortlist; discovery supports grid and list layouts.
- Organized discovery and account menus, grouped mobile navigation, keyboard dismissal and locally hosted Inter typography.
- City/text search, category/date/price filters and saved events.
- Accounts with salted password hashes, six-digit email verification through Gmail SMTP, verification resend, forgot-password and one-use password reset links.
- Revocable server-backed sessions; password recovery signs out every existing session.
- Recommendations based on selected interests, saved categories, artist lineups and music genres, with booked and unavailable events excluded.
- Optional Apple Music and gated Spotify connections: consent, playlist selection, bounded import, explicit match reasons and disconnect/delete controls. Manual artist and genre preferences work without provider credentials.
- Organizer event publishing/editing, inventory limits, guest lists, CSV export and ticket-code check-in.
- Free reservations and clearly marked sample bookings; QR tickets, calendar downloads and print-to-PDF.
- Stripe Connect onboarding, hosted Checkout, verified payment fulfillment, checkout resumption/cancellation, attendee refund requests and organizer full refunds.

The included listings are fictional examples. Sample bookings never charge money and do not grant admission to real events. The application does not come with Stripe credentials or a connected merchant account.

## Private organizer demo

Set `EVENTLY_ORGANIZER_DEMO=true` in `.env.local` and restart the app. This is enabled in the current local workspace. In this mode:

- New organizer events are saved as private drafts. Only their owner can open the event preview; drafts do not appear in search, discovery, or recommendations.
- Ticket prices are planning information. Stripe setup is hidden in Organizer studio and payment actions are disabled, even if a Stripe key is configured.
- Organizers can create up to ten clearly marked practice guests for each private event, open their sample tickets, and test code-based check-in and guest export. Practice tickets do not grant real admission.
- Organizers can submit feedback in Organizer studio. Read the saved responses locally with `npm run demo:feedback` (includes organizer names and email addresses; keep the output private).

Use verified test accounts for organizers. The demo needs PostgreSQL, but no Stripe account. Existing organizer events are private while demo mode is enabled; newly created drafts remain private when demo mode is turned off. Public sample listings still appear for exploration. This is suitable for guided local sessions before setting up an invite-only preview address.

## Run locally

Use **Node.js 22.13 or newer** (Node 24 LTS is suitable) and a PostgreSQL database.

```sh
npm ci
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Create an empty PostgreSQL database first, then set `DATABASE_URL` in `.env.local` to its connection string. Evently initializes the schema on first use; `npm run db:migrate` can also prepare it explicitly. Set `MYEMAIL` and `MYPASS` to the Gmail sender and Google app password used by Habesha Brokers, then open http://127.0.0.1:3000. Account creation works even before email delivery is configured. Unverified accounts can browse but cannot book, publish or connect music. There are no default passwords.

To bring over an existing SQLite installation, keep its database file as a backup and run `npm run db:import:sqlite -- data/evently.sqlite` after setting `DATABASE_URL`. The importer copies users, events, bookings, sessions, saved events, tokens and music connections into PostgreSQL without overwriting rows already there. It does not delete or alter the SQLite source file.

The development command loads `.env.local` and starts on the exact hostname and port in `APP_URL`. The terminal's Local address therefore matches your forms, cookies and email/music links. If the port is already occupied, stop the previous server; Evently will not silently move to another port. Conflicting port/hostname overrides are rejected with a setup message.

Route discovery uses polling to avoid file-watcher limits that can otherwise make pages and API routes return 404. An explicit `WATCHPACK_POLLING` override is preserved. Keep this terminal running while using the app.

When updating an existing installation, preserve `.env.local` and the `data` folder. The downloadable source ZIP intentionally excludes private settings and databases; a newly extracted copy starts without your existing accounts. Only copy `.env.example` when creating settings for the first time.

For a production preview:

```sh
npm run build
npm start
```

A Webpack build is also supported: `npm run build -- --webpack`.

Set `APP_URL` to the exact application origin, including its port. In development, page visits to the matching `localhost`/`127.0.0.1` alias automatically redirect to `APP_URL`, so sessions, form submissions and provider callbacks use one address. API origin checks remain strict. If you use a different port, update `APP_URL` and any registered provider callback URLs to match. Restart the server after changing environment variables.

## Verification and password recovery with Gmail SMTP

1. Use the same Gmail sender and Google app password configured in Habesha Brokers. Store them as `MYEMAIL` and `MYPASS` in `.env.local` or your host's secret manager.
2. Set `EMAIL_DELIVERY=gmail` and `APP_URL` to the correct application origin. Restart the application after changing environment variables.
3. Register using an inbox you control and enter the six-digit code from the message. Codes expire after 15 minutes, are one-use, and are stored as salted password hashes in PostgreSQL. Resending replaces the previous code and is rate-limited.
4. Test **Forgot password?** from the sign-in page. Password resets continue to use one-use email links.

Gmail SMTP delivery failures leave the account unverified and offer a resend action. Password recovery returns the same generic response for existing and unknown emails. The mailer sends plain text and HTML. Gmail credentials remain server-side. If only legacy Resend settings are present, Evently can still deliver its previous verification links and password-reset messages.

For a local preview without sending email, set `EMAIL_DELIVERY=preview`. Messages are written to private `data/mail-preview/*.json` files and are never served by a public API. Preview mode keeps the existing link-based verification path; open the message's `url` locally to verify or reset. Production-build previews additionally require `EVENTLY_TEST_MODE=true` and a loopback `APP_URL`. Never enable this mode or copy its outbox into a live deployment.

## Music-based event recommendations

Customers can open **Your music taste**, choose artists and genres manually, then view specific matches in **For you**. Organizers should add accurate performer names and genres in the event form. Matching uses normalized exact artist names and genre matches; artist matches have more weight. It does not infer an artist's presence, invent percentage confidence, train AI or analyze audio. Similarly named artists can still need disambiguation; this version has no canonical artist-ID catalog.

### Shared configuration

Generate a stable encryption key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` and put it in `MUSIC_ENCRYPTION_KEY`. Tokens are encrypted with AES-256-GCM and authenticated against their owner/provider. Back up this key separately and securely; replacing it requires users to reconnect.

Only explicitly selected playlists are imported, with a maximum of five playlists and 500 songs per update. Providers are selected separately in For you. Stored preferences include artist/available-genre counts, playlist names/links and timestamps, not audio or a saved track library. Preferences expire after 30 days and are removed on access. Disconnect removes the provider's stored credentials and imported preferences; provider-side revocation remains available in the customer's Spotify/Apple account settings. Repeated imports, authorization and email requests are rate-limited.

### Apple Music

1. In your Apple Developer account, configure a MusicKit identifier and private key for the application and the permitted web domain. Follow [MusicKit setup](https://developer.apple.com/musickit/).
2. Configure `APPLE_MUSIC_TEAM_ID`, `APPLE_MUSIC_KEY_ID` and `APPLE_MUSIC_PRIVATE_KEY`. Use the PEM key, with literal `\n` line separators in an environment variable if necessary.
3. Restart and connect a real Apple Music subscriber account from **Your music taste**. The consent screen prepares MusicKit, then a separate **Continue to Apple Music** click launches authorization.
4. Select library playlists and refresh recommendations. Test authorization refusal, empty libraries, revoked access and disconnect with your actual account before launch.

The browser receives a short-lived, origin-restricted developer token; the signing key stays on the server. Library requests use a Music User Token plus a server developer token. MusicKit JS is loaded from Apple's CDN only after consent. Genre data depends on what the library API provides; artist matching remains available when genres are absent. No playback is implemented.

### Spotify — local connection testing and recommendations

For a local connection test, configure `SPOTIFY_CLIENT_ID` and `MUSIC_ENCRYPTION_KEY`, set `SPOTIFY_CONNECTION_TEST=true`, and use a loopback-IP `APP_URL` such as `http://127.0.0.1:3000`. Register exactly `APP_URL/api/music/spotify/callback` in the Spotify app and add the test account under User Management. Leave `SPOTIFY_APPROVED_USE_CASE=false`. Restart, sign into a verified Evently account, then choose **Connect Spotify**. This mode supports sign-in, viewing owned/collaborative playlist names, links and track counts, and disconnecting. It does not fetch playlist songs, import preferences or use Spotify profiles for event recommendations. The test flag does not enable connections on a public origin.

Spotify's current [Developer Policy](https://developer.spotify.com/policy) restricts analysis/profiling and commercial offers. Obtain clarification or approval for playlist-derived ticket recommendations, including commercial ticket links and the proposed matching/data retention, before activating that feature. `SPOTIFY_APPROVED_USE_CASE=true` is an operator gate, **not an application for approval, evidence of approval or an exemption from policy**. Existing Spotify preference profiles are excluded from recommendations while that flag is off.

After approval for the specific recommendation use case, enable `SPOTIFY_APPROVED_USE_CASE=true`. OAuth uses PKCE with a one-use state tied to the signed-in session, requesting only private/collaborative playlist read permissions. Credentials remain server-side.

Under the [2026 development-mode changes](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide), new development apps are limited to five allowlisted users, the owner requires Premium, and readable playlist contents are limited to owned/collaborative lists. The implementation uses the new `/playlists/{id}/items` endpoint and its item format. Broader release requires appropriate Spotify access; test accounts and a flag do not provide it. No Spotify-derived genre enrichment or AI ingestion is performed.

Provider cards distinguish **Unavailable**, **Connection test**, **Ready to connect** and **Connected**. Live authorization still requires account setup and validation; automated provider tests use simulated API responses. A configured local connection test does not establish that live Spotify sign-in has succeeded.

## Connect real payments

Start in a Stripe test environment. Use a Stripe account with Connect enabled and complete the platform's required configuration in Stripe.

1. Put the platform's secret key in `STRIPE_SECRET_KEY` in `.env.local` or your host's secret manager. Never put secret keys into a `NEXT_PUBLIC_` variable.
2. Set `APP_URL` to your application's origin. This and the Stripe secret key are enough to enable Checkout and reconcile card payments when the attendee returns to Evently.
3. A webhook is optional. For background confirmation when an attendee closes Checkout before returning, create a webhook destination for **connected account events** at `https://YOUR_DOMAIN/api/stripe/webhook`. Subscribe to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.expired`
   - `checkout.session.async_payment_failed`
   - `charge.refunded`
   Then set `STRIPE_WEBHOOK_SECRET` to that destination's signing secret. For local development, the Stripe CLI can forward Connect events:
   `stripe listen --forward-connect-to localhost:3000/api/stripe/webhook`.
   Use the signing secret printed by that listener. Skip this step if you are testing without a webhook.
4. Restart Evently. Sign in, open **Organizer studio**, select your country and connect a Stripe account. Complete onboarding until both charges and payouts are enabled.
5. Publish a paid event. Use a separate attendee account to complete a test checkout. Verify confirmation, ticket visibility, cancellation/expiry and a full refund before enabling live mode.
6. For live operation, configure a live Connect platform, live connected organizer accounts and HTTPS. Add a live webhook if you need background confirmation when attendees do not return to Evently. Test and live objects and secrets are separate.

Payments are **direct charges on each organizer's connected account**. Evently does not collect an application fee in this version. Stripe determines processing fees and account eligibility. Paid publishing is blocked until the organizer's payments and payouts are enabled.

Ticket prices and capacity are checked on the server. Tickets are confirmed only after Evently retrieves a paid session from Stripe and verifies the booking, amount, currency and connected account. Returning to the success URL alone never issues a ticket. With no webhook, this check happens when the attendee returns to the ticket page; a configured webhook can also confirm or expire sessions in the background. Webhook retries are safe to repeat.

Official references: [Connect direct charges](https://docs.stripe.com/connect/direct-charges), [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment), [Connect webhooks](https://docs.stripe.com/connect/webhooks), [webhook signature verification](https://docs.stripe.com/webhooks/signature).

### Payment operations

Checkouts reserve inventory for about 35 minutes. A configured signed expiry event releases places in the background; visiting a ticket or attempting another booking also reconciles known expired sessions. If you enable a Connect webhook, monitor delivery failures in Stripe.

If Stripe accepts a checkout but the network fails before Evently receives its session ID, the reservation remains held conservatively. Retry promptly with the same booking; a matching signed webhook can resolve it. An operator should reconcile any unresolved pending bookings against Stripe before releasing capacity. Do not manually mark bookings paid based on a browser redirect.

Refund requests appear in the organizer's guest list. They do not cancel tickets by themselves. Full refunds are issued by the organizer and the ticket is invalidated after Stripe confirms the refund. Partial refunds, disputes and automatic refund policy decisions are not implemented.

## Deployment and data

This edition uses PostgreSQL as shared persistent storage and can run behind multiple Node.js instances. Configure every instance with the same private `DATABASE_URL`, use a suitably sized connection pool, and test concurrency limits for your hosting provider.

- Restrict network access to PostgreSQL and use TLS when required by your provider.
- Set `DATABASE_POOL_SIZE` to fit the database connection limit across all application instances.
- Set `SEED_DEMO=false` before the first run with a fresh production database. This setting does not delete samples from an existing database.
- Use HTTPS and set the correct `APP_URL`; session cookies are secure when that URL uses HTTPS.
- Back up PostgreSQL with regular, tested `pg_dump` snapshots and protect the backup location.
- Keep credentials, databases and backups out of Git. Do not copy development databases into production.
- Put the app behind a reverse proxy with request-size limits and abuse controls. App rate limits are supplementary.
- Configure monitoring for application errors and Stripe webhook delivery failures.

## Checks

```sh
npm run lint
npm test
npm run build
npm run test:e2e
```

The tests cover password hashing, one-use/expired verification and reset tokens, session revocation, mail failure cleanup, music encryption, OAuth state, Spotify refresh/import contracts, Apple JWT signing/import contracts, disconnect races, recommendation exclusions, capacity, idempotency, ownership and signed payment webhooks.

The unit and end-to-end suites use PostgreSQL. Set `TEST_DATABASE_URL` to a separate disposable database; tests isolate their tables in dedicated schemas. Never point it at production data. The end-to-end suite also writes to a local email outbox. It uses **fixture secrets**, not a real Stripe account, and does not charge money. Tests default to installed Google Chrome. To use Playwright Chromium, install it with `npx playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium`. Build before running the suite.

Run only the API flow with:

```sh
npm run test:e2e -- --grep 'organizer flow|account security API'
```

## Remaining launch work

The code is an integrated first version, not a completed live merchant deployment. Live Stripe checkout, onboarding and refunds still require account configuration and tests against Stripe.

Gmail SMTP verification/recovery and Apple Music still need live account tests; Spotify additionally needs approval for the use case. Booking emails, custom image uploads, event cancellation notifications, moderation and operator-specific legal policy pages are not implemented. Define operational/refund/privacy policies before opening registration to the public. The music privacy page describes the implemented behavior and does not replace the operator’s complete privacy policy. QR codes contain a group ticket code; organizers currently enter that code in the studio rather than using an in-app camera scanner.

## Assets

Event photos are local copies from Unsplash, used as illustrative imagery:

- Festival: `photo-1492684223066-81342ee5ff30`
- Music: `photo-1470229722913-7c0e2dbbafd3`
- Culture: `photo-1511795409834-ef04bbd61622`
- Technology: `photo-1505373877841-8d25f7d46678`
- Outdoors: `photo-1500530855697-b586d89ba3ee`
- Community: `photo-1511988617509-a57c8a288659`

The homepage background is drawn procedurally with Three.js and uses no video or poster image. Each collection has its own visualizer: a pulsing equalizer for Club Nights, softly orbiting clay-like forms for Good Company, and slow horizon waves for Open Horizons. The event cover photos remain local files and are used by listings, forms and account screens.

Source images: `https://images.unsplash.com/IMAGE_IDENTIFIER`. Manrope is bundled locally under the SIL Open Font License; see `public/fonts/OFL.txt`. Icons use React Icons / Feather. Fonts and event images do not require a third-party request at runtime.

## Fonts

Interface typography uses [Inter 4.1](https://rsms.me/inter/), served locally through Next.js font optimization. The brand wordmark retains Manrope. Font licenses are included in `public/fonts/INTER-LICENSE.txt` and `public/fonts/OFL.txt`.
