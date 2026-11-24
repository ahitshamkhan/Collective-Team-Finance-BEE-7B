# Architecture rationale

## Context

The approved scope replaces a static Firebase portal for 26 people. Existing visuals are useful; its automatic expense sharing, weak financial validation and session cleanup defects are not migration contracts. The deadline is the end of 25 November 2026 in Pakistan. The requested stack and Tracer Bullet/GA workflow are fixed, while live data, operator capacity, hosting and some business policies remain unknown.

This topic contains several buildable decisions. One umbrella and five child contracts keep them linked without creating a large sequence of separate planning rounds. No compliance certification or legal standard is asserted.

## Options considered

| Choice | Benefit | Cost / disposition |
|---|---|---|
| One origin modular backend plus Next.js | Clear API authority, simple cookies and one database transaction boundary | Two runtimes still require deployment coordination; selected (basis: user preferences and small roster) |
| Separate public frontend/API origins | Independent hosting flexibility | CORS, cookie and proxy configuration become harder; not preferred for deadline (basis: browser security boundaries) |
| Stateless JWT with refresh tokens | Fewer database checks | More rotation/reuse complexity and weaker immediate revocation unless state is reintroduced; rejected (basis: required revocation) |
| Bounded JWT plus database sessions | Straightforward revocation and fixed expiry | Query per request and periodic login; selected (basis: approved session requirement) |
| Fine grained financial locking | More simultaneous writes | More lock ordering and race cases to reason about; unnecessary at 26 users (basis: atomic financial operations) |
| One short mutation guard | Easy serialization of permission/roster/finance mutations | Limited throughput; selected until measured need (basis: deadline and correctness) |
| Queue based SMTP delivery | Better automatic retry isolation | Worker/queue lifecycle and more states; deferred (basis: explicit infrastructure exclusions) |
| Bounded synchronous SMTP | Small implementation and clear failure states | Request latency and manual resend after failure; selected (basis: small account population) |

## Rationale

Choose predictable database operations and proven crypto libraries over infrastructure breadth. All arithmetic and permissions live in the backend. Snapshot attribution avoids rewriting history when members change groups. A database transaction commits finance, audit and duplicate receipt together. These choices directly address the legacy audit findings while keeping the implementation small.

The security workflow is still application code that needs careful testing; using JWT and Argon2id libraries does not make it automatically secure. The first slice therefore includes OTP/session failure tests and atomic deposit tests before expenses and extra pages. No date, overdraft or account policy is silently approved as a consequence of an implementation default.

## References

Sources only, as requested; no external reference links are included.

Project sources: approved `docs/scope/scope.md`; your architecture preferences and deadline clarification; the preceding read only legacy audit; local legacy `site/styles.css`, `site/index.html` and rendering functions in `site/app.js`.

Practices and official documentation checked: FastAPI JWT/password security guidance (PyJWT and pwdlib); SQLAlchemy session lifecycle and transaction guidance; PostgreSQL constraints and explicit locking; OWASP authentication, session management and CSRF prevention guidance; Google account App Password requirements. These support the decisions above, not a claim that deployment or Gmail delivery has been verified.

No additional skills or MCP tools were discovered or installed. You will name any that are needed.
