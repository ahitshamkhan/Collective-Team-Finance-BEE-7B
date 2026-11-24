# Scope: Collective Finance Portal MVP

You are replacing the legacy portal with a private bookkeeping application for 26 authorized people, including three FIP Leads. The MVP records externally verified deposits and expenses in one collective fund and gives approved members shared financial transparency.

**Scope date:** 24 November 2026.
**Build approach:** Tracer Bullet (confirmed by you). Prove one real path through the interface, API and database, then extend it with complete working slices.
**Workflow:** GA (confirmed by you). Real application verification, automated tests, independent review and release documentation follow implementation.
**Approval boundary:** You approved this requirements baseline and authorized architecture specification on 24 November 2026. You subsequently approved architecture 0001 after your own review. Scaffolding, installation, implementation and live data changes remain unauthorized until your next instruction.
**Deadline:** 26 November 2026 at 00:00 Asia/Karachi, the end of 25 November, as explicitly clarified by you.
**Priority:** P0 is required before real financial use. P1 is a useful enhancement after P0 and may be deferred to meet the deadline. P2 requires separate scope approval and is outside the initial release.

## Confirmed constraints

The following technologies are your requirements, not new tool selections made during scoping.

| Layer | Confirmed constraint |
|---|---|
| Frontend | Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI modular monolith, Python, Pydantic, synchronous SQLAlchemy ORM and Psycopg, Alembic |
| Database | PostgreSQL |
| Authentication | JWT in secure HttpOnly cookies, CSRF protection, PostgreSQL session revocation, Argon2id, PostgreSQL OTP challenges and rate limits |
| Testing | Pytest and Playwright for critical browser workflows |
| Proposed delivery provider | Gmail SMTP with an App Password, subject to account readiness and delivery verification |
| Prohibited in the replacement | Firebase, Firestore, Redis, Celery and microservices |

Keep the legacy application and ZIP intact. Reuse useful visual design and workflows, not its authentication implementation, expense sharing model or mutable financial history. No production financial totals or private roster data may be embedded in public assets.

## Actors and permissions

| Actor | Allowed access | Restrictions |
|---|---|---|
| Visitor | Login, member registration, verification and recovery entry points | No roster or financial information |
| Unverified applicant | Complete email verification | No authenticated financial access |
| Verified applicant awaiting approval | See own pending status and permitted account workflow | No financial access or self approval |
| Approved regular member (23) | Shared finance summaries, member contributions, group records, complete financial history and own account | All financial access is read only |
| Authorized FIP Lead (3) | All member views, approvals, roster management, deposits, expenses, corrections, suspension and audit history | Identity must match one of the three predefined authorized people; admin login requires OTP |
| Rejected or suspended account | Only explicitly permitted status or recovery actions | No financial access; suspension invalidates existing sessions |

All 26 people, including the three administrators, have individual member records. There are exactly 10 technical groups. The shared collective expense category is not an eleventh member group. No public role selection or ordinary account management action may create a fourth administrator or promote an unauthorized person.

## Functional requirements

| ID | Priority | Confirmed requirement |
|---|---|---|
| FR-01 | P0 | Validate the 26 person roster, the three authorized administrator identities and 10 group mapping before migration. Preserve a unique member record for every person. |
| FR-02 | P0 | Register members using name, email and password. Store an Argon2id password hash. Client supplied roles never grant privileges. |
| FR-03 | P0 | Verify registration email with a cryptographically generated six digit OTP, five minute expiry, at most five verification attempts, a 60 second resend cooldown and single use consumption. Store only a keyed hash; apply backend rate limits. |
| FR-04 | P0 | Move verified applicants to pending approval. An administrator approves or rejects them. Approval requires a valid, unique member link. Concurrent approvals cannot link two accounts to the same member. |
| FR-05 | P0 | Permit approved, active regular members to log in. For admin login, validate credentials and authorized identity, then verify email OTP before issuing a privileged session. |
| FR-06 | P0 | Support password recovery, logout, session expiration, session revocation and account suspension. Recovery must not bypass administrator OTP or restore suspended access. |
| FR-07 | P0 | Enforce authorization on every protected backend operation. Regular members cannot write financial or administrative data, even through direct API requests. |
| FR-08 | P0 | Record deposits with selected member, PKR amount, payment date and description. Generate transaction ID, recording administrator, creation timestamp, status and historical group attribution on the server. |
| FR-09 | P0 | Show who deposited, amount, payment date, administrator who accepted and recorded it, description, individual contribution totals and complete deposit history. |
| FR-10 | P0 | Record expenses with title, PKR amount, expense date, group or collective category, description and optional associated member. Generate recording administrator, creation timestamp and status on the server. |
| FR-11 | P0 | Calculate one collective fund and deposit based individual contributions using the confirmed business rules below. Expense association with a member never deducts from that member's contribution. |
| FR-12 | P0 | Correct transactions through voiding or reversal and replacement. Preserve original records, correction relationships and attribution. No destructive financial deletion. |
| FR-13 | P0 | Audit sensitive modifications, including financial writes and corrections, approvals, rejections, member links, member changes, group changes and account suspension. Capture actor, operation, record, timestamp and relevant previous and updated values. |
| FR-14 | P0 | Provide collective overview, members, individual records, groups, group expenditure, ledger and personal account views to approved users. |
| FR-15 | P0 | Provide administrators with summaries, registration approvals, roster and group assignment management, deposit management, expense management and audit history. |
| FR-16 | P0 | Provide useful search and filtering and access to complete histories. Clearly label filtered results versus collective totals; filters never alter authoritative totals. Exact filter sets are proposed below. |
| FR-17 | P0 | Preserve historical group attribution when current group membership changes. Validate referenced members and groups for every financial write. |
| FR-18 | P0 | Preserve useful legacy visual hierarchy, dark teal navigation, cards, tables and responsive layouts through maintainable components. Every required view must remain reachable on mobile. |
| FR-19 | P1 | Add richer combinations of filters and sorting beyond the P0 search and filter baseline if time permits. This is a proposed enhancement, not a reason to defer basic search. |
| FR-20 | P2 | Consider Projects only after separate financial requirements are confirmed. No project budgets or targets are included now. |

## Business and calculation rules

| ID | Confirmed rule |
|---|---|
| BR-01 | One collective fund receives all active deposits and pays all active expenses. |
| BR-02 | Total deposits = sum of active deposit amounts. |
| BR-03 | Total expenses = sum of active expense amounts. |
| BR-04 | Collective remaining balance = total deposits minus total expenses. |
| BR-05 | Individual contribution = sum of active deposits for that member, including administrators. |
| BR-06 | Group contribution = sum of active deposits with that historical group attribution. |
| BR-07 | Group expenditure = sum of active expenses attributed to that group. Collective category expenditure is shown separately and counted once in collective expenses. |
| BR-08 | No equal expense division, individual expense allocation or automatic reduction of individual contributions. |
| BR-09 | An associated expense member is contextual information only. It does not create a debt, reimbursement entitlement or allocation. |
| BR-10 | Do not invent contribution targets, individual outstanding balances or group budgets. Those values are absent unless explicitly defined and approved later. |
| BR-11 | Current roster changes never silently rewrite historical attribution. An explicit historical correction follows the financial correction and audit workflow. |
| BR-12 | Use PostgreSQL NUMERIC and Python Decimal, confirmed in your architecture request. Never use floating point for authoritative money. |
| BR-13 | Only active economic effects contribute to totals. Use voiding and replacement with mandatory reasons, confirmed in your architecture request. Never count both the original and replacement. |
| BR-14 | The backend supplies financial IDs, administrator attribution, timestamps and controlled statuses. Browser supplied values cannot impersonate another administrator. |

## Authentication workflows

**Member registration:** submit name, email and password → receive verification OTP → verify → pending approval → administrator reviews and uniquely links the roster member → approve or reject → approved active member can log in. Registration and pending status never grant finance access.

**Administrator login:** enter email and password → validate credentials and predefined administrator identity → issue an OTP challenge with no privileged session → verify OTP → establish the admin session. Failed, expired, exhausted or reused challenges cannot create that session.

**OTP lifecycle:** bind the challenge to its account and purpose, enforce expiry, attempt count and cooldown in the backend, consume it once and prevent concurrent reuse. Purpose binding and invalidating the previous code on resend are proposed security defaults for architecture approval. Neither logs nor API responses expose codes, keyed hashes or credentials.

**Recovery and sessions:** request recovery → prove control through a secure email recovery flow → set a new password → return to the applicable login process. Secure HttpOnly JWT cookies, CSRF and PostgreSQL session revocation are confirmed. The approved architecture specifies recovery challenges, lifetimes and revoking all sessions after recovery; those technical details are now ratified. Suspension blocks access and revokes sessions. Logout invalidates the session being used.

## Deposit and expense workflows

**Deposit:** a member transfers money externally → an FIP Lead verifies receipt externally → that administrator selects the member and records the amount, date and description → the backend validates and commits the transaction and audit event atomically → the record appears in shared history and contribution totals. Your architecture request confirms the authenticated administrator as the accepting and recording administrator; a separate actor selector is not included.

**Expense:** evidence is shared outside the portal → an administrator verifies it → the administrator records the expense fields → the backend validates and commits the expense and audit event atomically → collective balance and relevant group expenditure update. Individual contributions stay unchanged. No evidence upload or bank integration is involved.

**Correction:** an administrator identifies an incorrect record → supplies a mandatory reason → the backend preserves the original, voids it and records any replacement and audit event atomically → histories show the relationship and totals count the intended economic effect once. Voiding and replacement with mandatory reasons is confirmed.

## Nonfunctional requirements

| ID | Priority | Requirement and verification boundary |
|---|---|---|
| NFR-01 | P0 | Backend authentication and role authorization protect every private read and write. JWT signatures, expiration and revocation are enforced. Argon2id protects passwords. |
| NFR-02 | P0 | If JWT sessions use cookies, use Secure HttpOnly cookies and CSRF protection for state changing requests. Restrict CORS to approved origins. Transport and topology remain undecided. |
| NFR-03 | P0 | Validate inputs with backend schemas, use parameterized database operations and enforce database constraints. Invalid references, duplicate member links and invalid monetary precision are rejected. |
| NFR-04 | P0 | Financial mutations and their audit records are atomic. Duplicate and concurrent submissions cannot create duplicate financial effects. Concurrent corrections cannot apply twice. |
| NFR-05 | P0 | Audit history is append only through application permissions. Ordinary application actions cannot edit or delete audit records. This does not claim protection from a privileged database operator. |
| NFR-06 | P0 | Use environment based secrets. Public responses, static files and client bundles expose no private roster, account information, password hashes, OTP hashes, JWT secrets or SMTP credentials. Approved finance views disclose only the intended shared fields. |
| NFR-07 | P0 | Backend OTP and authentication abuse controls work without Redis or Celery and remain effective across application workers and restarts. Thresholds beyond the specified OTP limits require a spec. |
| NFR-08 | P0 | Pytest covers accounting, authorization, OTP, sessions, constraints and transaction integrity. Playwright proves critical registration, admin login, approvals, finance and revocation journeys. |
| NFR-09 | P0 | Provide responsive layouts, clear errors, empty states and safe retry behavior. Proposed accessibility baseline: keyboard operation, associated labels, visible focus and correctly managed dialogs. No accessibility certification is claimed. |
| NFR-10 | P0 | Proposed release baseline: HTTPS, separated test and production secrets/data, repeatable migrations, backup and restore verification, operational error visibility with secret redaction and a rollback procedure. Hosting and recovery targets remain unresolved. |
| NFR-11 | P0 | Scope is sized for 26 authorized people. Complete histories must remain navigable as transaction volume grows. Pagination, expected history volume and measurable performance thresholds require architecture input. |

## Required application pages

These are required surfaces, not a finalized URL map. Authentication and authorization apply to both pages and their APIs.

| Surface | Audience | Minimum scope |
|---|---|---|
| Login | Visitor | Member credentials and administrator credentials followed by OTP |
| Member registration | Visitor | Name, email, password and verification entry |
| OTP verification | Challenged user | Code input, expiry feedback and controlled resend |
| Pending approval | Verified applicant | Own status, refresh and exit; no private roster |
| Password recovery | Account holder | Request and secure completion surfaces |
| Finance overview | Approved members and admins | Collective deposits, expenses and remaining balance |
| Members | Approved members and admins | Contributions, search and individual detail/history |
| Groups | Approved members and admins | Group contributions, expenditure and relevant history |
| Transaction ledger | Approved members and admins | Deposits and expenses, statuses, attribution and filters |
| My account | Account holder within allowed state | Own information, password/session actions and logout |
| Admin dashboard | Authorized admins | Collective summaries and management navigation |
| Registration approvals | Authorized admins | Review, approve/reject and unique member linking |
| Deposit management | Authorized admins | Record and correct deposits; complete history |
| Expense management | Authorized admins | Record and correct expenses; complete history |
| Audit history | Authorized admins | Sensitive modifications and relevant before/after values |

Member detail and group detail can be accessible subviews instead of separate top level navigation entries. Projects is not part of this required page set.

## Acceptance criteria

All examples use synthetic test data. No test may mutate live accounts or financial records.

| ID | Priority | Observable acceptance criterion | Requirements |
|---|---|---|---|
| AC-01 | P0 | The validated dataset has 26 distinct people, 10 groups and only the three authorized admin identities. All admins also have member records. Legacy chassis entries have an approved mapping. | FR-01, BR-07 |
| AC-02 | P0 | Registration cannot submit itself into an approved or admin state. Email verification alone grants no finance access. Approval of an unverified account fails. | FR-02–04, FR-07 |
| AC-03 | P0 | OTP expiry, fifth failed attempt, early resend and replay are rejected. Simultaneous verification cannot consume one challenge twice. Codes and credentials are absent from logs/responses. | FR-03, NFR-07 |
| AC-04 | P0 | Correct admin credentials without completed OTP cannot access any privileged endpoint. A nonauthorized identity cannot obtain admin privileges by changing request fields. | FR-05, FR-07 |
| AC-05 | P0 | Duplicate and concurrent member linking attempts fail without partial approval. Rejected, pending and suspended accounts cannot read finance data. | FR-04, FR-07 |
| AC-06 | P0 | Expired/revoked sessions and sessions belonging to suspended accounts fail on protected requests. Logout removes private interface state. Recovery does not bypass approval, suspension or admin OTP. | FR-06 |
| AC-07 | P0 | A member can read permitted shared records but direct API attempts to record, correct, approve or alter roles fail. Anonymous requests receive no private roster or finance data. | FR-07, FR-14–15, NFR-06 |
| AC-08 | P0 | Record deposits of PKR 1,000.00 and PKR 500.00 for two members, then an expense of PKR 600.00. Totals are 1,500.00 deposits, 600.00 expenses and 900.00 collective balance. Individual contributions stay 1,000.00 and 500.00. | FR-08–11, BR-02–09 |
| AC-09 | P0 | PKR 0.10 plus PKR 0.20 equals exactly PKR 0.30. Invalid precision and invalid references are rejected without partial records. Repeated submission produces one financial effect. | NFR-03–04, BR-12 |
| AC-10 | P0 | Moving a member from Group A to Group B leaves prior deposits attributed to A. Future deposits use the applicable group attribution. A collective category expense appears once in overall expenses and separately from technical group expenditure. | FR-17, BR-06–07, BR-11 |
| AC-11 | P0 | A correction preserves the original, records actor and reason, links the replacement if applicable and updates totals once. Concurrent corrections do not double reverse a record. | FR-12–13, NFR-04–05 |
| AC-12 | P0 | Every sensitive successful mutation has an audit record with relevant before/after values. A failed mutation does not leave a partial financial result. Audit history cannot be edited through the application. | FR-13, NFR-04–05 |
| AC-13 | P0 | All required pages are reachable on desktop and mobile. Search and filters return correct data, retain access to full history and distinguish filtered totals from collective totals. No page shows invented balances, targets or budgets. | FR-14–18, BR-10 |
| AC-14 | P0 | Tests and independent review cover the P0 requirements; deployment rehearsal verifies migrations, email delivery, secure sessions and recovery procedures before real use. | NFR-01–11 |
| AC-15 | P1 | Any approved richer filters/sorting preserve authorization, stable results and exact summary semantics. | FR-19 |

## Prioritized implementation backlog

You approved [architecture 0001](../specs/0001-portal-architecture/index.md) on 24 November 2026 after your own review. Covered features are now in-progress for design only, with no implementation completed or authorized. Explicitly unresolved policies remain gates on their affected tasks. Feature 2 still needs the context audit after scaffolding; P1 feature 12 remains undesigned. The milestones below roll up the atomic tasks in the delivery contract.

### Approved architecture coverage

| Scope features | Ratified technical contract | Execution tasks |
|---|---|---|
| 1, 2 | [Foundation and delivery](../specs/0001-portal-architecture/index.md) | T01, T02, then context audit |
| 3 | [Data contract](../specs/0001-portal-architecture/0001-data.md) | T03, T04 |
| 4 | [Interface contract](../specs/0001-portal-architecture/0001-interface.md) | T02, reused in later slices |
| 5 | [Identity contract](../specs/0001-portal-architecture/0001-identity.md) | T05 through T09 |
| 6 | [Finance contract](../specs/0001-portal-architecture/0001-finance.md) | T10 through T13 |
| 7, 8 | [Finance extensions](../specs/0001-portal-architecture/0001-finance.md) | T14 through T18 |
| 9 | [Shared interface](../specs/0001-portal-architecture/0001-interface.md) | T19, T20 |
| 10 | [Account lifecycle](../specs/0001-portal-architecture/0001-identity.md) | T21, T22 |
| 11 | [Delivery and release](../specs/0001-portal-architecture/0001-delivery.md) | T23 through T26 |

### At a glance

| # | Feature | Phase | Status |
|---|---|---|---|
| L | Legacy visual reference | Retained context | existing |
| 1 | Replacement application foundation | Foundation, P0 | in-progress |
| 2 | Coding conventions and verification tooling | Foundation, P0 | planned |
| 3 | Roster and financial data contract | Foundation, P0 | in-progress |
| 4 | Reusable finance interface foundation | Foundation, P0 | in-progress |
| 5 | Registration, OTP, approvals and authenticated access | Slice 1, P0 | in-progress |
| 6 | Verified deposit through shared overview | Slice 1, P0 | in-progress |
| 7 | Expense recording and collective totals | Slice 2, P0 | in-progress |
| 8 | Corrections and financial audit history | Slice 3, P0 | in-progress |
| 9 | Member, group and ledger transparency | Slice 4, P0 | in-progress |
| 10 | Account lifecycle and roster administration | Slice 5, P0 | in-progress |
| 11 | Migration and release readiness | Release, P0 | in-progress |
| 12 | Richer filtering and sorting | Follow up, P1 | planned |

### L. Legacy visual reference · existing

Retain the existing dark teal sidebar, visual hierarchy, cards and responsive table/card patterns as design input. This status describes existing design material, not completion of the replacement product.

Code area: `BEE-7B-Collective-Team-Finance-Private-Login-Fix/site/styles.css` and the rendering functions in `site/app.js` in that same legacy directory. Existing Firebase workflows are partial and unsuitable as proof that replacement features are complete. No legacy implementation work is queued.

### Foundation

#### 1. Replacement application foundation · in-progress

Define a minimal runnable replacement using your confirmed stack. The legacy foundation cannot serve the new runtime, so this migration needs a new foundation without overwriting the old application.

**Done when:** an approved architecture establishes application boundaries, deployment topology, configuration and a runnable skeleton with no live data mutation.

- [x] Decide the foundation (spec): `/architect replacement application foundation`

Spec: [0001](../specs/0001-portal-architecture/index.md). Technical design approved; unresolved policy gates remain as documented.

- [ ] Build it: `/develop replacement application foundation`
  - [ ] Runnable frontend/backend and safe configuration (T01; AR-01, AR-07, AC-14).
  - [ ] Same origin routing, health/errors and initial shell (T02; AR-01, AR-05, AC-13).
- [ ] Verify it: `/check verify replacement application foundation`
- [ ] Test it: `/test replacement application foundation`
- [ ] Review it (fresh model): `/check review replacement application foundation`
- [ ] Document it: `/document release-note replacement application foundation`

#### 2. Coding conventions and verification tooling · planned

Capture conventions for the real replacement scaffold, test execution and secrets handling after foundation approval and scaffolding.

**Done when:** durable context and repeatable quality checks describe the actual replacement structure and required GA verification workflow.

- [ ] Capture conventions: `/audit`

#### 3. Roster and financial data contract · in-progress

Define accounts, member identity, groups, historical attribution, transactions and audit constraints. Keep secure OTP/session storage decisions distinct from financial semantics during spec capture.

**Done when:** approved contracts support FR-01, FR-04 and FR-08–13 with exact money, atomic writes, duplicate protection and no expense sharing.

- [x] Design the data contract (spec): `/architect roster and financial data contract`

Spec: [0001](../specs/0001-portal-architecture/0001-data.md). Technical design approved; unresolved policy gates remain as documented.

- [ ] Build it: `/develop roster and financial data contract`
  - [ ] First slice schema, constraints and migrations (T03; AR-03, AR-06, AC-01, AC-05, AC-09).
  - [ ] Validated roster and fixed administrator provisioning (T04; AR-06, AC-01, AC-12).
- [ ] Verify it: `/check verify roster and financial data contract`
- [ ] Test it: `/test roster and financial data contract`
- [ ] Review it (fresh model): `/check review roster and financial data contract`
- [ ] Document it: `/document release-note roster and financial data contract`

#### 4. Reusable finance interface foundation · in-progress

Translate useful legacy patterns into maintainable components, accessible forms and responsive navigation without public roster data.

**Done when:** the visual contract covers the required surfaces and shared loading, error, empty, table and dialog states, including mobile access.

- [x] Design the interface foundation (spec): `/architect reusable finance interface foundation`

Spec: [0001](../specs/0001-portal-architecture/0001-interface.md). Technical design approved; unresolved policy gates remain as documented.

- [ ] Build it: `/develop reusable finance interface foundation`
  - [ ] Shared teal shell and safe public rendering (T02; AR-01, AR-05, AC-13).
  - [ ] Reusable accessible forms, tables and navigation integrated with slices (T09, T12, T20; AC-13).
- [ ] Verify it: `/check verify reusable finance interface foundation`
- [ ] Test it: `/test reusable finance interface foundation`
- [ ] Review it (fresh model): `/check review reusable finance interface foundation`
- [ ] Document it: `/document release-note reusable finance interface foundation`

### Slice 1: First complete financial path

#### 5. Registration, OTP, approvals and authenticated access · in-progress

Establish real member and admin access, secure session enforcement and uniquely linked approvals. This is a prerequisite for the deposit path, not a standalone demonstration with fake authentication.

**Done when:** AC-02–07 pass for the access paths, including suspension/revocation enforcement primitives; identity and OTP rules cannot be bypassed.

- [x] Design authenticated access (spec): `/architect registration OTP approvals and authenticated access`

Spec: [0001](../specs/0001-portal-architecture/0001-identity.md). Technical design approved; unresolved policy gates remain as documented.

- [ ] Build it: `/develop registration OTP approvals and authenticated access`
  - [ ] Permission/session/CSRF and persisted OTP limits (T05, T06; AC-03, AC-04, AC-06, AC-07).
  - [ ] Admin OTP, registration and unique approvals (T07, T08; AR-02, AC-02, AC-05, AC-12).
  - [ ] Real authentication and approval interfaces (T09; AR-02, AR-05, AC-02 through AC-07).
- [ ] Verify it: `/check verify registration OTP approvals and authenticated access`
- [ ] Test it: `/test registration OTP approvals and authenticated access`
- [ ] Review it (fresh model): `/check review registration OTP approvals and authenticated access`
- [ ] Document it: `/document release-note registration OTP approvals and authenticated access`

#### 6. Verified deposit through shared overview · in-progress

An OTP authenticated FIP Lead records a verified deposit, and an approved member sees its persisted contribution and collective total. Include audit creation in this first write path.

**Done when:** the real interface, API and database prove FR-08–09, deposit calculations, atomic audit logging, authorization and duplicate protection with no placeholder financial data.

- [x] Design the deposit path (spec): `/architect verified deposit through shared overview`

Spec: [0001](../specs/0001-portal-architecture/0001-finance.md). Technical design approved; unresolved policy gates remain as documented.

- [ ] Build it: `/develop verified deposit through shared overview`
  - [ ] Atomic deposit, audit and duplicate receipt (T10; AC-08 through AC-12).
  - [ ] Real summary/ledger and browser deposit path (T11, T12; AR-02, AR-05, AC-13).
  - [ ] First slice race, rollback and permission verification (T13; AR-03, AR-04, AC-03, AC-06, AC-07, AC-09, AC-12).
- [ ] Verify it: `/check verify verified deposit through shared overview`
- [ ] Test it: `/test verified deposit through shared overview`
- [ ] Review it (fresh model): `/check review verified deposit through shared overview`
- [ ] Document it: `/document release-note verified deposit through shared overview`

### Slice 2: Collective expenses

#### 7. Expense recording and collective totals · in-progress

Record group or collective expenses and show their effect on the shared fund without altering individual contributions.

**Done when:** FR-10–11 and AC-08–10 pass, including optional member context with no financial allocation.

- [x] Design collective expenses (spec): `/architect expense recording and collective totals`

Spec: [0001](../specs/0001-portal-architecture/0001-finance.md). Technical design approved; unresolved policy gates remain as documented.

- [ ] Build it: `/develop expense recording and collective totals`
  - [ ] Expense validation and atomic persistence after policy resolution (T14; AC-08 through AC-10).
  - [ ] Expense interface and collective/group calculations (T15; AC-08, AC-10, AC-13).
- [ ] Verify it: `/check verify expense recording and collective totals`
- [ ] Test it: `/test expense recording and collective totals`
- [ ] Review it (fresh model): `/check review expense recording and collective totals`
- [ ] Document it: `/document release-note expense recording and collective totals`

### Slice 3: Financial corrections

#### 8. Corrections and financial audit history · in-progress

Expose safe correction workflows and administrator audit history. Audit capture already exists on earlier sensitive writes; this slice adds correction behavior and complete history browsing.

**Done when:** AC-11–12 pass and every affected original, correction and replacement remains traceable.

- [x] Design corrections (spec): `/architect corrections and financial audit history`

Spec: [0001](../specs/0001-portal-architecture/0001-finance.md). Technical design approved; unresolved policy gates remain as documented.

- [ ] Build it: `/develop corrections and financial audit history`
  - [ ] Immutable facts and safe void/replacement after attribution decision (T16; AR-04, AC-11, AC-12).
  - [ ] Correction interface and preserved history (T17; AC-11, AC-13).
  - [ ] Audit projections and permissions (T18; AC-07, AC-12).
- [ ] Verify it: `/check verify corrections and financial audit history`
- [ ] Test it: `/test corrections and financial audit history`
- [ ] Review it (fresh model): `/check review corrections and financial audit history`
- [ ] Document it: `/document release-note corrections and financial audit history`

### Slice 4: Shared transparency

#### 9. Member, group and ledger transparency · in-progress

Complete member details, group records, ledger history and useful search/filtering on the working financial path.

**Done when:** FR-09, FR-14, FR-16–18 and AC-13 pass for approved members and admins with clear status and attribution.

- [x] Design shared finance views (spec): `/architect member group and ledger transparency`

Spec: [0001](../specs/0001-portal-architecture/0001-interface.md). Technical design approved; unresolved policy gates remain as documented.

- [ ] Build it: `/develop member group and ledger transparency`
  - [ ] Member/group history and P0 filters (T19; AC-10, AC-13).
  - [ ] Responsive shared views and audit navigation (T20; AR-05, AC-07, AC-13).
- [ ] Verify it: `/check verify member group and ledger transparency`
- [ ] Test it: `/test member group and ledger transparency`
- [ ] Review it (fresh model): `/check review member group and ledger transparency`
- [ ] Document it: `/document release-note member group and ledger transparency`

### Slice 5: Account and roster lifecycle

#### 10. Account lifecycle and roster administration · in-progress

Complete recovery, My account, suspension controls and audited member/group editing on top of the access primitives established in Slice 1.

**Done when:** FR-06, FR-15, FR-17 and AC-06, AC-10, AC-12 pass through the real management interfaces.

- [x] Design account lifecycle (spec): `/architect account lifecycle and roster administration`

Spec: [0001](../specs/0001-portal-architecture/0001-identity.md). Technical design approved; unresolved policy gates remain as documented.

- [ ] Build it: `/develop account lifecycle and roster administration`
  - [ ] Recovery, revocation and audited roster lifecycle after policy resolution (T21; AC-06, AC-10, AC-12).
  - [ ] Account and administration interfaces with private state cleanup (T22; AC-06, AC-07, AC-13).
- [ ] Verify it: `/check verify account lifecycle and roster administration`
- [ ] Test it: `/test account lifecycle and roster administration`
- [ ] Review it (fresh model): `/check review account lifecycle and roster administration`
- [ ] Document it: `/document release-note account lifecycle and roster administration`

### Release

#### 11. Migration and release readiness · in-progress

Validate private imports, rehearse deployment and complete GA verification. Resolve the historical transaction migration decision before cutover.

**Done when:** AC-01 and AC-14 pass, all P0 requirements meet the definition of done, and an authorized reviewer accepts reconciliation and release evidence.

- [x] Design release readiness (spec): `/architect migration and release readiness`

Spec: [0001](../specs/0001-portal-architecture/0001-delivery.md). Technical design approved; unresolved policy gates remain as documented.

- [ ] Build it: `/develop migration and release readiness`
  - [ ] Complete automated verification and GA review/documentation (T23, T24; AC-01 through AC-14, AR-01 through AR-07).
  - [ ] Deployment, SMTP and recovery rehearsal (T25; AC-14, AR-07).
  - [ ] Private import reconciliation and separately approved cutover (T26; AC-01, AC-14, AR-06, AR-07).
- [ ] Verify it: `/check verify migration and release readiness`
- [ ] Test it: `/test migration and release readiness`
- [ ] Review it (fresh model): `/check review migration and release readiness`
- [ ] Document it: `/document release-note migration and release readiness`

### Follow up

#### 12. Richer filtering and sorting · planned · needs a decision

Extend the useful P0 filters only if the deadline allows and real usage warrants it.

**Done when:** approved filter refinements satisfy AC-15 without expanding access or changing totals.

- [ ] Design filter refinements (spec): `/architect richer filtering and sorting`

## Exclusions and deferred work

Excluded from the initial MVP: payment gateways, banking APIs, equal expense splitting, individual expense allocation, receipt uploads, AI predictions, forecasting, microservices, Redis, Celery and unconfirmed project budgets. Firebase and Firestore are excluded from the replacement, while the legacy package stays intact.

**P2 deferred candidate:** Projects, only after explicit requirements and approval. This is not a committed backlog feature or permission to add budgets. No subscriptions, public marketing site, public API or product analytics feature is included in the supplied requirements.

## Proposed defaults and unresolved decisions

These are not silently confirmed requirements. They can be settled during scope approval or the relevant architecture discussion. None blocks creating this scope document.

| ID | Decision or missing input | Proposed default or next decision | Blocks |
|---|---|---|---|
| D-01 | Deadline confirmed, contributors and budget unknown | 26 November 2026 at 00:00 PKT; no feasibility or effort promise | Staffing and scheduling commitment |
| D-02 | Verified roster, group mapping and three administrator identities | Privately validate all 26 records; do not infer identities from legacy leadership flags | Production provisioning and imports |
| D-03 | Legacy chassis category | Treat as collective expense category, subject to mapping validation; never create an eleventh member group | Migration acceptance |
| D-04 | Existing live transactions to migrate | Confirm whether historical records exist and define cutover/reconciliation. Never import legacy expense shares or trust derived legacy balances | Migration and launch |
| D-05 | Hosting, domain, budget and operator | Not selected; approve a deployment topology for the supplied stack | Deployment specification |
| D-06 | Gmail SMTP readiness | Proposed initial provider only; confirm sender ownership, App Password availability, permitted use and OTP delivery in the target environment | Email integration and launch |
| D-07 | Session transport and revocation confirmed | HttpOnly cookie JWT, CSRF and PostgreSQL revocation selected; lifetimes and protocol ratified in architecture 0001 | Resolved technical design |
| D-08 | Recovery mechanism and OTP delivery failure behavior | Propose purpose bound email recovery, resend invalidation and revoking all sessions after reset; decide retry and user feedback without background infrastructure expansion | Recovery implementation |
| D-09 | Admin provisioning confirmed; emergency authority unresolved | Secure CLI provisioning of exactly three fixed identities; no public promotion flow. All admins locked out recovery authority remains to be confirmed | Bootstrap inputs and operational readiness |
| D-10 | Suspension of admins and protection from total admin lockout | Confirm who may suspend another FIP Lead and how the last usable admin is protected; do not invent an owner role | Account management specification |
| D-11 | Representation confirmed; business limits unresolved | PostgreSQL NUMERIC and Python Decimal selected. Architecture defines technical precision/ceiling; lower business cap and permitted dates still require confirmation | Financial policy confirmation |
| D-12 | Spending beyond available funds | Undecided whether to block, warn or allow a negative collective balance; never clamp or hide it | Expense acceptance policy |
| D-13 | Correction method confirmed | Void and replacement with mandatory reasons; historical correction attribution policy still unresolved | Historical attribution policy |
| D-14 | Accepting administrator confirmed | Authenticated accepting/recording administrator, no client supplied alternate actor | Resolved for MVP |
| D-15 | Currency and dates confirmed; language default | PKR, Asia/Karachi business dates and UTC timestamps confirmed. English UI remains the documented default | Interface review |
| D-16 | Basic filters | Propose member name/group search and ledger type, member, group, date and status filters. Richer combinations stay P1 | View acceptance details |
| D-17 | Accessibility, performance, retention and recovery targets | Propose keyboard usable forms and dialogs; confirm response targets, expected history volume, retention, backup frequency and acceptable recovery loss/time | Release acceptance thresholds |
| D-18 | Legal/privacy obligations and account data visibility | Shared finance visibility is confirmed; other members' emails/contact details are not part of it. Confirm jurisdictional obligations and retention with the responsible operator | Production privacy review |
| D-19 | Rejected applicant resubmission and account identity changes | Decide whether/how rejected applicants may reapply and who may change email or member links after approval | Lifecycle edge cases |

## Dependencies and deployment prerequisites

1. Scope is approved and architecture specification is authorized. Architecture 0001 is approved; wait for your development instruction before any implementation starts.
2. Private, validated roster and administrator identity inputs, plus approved mapping from 11 legacy categories to 10 groups and collective expenses.
3. An approved architecture covering application topology, session management, OTP persistence/rate limits, money representation and audit/correction contracts.
4. Provisioned application hosting, PostgreSQL, HTTPS domain/origins and environment secret delivery. Credentials belong in secret configuration, never this document.
5. A usable email sender with tested OTP and recovery delivery, failure handling and clock synchronization for expiry.
6. Separate test data/accounts and a migration rehearsal that does not alter live records. If history is imported, reconcile active totals and preserve provenance before cutover.
7. Repeatable schema migration, deployment, backup, restore and rollback procedures, with an identified operator.

## Definition of done

The MVP is ready for release only when all P0 requirements and acceptance criteria are met, all required pages work on desktop and mobile, and remaining decisions affecting those requirements have been resolved explicitly.

Pytest and Playwright prove the critical flows, exact accounting, direct API authorization, OTP edge cases, session revocation and concurrency protection. GA verification includes the real application, independent review and release documentation. No unresolved high impact authorization, privacy, accounting or data loss defect remains.

The production roster and allowed administrators are validated; financial totals reconcile; no automatic expense sharing, invented budgets, public private data or hardcoded financial totals remain. Email and deployment checks pass in the target environment. Recovery and rollback have been rehearsed. No real financial record or account is changed without separate authorization for migration or release.

P1 may be deferred explicitly. P2 and exclusions do not block MVP completion. Schedule pressure does not convert an unverified P0 security or accounting requirement into a completed feature.

## Legend and handoff

`existing` denotes retained legacy material only. `planned` means replacement work has not begun. Later pipeline statuses are `in-progress` and `done`, supported by specs, code and verification evidence.

A `needs a decision` tag means architecture must resolve the feature contract. Each undesigned feature has one future entry command. The architecture step can split distinct decisions into separate specs and add build/verify/test/review milestones here; atomic implementation tasks belong in the specs, not this scope.

No root AGENTS.md currently exists. After permission to proceed and foundation scaffolding, the planned audit establishes durable context for the replacement. The earlier read only audit remains the legacy baseline; it did not authorize context file writes.

**Recommended next step when you authorize development:** the first development command is `/develop replacement application foundation`, bounded to T01 and T02 before the context audit and remaining first slice work. No development has started.
