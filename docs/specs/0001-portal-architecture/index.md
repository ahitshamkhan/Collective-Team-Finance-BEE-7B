# 0001. Collective Finance Portal architecture

**Date:** 2026-11-24
**Status:** In Progress
**Technical design approval:** Accepted by you on 24 November 2026 after your own review. No independent AI critique was requested. This feature linked spec remains Proposed until development begins; Accepted lifecycle status is reserved for built and verified work. Implementation is not yet authorized.

## Summary

Build one full stack Next.js App Router application in `frontend/` backed by PostgreSQL and Prisma ORM. Next.js Route Handlers under `/api/v1` and `server-only` services own authentication, permissions, and accounting. The first working slice proves administrator OTP login, member approval, deposit recording, and the member's real balance view before adding more features.

This is a consolidated architecture umbrella, with focused child contracts rather than separate planning rounds for every page. It is not implementation approval. The approved requirements remain in `docs/scope/scope.md`.

## Structure

| Document | Decision owned |
|---|---|
| [0001-data.md](0001-data.md) | Relational model, keys, constraints, indexes and immutable history |
| [0001-identity.md](0001-identity.md) | Identity, OTP, cookies, CSRF, revocation and permission enforcement |
| [0001-finance.md](0001-finance.md) | Exact accounting, atomic writes, historical attribution and idempotency |
| [0001-interface.md](0001-interface.md) | API contract, frontend routes, components and integration |
| [0001-delivery.md](0001-delivery.md) | Configuration, imports, deployment options and atomic build tasks |
| [verify.md](verify.md) | GA verification and acceptance evidence |
| [rationale.md](rationale.md) | Alternatives, tradeoffs and named sources |

Children share this lifecycle status. Their technical decisions are ratified; business decisions marked unresolved remain unapproved.

## Requirements

All scope FR-01 through FR-18, BR-01 through BR-14, NFR-01 through NFR-11 and AC-01 through AC-14 remain binding. FR-19/AC-15 are P1 and FR-20 is deferred P2. The child contracts refine rather than replace those criteria.

Additional architecture acceptance criteria:

| ID | Observable result |
|---|---|
| AR-01 | One browser origin serves the Next.js pages and `/api/v1` Route Handlers; only `server-only` server modules access PostgreSQL (via Prisma) and SMTP (via Nodemailer). |
| AR-02 | The first real slice completes admin password/OTP, approval, deposit plus audit commit, and an approved member's updated ledger and collective balance. |
| AR-03 | Restarting or using another worker cannot reset OTP attempts, rate limits, revocations or duplicate submission protection. |
| AR-04 | Concurrent writes, approval conflicts, suspension races and failed audit inserts cannot create partial or unauthorized financial effects. |
| AR-05 | Every public/private response follows the field projections below; money crosses JSON as strings and private data is never statically published. |
| AR-06 | A clean test database migrates and accepts a validated synthetic roster of 26 people and 10 groups; exactly three administrator slots can be provisioned. |
| AR-07 | Configuration, recovery rehearsal and required GA checks pass before a release with real records. |

## Decision

Use a single full stack Next.js App Router deployable in `frontend/` with TypeScript, `server-only` domain modules, Next.js Route Handlers, Prisma ORM, and PostgreSQL. Domain separation is code organization under `src/server/`, not separate network services. Preserve Tracer Bullet delivery and GA verification. (basis: approved scope and revised full stack Next.js architecture)

Your confirmed deadline is **26 November 2026 at 00:00 Asia/Karachi**, equivalent to **25 November 2026 at 19:00 UTC**. P1/P2 do not enter the release path. The deadline does not authorize bypassing security or accounting tests, and this specification is not a feasibility guarantee.

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Interface | Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui | Confirmed stack, already initialized in `frontend/`, retain the existing finance appearance |
| API & Server Logic | Next.js Route Handlers (`/api/v1/*`) on Node.js runtime with `server-only` modules | Single deployable, same origin cookies, and strict server/client boundary |
| Validation | Zod (`.strict()`), unknown write fields forbidden | Explicit request/response contracts and prevention of mass assignment |
| Persistence | PostgreSQL, Prisma ORM, Prisma Migrate, `NUMERIC(14,2)`, `Prisma.Decimal` / `decimal.js` | Exact money, type safe queries, and enforced relational constraints |
| Authentication primitives | `jose` (HS256) and Argon2id (`argon2`); Node.js `crypto` (`randomInt`, `randomBytes`, `createHmac`, `timingSafeEqual`) | Established signing/hash primitives, no handwritten cryptography |
| Session state | Signed JWT cookie plus PostgreSQL `sessions` row, no refresh token for MVP | Simple revocation and bounded session lifetime |
| Email | Nodemailer using Gmail SMTP submission with mandatory TLS | Small volume, no queue infrastructure; sender availability is a launch dependency |
| Testing | Vitest against real PostgreSQL, Playwright against the complete app | Tests actual database constraints and browser cookie behavior |
| Delivery | Vercel (proposed) with managed PostgreSQL | Single origin hosting with zero separate proxy or backend coordination |
| Observability | Structured redacted logs and readiness checks | Sufficient initial diagnosis without selecting another service |

Library versions will be pinned in `frontend/package.json` and `package-lock.json` during implementation. No cache, message broker, file storage service, websocket server or background job service is required.

## System architecture

```mermaid
flowchart LR
  B[Browser] -->|HTTPS, cookies, CSRF header| N[Next.js App Router on Vercel]
  N -->|Pages and UI| UI[Client & Server Components]
  N -->|/api/v1 Route Handlers| S[src/server/: identity, otp, mail, roster, finance, audit]
  S -->|Prisma ORM transactions| D[(PostgreSQL)]
  S -->|Bounded synchronous send after DB commit| E[Gmail SMTP via Nodemailer]
  C[Private operator CLI scripts] --> S
```

Vercel terminates TLS and serves both pages and `/api/v1` Route Handlers from one origin. PostgreSQL is never exposed publicly. Client Components never import `src/server/`, Prisma, or secrets. Route Handler authorization is authoritative even if a page guard is bypassed.

Use a singleton Prisma client in `src/server/db/prisma.ts` (safe for Next.js dev hot reload). Permission helpers open a short read query to validate the session and user before returning principal IDs. Mutation services open `prisma.$transaction(async (tx) => ...)`, acquire the PostgreSQL transaction advisory lock via `tx.$executeRaw`, and reload authority inside that transaction. Route Handlers map domain errors to `ErrorView`; helpers never swallow errors. Nodemailer SMTP runs outside database transactions with explicit challenge delivery state.

## Minimal directory structure

```text
frontend/
  prisma/
    schema.prisma             10-table PostgreSQL schema
    migrations/               Prisma Migrate SQL migrations + triggers/partial indexes
    scripts/                  Private operator CLI scripts (roster validate/import, admin provision)
  src/
    app/
      (auth)/                 login, register, verify, pending, recovery
      (portal)/               overview, members, groups, ledger, account, admin
      api/v1/                 Next.js Route Handlers (health, auth, finance, members, groups, transactions, admin)
    components/
      ui/                     shadcn/ui primitives
      finance/                cards, tables, forms, filters, navigation
    server/                   server-only boundary (never imported by client components)
      config.ts               validated server env config
      db/                     prisma.ts, locks.ts
      auth/                   jwt.ts (jose), password.ts (argon2), csrf.ts, guards.ts
      services/               identity.ts, otp.ts, mail.ts, roster.ts, finance.ts, audit.ts
      schemas/                zod request/response schemas
      errors.ts               stable error codes and ErrorView mapper
    lib/                      api.ts, contracts.ts, money.ts, utils.ts
    features/, hooks/, services/, types/
  tests/
    unit/                     Vitest unit tests
    integration/              Vitest PostgreSQL integration tests
    e2e/                      Playwright browser tests
docs/scope/                   approved requirements
docs/specs/                   these contracts
```

`frontend/` is already initialized with Next.js App Router, TypeScript, Tailwind CSS, and `shadcn/ui`. Keep the supplied legacy directory and ZIP untouched and outside public deployment roots. Do not introduce microservices or a separate backend runtime.

## Cross child contracts

1. UUIDs are generated by the backend; timestamps are timezone aware UTC; business dates are `date` values interpreted in Asia/Karachi. Currency is always PKR.
2. Amounts are canonical decimal strings with two fractional digits in responses. Financial calculations occur only in the API/database. JavaScript formatting must not determine balances.
3. Ten groups and 26 members are imported privately. Exactly three fixed authorization slots identify administrators. Leadership names/flags from the legacy application are not administrator credentials.
4. Each protected request reloads session and user eligibility from PostgreSQL. Admin permissions are derived from the fixed authorization table, never a request role or JWT role claim.
5. Sensitive writes, including session revocation, use the common short database mutation guard defined in the finance contract. This is deliberately coarse for 26 people.
6. No endpoint deletes financial history or grants admin roles. Corrections are void and optional replacement with a mandatory reason.
7. Unresolved business policies cannot be silently defaulted. Affected operations remain unbuilt or return `POLICY_UNRESOLVED` until the decision is ratified. This is an implementation guard, not permission to release an incomplete P0 feature.

## Build plan

The atomic feature execution plan is in `0001-delivery.md`, tasks T01 through T26. It starts with foundation and the real deposit path, then expenses, correction/history, account management and release verification. Child feature tasks own implementation; this umbrella does not duplicate their task lists.

## Consequences

Database state on every protected request is intentional: modest additional queries buy immediate revocation and clearer permissions. Serializing sensitive writes limits throughput but makes races tractable at this scale. Synchronous SMTP adds login latency and can fail independently of account creation, so delivery states and retries are explicit. No rolling token refresh means a user logs in again after the bounded session expires.

## Follow-up

Business blockers: overdraft policy, permitted financial dates and any lower amount cap, historical correction attribution, rejected account reapplication, member relinking/email changes, and administrator suspension/last usable admin policy. Deployment blockers: verified identities/roster, sender readiness, hosting/domain/operator, existing history inventory, backup/recovery targets and privacy retention obligations. See delivery decision register for exact gates.

You will name any additional tools. No skill discovery or installation is authorized. You approved the data model and technical specification. Explicitly unresolved business policies and deployment blockers remain open; no feature is claimed implemented or shipped.

## Rationale

Reasoning, alternatives and named sources: see [rationale.md](rationale.md).
