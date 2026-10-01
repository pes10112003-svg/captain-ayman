# Security design

Security in Kinetic is enforced on the server for every request. Hiding a button is never the control.

## Threat model (what we defend against)

| Threat | Control | Where |
|---|---|---|
| Client reads another client's data by editing a URL, id, query or request body | Client routes contain no ids — the client id comes only from the session. Every service call runs `authorizeClient()`; foreign ids return **404** (no existence leak). Queries are scoped `WHERE id = $1 AND client_id = $2`. | `src/server/authz.ts`, all `services/*` |
| Client writes to another client's set/meal log | Record lookups are joined on the caller's `client_id` and locked `FOR UPDATE`; DB composite FK ensures set logs can't be re-parented to another client. | `services/workouts.ts`, `services/nutrition.ts`, `db/schema.ts` |
| Coach reads another coach's clients | Coach access requires `clients.coach_id = session.userId`. | `authz.ts` |
| Client calls coach-only operations | `assertCoach()` in every coach service + role checks in actions/API. | services, `auth/guards.ts` |
| Permission bypass by crafted requests | Permissions are re-loaded from the DB and checked inside the service (e.g. `enterActualReps` rejects `actualReps ≠ target`). | `authz.ts`, services |
| Session theft / fixation | 256-bit random token; only SHA-256 stored; `httpOnly`, `SameSite=Lax`, `Secure` + `__Host-` on HTTPS; new token on every login; server-side revocation. | `auth/session.ts` |
| Disabled client keeps using a live session | Session resolution re-checks `users.is_active` and `clients.status` on every request; disabling deletes all sessions. | `auth/session.ts`, `services/clients.ts` |
| Password cracking | Argon2id (19 MiB, t=2, p=1); passwords 8–128 chars; forced change after coach-issued credentials. | `auth/password.ts` |
| Credential stuffing / brute force | Failed-attempt limits per account (8/15 min) and per IP (40/15 min) in Postgres; constant-time path for unknown emails. | `auth/rate-limit.ts`, `services/auth.ts` |
| Account enumeration | Identical login errors; reset endpoint always returns the same message; 404 for foreign resources. | `services/auth.ts` |
| Password-reset token abuse | Single-use, hashed, expiring tokens, claimed atomically; all sessions revoked after reset; `Referrer-Policy: no-referrer` on the reset page. | `services/auth.ts` |
| CSRF | SameSite cookies; Next.js server-action Origin check; API mutations reject cross-site `Origin`/`Sec-Fetch-Site`. | `api/handler.ts` |
| XSS | React escaping; nonce-based CSP with `strict-dynamic` (no inline scripts); `http(s)`-only URL validation; `rel="noopener noreferrer"`. | `proxy.ts`, `lib/validation.ts` |
| Clickjacking | `frame-ancestors 'none'` + `X-Frame-Options: DENY`. | `proxy.ts`, `next.config.ts` |
| Malicious uploads / metadata leaks | Size limit; image decoded by sharp (not trusting MIME/extension); re-encoded to WebP; EXIF/GPS stripped; pixel limit. | `services/images.ts` |
| Public photo exposure | Stored outside `/public` or in a private bucket; streamed only via `/api/media/*` after authorization; `Cache-Control: private`; the service worker never caches API/media. | `storage/*`, `services/photos.ts`, `public/sw.js` |
| Path traversal in storage | Strict key regex + resolved-path containment check. | `storage/local.ts`, `storage/keys.ts` |
| Leaking internals in errors | Typed `AppError`s map to safe messages; unknown errors logged server-side with a generic user message. | `server/errors.ts` |
| Tampering with timestamps | Completion / consumption times always come from the server (`now()`); client-supplied times are never accepted. | services |
| History tampering via plan edits | Logs are value snapshots; plan FKs are `ON DELETE SET NULL`; completed/started logs are never rebuilt; clients may only modify *today's* records. | `services/workouts.ts`, `services/nutrition.ts` |

## Verified by tests

`tests/integration/authorization.test.ts` (20 cases against real PostgreSQL) and `tests/e2e/security.spec.ts` + `flows.spec.ts` (Playwright against the running app) cover the scenarios above, including URL/API id manipulation, forged ids on writes, permission enforcement, photo privacy, header/cookie flags, rate limiting and instant revocation.

## Reporting

If you find a vulnerability, please report it privately to the maintainer rather than opening a public issue.
