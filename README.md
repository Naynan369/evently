# Evently

A working event discovery and ticketing application built with Next.js, React, PostgreSQL and Stripe Connect.

## What works

- A cinematic homepage with event photography, Three.js motion, pause/select controls, reduced-motion support, neutral charcoal dark mode and responsive discovery pages.
- Equal-size featured event cards in a horizontal row; discovery supports grid and list layouts.
- Organized discovery and account menus, grouped mobile navigation, keyboard dismissal and locally hosted Space Grotesk typography.
- City/text search, category/date/price filters and saved events.
- Messina area browsing, Italian as the first-visit language, and optional access and arrival details on event pages.
- Attendee and organizer choices on one sign-up page: attendees can choose interests, while organizers provide a public organizer name and business country. Both use the same sign-up and sign-in pages.
- Accounts with salted password hashes, six-digit email verification through Gmail SMTP, verification resend, forgot-password and one-use password reset links.
- Google and Apple account sign-in when their OAuth credentials and callback URLs are configured.
- Revocable server-backed sessions; password recovery signs out every existing session.
- Recommendations based on selected interests, saved categories, artist lineups and music genres, with booked and unavailable events excluded.
- Optional Apple Music and gated Spotify connections: consent, playlist selection, bounded import, explicit match reasons and disconnect/delete controls. Manual artist and genre preferences work without provider credentials.
- Organizer event publishing/editing, inventory limits, guest lists, CSV export and camera QR check-in with manual code entry as a fallback.
- Distinct signed-in workspaces: attendee accounts open a dashboard for plans and preferences; organizer accounts open a studio for event creation and operations. They share the same sign-in page, while organizer tools require an organizer account.
- Free reservations and clearly marked sample bookings; QR tickets, calendar downloads and print-to-PDF.
- Stripe Connect onboarding, hosted Checkout, verified payment fulfillment, checkout resumption/cancellation, attendee refund requests and organizer full refunds.
- A private operations desk for listing review, reports, disputes, cancelled-event refund follow-up, failed booking emails, and an admin contact CRM with notes and follow-up dates.
- Attendee event ideas for Messina and an anonymous organizer demand board, with matching-event emails only for attendees who opt in.

The included listings are fictional examples. Sample bookings never charge money and do not grant admission to real events. The application does not come with Stripe credentials or a connected merchant account.

## Ticket intents and reverse marketplace

Attendees open `/intent` to describe an event they would attend: category, Messina area, month, maximum per-person price, group size and an optional private note. One idea per category, area and month can be updated or removed. The form makes clear that an idea is not a booking or a promise of a future event. Matching published events appear under each idea. Attendees can independently opt in to one matching-event email at a time; turning that off before delivery skips the queued message.

Organizers open `/organizer/demand` to see category/area/month groups only after three distinct attendees join a group. The board shows grouped attendee count, potential group size and average maximum budget; it never exposes individual names, email addresses or notes. A demand card can start an event draft with its category and area prefilled. When that event is published (or approved if listing review is enabled), matching email notifications enter the existing retryable message queue. Matching is limited to upcoming, available, non-sample Messina events priced in euros whose Standard ticket price meets the attendee's budget. The first version does not charge people or reserve tickets from an intent.

## Project layout

- `src/app` contains pages and API routes, following Next.js routing conventions.
- `src/components/organizer` contains the event, business profile, venue, and organizer studio interfaces.
- `src/lib/music` contains provider connections, matching, storage, and music types.
- `src/components/visualizers` contains the homepage and discovery animation scenes.
- `scripts` contains database and development utilities; `tests` contains unit and browser checks.

## Private organizer demo

Set `EVENTLY_ORGANIZER_DEMO=true` in `.env.local` and restart the app. In this mode:

- New organizer events are saved as private drafts. Only their owner can open the event preview; drafts do not appear in search, discovery, or recommendations.
- Ticket prices are planning information. Stripe setup is hidden in Organizer studio and payment actions are disabled, even if a Stripe key is configured.
- Organizers can create up to ten clearly marked practice guests for each private event, open their sample tickets, and test QR or code check-in and guest export. Practice tickets do not grant real admission.
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

Gmail SMTP delivery failures leave the account unverified and offer a resend action. Password recovery returns the same generic response for existing and unknown emails. The mailer sends plain text and HTML. Gmail credentials remain server-side.

For a local preview without sending email, set `EMAIL_DELIVERY=preview`. Messages are written to private `data/mail-preview/*.json` files and are never served by a public API. Preview mode keeps the existing link-based verification path; open the message's `url` locally to verify or reset. Production-build previews additionally require `EVENTLY_TEST_MODE=true` and a loopback `APP_URL`. Never enable this mode or copy its outbox into a live deployment.

## Google and Apple sign-in

The sign-in and registration pages include Google and Apple buttons. Both use the same Evently accounts and sessions as email sign-in. Provider identity is tied to the provider's stable user ID; verified email is used only when linking a provider for the first time. Until credentials are set, the buttons return to the form with an availability message.

- **Google:** Create a web OAuth client in [Google Cloud](https://developers.google.com/identity/protocols/oauth2/web-server). Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`, and register the exact redirect URI `APP_URL/api/auth/oauth/google/callback`. A loopback `APP_URL`, including `http://127.0.0.1:3000`, works for local testing.
- **Apple:** Configure a Services ID and Sign in with Apple key in [Apple Developer](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple). Set `APPLE_SIGN_IN_CLIENT_ID`, `APPLE_SIGN_IN_TEAM_ID`, `APPLE_SIGN_IN_KEY_ID` and `APPLE_SIGN_IN_PRIVATE_KEY`. Register `APP_URL/api/auth/oauth/apple/callback` as the return URL. Apple web sign-in requires a registered HTTPS domain, so it cannot complete against the local HTTP address. The Apple sign-in keys are separate from Apple Music keys.

Restart Evently after changing `.env.local`. Keep the client secrets and private key server-side. The sign-in callback verifies the provider's signed identity token and one-time state before creating an Evently session.

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
3. A webhook is optional for a local Checkout trial. For reliable background confirmation and marketplace operations in production, create a webhook destination for **connected account events** at `https://YOUR_DOMAIN/api/stripe/webhook`. Subscribe to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.expired`
   - `checkout.session.async_payment_failed`
   - `charge.refunded`
   - `charge.dispute.created`
   Then set `STRIPE_WEBHOOK_SECRET` to that destination's signing secret. For local development, the Stripe CLI can forward Connect events:
   `stripe listen --forward-connect-to localhost:3000/api/stripe/webhook`.
   Use the signing secret printed by that listener. Skip this step if you are testing without a webhook.
4. Restart Evently. Sign in, open **Organizer studio**, select your country and connect a Stripe account. Complete onboarding until both charges and payouts are enabled.
5. Publish a paid event. Use a separate attendee account to complete a test checkout. Verify confirmation, ticket visibility, cancellation/expiry and a full refund before enabling live mode.
6. For live operation, configure a live Connect platform, live connected organizer accounts and HTTPS. Add a live webhook if you need background confirmation when attendees do not return to Evently. Test and live objects and secrets are separate.

Payments are **direct charges on each organizer's connected account**. Evently does not collect an application fee in this version. Stripe determines processing fees and account eligibility. Paid publishing is blocked until the organizer's payments and payouts are enabled.

### Test paid tickets without organizer onboarding

For a local or Vercel deployment, set `EVENTLY_PLATFORM_CHECKOUT_TEST=true`, use an `sk_test_` or `rk_test_` Stripe key, set `APP_URL` to that deployment's exact origin, and leave `EVENTLY_ORGANIZER_DEMO=false`. Set the variables for the Vercel environment serving the URL you open: the main project domain uses **Production**, while branch deployments use **Preview**. Redeploy after changing variables. A live Stripe key never enables this mode. Use a separate test database and clearly mark a Production-domain test site so visitors do not mistake its tickets for real sales.

In this mode, an organizer can publish an event with Standard and VIP prices without completing Stripe onboarding. Checkout uses the ticket price and quantity from Evently's database, but creates the test charge on **Evently's platform Stripe account**. The attendee can pay with a Stripe test card and return to a clearly marked test ticket. No real money moves, no organizer payout occurs, and test tickets cannot be checked in. This lets you verify Evently's checkout, payment reconciliation, ticket, and refund paths; it does not verify connected-account onboarding or organizer payouts. Disable the setting before testing those Connect paths. Return to Evently after checkout to reconcile the test booking; a webhook destination that listens only for connected-account events will not receive these platform test payments.

The booking stores its payment scope when it is created, so an existing test booking remains test-only after the flag is disabled. Keep the same test key until any pending test checkouts have been reconciled or refunded. No database migration is needed.

Ticket prices and capacity are checked on the server. Tickets are confirmed only after Evently retrieves a paid session from Stripe and verifies the booking, amount, currency and connected account. Returning to the success URL alone never issues a ticket. With no webhook, this check happens when the attendee returns to the ticket page; a configured webhook can also confirm or expire sessions in the background. Webhook retries are safe to repeat.

### Test ticket and tax preview

With a Stripe **test** secret key, paid bookings show an illustrative VAT amount already included in the advertised total, and each confirmed test ticket receives a `PREVIEW-` reference. The default sample rate is 10%; set `EVENTLY_TEST_TICKET_VAT_PERCENT` to another whole number from 1 to 30 to change this testing assumption. The displayed amount does not change the Stripe Checkout total. The preview appears only after the existing paid-session verification, whether reached through the return page or an optional webhook.

This is a payment-flow simulation only. The references are not SIAE fiscal access tickets, and no Ticka MF API call, legal tax determination, or fiscal reporting occurs. Real Italian ticket sales need a selected, configured compliant provider and verified tax treatment for the organizer and event. This preview turns off automatically with a live Stripe key.

For a Vercel test deployment, use a Stripe test secret key and test connected organizer account, set `APP_URL` to that deployment's origin, and leave `EVENTLY_ORGANIZER_DEMO=false`. Redeploy after changing environment variables. The database adds the preview columns automatically on first use; `npm run db:migrate` can prepare them explicitly. Existing confirmed bookings keep their previous record and do not receive backfilled preview references.

Official references: [Connect direct charges](https://docs.stripe.com/connect/direct-charges), [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment), [Connect webhooks](https://docs.stripe.com/connect/webhooks), [webhook signature verification](https://docs.stripe.com/webhooks/signature).

### Payment operations

Checkouts reserve inventory for about 35 minutes. A configured signed expiry event releases places in the background; visiting a ticket or attempting another booking also reconciles known expired sessions. If you enable a Connect webhook, monitor delivery failures in Stripe.

If Stripe accepts a checkout but the network fails before Evently receives its session ID, the reservation remains held conservatively. Retry promptly with the same booking; a matching signed webhook can resolve it. An operator should reconcile any unresolved pending bookings against Stripe before releasing capacity. Do not manually mark bookings paid based on a browser redirect.

The draft platform rule permits a full refund request until seven days before the event. A cancelled event qualifies for a full refund regardless of the deadline. Requests appear in the organizer's guest list and the operations desk; they do not cancel tickets by themselves. A full refund is issued manually by the organizer or operator and invalidates the ticket after Stripe confirms it. Cancellation creates a refund follow-up case for each paid booking. The operations desk lists still-open Checkouts on cancelled events so an operator can close them; a payment completed after cancellation enters the refund queue. Partial refunds and automatic refunds are not implemented. Stripe disputes create operator cases when a signed `charge.dispute.created` webhook arrives; resolve the financial dispute in Stripe, then close the Evently case.

### Operator workspace and service messages

1. For a new dedicated admin account, run the private provisioning command with an unused email address. It creates an inactive `ADMIN` account in the configured PostgreSQL database and emails a one-time link to set a password and verify the address. The address must not already belong to an attendee, organizer, or venue account. Configure `APP_URL` and email delivery first. Run the command with the environment of the intended site; the local database and Vercel database have separate accounts.

   ```sh
   npm run admin:provision -- --email admin@example.com --name "Evently Admin"
   ```

   Open the emailed link, set the password, and sign in through the normal login page. The account then opens `/admin`. In local email preview mode, the command prints the preview file containing the setup link. If the 30-minute link expires, use **Forgot password** with the admin email to request a new link. There is no public admin signup option or admin email environment flag. Only the first admin can be provisioned this way; existing admins grant later access from the private Accounts view.

2. If a separate account is already registered and verified, grant the first admin role with the one-time PostgreSQL query below instead. Replace the example email with that account's email. It updates an account without an organizer or venue business profile; a zero-row result means those conditions were not met. The `ADMIN` role persists on that account.

   ```sql
   UPDATE users AS u
   SET role = 'ADMIN'
   WHERE lower(u.email) = lower('admin@example.com')
     AND u.email_verified_at > 0
     AND NOT EXISTS (
       SELECT 1 FROM business_profiles AS b WHERE b.owner_id = u.id
     )
   RETURNING u.email, u.role;
   ```

   Once signed in, use `/admin?view=users` to grant or revoke admin access for other verified accounts. Accounts with organizer or venue business profiles cannot be promoted. An admin cannot remove their own role or the last stored admin role. The private admin page and API check the stored role on every request.
3. Once `/admin` works, set `EVENTLY_REQUIRE_EVENT_APPROVAL=true`. New organizer events then enter review and stay out of discovery until approved. Edits to reviewed events return to review; edits after ticket reservations require operator help. Existing published events stay published unless cancelled. Organizers cannot approve their own listings.
4. Attendees can report an event from its page or a booking from its ticket. The operator can track and resolve cases. For payment disputes, use Stripe's evidence and dispute tools; Evently records the case, not the card-network decision.
5. Booking confirmation, free-booking cancellation, event cancellation, and refund messages enter a database outbox. Evently attempts immediate delivery after key actions and the Stripe webhook. Set `MYEMAIL`, `MYPASS`, `EMAIL_DELIVERY=gmail`, and `APP_URL` for live delivery. Failed messages are visible in `/admin`; use **Send or retry messages** after fixing the sender. Set `CRON_SECRET` on Vercel for the daily retry route in `vercel.json`.
6. Set `EVENTLY_LEGAL_NAME`, `EVENTLY_LEGAL_ADDRESS`, `EVENTLY_LEGAL_EMAIL`, and (if applicable) `EVENTLY_VAT_NUMBER`. The `/policies` page is a draft, kept out of search indexing. Obtain legal and privacy review before relying on it for public sales. The fixed refund rule is coded, but ticket tax and Italian fiscal ticket issuance remain separate launch requirements.

## Deployment and data

This edition uses PostgreSQL as shared persistent storage and can run behind multiple Node.js instances. Configure every instance with the same private `DATABASE_URL`, use a suitably sized connection pool, and test concurrency limits for your hosting provider.

### Vercel with Neon

1. Create a Neon PostgreSQL project in a European region close to the Vercel Functions region you plan to use.
2. In Neon’s connection details, select **Pooled connection** and copy its PostgreSQL URL. The pooled hostname includes `-pooler`; this is the connection string to use for the serverless app.
3. In the Vercel project’s Environment Variables, set `DATABASE_URL` to that URL for Production. Give Preview its own Neon branch or database so preview deployments cannot change production data. Keep your current local database URL in `.env.local` for local development.
4. Set `DATABASE_POOL_SIZE` to `5` initially. In Vercel project settings, place Functions in the same region as Neon or the nearest available region. For example, use Vercel’s Frankfurt region (`fra1`) if the Neon project is in Frankfurt.
5. Before serving production traffic, run `npm run db:migrate` against the Neon database to create or update Evently’s schema. Evently can initialize the schema on first use too, but running the setup command explicitly makes database setup errors visible before launch.

If you already have Evently data in another PostgreSQL database, copy it to Neon before switching Production’s `DATABASE_URL`. Keep the source database as a backup until you have confirmed the migrated records in Neon. Never point Preview or automated tests at production data.

- Restrict network access to PostgreSQL and use TLS when required by your provider.
- Keep `DATABASE_POOL_SIZE` sized for the database connection limit across all application instances; use Neon’s pooled URL for Vercel.
- Keep `SEED_DEMO=false` for deployment. Fictional listings appear only when explicitly enabled in local development or isolated automated tests; existing sample rows are hidden from public discovery in production. This setting does not delete rows from an existing database.
- Give real Messina events an area when creating or editing them so neighborhood links can find them. Existing events without an area remain visible in the all-area results.
- Use HTTPS and set the correct `APP_URL`; session cookies are secure when that URL uses HTTPS.
- Back up PostgreSQL with regular, tested `pg_dump` snapshots and protect the backup location.
- Keep credentials, databases and backups out of Git. Do not copy development databases into production.
- Put the app behind a reverse proxy with request-size limits and abuse controls. App rate limits are supplementary.
- Configure monitoring for application errors and Stripe webhook delivery failures.

## Checks

```sh
npm run lint
npm run test:unit
npm test
npm run build
npm run test:e2e
```

The tests cover password hashing, one-use/expired verification and reset tokens, session revocation, mail failure cleanup, music encryption, OAuth state, Spotify refresh/import contracts, Apple JWT signing/import contracts, disconnect races, recommendation exclusions, capacity, idempotency, ownership and signed payment webhooks.

`npm run test:unit` runs checks that do not require a database. The full `npm test` and end-to-end suites use PostgreSQL. Set `TEST_DATABASE_URL` to a separate disposable database; tests isolate their tables in dedicated schemas. Never point it at production data. The end-to-end suite also writes to a local email outbox. It uses **fixture secrets**, not a real Stripe account, and does not charge money. Tests default to installed Google Chrome. To use Playwright Chromium, install it with `npx playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium`. Build before running the suite.

Run only the API flow with:

```sh
npm run test:e2e -- --grep 'organizer flow|account security API'
```

## Remaining launch work

The code is an integrated first version, not a completed live merchant deployment. Live Stripe checkout, onboarding and refunds still require account configuration and tests against Stripe.

Booking and cancellation emails, listing moderation, and camera QR check-in are implemented, but still need end-to-end checks with configured services and real devices. Gmail SMTP verification/recovery and Apple Music need live account tests; Spotify additionally needs approval for the use case. The `/policies` page remains a draft: complete and review the operator's legal, refund, and privacy details before public registration. The music privacy page describes the implemented behavior and does not replace the operator's complete privacy policy. Each QR code admits a whole booking; separate check-in for individual guests within a group is not implemented.

## Assets

Event photos are local copies from Unsplash, used as illustrative imagery:

- Festival: `photo-1492684223066-81342ee5ff30`
- Music: `photo-1470229722913-7c0e2dbbafd3`
- Culture: `photo-1511795409834-ef04bbd61622`
- Technology: `photo-1505373877841-8d25f7d46678`
- Outdoors: `photo-1500530855697-b586d89ba3ee`
- Community: `photo-1511988617509-a57c8a288659`

The homepage combines a local event photograph with Three.js motion. Each collection has its own visualizer. Organizers upload event covers in the creation wizard; the images are stored in PostgreSQL and served through `/api/event-images/`. Local image files remain for sample and existing listings, with credits in `public/images/photo-credits.txt`.

Source images: `https://images.unsplash.com/IMAGE_IDENTIFIER`. Icons use React Icons / Feather. Fonts and event images do not require a third-party request at runtime.

## Fonts

Interface typography uses [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk), served locally through Next.js font optimization. Its license is included in `public/fonts/SPACE-GROTESK-OFL.txt`.
