# 0001. Delivery, migration and implementation plan

## Summary

Build the replacement beside the legacy files. Prove the complete deposit path with synthetic data first, then extend it without changing the accounting rules. Production provisioning and cutover require separate approval.

## Requirements

All P0 scope acceptance criteria and AR-01 through AR-07. Deadline: 26 November 2026 at 00:00 PKT, the end of 25 November. Tracer Bullet and GA remain mandatory. P1 filters and P2 Projects are not on the deadline path.

## Decision

Use a minimal local composition and one public origin in production. Prefer a small existing host if available; otherwise a managed application platform with PostgreSQL is a reasonable alternative. No hosting account is assumed available, no provider is selected or purchased, and no deployment runs in this task. (basis: approved deadline, stack and operating scale)

### Configuration contract

Secrets are required environment variables without checked in defaults. Example files contain variable names and safe placeholders only, never working credentials.

| Variable | Purpose and rules |
|---|---|
| `APP_ENV` | `development`, `test`, `production`; production validates all secure settings |
| `PUBLIC_ORIGIN` | Exact canonical scheme/host/port used for Origin checks and redirects; HTTPS in production |
| `DATABASE_URL` | Runtime `postgresql+psycopg` credentials with least privileges; never public |
| `MIGRATION_DATABASE_URL` | Separate schema owner used only by Alembic/operator commands |
| `PROVISIONING_DATABASE_URL` | Separate restricted operator credential for roster/admin provisioning, not the web process |
| `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE` | Random signing key with at least 256 bits of entropy and fixed token namespace |
| `OTP_HMAC_KEY`, `CSRF_HMAC_KEY`, `RATE_LIMIT_HMAC_KEY` | Distinct random keys, never reuse JWT key; environment managed |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_APP_PASSWORD`, `SMTP_FROM` | Initial Gmail submission: `smtp.gmail.com`, port 587 with STARTTLS and certificate validation; password secret, sender ownership verified |
| `SMTP_TIMEOUT_SECONDS` | 10 initially; bounded send rather than indefinite thread occupation |
| `BUSINESS_TIMEZONE`, `CURRENCY` | Fixed `Asia/Karachi`, `PKR`; reject unsupported production changes |
| `ADMIN_SESSION_SECONDS`, `MEMBER_SESSION_SECONDS`, `STATUS_SESSION_SECONDS` | 7200, 28800, 1800 respectively; validated positive bounds |
| `TRUSTED_PROXY_IPS` | Explicit proxy addresses allowed to supply client IP/protocol headers |
| `LOG_LEVEL` | INFO in production; no request body or credential logging |
| `COOKIE_SECURE` | True in production; false permitted only in explicit localhost development/test |
| `API_INTERNAL_ORIGIN` | Development Next rewrite destination or infrastructure routing address; not browser public config |
| `FINANCE_POLICIES_CONFIRMED` | False until named unresolved financial policies are ratified in the spec; must be true for production readiness, not a mechanism to bypass them |

OTP lifetime, attempt count and resend cooldown remain 300 seconds, five attempts and 60 seconds. Rate thresholds live in one validated settings object using the identity contract. Frontend needs no secret or database URL. No NEXT_PUBLIC variable contains a secret. Password/key rotation procedures revoke sessions/challenges as applicable; key changes are deliberate operator actions.

### Local development design

Proposed ports: Next.js 3000, FastAPI 8000, PostgreSQL 5432 bound to localhost. Browser uses `http://localhost:3000` only; Next development rewrites `/api/v1/*` to FastAPI and forwards Set-Cookie. Different development cookie names avoid the Secure `__Host-` production prefix. Integration tests use a separate database and generated synthetic roster. Test email uses an injected in memory mail adapter readable only by the test process, never a public debug endpoint or application log. Real SMTP is tested separately with approved test accounts.

Pin compatible framework/library versions in application lockfiles during implementation. Define documented commands for lint/typecheck/build, Pytest, migrations and Playwright. No local command requires the legacy Firebase configuration or production database access.

### Migration and secure import

1. Alembic owns schema creation, constraints, indexes and immutable transaction trigger. Runtime role is not schema owner. Baseline migrations create identity/roster/transaction/audit/idempotency state needed for the first slice; later migrations add expense/correction constraints and indexes as implemented. Test upgrade from empty and from each preceding revision.
2. Prepare a private roster manifest outside public assets and Git: stable roster keys, names, ten explicit group codes and each member's current group. Administrator manifest has exactly three slots with verified emails and member keys. Do not infer either from leadership flags. The CLI validates duplicate keys, empty names, group references, exact counts and collisions before touching a database.
3. Planned commands: `python -m app.cli roster validate --file <private-path>`, then authorized `roster import --file <private-path> --operator <label>`. Validation output reports counts/errors using nonprivate row numbers; no roster dump. Default import is a dry run unless explicit `--apply`; acquire the mutation guard, commit all records and operator audit in one transaction. A rerun with identical stable keys/content is a no op; changed data fails rather than overwriting. Enforce ten groups/26 members before commit.
4. Planned admin command: `python -m app.cli admins provision --file <private-path> --operator <label> --apply`. Require complete three slot manifest and existing member records, hidden password entry per new account and a single transactional provisioning audit. Validate authorization rows and linked accounts before commit. Never pass passwords on command lines or return hashes. Initial password transfer remains a private operator responsibility; every admin still completes email OTP before session creation.
5. Legacy package has 11 categories and empty seeded enrollment values, not a validated production roster. Map chassis to collective expense category only after operator confirmation. Never import expense shares, initial zero totals or project placeholder budgets as production facts.
6. Historical transactions are a separate unresolved import. Do not implement a blind converter. Obtain an authorized export and approve source IDs, amounts, dates, void status, member/group mappings and recorded actor provenance. If a historical actor cannot be verified, stop instead of attributing it to the current importer. Reconcile counts and active deposits/expenses against source records and have an authorized lead sign off.
7. Cutover requires a backup and write freeze on the old ledger, rehearsal in a separate database, reconciliation and an explicit switch of the public origin. Do not dual write. After new financial writes exist, rollback cannot simply restore the old ledger and lose those writes; freeze, export/reconcile and use a reviewed recovery plan. The legacy files remain intact throughout.

### Production options

| Option | Recommended use | Cost/tradeoff and prerequisites |
|---|---|---|
| One small VM with reverse proxy, frontend/API processes and PostgreSQL | Recommended when an operated host is already available | Simplest topology; operator owns patching, backups, TLS and restore. Off host backups are essential. |
| Managed app hosting for frontend/API with managed PostgreSQL | If no operator can maintain the database | Less database operation work, but platform billing, SMTP egress, private connectivity and same origin routing must be confirmed. |

No Kubernetes, microservices or multi region deployment. Enable HTTPS, private database ingress, trusted proxy validation, no-store auth/private responses, frame protection, MIME sniff protection and a CSP tested with the selected Next/shadcn build. Do not invent an unsafe blanket CSP exception to make a build pass. Disable public debug/docs endpoints or protect them in production. Readiness checks database connectivity, migrations, 10/26/3 provisioning and confirmed policy settings, not a live SMTP send on every probe.

Redacted logs include request ID, endpoint, duration, status and safe event codes. Exclude Cookie, Authorization, CSRF, OTP, passwords, email contents, hashes and SMTP credentials. Persist logs outside the process and check health/errors with the selected host's facilities. Backup frequency, retention, restore target and alert destination need an owner before launch.

## Build plan

Tasks are atomic implementation work for a later approved development run. Dependencies are explicit. Checkboxes in scope carry only milestone rollups, not this list.

| Task | Priority and dependency | Work and completion evidence | Acceptance |
|---|---|---|---|
| T01 | P0, first | Scaffold only `frontend/` and `backend/` using confirmed stack; pin dependencies and add safe configuration validation. Legacy untouched. | AR-01, AR-07; AC-14 |
| T02 | P0, T01 | Add same origin local routing, API error envelope/live health, public auth shell and teal portal shell without private seed data. | AR-01, AR-05; AC-13 |
| T03 | P0, T01 | Implement SQLAlchemy models and Alembic first slice schema with identity, fixed roster, deposit, audit and idempotency constraints. Test empty upgrade/rollback on test DB. | AR-03, AR-06; AC-01, AC-05, AC-09 |
| T04 | P0, T03 | Implement dry run roster validation/import and three slot admin CLI, least privilege roles and operator audits using synthetic data. | AR-06; AC-01, AC-12 |
| T05 | P0, T03 | Implement Argon2id, JWT verification, session lookups, common mutation guard, permission dependencies and CSRF/origin enforcement. | AR-03, AR-04; AC-04, AC-06, AC-07 |
| T06 | P0, T05 | Implement database rate counters, OTP challenge/HMAC/generation/attempt state and synchronous SMTP adapter with failure behavior. | AR-03; AC-03 |
| T07 | P0, T06 | Implement admin credentials then OTP session path, member login and status sessions. Add integration tests proving no early privileged cookie. | AR-02; AC-04, AC-06 |
| T08 | P0, T06 | Implement registration/verification and unique approve/reject mutations with audit and optimistic versions. | AR-02, AR-04; AC-02, AC-05, AC-12 |
| T09 | P0, T07,T08 | Wire login/register/verify/pending and approval forms to real endpoints; test cookie/CSRF behavior and unique member selection. | AR-02, AR-05; AC-02 through AC-07 |
| T10 | P0, T04,T05 | Implement deposit transaction service, Decimal validation, snapshots, guard, receipt replay and atomic audit. | AR-02, AR-04; AC-08 through AC-12 |
| T11 | P0, T10 | Implement summary and transaction read projections with exact aggregates and stable pagination. | AR-02, AR-05; AC-08, AC-09, AC-13 |
| T12 | P0, T09,T11 | Wire admin deposit form and member overview/ledger; run the full admin OTP → approval → deposit → member read browser test with real PostgreSQL. | AR-02; AC-04, AC-05, AC-07 through AC-09 |
| T13 | P0, T12 | First slice verification: race duplicate keys and suspension, inject audit failure, check unauthorized requests and redaction. Fix failures before broadening. | AR-03, AR-04; AC-03, AC-06, AC-07, AC-09, AC-12 |
| T14 | P0, T13, financial policies resolved | Add expense schema constraints and service with group/collective category, optional member context and confirmed overdraft/date behavior. | AC-08 through AC-10 |
| T15 | P0, T14 | Wire expense form and summary/group expenditure; prove expenses do not reduce contributions. | AC-08, AC-10, AC-13 |
| T16 | P0, T13, correction attribution resolved | Add immutable row guard, void/replacement service, linkage and concurrent correction checks. | AR-04; AC-11, AC-12 |
| T17 | P0, T16 | Wire mandatory reason correction dialogs and original/replacement history views. | AC-11, AC-13 |
| T18 | P0, T13 | Implement audit list/detail projections, filters and permission tests; ensure runtime cannot alter/delete audit rows. | AC-07, AC-12 |
| T19 | P0, T11,T15 | Complete members/groups/detail endpoints and P0 keyword/date/status/member/group filters. | AC-10, AC-13 |
| T20 | P0, T17,T18,T19 | Complete shared finance pages and admin audit view, responsive navigation, focus and error states. | AR-05; AC-07, AC-13 |
| T21 | P0, T08, account policies resolved | Implement recovery/password change, logout all, suspension/restore and versioned roster edits with audit/revocation. | AC-06, AC-10, AC-12 |
| T22 | P0, T21 | Wire My account, recovery, roster and allowed suspension interfaces; test no private state remains on auth loss. | AC-06, AC-07, AC-13 |
| T23 | P0, T20,T22 | Run complete Pytest/PostgreSQL and Playwright suite, typecheck/lint/build; fix regressions with targeted tests. | AC-01 through AC-14; AR-01 through AR-06 |
| T24 | P0, T23 | Conduct GA independent code/security review and resolve blocking findings; produce release notes and operator runbook. | AC-14, AR-07 |
| T25 | P0, T24, hosting/sender available | Rehearse deployment, SMTP delivery, restore and rollback with test data; validate secure production cookies and proxy settings. | AC-14, AR-07 |
| T26 | P0, T25, separate release approval | Validate private roster/import plan and any history reconciliation; approved cutover only after all P0 gates pass. | AC-01, AC-14, AR-06, AR-07 |

The first Tracer Bullet slice ends at T13, not after a frontend mockup. Expenses and later slices extend its real structure. Security primitives and audit capture land before any financial write, not in a final hardening phase. T21 completes lifecycle interfaces; revocation/suspension enforcement is already tested in the first slice. Advanced filtering is P1 and no task is scheduled for Projects.

## Unresolved decisions and release blockers

| Decision | Known boundary | Required resolution / gate |
|---|---|---|
| Overdraft | Never hide/clamp negative balance | Confirm block, warn or allow before T14 |
| Backdated/future dates and business amount cap | Technical storage ceiling is not business permission | Confirm permitted dates and any lower cap before unrestricted deposit/expense release |
| Backdated deposit/group correction | Current group is known, past membership is not supplied | Confirm explicit historical group selection or validated history; do not guess before T16 |
| Admin suspension and last usable admin | Exactly three authorized identities, no invented owner role | Confirm who can suspend/restore another admin and emergency recovery authority before T21 |
| Rejected reapplication and identity relinking | No silent approval/reset of status | Confirm reapplication and email/member change policy; those mutations have no endpoints yet |
| Roster and identities | Exactly 26/10/3 | Private validation inputs and authorization for provisioning before T26 |
| Existing history | Legacy files do not prove production data contents | Confirm whether history exists and approve source mapping/provenance before T26 |
| Hosting and operator | Same origin design; no provider committed | Choose host/domain, operator, budget and SMTP egress before T25 |
| SMTP | Gmail App Password proposed | Confirm eligible sender account, credentials privately configured and delivery tests before T25 |
| Retention/recovery/privacy | No invented legal standard or retention guarantee | Confirm jurisdictional obligations, retention, backup/recovery targets and alert recipient before launch |
| Team capacity | Deadline fixed, available contributors not specified | Allocate tasks and reassess feasibility after T13; no claim that all P0 fits the deadline |

English interface and practical keyboard accessibility remain documented defaults for review, not a claim of formal certification. Targets/budgets, private account sharing and a fourth administrator are not proposed.

## Consequences and rationale

The plan spends time on the first real write path and failure cases before UI breadth. The deadline may force release delay if P0 verification or external dependencies fail; it does not justify real funds on an unverified prototype. (basis: confirmed Tracer Bullet and GA workflow)
