# Finance BEE — Collective Finance Portal

Finance BEE is a Next.js interface for managing a private collective fund. The current milestone delivers the portal UI; it is **not a production-ready finance or authentication system**.

## Current status

The interface includes account flows, member and group pages, deposits, expenses, a ledger, an overview, and administrator screens. Normal private pages expect a secure `/api/v1` service, which is not implemented yet. Authentication, authorization, email delivery, database persistence, and financial transactions therefore are not available in this repository. UI checks are not a substitute for server-side security or transaction controls.

A synthetic preview is available only in development. It uses sample data, does not create credentials or persist changes, and is not a way to sign in. The root `.env.example` describes a backend configuration that the current frontend does not use.

## Run the frontend

**Requirements:** Node.js 20.9 or later and npm. No database or backend is needed to start the interface.

```sh
cd frontend
npm ci
npm run dev
```

Open <http://localhost:3000/login> for the sign-in interface, or <http://localhost:3000/dev/preview/overview> for the development-only sample preview. Without the API service, normal private pages cannot load finance data.

## Checks

Run these from `frontend/`:

```sh
npm run lint
npm run typecheck
npm run build
npm run test:ui
```

The Playwright UI tests use a server at `localhost:3000` and Microsoft Edge by default. They verify frontend behavior, not backend authentication, permissions, persistence, or accounting integrity. See [`frontend/README.md`](frontend/README.md) for test setup and implementation detail.

## Project layout

- `frontend/` — Next.js App Router application, reusable UI, API client/contracts, and browser tests.
- `docs/scope/` — approved product scope.
- `docs/specs/` — architecture specification.

For implementation boundaries and remaining integration work, see [`frontend/README.md`](frontend/README.md) and [`AGENTS.md`](AGENTS.md).
