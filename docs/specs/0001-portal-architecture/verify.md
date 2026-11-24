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
| Release | Fresh Alembic upgrade, backup restoration, production cookie/Origin/proxy tests, Gmail test delivery, health/log redaction and rollback rehearsal; independent review and release documentation. | AC-14, AR-07 |

Pytest runs service tests plus integration/concurrency tests on actual PostgreSQL with separate connections. SQLite is not an acceptable substitute for locks, NUMERIC or constraints. Inject a clock for unit expiry tests, and test database timestamp boundaries in integration. Inject mail transport for tests; do not expose codes through an HTTP test helper in the production app.

Playwright uses a test mailbox adapter available only inside the test process. It obtains codes through test infrastructure, not logs or user facing API responses. At least one approved SMTP smoke test proves the production delivery path separately. Disable production fixture/import helpers by configuration validation.

GA evidence records commands, environment, pass/fail and remaining blockers. Independent review is performed by a reviewer that did not write the implementation. Release requires zero unresolved high impact auth, privacy, money or data loss defects. No estimated coverage percentage substitutes for these acceptance scenarios.
