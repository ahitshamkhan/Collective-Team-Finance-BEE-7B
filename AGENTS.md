# Finance BEE — Agent Guidelines

This file contains repository instructions for AI coding agents working in **Finance BEE** (Collective Finance Portal).

## Stack and Architecture

- **Framework:** Next.js App Router (full stack: UI, Server Components, and REST Route Handlers under `/api/v1`)
- **Language:** TypeScript (strict mode)
- **Styling and UI:** Tailwind CSS and `shadcn/ui`
- **Database and ORM:** PostgreSQL with Prisma ORM and Prisma Migrate
- **Validation:** Zod (strict schemas, unknown write fields rejected)
- **Authentication and Security:** `jose` (HS256 JWT in `HttpOnly` cookies), Argon2id password hashing, PostgreSQL session revocation, CSRF protection, and PostgreSQL OTP/rate limit state
- **Email:** Nodemailer with Gmail SMTP (STARTTLS)
- **Testing:** Vitest (unit and PostgreSQL integration) and Playwright (end to end browser workflows)
- **Deployment Target:** Vercel (proposed) with managed PostgreSQL

## Project Layout

- `.agents/` — Existing JS Mastery skills (local only, untracked)
- `frontend/` — Full stack Next.js application:
  - `src/app/` — App Router pages (`(auth)`, `(portal)`) and REST Route Handlers (`api/v1/`)
  - `src/server/` — `server-only` business logic, database access, auth, OTP, mail, finance, and audit services
  - `src/components/` — `ui/` (`shadcn/ui` primitives) and `finance/` reusable components
  - `src/features/`, `src/hooks/`, `src/lib/`, `src/services/`, `src/types/` — Client helpers, API wrapper, and types
  - `prisma/` — `schema.prisma`, migrations, and private operator CLI scripts
  - `tests/` — Vitest unit/integration tests and Playwright e2e tests
- `docs/` — Approved scope (`docs/scope/scope.md`) and ratified architecture (`docs/specs/0001-portal-architecture/`)
- `BEE-7B-Collective-Team-Finance-Private-Login-Fix/` — Legacy visual reference (local only, untracked; do not modify or import legacy Firebase auth/finance logic)

## Core Rules

1. Never import `src/server/` or Prisma into Client Components (`server-only` boundary).
2. Never use JavaScript floating point (`number`) for authoritative money calculations; use exact decimal arithmetic (`Prisma.Decimal` / `decimal.js`) and PostgreSQL `NUMERIC(14,2)`.
3. Never expose secrets, private roster data, or production totals in public pages, static assets, or `NEXT_PUBLIC_*` variables.
4. Keep `docs/scope/scope.md` and `docs/specs/0001-portal-architecture/` as the source of truth before building any feature.
