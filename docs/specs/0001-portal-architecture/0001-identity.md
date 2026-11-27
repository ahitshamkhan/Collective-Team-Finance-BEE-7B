# 0001. Identity and session contract

## Summary

Use established cryptographic libraries and PostgreSQL state to enforce account eligibility, OTP limits and session revocation. A correct admin password creates only an OTP challenge, not an authenticated privileged session.

## Requirements

Scope AC-02 through AC-07 and AC-12; architecture AR-01, AR-03 through AR-06. The security mechanisms below are technical decisions; unresolved account lifecycle policies remain gated.

## Decision

Use `jose` (`SignJWT` / `jwtVerify`) with explicitly allowed `HS256`, separate random secrets for JWT, OTP HMAC, rate limit keying and CSRF, and `argon2` (`argon2id` variant). Proposed starting Argon2id parameters: 64 MiB memory, three iterations and parallelism four; benchmark on the target host/serverless runtime and never go below the then current OWASP minimum. Passwords are 12..128 characters, never trimmed or logged; rehash on successful login when parameters change. Normalize email by trimming and lowercasing, never Gmail dot or plus rewriting. Preserve the submitted display name separately. (basis: approved stack, TypeScript/Next.js security guidance and OWASP authentication practices)

### Session design

1. Issue a fresh server generated session UUID and signed JWT with `sub`, `sid`, `iss`, `aud`, `iat`, `exp` and `jti`. No role, password or private profile data in JWT. Validate signature, exact algorithm/issuer/audience and lifetime on every request; no algorithm from token headers is trusted.
2. Admin full session lifetime: two hours absolute. Regular member full session: eight hours absolute. Pending/rejected status session: 30 minutes. No refresh endpoint or sliding renewal in MVP. Reauthentication creates a new session and revokes any prior session on that browser.
3. Read `sessions` and `users` on every protected request. Check expiry/revocation, approved/verified/member linked state, session kind and current authorization table membership. Admin authorization requires session `admin_otp_at` and current fixed identity match. A valid JWT alone is insufficient.
4. Production cookie `__Host-cfp_session`: HttpOnly, Secure, SameSite=Lax, Path=/, no Domain; Max-Age never exceeds session expiry. JWTs never enter localStorage, JavaScript variables or response JSON. Clear cookie on logout/401 and clear all client private state; revoke the session row even if the cookie is lost later.
5. Logout revokes current session; logout all and password change/recovery revoke all user sessions. Suspension revokes all sessions atomically. Mutations recheck identity under the shared database mutation guard so revocation cannot race a financial write. A request already authorized and completing before revocation may finish; later requests fail.

### CSRF and browser binding

`GET /auth/csrf` creates a cryptographically random anonymous browser cookie if absent and returns a signed token. Anonymous browser cookie `__Host-cfp_browser` is HttpOnly, Secure, SameSite=Lax, Path=/, with a 30 minute lifetime. CSRF token contains nonce, expiry and HMAC binding to the browser cookie before login or session ID after login. Store token also in readable `__Host-cfp_csrf` (Secure, SameSite=Lax, Path=/). Do not put the raw session ID into the readable token; bind through an HMAC digest.

Every POST/PATCH/PUT/DELETE, including login, registration, OTP, recovery and logout, requires exact trusted Origin, JSON content type and `X-CSRF-Token`. Compare submitted header to cookie in constant time, validate HMAC, expiry and current binding. Reject absent/foreign Origin for browser mutation endpoints. Rotate CSRF binding at session establishment; never accept a preauth token for an authenticated mutation. SameSite is extra protection, not the primary control. No state changes via GET.

CSRF tokens expire after 30 minutes or session expiry, whichever is earlier. Encode the version, nonce, expiry and binding digest as canonical JSON, base64url encode it and sign that exact encoded value with HMAC-SHA256. A failed CSRF check runs before mutations. The client can fetch a fresh token and let the user retry with the same financial idempotency key. This is not a session renewal.

The public edge exposes one origin. CORS is unnecessary by default; if enabled, list exact configured origins and methods with credentials, never wildcard. Trust proxy client IP headers only from the configured reverse proxy. Direct API access is private. Local development uses distinct nonprefixed cookie names and Secure=false only when explicit development mode plus localhost origin is configured; production refuses insecure settings.

### OTP challenge protocol

Use Node.js `crypto.randomInt(0, 1_000_000)` formatted to six digits, retaining leading zeros. Persist `HMAC(OTP_HMAC_KEY, challenge_id || purpose || generation || code)`, never raw codes. A 256 bit random flow secret (`crypto.randomBytes(32)`) is set in HttpOnly `__Host-cfp_flow` with Path=/ and five minute lifetime. Store only its SHA-256 hash with the challenge; require both flow possession and the OTP. The opaque cookie encodes challenge ID plus secret; it authorizes only OTP operations, not account or financial reads.

Challenge lookup uses the cookie, not a user supplied email or arbitrary purpose. Purpose originates from the initiating endpoint. Resend and verification rate limits are keyed by account/email and trusted IP, not only challenge ID. Each challenge expires five minutes after issuance; resend is allowed after 60 seconds, changes generation and HMAC, and invalidates the old code. Resend never resets failed attempts. At five failures revoke the challenge and enforce a 15 minute account/purpose cooldown before a new challenge. Do not extend an authenticated session through an OTP challenge.

For verification, lock the user (if any) and challenge, recheck eligibility, purpose, flow hash, delivery state, expiry, attempts and cooldown. Wrong codes increment attempts and commit even though the endpoint returns an error. Correct codes consume the challenge atomically with their effect. Replays and concurrent verification have no second effect. Compare HMACs in constant time.

### Delivery and rate limits

Create/revoke challenge state and persist rate limits before SMTP. Do not hold a database transaction while sending email. After commit, send synchronously via Nodemailer (`nodemailer`) with a ten second connection/socket timeout and mandatory TLS certificate validation. Mark `sent` or `failed` only if challenge generation still matches. A crashed/uncertain delivery leaves no session; the user retries after cooldown. Send failures never roll back into an approved account or a session. Verification requires `sent`; an email received during the short send acknowledgement window can safely retry.

No automatic retry loop, broker or outbox worker. The UI offers controlled resend. Duplicate registration and unknown recovery email create a dummy flow with the same outward response shape and no code email; throttle dummy flows too. Do not claim timing based enumeration is eliminated: test and reduce measurable differences, and apply limits to all outcomes. Never return codes, credentials, hashes or raw SMTP exceptions.

Rate limit counters use atomic PostgreSQL upsert/increment with fixed UTC windows, composite keys and expiry. Increment before expensive hashing or sending. Starting technical thresholds, configurable but not disableable in production:

| Operation | Account/email key | Trusted IP key |
|---|---|---|
| Password login | 5 attempts per 15 minutes | 30 per 15 minutes |
| Registration | 3 per hour | 10 per hour |
| OTP send/resend, all purposes combined | 5 per hour plus 60 second cooldown | 20 per hour |
| OTP verification | 5 failures per challenge plus exhaustion cooldown | 30 per 15 minutes |
| Recovery initiation | 3 per hour | 10 per hour |

Use an HMAC digest of normalized email/IP as bucket keys, not raw PII. Return 429 and Retry-After. Failed requests retain counter increments. Daily operator maintenance can remove expired buckets and consumed/expired challenge material after the agreed security retention period; no scheduler service is required. Persistent counters, not process memory, determine limits.

### Workflows and state transitions

| Flow | Transition and effect |
|---|---|
| Registration | Validate name/email/password; create `unverified` member applicant only; create registration challenge. Existing email/reserved admin email returns generic dummy flow. No session. |
| Registration verification | Consume registration challenge, set email verification time and `pending`; issue a status session for own pending page only. |
| Pending login | Verify password and verified email, issue status session; no roster/finance access. Unverified login starts registration challenge. Rejected login can show own status but cannot reapply until policy is approved. |
| Approval | Admin selects a valid unreserved member; locked transaction confirms verified pending applicant, unique link and valid version, marks approved and audits. Existing status session stays status only; user logs in again for full access. |
| Rejection | Verified pending applicant becomes rejected with reason and audit event; no financial access. |
| Admin login | Verify password and exact authorization identity; if approved/active, create admin challenge. Consume challenge and atomically set email verification time if bootstrap, create full session with admin OTP time and audit login success. No privileged session before this point. |
| Member login | Approved, verified, linked user without fixed admin match gets member full session directly after password verification. A reserved identity cannot fall back to member login to bypass OTP. |
| Recovery | Generic request creates recovery challenge for existing account or dummy flow. `POST /auth/password/reset` accepts code and new password together; consumes challenge, replaces hash, revokes all sessions and audits in one transaction. It never issues a session or changes approval/suspension. |
| Password change | Full session plus current password and new password; update hash, revoke all sessions, audit, then require login again. |
| Suspension | Regular member suspension/restoration is in scope via the admin API, which changes target state and revokes sessions in one audited transaction. Restoration returns to stored previous state and never auto-approves a pending/rejected user. Reserved administrator suspension/restoration is restricted to the audited operator CLI (`admins suspend` / `admins restore`), which blocks suspending the last active administrator; the web API rejects admin targets with `403`. |

### CLI provisioning

The operator imports a private manifest with exactly three slots, normalized emails and member references. Each slot is distinct and belongs to the validated 26 person roster. The CLI transaction rejects missing/extra slots, collisions and attempts to change fixed identities after provisioning. There is no API to grant admin.

For each reserved account, an interactive CLI sets an initial password using hidden confirmation input (never a command argument or printed generated password). The trusted operator conveys that password outside the portal; first admin login still needs the account's email OTP. Audit actor is `operator` with an explicitly supplied nonsecret operator label. Runtime credentials cannot write authorization slots. Replacement of a predefined individual is a future approved operator procedure, not an MVP UI feature.

### Permission guards (`server-only`)

`requireStatusOrFull` reads only self metadata. `requireMember` requires full eligible session. `requireAdmin` additionally requires the fixed admin match and admin OTP. Every protected Route Handler calls one explicitly; service mutations revalidate inside their Prisma transaction. Never use an admin boolean supplied by the client. Financial projections shared with members omit other users' emails/contact data and all security state. Audit and registration lists are admin only.

## Build plan

Implement T05 through T09 for the first slice, then T21/T22 for lifecycle interfaces. AC-02 through AC-07 and AR-03/AR-04 are tested against real PostgreSQL and browser cookies, not mocked authorization.

## Consequences and rationale

These mechanisms require careful custom orchestration even with proven crypto libraries. No refresh flow and no queue reduce the number of failure states. Absolute session expiry requires periodic login; PostgreSQL unavailability fails authentication closed. (basis: OWASP session/CSRF guidance and approved security requirements)
