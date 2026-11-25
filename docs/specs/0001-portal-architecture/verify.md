# Verification contract

Use synthetic identities, test SMTP accounts and a separate PostgreSQL database. Never run these scenarios against live records. Scope AC identifiers are the authoritative acceptance requirements; AR identifiers refine architecture behavior.

| Area | Required evidence | Coverage |
|---|---|---|
| Roster and permissions | Reject 25/27 people, 9/11 groups, duplicate member links, a fourth admin slot and reserved admin identity mismatch. Verify CLI dry run makes no changes. | AC-01, AC-05, AR-06 |
| OTP | Leading zero codes, exact expiry boundary, wrong code attempts persisting, fifth failure lockout, resend under 60 seconds, resend preserving attempts, old code invalidation, wrong purpose/browser, concurrent consume, SMTP failure and restart. | AC-02 through AC-04, AR-03 |
| Login and cookies | No privileged session before admin OTP; signature/algorithm/issuer/audience/expiry validation; malformed tokens; Secure/HttpOnly/Path/SameSite; no localStorage tokens; cross origin and missing/forged CSRF rejected on every write. | AC-04, AC-06, AC-07, AR-01 |
| Sessions and lifecycle | Logout, logout all, reset, password change and suspension deny existing sessions; recovery cannot approve/unsuspend; status session cannot read roster; old password verification cannot race a reset into a session. | AC-02, AC-05 through AC-07, AR-04 |
| Financial arithmetic | Scope 1000 + 500 deposit, 600 expense example; 0.10 + 0.20; nonfinite/float/exponent/excess precision rejection; active/void aggregation; no member expense subtraction. | AC-08, AC-09 |
| Attribution | Client actor override rejected, server actor snapshot correct, group change leaves prior group totals unchanged, collective expense counted once, optional member expense has no contribution effect. | AC-07, AC-10, AR-05 |
| Atomicity and duplicates | Parallel identical keys create one result/audit; different body same key 409; disconnect after commit replays; forced audit insertion failure rolls back; concurrent void/replace only one succeeds. | AC-09, AC-11, AC-12, AR-04 |
| Mutation races | Write versus suspension/logout/password reset, member group edit versus deposit, parallel approvals; verify serialized authorization and attribution or explicit conflict, never partial state. | AC-05, AC-06, AC-10, AR-04 |
| Private data | Inspect anonymous HTML/static bundles/source maps and API responses; no real roster or secrets. Members see shared finance fields but no other users' emails, hashes, challenge state or admin audits. | AC-07, AR-05 |
| Database permissions | Runtime cannot alter schema, insert/delete roster, write admin slots, edit financial fact fields or update/delete audits; direct invalid records fail constraints. | AC-01, AC-09, AC-11, AC-12 |
| Browser first slice | Real admin credentials/OTP → pending verified member approval → deposit → second browser member login → real transaction and updated collective totals. | AR-02, AC-02 through AC-09 |
| Browser breadth | Expenses, correction reason, history linkage, filters/pagination, account recovery and admin audit; required routes reachable at 390px and desktop widths; keyboard dialogs/forms; private modals cleared on auth loss. | AC-06, AC-10 through AC-13 |
| Release | Fresh Prisma Migrate deploy, backup restoration, production cookie/Origin/proxy tests, Gmail test delivery, health/log redaction and rollback rehearsal; independent review and release documentation. | AC-14, AR-07 |

Vitest runs service tests plus integration/concurrency tests on actual PostgreSQL with separate connections. SQLite is not an acceptable substitute for locks, NUMERIC or constraints. Inject a clock for unit expiry tests, and test database timestamp boundaries in integration. Inject a Nodemailer test transport for tests; do not expose codes through an HTTP test helper in the production app.

Playwright uses a test mailbox adapter available only inside the test process. It obtains codes through test infrastructure, not logs or user facing API responses. At least one approved SMTP smoke test proves the production delivery path separately. Disable production fixture/import helpers by configuration validation.

GA evidence records commands, environment, pass/fail and remaining blockers. Independent review is performed by a reviewer that did not write the implementation. Release requires zero unresolved high impact auth, privacy, money or data loss defects. No estimated coverage percentage substitutes for these acceptance scenarios.


## UI verification, 25 November 2026

### Scope and verdict

**UI review status: PASS for the explicitly authorized frontend presentation iteration, with the limitations below. Full MVP and integrated interface verification: BLOCKED by the intentionally unimplemented backend.**

This run used the installed JS Mastery check skill in verify mode. A separate fresh reviewer independently inspected the implementation without writing it. Confirmed defects were reproduced and fixed through the debug workflow. Intercepted API responses in browser tests are synthetic test infrastructure, not runtime authentication or persistence. No backend, database, real account or real financial record was created or changed.

The original verification requirements above are preserved. No original requirement, scope Verify it box, GA review box or release milestone was marked complete. Architecture status remains In Progress. This UI assessment does not approve real financial use.

### Findings and fixes

| Finding | Severity | Reproduction and root cause | Fix and evidence |
| --- | --- | --- | --- |
| Definitive rejection locked a financial form | P2 | Return 422 to a deposit, edit the amount and resubmit. Only one request was sent because every failure retained the old payload lock. | Initial definitive rejection now permits editing with a new key. A prior uncertain result continues to retain its key. financial-forms.tsx, regression tests below. |
| Correction key lost on dialog dismissal | P2 | Return 503 to a void request, close/reopen the dialog, retry the same reason. Before the fix the two UUID keys differed. | Per workspace registry retains keys by transaction and operation across dialog dismissal. In flight correction dialogs cannot close or switch methods. workspace-view.tsx and financial-forms.tsx. |
| Later CSRF rejection erased prior uncertainty | P2 | Financial request returns 503, retry CSRF returns 403, then edit and retry. The later rejection cannot prove the earlier write did not commit. | An uncertainty flag persists until successful replay; later 4xx cannot clear an already uncertain attempt. New regression passed in development and production. |
| CSRF 401 left private modal mounted | P1 | Open a correction, return 401 from /auth/csrf, submit. The browser remained on the ledger with the private modal. | api.ts now dispatches the same session cleanup event for a CSRF 401 as for a business endpoint 401. Regression proves redirect to login and modal removal. |
| Incomplete financial input validation | P2 | Whitespace description reached the request boundary; amounts above the NUMERIC(14,2) ceiling were accepted by the UI. | Reject blank trimmed description/expense title and amounts above PKR 999,999,999,999.99 using string checks. No business cap was invented. Server validation remains mandatory. |
| Detail filter label contradicted returned history | P2 | On member 01 detail, select member 02. Selected ID changed but two member 01 rows remained because the route correctly overrode the query. | Member and group detail filters now show the fixed route context and cannot be changed. Clear filters retains that context. transaction-filters.tsx and workspace-view.tsx. |

Four original reproductions failed before the fixes and passed afterward. The uncertainty and detail context cases were also added as regression tests. Evidence before fixes is under frontend/test-results/review-before/. All six regression cases are in frontend/tests/ui/review-regressions.spec.ts.

### Commands and observed results

All commands ran from frontend on Windows with Node 24.13.0 and headless Microsoft Edge. The existing development server at http://127.0.0.1:3000 was exercised. A separate production server was started on port 3102 for this run and stopped afterward.

| Command | Observed result |
| --- | --- |
| npm.cmd run lint | Exit 0, no errors or warnings after fixes |
| npm.cmd run typecheck | Exit 0 |
| npm.cmd run build | Exit 0; all requested pages generated, no build errors |
| npx.cmd playwright test --output test-results/ui-review-final | 16 passed, 1 production only test skipped, 1.9 minutes; this run preceded the final detail context test |
| npx.cmd playwright test review-regressions --grep 'detail filters' --output test-results/review-detail | 1 passed, 15.9 seconds |
| Production: npx.cmd playwright test --output test-results/ui-review-production | 12 passed, 6 development only tests skipped, 18.3 seconds; final rebuilt code, including all six regressions |
| npm.cmd audit --json | Four moderate affected packages, zero high or critical; nonzero audit result is expected while advisories remain |
| npm.cmd audit --omit=dev --json | Same four affected packages, because shadcn is currently classified as a production dependency |
| Production trace inspection | 28 .nft.json manifests inspected; none reference shadcn, ts-morph or @ts-morph/common |
| Source/public credential pattern scan | 57 text source/public files inspected; no matches for the tested private key, Firebase API key, live key or GitHub token patterns |

The browser assertions cover request responsibilities with controlled responses. They do not prove server authorization, persistent OTP, arithmetic, transaction atomicity or real SMTP delivery.

### Reproduce the UI checks

Use separate terminals for servers and tests. Start with npm.cmd run dev in frontend. Do not use live credentials or records.

~~~powershell
$env:PORTAL_TEST_URL = 'http://127.0.0.1:3000'
$env:PORTAL_TEST_PRODUCTION = '0'
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:ui -- --output test-results/ui-review-final
npm.cmd run build
~~~

Start the built app in another terminal with npm.cmd run start -- --port 3102 --hostname 127.0.0.1, then run:

~~~powershell
$env:PORTAL_TEST_URL = 'http://127.0.0.1:3102'
$env:PORTAL_TEST_PRODUCTION = '1'
npm.cmd run test:ui -- --output test-results/ui-review-production
~~~

### UI checklist and evidence ledger

These checked items describe only UI behavior actually exercised in this run.

* [x] Open /login, /register, /verify, /pending, /forgot-password and /reset-password. Confirm labelled inputs, status feedback and navigation. A 503 response cannot sign in a user. Challenge navigation occurs only after a valid server projection. Coverage: UI portions of AC-02 through AC-06.
* [x] Open all 16 financial surfaces at widths 1440, 768 and 390: /overview, /members, /members/[id], /groups, /groups/[id], /deposits, /expenses, /ledger, /account, /admin, /admin/approvals, /admin/members, /admin/groups, /admin/deposits, /admin/expenses and /admin/audit. Use corresponding /dev/preview paths for synthetic presentation. All rendered and had no page level horizontal overflow. Tables scroll within their own containers. Coverage: UI portion of AC-13.
* [x] At 390 pixels, open navigation, Tab through the dialog, press Escape and confirm focus returns to the opener. Reopen and follow Audit history. All required navigation remains reachable, including the scrollable admin section. Coverage: AC-13 UI.
* [x] Inspect computed dark teal sidebar color: rgb(16, 43, 50), matching #102b32. PostCSS uses @tailwindcss/postcss; shadcn base-nova aliases resolve to existing primitives; builds generate working styles. Shared layouts, inputs, tables, dialogs and exact string money formatting are reused.
* [x] Inspect labels and IDs on the captured login, overview, expense and ledger pages. No unlabelled form controls or duplicate IDs were found on those samples. Keyboard focus trapping/restoration passed. This is not a complete WCAG or screen reader certification.
* [x] Use the member preview and a member SelfView on normal routes. Financial write controls and administration navigation are absent; direct /admin/deposits navigation is denied before financial data requests. No public role selection can create a session. Coverage: UI portions of AC-04 and AC-07.
* [x] Select a depositing member and supply amount, payment date and description. Check captured request fields contain no administrator override or group override. Displayed actor comes from the server projection. Coverage: UI portions of AC-08 and AC-10.
* [x] Reject negative amount, exponent notation, NaN, Infinity and excess precision through native form validity. Reject zero, whitespace descriptions and amounts above storage precision before writes. The normal 1250.25 request stays a string. Coverage: UI portion of AC-09.
* [x] Change browser timezone to Pacific/Honolulu and set its clock to 2027-01-01T20:00:00Z. Payment date defaults to 2027-01-02 in Asia/Karachi. No real record is submitted. Date policies remain server requirements.
* [x] Verify summary values come from SummaryView and do not change when history filters change. Synthetic overview shows 135,000.00 deposits, 38,500.00 expenses and 96,500.00 collective balance. These are labelled development fixtures, not calculated financial evidence. No shares, outstanding balances, targets or budgets appear. Coverage: UI portions of AC-08 through AC-10 and AC-13.
* [x] Filter ledger by voided status, open details and inspect reason and replacement references. Search for no matching entry to expose the empty state; clear filters to restore history. Member/group detail filters retain route context. Coverage: UI portions of AC-10, AC-11 and AC-13.
* [x] Exercise approval, group editing, expense attribution, audit before/after and correction controls in preview. Submit actions explicitly report no change and issue no business writes. Real route tests preserve financial keys across retries and correction dialog dismissal. Coverage: UI portions of AC-05, AC-09, AC-11 and AC-12.
* [x] Return 401 while a private modal is open, including from CSRF preparation. Confirm private components unmount and navigation moves to /login. Coverage: UI portion of AC-06.
* [x] Delay /auth/me to observe Loading your workspace, then return 503 to observe a labelled error state and retry button. Coverage: AC-13 UI.
* [x] Under next start, request /dev/preview/overview and /dev/preview/admin/deposits: both return 404. Production login has no preview link. Anonymous /overview shows no fixture totals or private identity. Coverage: privacy portion of AC-07 and AR-05.

Saved screenshots and observations are under frontend/test-results/review-evidence/: overview-desktop.png, login-mobile.png, expenses-tablet.png, ledger-mobile.png, mobile-navigation.png, empty.png, loading.png, error.png and observations.json. The capture script is capture.cjs in the same scratch directory. Four sampled pages had no horizontal overflow, unlabelled controls, duplicate IDs or page errors. These local artifacts are ignored by Git; the steps and regression tests provide the durable reproduction record.

### Dependency advisory assessment

The four moderate entries are affected package nodes for one advisory, not four separate application exploits:

shadcn 4.23.0 → ts-morph 26.0.0 → @ts-morph/common 0.27.0 → minimatch 10.2.6.

[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) describes pattern amplification when attacker controlled glob patterns use optimizationLevel >= 2. The patched major is 11.0.1. Current inspected ts-morph/common callers use minimatch without an optimization override; the installed minimatch default is 1. This further limits the observed trigger, but does not remove the advisory from the installed dependency inventory.

The application imports shadcn/tailwind.css at build time, not the shadcn CLI JavaScript. No affected chain package was present in the 28 production trace manifests. No portal request path or browser code was found that sends user input to this glob implementation. The evidence therefore identifies a tooling/dependency maintenance exposure, not an observed production request or browser runtime vulnerability in this build. npm --omit=dev still reports it because shadcn is listed under dependencies; an installation retaining every production dependency can still contain the vulnerable package on disk even when the route bundle does not load it.

No npm audit fix --force, version override, major downgrade or other dependency change was performed. A future compatible shadcn/ts-morph update and separate dependency classification cleanup should be evaluated before release. Do not process untrusted glob input with vulnerable tooling.

### Acceptance coverage and unresolved risks

| Acceptance area | Current verdict |
| --- | --- |
| AC-01, actual authorized roster/groups/admin provisioning | Not implemented in this UI iteration; synthetic counts are not provisioning proof |
| AC-02 through AC-07, real authentication/OTP/permissions | UI behavior exercised; backend and real email/session enforcement blocked |
| AC-08 through AC-12, money, attribution, corrections and audits | UI request/display behavior exercised; PostgreSQL arithmetic, concurrent idempotency and atomicity blocked |
| AC-13, required UI breadth/responsiveness/filter presentation | Met for the synthetic UI slice and intercepted response checks; real data service behavior awaits integration |
| AC-14 and AR-02/AR-07, complete first slice/release | Blocked, no migrations, SMTP rehearsal, deployment or financial release verification |
| AC-15, richer P1 filters | Deferred, not introduced by this work |

Remaining limitations:

1. Retained financial attempts live only in memory for the mounted workspace. Navigation, reload or browser exit discards that memory. After an uncertain result, check authoritative transaction history before starting another request. Durable recovery and cross session replay require backend integration; this run does not claim them.
2. Real API permissions, signed cookies, CSRF enforcement, session revocation, exact arithmetic, atomic audit writes and concurrency protection remain unimplemented and unverified. Browser hiding is not authorization.
3. Negative fund policy, date rules, historical correction attribution and administrator suspension policies remain unresolved business decisions. UI controls do not ratify those policies.
4. No private roster was loaded for comparison. Inspection found no private information or credential patterns in the examined application source/public output, but a bounded scan is not a guarantee against every possible secret. No .env values were read or printed.
5. Verification used Edge/Chromium. Safari, Firefox, assistive technology and comprehensive contrast/WCAG certification were not exercised.
6. WorkspaceView centralizes screen composition and data loading. Existing shared components avoid duplicated forms/tables, but future integration should keep domain logic on the server and avoid expanding the presentation switch into business logic. This is a maintainability observation, not a requested refactor.

No existing scope completion checkbox changed. The UI findings above are fixed and regression checked; backend and release gates remain open. You can use /clear before beginning the next feature.
