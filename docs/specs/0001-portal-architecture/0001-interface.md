# 0001. API and frontend contract

## Summary

The interface uses one REST API prefix, `/api/v1`. Requests go to the same browser origin with cookies and CSRF protection. Every private response is an explicit projection, not an ORM object dumped into JSON.

## Requirements

Scope AC-02 through AC-13; architecture AR-01, AR-02 and AR-05. All required pages remain reachable on mobile and regular members have no financial write access.

## Decision

Use JSON endpoints with Pydantic request and response schemas. Reject unknown write fields. Money is a decimal string, dates are `YYYY-MM-DD`, timestamps are ISO 8601 UTC and IDs are UUID strings. Lists use `{items,total,page,page_size}` with page >=1, default page size 25 and maximum 100. Stable ledger order is `(business_date DESC,created_at DESC,id DESC)`, audit order `(occurred_at DESC,id DESC)`; pagination is a current view, not a guaranteed historical export snapshot. (basis: approved shared history requirements and simple REST contracts)

### Shared types and access rules

`Public`: no session, but browser writes still require Origin/CSRF and endpoint rate limits. `Flow`: valid opaque challenge cookie plus CSRF. `Self`: full or status session for that user only. `Member`: full approved/verified/linked session. `Admin`: Member plus fixed authorization identity and completed admin OTP.

| Type | Response fields and source |
|---|---|
| `SelfView` | `user_id,name,email,status,role,member_id,session_kind,session_expires_at`; own user/session rows and derived role only |
| `ChallengeResult` | `next_step,expires_in_seconds,resend_after_seconds`; fixed workflow values, no OTP, flow secret or challenge hash |
| `MemberView` | `id,name,current_group:{id,code,name},contribution,version`; roster and active deposit aggregate; no account email/phone |
| `GroupView` | `id,code,name,member_count,contribution,expenditure,version`; roster/current member count and historical finance aggregates |
| `TransactionView` | `id,kind,amount,currency,business_date,title,description,member_id,member_name_snapshot,group_id,group_code_snapshot,group_name_snapshot,expense_category,recorded_by,recorded_by_name_snapshot,created_at,status,voided_by,voided_at,void_reason,replaces_id,replacement_id`; transaction columns plus reverse replacement lookup, currency constant PKR |
| `SummaryView` | `currency,total_deposits,total_expenses,collective_balance,collective_category_expenses,member_count,group_count`; aggregate and roster queries |
| `RegistrationView` | `id,name,email,status,email_verified_at,member_id,version,created_at,reviewed_by,reviewed_at,review_reason`; admin only user projection |
| `AuditView` | Audit event columns from data contract; excludes any nonwhitelisted sensitive values |
| `ErrorView` | `{error:{code,message,fields?},request_id}`; controlled messages and validation field names, no internal exception bodies |

All private/auth responses use `Cache-Control: no-store`. GETs never change business/account state. Success responses do not return JWTs. CSRF responses intentionally return only a CSRF token, not authentication credentials.

### Complete endpoint contract

All paths below are relative to `/api/v1`. Noncreation successes use 200 unless shown. Common errors: 401 invalid session, 403 permission/CSRF/Origin, 422 validation, 429 rate limits, 503 dependency outage. Resource endpoints may return 404. Endpoint specific conflicts return 409 with a stable code.

| Method and path | Permission | Request | Response responsibility / special errors |
|---|---|---|---|
| GET `/health/live` | Public | None | `{status:"ok"}`, no versions/secrets |
| GET `/health/ready` | Private edge/operator | None | Checks DB, migrations and configured provisioned counts; 503 when not ready, no roster detail |
| GET `/auth/csrf` | Public/Self | None | `{csrf_token}` plus browser/CSRF cookies; no private identity |
| POST `/auth/register` | Public | `name,email,password` | 202 generic ChallengeResult; create registration or dummy flow; no role field |
| POST `/auth/login` | Public | `email,password` | 200 SelfView plus cookie for eligible member/status session OR 202 ChallengeResult for admin/unverified flow; 401 generic invalid credentials, 403 unavailable account |
| POST `/auth/otp/verify` | Flow | `code` six digit string | Registration: pending SelfView/status cookie. Admin login: full SelfView/session cookie. Recovery purpose rejected here, use reset endpoint. Invalid/expired/exhausted: 400 generic invalid challenge; 429 cooldown |
| POST `/auth/otp/resend` | Flow | Empty object | 202 ChallengeResult with renewed flow cookie; checks cooldown/attempt state; no purpose supplied by caller |
| POST `/auth/password/recovery` | Public | `email` | 202 generic ChallengeResult and real/dummy recovery flow |
| POST `/auth/password/reset` | Flow | `code,new_password` | 204 after atomic consume/hash update/revoke/audit; no session issued; wrong purpose/invalid code 400 |
| GET `/auth/me` | Self | None | SelfView, including pending/rejected status when permitted |
| POST `/auth/logout` | Self | Empty object | 204, revoke current session and expire session/flow/CSRF cookies |
| POST `/auth/logout-all` | Member | Empty object | 204, revoke all own sessions; clear current browser |
| POST `/auth/password/change` | Member | `current_password,new_password` | 204, update hash and revoke all sessions; incorrect current password 400; rate limited like login |
| GET `/finance/summary` | Member | None | SummaryView, global totals unaffected by UI filters |
| GET `/members` | Member | `q?,group_id?,page?,page_size?` | List MemberView; name search, current group filter |
| GET `/members/{id}` | Member | None | MemberView; history uses transactions filtered by member |
| GET `/groups` | Member | `q?` | Ten GroupView objects; no synthetic eleventh group |
| GET `/groups/{id}` | Member | None | GroupView and list of current members `{id,name}`; finance history uses historical group filter |
| GET `/transactions` | Member | `kind?,member_id?,group_id?,category?,date_from?,date_to?,status?,q?,page?,page_size?` | TransactionView list; keyword searches title/description; member filter matches depositing/context member; defaults to all statuses, UI labels active totals separately |
| GET `/transactions/{id}` | Member | None | TransactionView with correction links |
| POST `/deposits` | Admin | `member_id,amount,payment_date,description` plus Idempotency-Key | 201 TransactionView; duplicate replay same stored status/body, conflicting key 409 |
| POST `/expenses` | Admin | `title,amount,expense_date,category,group_id?,associated_member_id?,description` plus Idempotency-Key | 201 TransactionView; explicit member context, no allocation; unresolved policy gate 409 |
| POST `/transactions/{id}/void` | Admin | `reason` plus Idempotency-Key | 200 voided TransactionView; already corrected 409 |
| POST `/transactions/{id}/replace` | Admin | `reason,replacement` plus Idempotency-Key; replacement schema matches original kind | 201 `{original:TransactionView,replacement:TransactionView}`; type/attribution violations 422 or policy gate 409 |
| GET `/admin/registrations` | Admin | `status=pending|rejected|approved|suspended|unverified?,q?,page?,page_size?` | RegistrationView list, default pending, keyword searches name/email |
| GET `/admin/members/available` | Admin | None | Unlinked, unreserved roster members `{id,name,group_id}` for approval, never public |
| POST `/admin/registrations/{id}/approve` | Admin | `member_id,expected_version` | RegistrationView; pending+verified required, link conflict or stale version 409 |
| POST `/admin/registrations/{id}/reject` | Admin | `reason,expected_version` | RegistrationView; stale/invalid transition 409 |
| PATCH `/admin/members/{id}` | Admin | `name?,group_id?,expected_version` | Updated roster data `{id,name,group_id,version}`; audits changes, no historical rewrite |
| PATCH `/admin/groups/{id}` | Admin | `name,expected_version` | `{id,code,name,version}`; code immutable |
| POST `/admin/users/{id}/suspend` | Admin | `reason,expected_version` | RegistrationView; atomic session revocation; admin target policy unresolved, block that branch |
| POST `/admin/users/{id}/restore` | Admin | `reason,expected_version` | RegistrationView with prior status restored, sessions stay revoked; admin target policy unresolved |
| GET `/admin/audit-events` | Admin | `actor_id?,entity_type?,entity_id?,operation?,from?,to?,page?,page_size?` | AuditView list; exact identifiers/date filters |

`replacement` contains no `kind`, actor, status or immutable ID fields. `expected_version` is required for mutable admin records and compared under the mutation guard, incrementing on success. Approve/reject/suspend/restore audit reasons use 5..500 characters where required; approval itself needs no reason. Repeated stale approval/rejection cannot repeat its audit mutation. All mutation services use the audit whitelist.

Admin member management obtains current version from MemberView and linked account ID/status from the admin registrations projection matched by `member_id`. Regular member views never request that account list. Applicant names are registration input; approval does not silently overwrite the validated roster name.

No DELETE, admin promotion, new group/member creation, upload, project, payment gateway, budget or target endpoints. No server route fetches financial data from Firebase.

### Frontend routes and layouts

| Route | Composition and access |
|---|---|
| `/login` | Credentials form, recovery link, registration link; role determined by backend response |
| `/register` | Name/email/password/confirmation; code never echoed |
| `/verify` | Six digit input, countdown and resend; challenge cookie determines purpose; recovery completion can use `/reset-password` |
| `/pending` | Own pending/rejected status, refresh and logout, no navigation to private roster |
| `/forgot-password`, `/reset-password` | Recovery request; OTP and new password form |
| `/overview` | Three fund metrics, recent ledger entries, group expenditure and navigation |
| `/members`, `/members/[id]` | Contribution list/search/current group filter; individual deposits and optional contextual expense history labeled clearly |
| `/groups`, `/groups/[id]` | Contributions, expenditure, current roster and historical finance rows; separate collective category in overview/ledger |
| `/ledger` | Filterable deposit/expense history, actor/date/status and detail/correction linkage |
| `/account` | Own profile, password change, current/logout all actions |
| `/admin` | Summary and links to approvals, deposits, expenses, roster and audits |
| `/admin/approvals` | Pending applications, unique roster match, approve/reject; tabs for other account states |
| `/admin/deposits`, `/admin/expenses` | Entry forms, history and correction dialogs |
| `/admin/members`, `/admin/groups` | Allowed roster edits and group assignments; suspend/restore controls through linked account UI |
| `/admin/audit` | Filterable audit history, before/after detail |

Use auth and portal route groups with a shared portal shell. Initial page rendering contains no private data; a client session boundary calls `/auth/me` then permitted data endpoints. Route guards improve UX but never replace API permissions. Avoid adding a second auth implementation to Next middleware. No server actions performing finance writes and no duplicate BFF API layer.

`lib/api.ts` is the only browser fetch wrapper: relative `/api/v1`, credentials included, no-store, JSON schemas, CSRF header on writes, bounded timeout. Obtain CSRF at startup and after session changes; never automatically retry a financial write with a new key. On 401 clear in memory data and dialogs and navigate to login. On 403 show denied state. Cancel obsolete reads on navigation; after a mutation refetch relevant summary/list. Refetch on focus or explicit refresh; no realtime service. Shared data is never stored in localStorage.

Reusable components: `PortalShell`, `Sidebar`, `MobileNavigation`, `SummaryCard`, `MoneyText`, `MemberTable`, `GroupTable`, `TransactionTable`, `TransactionFilters`, `Pagination`, `DepositForm`, `ExpenseForm`, `CorrectionDialog`, `ApprovalForm`, `OtpForm`, `AuditDiff`, `ErrorState`, `EmptyState`, `LoadingState`. Use shadcn/ui primitives for controls/dialog focus behavior rather than copying legacy string templates. API contract types are generated from committed OpenAPI during implementation or explicitly checked against it; no additional client state framework is necessary.

### Visual contract

Use the existing local styles as reference: navigation `#102b32`, background `#f5f7f6`, ink `#15313a`, accent `#197e68`, border `#e5ece9`. Preserve the dark teal sidebar, white cards, clear money columns and responsive card/table hierarchy. Use a local/system sans serif and restrained serif headings as in the legacy design; no external image/font requests are necessary. Replace obsolete individual balance/share labels with contribution and collective fund labels.

On narrow screens provide a menu that reaches every required route, not only the legacy bottom navigation subset. Forms have associated labels, focus visibility, inline validation, disabled pending actions and screen reader notices. Dialogs trap/restore focus and close on Escape where safe. Money is formatted from strings (split/group digits without float calculations); expose exact values and meaningful status text beyond color.

## Build plan

T02/T09/T12 establish the first real UI path; T15/T17/T19/T20/T22 complete the other views. Tests include direct API denial independent of hidden buttons, mobile navigation and stale private modal cleanup.

## Consequences and rationale

Client loaded private pages avoid accidental static caching and keep one API permission boundary. The tradeoff is an initial loading state rather than private server rendering. REST plus explicit small contracts is adequate for this roster and deadline. (basis: approved UI migration, privacy constraints and minimal integration)
