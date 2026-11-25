# Collective Finance Portal interface

The requested MVP presentation is implemented in the existing Next.js application. Authentication and financial actions call the ratified API contract, but the API and database services are not implemented in this iteration. The UI does not sign users in locally, create sessions, approve accounts or save financial records itself.

## Open the interface

From this directory, run `npm.cmd run dev`. Open `http://localhost:3000/login` for the actual sign in interface or `http://localhost:3000/dev/preview/overview` for the synthetic development preview.

The preview is a separate server gated route. Outside `NODE_ENV=development` it returns not found before loading fixtures. Its audience selector changes presentation only, creates no credentials and grants no access to normal routes. Preview submissions display an explicit no change message. All preview identities use sample names and reserved example.invalid email addresses.

Normal private routes initially render without private data, then request `/api/v1/auth/me` and authorized projections. Without the secure service, the UI shows an error. A 401 clears mounted private data and dialogs. Member projections cannot open admin pages or see write controls. These browser checks complement, and never replace, mandatory server permissions.

## Implemented pages

| Area | Routes and features |
| --- | --- |
| Authentication | /login, /register, /verify, /pending, /forgot-password, /reset-password; labelled forms, server challenge timers, resend, status refresh and errors |
| Shared finance | /overview, /members, /members/[id], /groups, /groups/[id], /deposits, /expenses, /ledger; exact displayed monetary strings, active fund totals, historical attribution, search, filters, pagination and transaction details |
| Own account | /account; own profile, password change and logout all request controls |
| Administration | /admin, /admin/approvals, /admin/members, /admin/groups, /admin/deposits, /admin/expenses, /admin/audit; approvals, account state tabs, allowed roster edits, deposits, expenses, correction dialogs and audit before/after details |
| Shared application states | Root redirects to login; loading, error and not found surfaces |
| Development only | /dev/preview/[[...path]] presents the same financial components with synthetic fixtures |

The overview displays total deposits, total expenses and remaining collective balance. Deposits show member, amount, payment date, accepting administrator and description. The deposit form sends only member, amount, date and description. The server must supply the authenticated administrator. Expenses do not reduce member contributions, and no shares, targets, outstanding balances or budgets are invented.

## Reusable components and integration

* `PortalShell`: teal desktop sidebar, active links, header profile, mobile focus trapping navigation and sign out.
* `AuthLayout`, `AuthScreen`: account forms, verification, recovery and pending status with server supplied challenge metadata.
* `Panel`, `PageHeading`, `SummaryCard`, `MoneyText`, `Badge`, `Field`, `Pagination`, `LoadingState`, `EmptyState`, `ErrorState`.
* `MemberTable`, `GroupTable`, `TransactionTable`, `TransactionFilters`, `MemberSelect`.
* `FinancialForm`, `FinancialFormPanel`, `CorrectionDialog`, `AdminActionDialog`, `ApprovalTable`, `AuditTable`, `AuditDiff`, `AccountPanel`.
* shadcn Base UI button/dialog primitives and native accessible input, select and textarea controls styled with the same Tailwind tokens.
* `Workspace` loads permitted API data. `WorkspaceView` composes presentation without coupling it to a data store.
* `lib/api.ts` uses same origin requests, cookies, no-store, CSRF before writes, timeouts, cancellation and Zod response contracts. No auth token or private record is saved to localStorage.
* Financial request IDs remain stable across retries of the same body. An uncertain request cannot be retried with edited values and a fresh key without leaving the form and checking history. Actual duplicate protection remains a backend responsibility.

## Directory structure

```text
frontend/
  design.md
  postcss.config.mjs
  playwright.config.ts
  src/
    app/
      (auth)/                 Authentication pages and layout
      (portal)/               Shared and admin pages and layout
      dev/preview/[[...path]]/ Development gate
      layout.tsx, page.tsx, loading.tsx, error.tsx, not-found.tsx
      globals.css
    components/
      ui/                     Button, dialog, inputs
      finance/                Reusable dashboard and domain components
    dev/fixtures.ts           Synthetic data, never normal route data
    hooks/use-hydrated.ts      Prevent interaction before handlers attach
    lib/                      Contracts, API, response schemas, exact display formatting
  tests/ui/portal.spec.ts      Browser presentation and request boundary checks
```

Existing backend, Prisma and other reserved placeholder directories remain outside this UI iteration. No FastAPI, Firebase, database layer, proxy authentication or Server Action write implementation was added. The obsolete optional external API rewrite and competing Turbopack CSS loader were removed from Next configuration. Tailwind now runs through its PostCSS adapter.

## Files changed in this iteration

Existing scaffold files updated: `package.json`, `package-lock.json`, `next.config.ts`, `.gitignore`, `README.md`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/ui/button.tsx`, `src/lib/utils.ts` (formatting).

Created configuration and documentation: `postcss.config.mjs`, `design.md`, `playwright.config.ts`, `tests/ui/portal.spec.ts`.

Created application files:

* `src/app/(auth)/forgot-password/page.tsx`
* `src/app/(auth)/layout.tsx`
* `src/app/(auth)/login/page.tsx`
* `src/app/(auth)/pending/page.tsx`
* `src/app/(auth)/register/page.tsx`
* `src/app/(auth)/reset-password/page.tsx`
* `src/app/(auth)/verify/page.tsx`
* `src/app/(portal)/account/page.tsx`
* `src/app/(portal)/admin/approvals/page.tsx`
* `src/app/(portal)/admin/audit/page.tsx`
* `src/app/(portal)/admin/deposits/page.tsx`
* `src/app/(portal)/admin/expenses/page.tsx`
* `src/app/(portal)/admin/groups/page.tsx`
* `src/app/(portal)/admin/members/page.tsx`
* `src/app/(portal)/admin/page.tsx`
* `src/app/(portal)/deposits/page.tsx`
* `src/app/(portal)/expenses/page.tsx`
* `src/app/(portal)/groups/page.tsx`
* `src/app/(portal)/groups/[id]/page.tsx`
* `src/app/(portal)/layout.tsx`
* `src/app/(portal)/ledger/page.tsx`
* `src/app/(portal)/members/page.tsx`
* `src/app/(portal)/members/[id]/page.tsx`
* `src/app/(portal)/overview/page.tsx`
* `src/app/dev/preview/[[...path]]/page.tsx`
* `src/app/error.tsx`
* `src/app/loading.tsx`
* `src/app/not-found.tsx`
* `src/components/finance/account-panel.tsx`
* `src/components/finance/admin-dialogs.tsx`
* `src/components/finance/admin-tables.tsx`
* `src/components/finance/auth-screen.tsx`
* `src/components/finance/financial-forms.tsx`
* `src/components/finance/portal-shell.tsx`
* `src/components/finance/preview-workspace.tsx`
* `src/components/finance/primitives.tsx`
* `src/components/finance/roster-tables.tsx`
* `src/components/finance/transaction-filters.tsx`
* `src/components/finance/transaction-table.tsx`
* `src/components/finance/workspace-view.tsx`
* `src/components/finance/workspace.tsx`
* `src/components/ui/dialog.tsx`
* `src/components/ui/input.tsx`
* `src/dev/fixtures.ts`
* `src/hooks/use-hydrated.ts`
* `src/lib/api.ts`
* `src/lib/contracts.ts`
* `src/lib/money.ts`
* `src/lib/response-schemas.ts`

Planning changes are limited to UI milestone lines in `../docs/scope/scope.md` and the lifecycle status line in `../docs/specs/0001-portal-architecture/index.md`. Existing unrelated workspace changes and the legacy application were preserved. No commit or push was performed.

## Verification

Run `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build` and `npm.cmd run test:ui`. Browser tests use an already running server at localhost:3000 and installed Microsoft Edge by default. Set `PORTAL_TEST_URL` to use another address. `PLAYWRIGHT_CHANNEL` may select another installed compatible browser.

For production boundary checks, run the built application with `npm.cmd run start -- --port 3101`, then in a separate PowerShell session:

```powershell
$env:PORTAL_TEST_URL = 'http://127.0.0.1:3101'
$env:PORTAL_TEST_PRODUCTION = '1'
npm.cmd run test:ui
```

Browser tests using intercepted API responses verify frontend behavior only. They are not authentication, database, authorization or transaction integrity tests. Separate GA verify, test, independent review and release documentation gates remain open.

Verification on 25 November 2026:

* Lint and TypeScript checks passed with no errors or warnings.
* Production build passed.
* All 11 development browser checks passed across the initial run and focused reruns after fixes. The production only test is intentionally skipped on the development server.
* Six production browser checks passed again against the final rebuilt application (10.9 seconds). Six development presentation tests are intentionally skipped in production.
* The route sweep covered all 16 financial screens at 1440, 768 and 390 pixel widths with no page level horizontal overflow.
* Keyboard focus trapping/restoration, mobile navigation, filters, empty states, preview no write behavior, OTP resend timing, session revocation cleanup, member route denial and request key reuse passed.
* Visual inspection covered desktop overview/deposit and mobile overview, login and navigation.
* Fixed issues included missing PostCSS wiring, a development streaming boundary, fixture projection shape and controls accepting clicks before React attached handlers.
* Production preview URLs return 404 and the production login omits its preview link. Fixture transaction amounts were absent from the checked production static/app output.
* Git diff whitespace checks passed. Separate GA approval remains open.

## Remaining integration tasks

1. Implement the first Tracer Bullet through real Next.js Route Handlers and server only services: admin password plus OTP, member approval, verified deposit plus atomic audit and member overview.
2. Add PostgreSQL and Prisma migrations, private validated roster import, exactly three administrator identities, and constraints for the 26 people and 10 groups.
3. Implement Argon2id, signed HttpOnly session cookies, PostgreSQL revocation, Origin/CSRF checks, OTP challenges, rate limits and real email delivery. No UI control establishes these guarantees.
4. Implement exact decimal accounting, authoritative historical group snapshots, idempotency receipts, atomic audit capture, safe void/replacement and consistent aggregates.
5. Add expense and account lifecycle services. Resolve date/amount policies, negative fund policy, correction attribution and administrator suspension before enabling affected operations.
6. Match the Zod response contracts to implemented projections and complete real service integration, concurrency/rollback tests, direct API permission tests, SMTP tests, independent GA review and release rehearsal.

Four moderate advisories were reported by npm audit in the existing shadcn tooling chain: shadcn → ts-morph → @ts-morph/common → minimatch. The proposed automatic fix was a major shadcn downgrade, so no forced dependency rewrite was applied. This remains a dependency maintenance item before release.
