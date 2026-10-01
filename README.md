# Captain Ayman (كابتن أيمن) — Personal-Trainer Client Management Platform

> 🇪🇬 **Arabic handover guide for the coach:** [docs/HANDOVER.ar.md](./docs/HANDOVER.ar.md)

A production-ready full-stack web app (installable PWA, **Arabic RTL by default + English**, light/dark mode) for a personal trainer to manage many clients from one place: workout plans with set-by-set logging and partial reps, nutrition plans with automatically time-stamped meals, body measurements, private before/after photos, per-client permissions, an audit trail and analytics computed from real data.

- **Coach** → a SaaS-style dashboard: every client, what they did today, plans, history, progress and reports.
- **Client** → a mobile-first app answering one question: *“What do I need to do today?”*
- **Private by design** → a coach-controlled **site access code** in front of everything, coach-issued client passwords, and server-side authorization on every request.

---

## Contents

1. [Quick start (local)](#1-quick-start-local)
2. [Demo accounts](#2-demo-accounts)
3. [Tech stack](#3-tech-stack)
4. [Features](#4-features)
5. [Architecture](#5-architecture)
6. [Database design](#6-database-design)
7. [Security model](#7-security-model)
8. [Environment variables](#8-environment-variables)
9. [Scripts](#9-scripts)
10. [Testing](#10-testing)
11. [Deploying to production](#11-deploying-to-production)
12. [REST API](#12-rest-api)
13. [Extending the platform](#13-extending-the-platform)

---

## 1. Quick start (local)

**Requirements:** Node.js ≥ 20.9 (22 LTS recommended) and PostgreSQL ≥ 14.

```bash
npm install
cp .env.example .env              # set DATABASE_URL (and CRON_SECRET)
createdb kinetic                  # or use Docker: docker compose up -d db
npm run db:migrate                # create tables + built-in measurement types
npm run db:seed                   # optional: realistic demo data (dev only)
npm run dev                       # http://localhost:3000
```

**Everything in Docker** (PostgreSQL + migrations + app):

```bash
cp .env.example .env              # set CRON_SECRET and POSTGRES_PASSWORD
docker compose up -d --build
docker compose run --rm migrate npm run db:seed        # optional demo data
# real coach account instead of demo data:
docker compose run --rm migrate npm run coach:create -- --email you@yourgym.com --name "Your Name"
```

## 2. Demo accounts

Created by `npm run db:seed` (fictional data, ~8 weeks of history):

| Role | Email | Password | Notes |
|---|---|---|---|
| — | **Site access code** | `AYMAN-2026` | Asked once per device before the sign-in page |
| Coach | `coach@kinetic.test` | `CoachDemo!2026` | Owns all demo clients |
| Client A | `omar@kinetic.test` | `ClientDemo!2026` | Push/Pull/Legs, fat loss, photos |
| Client B | `mariam@kinetic.test` | `ClientDemo!2026` | Full body, may upload photos & edit profile |
| Client | `youssef@kinetic.test` | `ClientDemo!2026` | Custom rep entry **disabled** (permissions demo) |
| Client | `hana@kinetic.test` | `ClientDemo!2026` | New — must choose a password at first sign-in |
| Client | `salma@kinetic.test` | — | **Disabled** account (cannot sign in) |

Workout schedules are generated relative to the day you seed, so “today” always has something to log. The login page shows these credentials only in development (or when `SHOW_DEMO_LOGINS=true`).

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router, React 19, Server Components, Server Actions) | One secure server boundary for UI + API |
| Language | TypeScript (strict) | End-to-end types from DB to UI |
| Database | **PostgreSQL** | Relational integrity, FKs, CHECKs, transactions |
| ORM / migrations | **Drizzle ORM** + drizzle-kit | Type-safe SQL, plain SQL migrations, no native engine binaries (Prisma-equivalent, lighter to deploy) |
| Auth | Custom DB-backed sessions + **Argon2id** (`@node-rs/argon2`) | Revocable sessions (logout-everywhere, instant disable) |
| Validation | **Zod 4** | Every action / API input validated server-side |
| Styling | **Tailwind CSS 4** with semantic design tokens, light + dark | Consistent, themeable UI |
| Charts | **Recharts** with a validated colour-blind-safe palette | Real data only |
| Images | **sharp** (decode → rotate → strip EXIF/GPS → WebP) | Upload validation + privacy |
| Storage | Private local disk or any **S3-compatible private bucket** | Photos never publicly addressable |
| Drag & drop | dnd-kit (keyboard accessible) | Exercise & meal ordering |
| Tests | Vitest (integration against real Postgres) + Playwright (E2E) | Authorization proven, not assumed |

## 4. Features

### Coach
- **Dashboard** — total / active / inactive clients, today's workouts (completed vs not yet), today's meal activity, 30-day adherence, 14-day charts, recent activity, progress updates, recently added clients, quick access.
- **Global search** (⌘K / Ctrl K / `/`) by name, phone, email or client ID (`KN-XXXXXX`).
- **Clients** — table (desktop) / cards (mobile) with photo, status, phone, email, weight, height, goal, today's workout & nutrition status, 30-day adherence, last activity, join date. Filter by status, workout status, nutrition status, goal and recent activity; sort by name, status, weight, goal, adherence, last activity or join date; paginated.
- **Client profile tabs** — Overview · Workouts · Nutrition · Progress · Photos · Activity · Permissions · Profile.
- **Workout plan editor** — any weekly schedule (e.g. Mon PUSH / Tue REST / Wed PULL…), workout days with title, muscle group and instructions; exercises with per-set target reps and weights, rest, tempo, notes, video link; drag-and-drop or button reordering, duplicate exercise / day, delete, unsaved-changes guard.
- **Workout history** — every day's snapshot: exercises, target vs actual reps per set, sets completed, completion %, completion time; missed/incomplete days flagged; coach can correct a record (flagged “Edited by coach”).
- **Nutrition plan editor** — meals with time, foods, quantity, kcal/protein/carbs/fats, notes, reference link; live daily totals; reorder, duplicate, replace, delete, sort by time.
- **Meal history** — scheduled vs consumed time (with early/late delta), status, daily adherence (e.g. 3/4 = 75%).
- **Progress** — weight, height, body fat, muscle mass, BMI (auto-derived), waist, abdomen, chest, shoulders, arms, thighs, hips + **custom measurement types**; each with value, unit, date, note; full history kept; weight/body-fat/any-measurement trend charts; body-composition summary.
- **Photos** — private uploads (front/side/back/other), chronological timeline, before/after comparison (side-by-side and slider).
- **Permissions** — ten per-client switches with sensible defaults.
- **Client settings** — edit all profile fields, profile photo, disable/re-activate (revokes sessions instantly), temporary password or 24-hour reset link, permanent delete with typed confirmation.
- **Workouts / Nutrition / Progress / Reports / Activity log** — cross-client views; reports for 7/30/90 days.
- **Settings** — language, theme, brand name, password and the site access code. Time zone, units and week start are fixed: Egypt time (Africa/Cairo), kg / cm, week starts on Saturday.

### Client (mobile-first)
- **Home** — greeting, big *Today's Workout* card (x / y exercises, %, start/continue), *Today's Meals* (x / y, next meal), weight + trend, 30-day consistency, week strip.
- **Today's Workout** — one tap per set; a −/+ stepper to log fewer (or more) reps than the target (partial sets are stored as such); edit a ticked set to fix mistakes; sticky **Complete Workout** (confirms if sets remain); completion time recorded by the server.
- **Nutrition** — meal cards with foods & macros; **Mark as eaten** stores `consumed_at` from the server clock (no manual time entry); undo same day.
- **Progress** — body composition, weight/body-fat charts, consistency, measurements & photos (if allowed), photo upload (if allowed).
- **Profile** — details, optional self-edit (if allowed), change password, sign out.

### Platform
- Loading skeletons, empty states, error boundaries, offline page, toasts, confirmation dialogs.
- Responsive desktop / tablet / mobile; light & dark mode; installable PWA (manifest, icons, privacy-safe service worker).

## 5. Architecture

```
src/
├─ app/                         Next.js routes
│  ├─ (auth)/                   login, forgot/reset password
│  ├─ change-password/          forced first-login password change
│  ├─ coach/…                   coach area (layout guard: role = coach)
│  ├─ client/…                  client area (layout guard: role = client) — no ids in URLs
│  └─ api/
│     ├─ v1/…                   JSON API (same services as the UI)
│     ├─ media/…                authorized private photo streaming
│     ├─ cron/daily             daily snapshot endpoint (Bearer CRON_SECRET)
│     └─ health                 readiness probe
├─ components/                  ui/ (design system), charts/, coach/, client/, shared/
├─ lib/                         client-safe helpers: time (tz-aware), units, validation (Zod), constants
├─ server/
│  ├─ db/                       schema.ts (single source of truth) + client
│  ├─ auth/                     password (Argon2id), session, guards, rate-limit
│  ├─ authz.ts                  resource-level authorization (every client read/write)
│  ├─ services/                 domain logic — the only place that touches the DB
│  ├─ actions/                  server actions (thin: auth → validate → service)
│  ├─ api/handler.ts            API wrapper: auth, same-origin check, safe errors
│  ├─ storage/                  local / S3 private object storage
│  ├─ events.ts                 domain-event bus → notifications (extensible)
│  └─ activity.ts               append-only audit log
└─ proxy.ts                     per-request CSP nonce + fast unauthenticated redirects
drizzle/                        SQL migrations
scripts/                        migrate, seed, reset, create-coach, daily-snapshot
tests/                          integration (Vitest + Postgres), unit, e2e (Playwright)
```

**Request flow:** page / server action / API route → `requireCoachPage()` / `requireClientPage()` / `requireActor()` (session from httpOnly cookie, re-validated in the DB on every request) → service → `authorizeClient(actor, clientId, permission?)` → scoped SQL (`WHERE … AND client_id = …`).

**Immutable history.** Plans are editable *templates*. Each day, the day's workout and meals are copied into *log snapshots* (`workout_logs → workout_exercise_logs → workout_set_logs`, `meal_logs`) that store names, targets and macros by value. Editing or deleting a plan never rewrites a log (FKs are `ON DELETE SET NULL`). Today's snapshot follows plan edits only while it is untouched; once the client logs anything it is frozen. A daily job (`/api/cron/daily`, also triggered lazily on the coach's first dashboard view each day) materialises every active client's day so missed workouts/meals are recorded as missed.

**Time.** All timestamps are `timestamptz` generated on the server (`now()`); calendar days are computed in Egypt time (Africa/Cairo, fixed in `FIXED_COACH_SETTINGS`). Clients never send times.

## 6. Database design

24 tables, UUID primary keys everywhere (no sequential ids), foreign keys on every relationship:

| Area | Tables |
|---|---|
| Identity | `users`, `sessions`, `password_reset_tokens`, `rate_limits` |
| Coach | `coach_settings` |
| Clients | `clients`, `client_permissions` |
| Workout templates | `workout_plans`, `workouts`, `workout_days`, `workout_exercises`, `workout_sets` |
| Workout history | `workout_logs`, `workout_exercise_logs`, `workout_set_logs` |
| Nutrition templates | `nutrition_plans`, `meals`, `meal_items` |
| Nutrition history | `meal_logs` |
| Progress | `measurement_types`, `measurements`, `progress_photos` |
| Audit & messaging | `activity_logs`, `notifications` |

Database-level safeguards include: one active plan per client (partial unique index), one workout log per client per day, `CHECK` constraints on day-of-week, reps and completion %, and a **composite foreign key** `(workout_log_id, client_id) → workout_logs(id, client_id)` so a set log can never point at another client's workout. Case-insensitive unique email index. See `src/server/db/schema.ts` and `drizzle/`.

Changing the schema: edit `schema.ts` → `npm run db:generate` → review the SQL in `drizzle/` → `npm run db:migrate`.

## 7. Security model

See **[SECURITY.md](./SECURITY.md)** for the full list. Highlights:

- **Site access code (gate)** — until a device enters the coach's access code, *nothing* is reachable: pages redirect to `/access`, server actions and the API answer 401. The code is stored AES-256-GCM-encrypted (key derived from `AUTH_SECRET`) so the coach can view & share it; devices get a signed, versioned `httpOnly` cookie, and changing the code rotates the version — instantly locking out every other device. Attempts are rate-limited per IP.
- **Coach-managed passwords** — the coach sets (or generates) each client's password and shares it with an invite message; clients can only change it when the coach enables the `changeOwnPassword` permission (or asks them to choose one at first sign-in).
- **Server-side authorization on every request** — page layouts, server actions and API routes all resolve the actor from the session and call `authorizeClient()`; client-area URLs contain no ids at all, and any foreign id returns **404** (existence is never revealed).
- **Coach vs client roles** enforced server-side; clients can't call coach-only services even for their own record.
- **Per-client permissions** are *extra restrictions* inside a client's own account — they can never widen access.
- **Argon2id** password hashing; timing-safe login for unknown emails; brute-force limits on failed logins (per account + per IP) stored in Postgres (works across instances).
- **Sessions:** 256-bit random tokens, only the SHA-256 hash stored; `httpOnly`, `SameSite=Lax`, `Secure` + `__Host-` prefix on HTTPS; revoked on logout, password change/reset and account disable.
- **Password reset:** single-use hashed tokens (60 min self-service / 24 h coach-issued), atomic claim, all sessions revoked; responses never reveal whether an email exists.
- **CSRF:** SameSite cookies + Next.js server-action origin check + same-origin/`Sec-Fetch-Site` check on API mutations.
- **Headers:** per-request nonce **CSP** (`strict-dynamic`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `nosniff`, strict referrer, COOP/CORP, HSTS on HTTPS.
- **Uploads:** size-limited, decoded by sharp (content, not extension), re-encoded to WebP with EXIF/GPS stripped, stored outside `/public` (or private S3), streamed only through an authorized route with `Cache-Control: private`.
- **Input validation** with Zod everywhere (e.g. video links must be `http(s)` — no `javascript:` URLs); internal errors are logged, users see safe messages.
- Private coach notes are never sent to client sessions.

## 8. Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `APP_URL` | ✅ in prod | `http://localhost:3000` | Public URL (reset links, cookie `Secure` flag, origin checks) |
| `APP_NAME` / `APP_NAME_AR` | | `Captain Ayman` / `كابتن أيمن` | Brand shown in English / Arabic |
| `AUTH_SECRET` | ✅ in prod | — | ≥ 32 chars; encrypts the access code & signs access cookies |
| `ADMIN_KEY` | | — | Enables `/setup` (first coach account, coach password / access-code recovery). Remove to disable |
| `SESSION_TTL_DAYS` | | `30` | Session lifetime |
| `CRON_SECRET` | ✅ in prod | — | Bearer secret for `/api/cron/daily` (≥ 16 chars) |
| `TRUST_PROXY` | | `false` | `true` only behind a proxy that sets `X-Forwarded-For` |
| `STORAGE_DRIVER` | | `database` | `database` (photos in Postgres — ideal for Vercel), `local` or `s3` |
| `STORAGE_LOCAL_DIR` | | `./storage` | Private directory for photos (mount a persistent volume) |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | for S3 | — | Any S3-compatible **private** bucket (AWS, R2, MinIO, B2) |
| `MAX_UPLOAD_MB` | | `10` | Photo upload limit |
| `DATABASE_SSL`, `DATABASE_SSL_REJECT_UNAUTHORIZED`, `DB_POOL_MAX` | | — | Managed-Postgres TLS & pool size |
| `MAIL_DRIVER` | | console | Plug an email provider into `src/server/mail.ts` for reset emails |
| `SHOW_DEMO_LOGINS` | | `false` | Show demo credentials on the login page in production |
| `SEED_*` | dev | see `.env.example` | Demo seed credentials |

## 9. Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Develop / build / run production |
| `npm run db:migrate` | Apply SQL migrations |
| `npm run db:generate` | Generate a migration from `schema.ts` changes |
| `npm run db:seed` | Load demo data (refuses in production) |
| `npm run db:reset` | Drop schema → migrate → seed (dev only) |
| `npm run coach:create -- --email … --name …` | Create / reset a real coach account |
| `npm run cron:daily` | Daily snapshot + cleanup (same as `/api/cron/daily`) |
| `npm run typecheck` / `lint` | TypeScript & ESLint |
| `npm test` | Unit + integration tests (needs a Postgres test DB) |
| `npm run test:e2e` | Playwright E2E against a running, freshly seeded app |

## 10. Testing

**Integration & unit (Vitest, real PostgreSQL)** — `tests/integration/authorization.test.ts` recreates the schema in `kinetic_test` from the real migrations and verifies:

1. Coach can access all of their clients (and not another coach's).
2. Client A can access only Client A data.
3. Client A cannot read or write Client B data by swapping ids (profile, workouts, meals, progress, photos, analytics, set/meal ids).
4. Client A can complete a set. 5. …enter fewer reps than the target (stored as `partial`, target 12 / actual 8).
6. Meal completion stores the exact server timestamp. 7. The coach sees that timestamp.
8. Coach can modify future plans. 9. Historical records stay unchanged (12/12/10 stays 12/12/10 after targets become 10).
10. Client permissions restrict actions (reps entry, completion, viewing, uploads) — and never widen access.
11. Private photos: only the owning coach and the client (with permission) can read them; fake images are rejected.
12. Coach-controlled passwords: only the client's own coach can set them; clients can't change them without permission.
13. Site access code: coach-only, encrypted at rest, case-insensitive check, rotation revokes every old device.

```bash
createdb kinetic_test            # once
npm test                         # TEST_DATABASE_URL overrides the default
```

**End-to-end (Playwright)** — `tests/e2e/` drives the real app: unauthenticated access, URL/API id manipulation (404s), cross-site POST blocking, security headers & cookie flags, login rate limiting, a mobile client logging a full set + a partial set + a meal and the coach verifying exact values/timestamps, instant session revocation on disable, the forced first-login password change, coach-set passwords, the site access gate (Arabic RTL by default on a new device, wrong/right codes, API closed) and access-code rotation locking out other devices.

```bash
npm run db:reset && npm run build && npm start     # in one terminal
npm run test:e2e                                   # in another
```

## 11. Deploying to production

### Option A — Vercel (Hobby, free) + Neon Postgres (free) — recommended for ~20 clients

1. Push this repo to a **private** GitHub repository and import it in Vercel (framework: Next.js). `vercel.json` already sets the region (`fra1`, close to Egypt), the build command (`npm run db:migrate && npm run build` — migrations run on every deploy) and a daily cron for `/api/cron/daily`.
2. In the Vercel project → **Storage** → create a **Neon** Postgres database and connect it (adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED`).
3. Environment variables: `AUTH_SECRET` (`openssl rand -hex 32`), `CRON_SECRET` (another random value), `ADMIN_KEY` (long random value), `APP_URL=https://<your-project>.vercel.app`, `STORAGE_DRIVER=database`, `TRUST_PROXY=true`.
4. Deploy, then open `https://<your-project>.vercel.app/setup`, enter the `ADMIN_KEY`, create the coach account and the site access code.
5. Optional: add a custom domain in Vercel and update `APP_URL`.

Free-tier notes: Vercel Hobby has no expiry and generous monthly limits for a small coaching business, but its terms restrict it to non-commercial personal use — move to Pro if you need commercial terms. Neon Free gives 0.5 GB per project (photos are re-encoded to compact WebP) and scales to zero when idle (first request after idle takes ~1 s).

### Option B — any Node host / Docker

1. **Database:** managed PostgreSQL (Neon, Supabase, RDS, Cloud SQL…). Set `DATABASE_URL` (and `DATABASE_SSL=true` if required).
2. **Secrets:** `APP_URL=https://your-domain`, `AUTH_SECRET`, `CRON_SECRET`, optional `ADMIN_KEY`.
3. **Photos:** `STORAGE_DRIVER=database` (default), `s3` with a **private** bucket, or `local` with a persistent volume on a single-instance host.
4. **Build & migrate:** `npm ci && npm run build && npm run db:migrate`, then `npm start` (or use the `Dockerfile`; it produces a small standalone image running as a non-root user with a health check).
5. **First coach:** `/setup` (with `ADMIN_KEY`) or `npm run coach:create -- --email you@yourgym.com --name "Your Name"`. Do **not** run the demo seed in production.
6. **Daily job:** call `GET /api/cron/daily` with `Authorization: Bearer $CRON_SECRET` at ~00:05 in your timezone (Vercel Cron, GitHub Actions, k8s CronJob or system cron with `npm run cron:daily`).
7. **HTTPS only.** Behind a reverse proxy set `TRUST_PROXY=true` so rate limiting sees real client IPs; forward `X-Forwarded-Host` so server-action origin checks pass.
8. **Email:** wire `src/server/mail.ts` to your provider for self-service password reset. Until then the forgot-password page tells clients to ask their coach (who sets a new password in seconds) and the coach to use `/setup`.
9. **Backups:** enable automated Postgres backups.

Hardening checklist: HTTPS + HSTS ✔, strong `AUTH_SECRET` / `CRON_SECRET` / `ADMIN_KEY` ✔, site access code ON ✔, DB user with least privilege ✔, log shipping for `[kinetic]` errors ✔, dependency updates (`npm audit`) ✔.

## 12. REST API

All endpoints use the session cookie, return JSON, send `Cache-Control: no-store`, and map errors to `{ error: { code, message } }` with 401/403/404/409/422/429.

| Method & path | Who | Description |
|---|---|---|
| `GET /api/v1/search?q=` | coach | Global client search |
| `GET /api/v1/clients/:id` | coach (own) · client (self) | Profile + permissions |
| `GET /api/v1/clients/:id/workout-logs?page=` | same + `viewWorkouts` | Workout history with per-set results |
| `GET /api/v1/clients/:id/meal-logs?days=&before=` | same + `viewNutrition` | Meal history grouped by day |
| `GET /api/v1/clients/:id/measurements` | same + `viewProgress` | Summary, series, history |
| `GET /api/v1/clients/:id/photos` | same + `viewPhotos` | Photo metadata |
| `GET /api/v1/me/today` | client | Today's workout + meals |
| `POST /api/v1/me/workout/sets/:setLogId` `{done, actualReps?}` | client | Tick / untick a set |
| `POST /api/v1/me/workout/complete` | client | Complete today's workout (server time) |
| `POST /api/v1/me/meals/:mealLogId` `{consumed}` | client | Mark eaten / undo (server time) |
| `GET /api/media/photos/:id?size=thumb\|full` | authorized | Private photo bytes |
| `GET /api/media/avatars/:clientId` | authorized | Private profile photo |
| `GET /api/cron/daily` | Bearer `CRON_SECRET` | Daily snapshot & cleanup |
| `GET /api/health` | public | Readiness (no data) |

## 13. Extending the platform

- **Multiple coaches / organisations:** clients already belong to a `coach_id`; add an `organizations` table and scope `authorizeClient()` by org to support gyms with several trainers.
- **Notifications & reminders:** services emit domain events (`src/server/events.ts`); add handlers for email / web-push / WhatsApp. The daily job is the natural place for “missed workout” and “meal reminder” checks; the `notifications` table already powers the coach's in-app bell.
- **Multiple programs:** `workout_plans` / `nutrition_plans` support many plans per client with one active — add plan archiving/switching UI.
- **Subscriptions & payments:** add `subscriptions` keyed by client and gate features in `authorizeClient()`.
- **Wearables & advanced analytics:** ingest into new measurement types (custom types already supported) or dedicated tables; analytics are pure functions over logs in `services/analytics.ts`.
- **Mobile apps:** the `/api/v1` layer calls the same services as the web UI.
- **Languages:** Arabic (default, RTL) and English live in `src/i18n/ar.ts` / `en.ts` (same shape, type-checked). See [docs/i18n.md](./docs/i18n.md) to add strings or another language.
