# 0001. Financial write and read contract

## Summary

Record deposits and expenses as immutable financial facts, with only an audited void transition allowed. Every successful financial write commits its audit and duplicate submission receipt in the same database transaction.

## Requirements

Scope AC-08 through AC-12, architecture AR-02, AR-04 and AR-05. One collective fund, no individual expense sharing, no targets or budgets.

## Decision

All monetary inputs are JSON strings matched to a plain positive decimal format with at most two fractional digits. Reject numeric JSON, exponent notation, NaN, infinity, negative/zero values and excess precision. Parse directly to Decimal; return a two decimal string. NUMERIC(14,2) is storage, not a substitute for validation since PostgreSQL can round excess input precision. (basis: approved exact accounting rules and PostgreSQL numeric behavior)

### Common mutation transaction

Use one fixed, documented PostgreSQL transaction advisory lock (`pg_advisory_xact_lock(260010)`) for sensitive successful account, roster, session and finance mutations. This serializes these short operations across workers. Never hold it while password hashing or SMTP runs. Hash first, then verify the locked user's password hash/version has not changed before using the result. Failed OTP attempts and rate counters use their own atomic updates and row locks; when an operation needs the guard, acquire it before any account/challenge/transaction row locks.

Within the guard recheck actor session, status and permission. Account suspension, logout, password reset and roster reassignment use the same guard, so they cannot interleave halfway through an authorized financial mutation. Auth reads can be concurrent; a mutation's authorization is checked again inside this guard. For this scale the predictable behavior outweighs write throughput. Retry only known transient deadlock/serialization failures with the same idempotency key and a small bounded retry count; never retry an unknown success using a new key.

### Deposit creation

1. Require admin full session, CSRF and a UUID `Idempotency-Key`. Validate `{member_id,amount,payment_date,description}`. Reject actor/status/group fields not in the request schema.
2. Begin transaction, acquire mutation guard, recheck authorization and look for existing idempotency receipt for actor plus operation plus key.
3. Normalize request values, hash canonical JSON. An existing matching receipt returns its stored result; a different hash returns 409. Authorization happens before replay.
4. Read the member and current group. Capture group code/name and member name snapshots. For today's business date use this association. Earlier/future payment dates remain gated until business date and attribution policy is settled.
5. Insert active deposit with backend UUID, Decimal amount, date, description, authenticated `recorded_by`, current admin name snapshot and database creation time. The recording administrator is the accepting administrator under the confirmed request; there is no separate client actor selector.
6. Insert whitelisted audit event and completed idempotency receipt, then commit once. Return 201 with transaction projection. Any audit/constraint failure rolls back everything; no balance is stored independently.

### Expense creation

Same transaction pattern with `{title,amount,expense_date,category,group_id?,associated_member_id?,description}`. `group` category requires a valid group and snapshots; `collective` requires null group. Optional member is context, never allocation. Store creator attribution from the session. Overdraft and backdating policies must be decided before expense release; until then that operation is explicitly gated. If a future decision blocks negative funds, check the current aggregate within this same guard, including all concurrent financial mutations.

### Corrections

`POST /transactions/{id}/void` needs `{reason}` and an idempotency key. Lock/read an active record, verify reason 5..500 characters, set only void status/actor/time/reason, insert audit and receipt, commit. Already voided with a different key returns 409; same key replays its result.

`POST /transactions/{id}/replace` needs `{reason,replacement}`. Replacement contains the same kind's allowed creation fields. Under one guard/transaction, validate everything, void original, insert replacement with `replaces_id`, insert both audit events and receipt, and commit. No partial void if replacement fails. Kind cannot change. An already voided/replaced original returns 409. Fixing deposit member/group attribution must follow the explicit historical attribution policy; do not silently assign a backdated correction to the member's current group. Until decided, only corrections retaining the original member/group attribution are implementable.

### Read calculations

Execute summary aggregates in a single SQL statement over active rows (or one consistent snapshot for a multi query detail response). Use `COALESCE(SUM(...),0)` and Decimal serialization, never float. The filters below do not change global totals.

| Read | Calculation |
|---|---|
| Collective deposits | Active deposit SUM(amount) |
| Collective expenses | Active expense SUM(amount) |
| Collective balance | Deposits minus expenses, never clamped at zero |
| Member contribution | Active deposits by `member_id` |
| Group contribution | Active deposits by stored historical `group_id` |
| Group expenditure | Active group category expenses by stored `group_id` |
| Collective category expenditure | Active collective category expense SUM(amount), no technical group |

A member's current group is roster information; their historical deposits remain under the recorded group. Detail/history screens show stored snapshots where attribution matters and label current roster data separately. Voided rows remain visible with status/reason/replacement relationship but contribute zero. No `expense_shares`, individual balance, amount owed, target or group budget endpoint exists.

### Duplicate protection and error behavior

Uniqueness `(actor,operation,key)` plus the mutation guard prevents parallel duplicate execution. Store canonical response body and HTTP status for replay, excluding cookies and secrets. Operations include a resource ID for void/replace so a reused key cannot address another record. Client keeps one key per form submission across timeout/retry and generates a new key only for an intentional new submission. Network uncertainty means query/retry that key, not create another transaction.

Use 422 for invalid fields, 401 for absent/expired/revoked authentication, 403 for role/CSRF failures, 404 for missing permitted resources, 409 for stale versions/conflicting keys/already corrected records and 503 for unavailable dependencies. Return stable error codes and request ID, never SQL or SMTP exceptions. A `POLICY_UNRESOLVED` 409 is a temporary build guard only, not accepted release behavior.

### Audit and value sources

Financial before/after objects include only transaction business fields, attribution snapshots, status and linkage. Actor comes from the revalidated session; reason comes from validated correction input; time and IDs are server generated. Approval and roster audit events capture relevant changed fields, not password/session/OTP material. Failed authorization attempts may appear in redacted operational logs but are not successful mutation audit records.

## Build plan

T10 through T12 implement deposit/read proof; T14/T15 extend expenses; T16/T17 implement correction and history. Tests inject audit insert failure, repeat the same key, reuse a key with different content, and race write versus suspension and group reassignment.

## Consequences and rationale

The database is the only source of financial truth. Serial writes and synchronous aggregation fit the fixed roster and avoid premature caching. Throughput is intentionally limited; scaling this lock is a future measured decision. (basis: atomic bookkeeping operations, approved roster scale and Tracer Bullet delivery)
