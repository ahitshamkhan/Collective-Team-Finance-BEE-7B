# Finance BEE — Collective Finance Portal

Full stack Next.js application for private collective fund bookkeeping.

## Project Structure

```text
Finance BEE/
├── frontend/                    # Full stack Next.js App Router application
│   ├── prisma/                  # Prisma schema, migrations, and operator CLI scripts
│   ├── public/                  # Static assets (no private data)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/          # Login, register, verify, pending, recovery
│   │   │   ├── (portal)/        # Overview, members, groups, ledger, account, admin
│   │   │   └── api/v1/          # Protected Next.js Route Handlers
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui primitives
│   │   │   └── finance/         # Portal shell, tables, forms, filters
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/                 # Client API wrapper, formatting, shared contracts
│   │   ├── server/              # server-only services (auth, otp, mail, finance, audit, db)
│   │   ├── services/
│   │   └── types/
│   └── tests/                   # Vitest (unit/integration) and Playwright (e2e)
├── docs/                        # Approved scope and architecture specifications
├── AGENTS.md
├── README.md
├── .gitignore
├── .env.example
└── skills-lock.json
```
