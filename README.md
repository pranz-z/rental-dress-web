# Maison Rêve

A complete dress-rental business in one Next.js application: a customer storefront
(shop, dress pages, live availability calendar, cart, checkout, account area) and a
private studio admin (bookings, inventory, customers, inquiries, cleaning, schedule,
reports, settings) that runs the operation behind it.

- **Next.js 16 · App Router · React 19 · Tailwind CSS 4**
- **PostgreSQL via Prisma** — embedded PGlite server for local review, any managed
  PostgreSQL in production
- Storefront: `src/app/(storefront)` · Studio: `src/app/studio` · Domain logic: `src/lib`
- Payments: Stripe (test mode by default) with a built-in internal test gateway when
  no key is set. Email: Resend when configured, a local outbox otherwise.

## Local development

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL and the two DEMO_* passwords
npm run db:start             # embedded PostgreSQL on 127.0.0.1:54329 (leave running)
npm run db:setup             # apply migrations + seed the demo studio
npm run dev                  # http://localhost:3000
```

`npm run db:seed` loads the demo studio only when `DEMO_DATA=1` (the npm script
sets it) and both `DEMO_STAFF_PASSWORD` and `DEMO_CUSTOMER_PASSWORD` are set —
each at least 12 characters, and no password that can sign in is committed to
this repository. `npm run db:reseed`
wipes and reloads the demo data at any time; the seed is fully fictional — the
wardrobe, customers, bookings, payments and inquiries.

Demo sign-ins after seeding (never use these anywhere real):

| Where | Account | Password |
| --- | --- | --- |
| Studio (Owner) | `isabelle@maisonreve.com` | your `DEMO_STAFF_PASSWORD` |
| Studio (Manager) | `nadia@maisonreve.com` | your `DEMO_STAFF_PASSWORD` |
| Studio (Stylist) | `claire@maisonreve.com` | your `DEMO_STAFF_PASSWORD` |
| Customer | `camille.dubois@gmail.com` | your `DEMO_CUSTOMER_PASSWORD` |

The studio owns every operating rule — rental percentages, extension and late fees,
cleaning buffer days, deposit share, cancellation windows, business hours, delivery
zones and every transactional email — under **Studio → Settings**. The storefront and
the studio read the same values, so changing a rule changes both sides.

## Deploying for real

### 1 · Database — hosted PostgreSQL (Neon Free)

Any managed PostgreSQL works (Neon, Supabase, RDS, Cloud SQL, Hetzner…). This
walkthrough uses **Neon Free** alongside Vercel; PostgreSQL — not SQLite — keeps
the row-locking that makes the checkout double-booking guard exact.

1. Create a project at neon.com — pick the region closest to where the app runs.
2. From the project dashboard, copy the two connection strings:
   - **Pooled** (host contains `-pooler`). This is the app's `DATABASE_URL` on
     Vercel: serverless functions open many short-lived connections and the
     pooler multiplexes them. Interactive transactions (the double-booking
     guard) run through it; ordinary `pg` queries do not use named prepared
     statements, so transaction pooling is safe here.
   - **Direct** (no `-pooler`). Used **from your machine only**, for migrations
     and seeding — never on Vercel.
3. From your machine, with the direct string exported, apply the migrations
   **with the production command** — never `prisma migrate dev`:

   ```bash
   $env:DATABASE_URL="postgresql://…@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"   # PowerShell
   export DATABASE_URL="postgresql://…"                                                    # bash
   npx prisma migrate deploy
   ```

4. Seed the studio — both choices run **from your machine**, never from a
   deployed route or serverless function (functions are request-scoped and
   ephemeral, they would need production credentials baked into the deployment,
   and anyone who found the route could re-seed your database):

   ```bash
   # A real studio: owner + configuration only, refuses when staff exist
   $env:OWNER_EMAIL="you@yourdomain.com"
   npm run db:seed:prod

   # A demo/staging showcase: the full fictional studio (DEMO_DATA)
   # (each password must be at least 12 characters)
   $env:DEMO_STAFF_PASSWORD="choose-your-own-12-plus"
   $env:DEMO_CUSTOMER_PASSWORD="choose-your-own-12-plus"
   npm run db:seed
   ```

   `db:seed:prod` creates the Owner's account (from `OWNER_EMAIL`, `OWNER_NAME`,
   `OWNER_INITIAL_PASSWORD`) plus the configuration rows — rental rules, hours,
   delivery zones, email templates. No demo data, no password that outlives
   first sign-in: the Owner chooses their own password and enrolls an
   authenticator app before the studio opens; the temporary password is printed
   once. The demo seed is guarded by `DEMO_DATA=1` (the npm script sets it) and
   takes its passwords from the environment — nothing sign-in-able is committed.
5. Re-run `npx prisma migrate deploy` from your machine whenever
   `prisma/schema.prisma` changes. It is idempotent.

**Backups.** Take a nightly logical dump and keep two weeks; verify a restore before
launch day.

```bash
# Nightly (cron / Task Scheduler / your host's job runner)
pg_dump "$DATABASE_URL" --format=custom --file="backup-$(date +%F).dump"

# Restore into a fresh database, then point the app at it
pg_restore --dbname "$RESTORE_DATABASE_URL" --clean --if-exists backup-2026-10-16.dump
```

Managed hosts (Neon, Supabase, RDS) also offer automated point-in-time recovery — turn
it on and note the retention window in your runbook.

### 2 · Hosting — Vercel Free (Hobby)

Push the repository to GitHub, then at vercel.com → **Add New → Project** import
it. Vercel detects Next.js; keep the defaults — install `npm install`, build
`npm run build`, output `.next`, Node 22.x. Add the environment variables for
**Production** (and **Preview** if preview deployments should see the same
database):

| Variable | What it does |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** string (§1) |
| `AUTH_SECRET` | Signs studio and customer sessions — 32 random bytes, base64url; rotate = everyone signs out |
| `NEXT_PUBLIC_APP_URL` | Public origin, used in emails and links |
| `STUDIO_TIMEZONE` | Drives "today", the schedule and late-fee accrual |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | Stripe keys (test by default); leave empty for the internal test gateway |
| `STRIPE_MODE` | `test` (default) or `live`. A live key with `test` refuses to run; `live` with a test key refuses too |
| `STRIPE_WEBHOOK_SECRET` | Signs webhook deliveries; required once Stripe is configured |
| `RESEND_API_KEY` / `EMAIL_FROM` | Transactional email — see §3; without a key, production skips sending with a warning instead of writing files |
| `EMAIL_REPLY_DOMAIN` | Domain for `reply+INQ-####@…` inbound routing |
| `EMAIL_INBOUND_SIGNING_SECRET` | Svix secret (`whsec_…`) verifying inbound webhooks — preferred |
| `EMAIL_INBOUND_SECRET` | Shared header secret for generic forwarders (`x-webhook-secret`) |
| `ERROR_WEBHOOK_URL` | Where server errors are forwarded (Slack webhook, monitor endpoint) |
| `PG_POOL_MAX` | Optional, e.g. `5` — small pool per function instance; Neon's pooler multiplexes across instances |

`OWNER_*` and `DEMO_*` are consumed by the seeders and never belong on Vercel.
In production, `/api/email/inbound` **refuses unsigned requests** — one of the
two inbound secrets above must be configured.

The first request after a quiet spell can take a second or two while Neon wakes
its compute and the function boots. After deploying, open `/api/health` — it
should be green (email may read `disabled` until a Resend key is set; that is a
configuration note, not an outage).

**Build settings, precisely.** `prisma generate` runs by itself: the
`postinstall` script generates the client during `npm install`, so the build
command stays `npm run build`. `prisma migrate deploy` is deliberately **not**
part of the build: preview and production deployments share the one Neon
database, so a build-time migration would let a preview branch change (or
break) production schema — and the pooled endpoint is not meant for DDL. Run it
from your machine (§1) whenever the schema changes; it is idempotent.

**Function limits.** Hobby functions may run for up to 60 seconds; nothing here
comes close. No route sets `maxDuration`, and the heaviest request is checkout's
row-locked transaction, measured in milliseconds. If requests ever feel slow,
keep the function region and the Neon region close together.

**Read-only filesystem.** Serverless instances can write only to `/tmp`, and it
does not survive the request. This app never needs it: dress imagery is drawn in
code, and the one file-writing feature — the development outbox — is disabled in
production (§3).

### 3 · Email deliverability

Without `RESEND_API_KEY` a deployment still runs: messages are skipped with a
logged warning and `/api/health` reports `email: "disabled (RESEND_API_KEY not
set)"`. The development outbox is never written in production — on a serverless
filesystem there is nowhere durable for it to go. Set the key before launch day
so booking confirmations actually leave the building.

1. Add your sending domain to Resend, set `RESEND_API_KEY` and `EMAIL_FROM`
   (`Maison Rêve <studio@yourdomain.com>`), then add the DNS records Resend shows you.
2. **SPF** — a `TXT` record on the sending domain authorising Resend
   (`v=spf1 include:amazonses.com ~all`, or the exact value Resend provides).
3. **DKIM** — the `TXT` records Resend generates (usually `resend._domainkey`).
4. **DMARC** — start in monitor mode and tighten after a week of clean reports:

   ```
   _dmarc.yourdomain.com  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com"
   ```

   Once alignment is confirmed, move to `p=quarantine`, then `p=reject`.
5. **Inbound replies.** Studio emails carry `Reply-To: reply+INQ-####@inbox.yourdomain.com`.
   Point that domain's MX at your inbound provider (Resend Inbound or any forwarder)
   and have it POST the message JSON to `https://your-domain/api/email/inbound`. Set
   `EMAIL_INBOUND_SIGNING_SECRET` to the provider's Svix signing secret so every
   delivery is signature-verified; a plain forwarder can use `EMAIL_INBOUND_SECRET`
   and send it back in the `x-webhook-secret` header.

### 4 · Payments

Checkout runs in one of three modes, chosen by the environment:

- **Internal test gateway** (no Stripe key) — identical flow, nothing leaves the box.
- **Stripe test** — set `sk_test_…`/`pk_test_…`; `STRIPE_MODE` defaults to `test`.
- **Stripe live** — set the live keys **and** `STRIPE_MODE=live`. The app refuses to
  mix (a live key with `test`, or `live` with a test key, stops at startup and
  `/api/health` reports `misconfigured`).

Register the webhook endpoint in the Stripe dashboard:

```
https://your-domain/api/stripe/webhook
```

Events: `payment_intent.amount_capturable_updated`, `payment_intent.succeeded`,
`payment_intent.payment_failed`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET` —
without it the route refuses to act and health checks go red.

Money only moves on verified events: a booking is recorded as authorized from a
signature-verified webhook or from a server-to-server Stripe API retrieve on the
confirmation page — never from the browser's word alone. In live mode, tail the
webhook log during the first real purchases.

### 5 · Monitoring and health

- `GET /api/health` — 200 when the database answers and payments are configured
  coherently, 503 otherwise. Point your uptime monitor at it. It reports statuses
  only, never secrets.
- `src/instrumentation.ts` — every uncaught server error (pages, route handlers,
  server actions) is logged, and forwarded to `ERROR_WEBHOOK_URL` when set. A Slack
  incoming webhook or any JSON endpoint works.

### 6 · Security

- **Headers** (`next.config.ts`): Content-Security-Policy (self + Stripe only),
  HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`,
  `strict-origin-when-cross-origin`, a minimal Permissions-Policy.
- **Rate limits** on every public write — cart, favorites, newsletter, inquiries,
  checkout, customer sign-in and magic links, studio sign-in and two-factor attempts,
  and the inbound email webhook.
- **Studio access**: staged first sign-in (choose a password, then enroll an
  authenticator app when required), 30-minute idle sign-out, role-based access
  (Owner / Studio Manager / Stylist / Fulfillment) and an audit trail for every
  staff, settings and booking change. The last active Owner cannot be demoted or
  deactivated.

## Launch checklist

- [ ] PostgreSQL created (§1) and `npx prisma migrate deploy` run from your machine;
      PITR or nightly `pg_dump` backups scheduled, and one restore rehearsed.
- [ ] Vercel project imported (§2); environment variables set; `AUTH_SECRET`
      generated fresh for production; `/api/health` green on the deployed URL.
- [ ] Seed chosen and run from your machine (§1): `npm run db:seed:prod` for a real
      studio, or the `DEMO_DATA` demo seed for a staging showcase. Owner signed in,
      password changed, authenticator enrolled; temporary password discarded.
- [ ] Storefront hours, studio email/phone/address, rental percentages, fees,
      cancellation windows and delivery zones reviewed in **Settings** — they are
      pre-filled with sensible defaults, not your numbers.
- [ ] Email domain verified in Resend; SPF, DKIM and DMARC records live; a test
      booking received on a real mailbox; **Settings → Email templates** copy read
      once and adjusted (send yourself a test of each).
- [ ] Inbound `reply+INQ-####` domain and webhook configured; reply to a studio
      email from an outside mailbox and see it thread back onto the inquiry.
- [ ] Stripe live keys set with `STRIPE_MODE=live`; webhook endpoint registered with
      its signing secret; a real end-to-end purchase made and refunded.
- [ ] Photography: the seeded dress art is drawn locally as SVG. Photograph your
      wardrobe, replace the images and rewrite each dress's story/fit notes.
- [ ] Legal review: rental terms, privacy policy and returns policy read by a lawyer
      for your jurisdiction; last-updated dates refreshed.
- [ ] Business details: company name, address, tax treatment and receipts checked.
- [ ] `/api/health` wired to an uptime monitor; `ERROR_WEBHOOK_URL` set.
- [ ] Final test purchase on the production domain: reserve → confirmation email →
      studio confirms → authorization captured → return email flow.

## Scripts

| Command | Does |
| --- | --- |
| `npm run db:start` | Start the embedded PostgreSQL (local review) |
| `npm run db:setup` | Apply migrations and seed the demo studio |
| `npm run db:seed` | Demo seed — `DEMO_DATA=1`, pass `DEMO_STAFF_PASSWORD` and `DEMO_CUSTOMER_PASSWORD` (12+ characters each) |
| `npm run db:seed:prod` | Production seed — Owner account + configuration only |
| `npm run db:reseed` | Wipe and reload the demo data |
| `npm run dev` / `npm run build` / `npm start` | Development / production build / serve |
| `npm run typecheck` | TypeScript, no emit |
| `npm run db:studio` | Prisma Studio against the configured database |
