# Architecture rationale

## Context

The approved scope replaces a static Firebase portal for 26 people. Existing visuals are useful; its automatic expense sharing, weak financial validation and session cleanup defects are not migration contracts. The deadline is the end of 25 November 2026 in Pakistan. The requested stack and Tracer Bullet/GA workflow are fixed, while live data, operator capacity, hosting and some business policies remain unknown.

This topic contains several buildable decisions. One umbrella and five child contracts keep them linked without creating a large sequence of separate planning rounds. No compliance certification or legal standard is asserted.

## Options considered

| Choice | Benefit | Cost / disposition |
|---|---|---|
| Full stack Next.js App Router + Route Handlers + Prisma | Single TypeScript deployable, zero cross service glue, same origin cookies, and one PostgreSQL transaction boundary | Server/client boundary must be enforced strictly via `server-only`; selected (basis: simplified deployment on Vercel and reduced complexity) |
| Separate Next.js + FastAPI runtimes | Python ecosystem for backend | Extra runtime, proxy wiring, and two deployment pipelines; superseded (basis: user decision to simplify stack) |
| Stateless JWT with refresh tokens | Fewer database checks | More rotation/reuse complexity and weaker immediate revocation unless state is reintroduced; rejected (basis: required revocation) |
| Bounded JWT plus database sessions | Straightforward revocation and fixed expiry | Query per request and periodic login; selected (basis: approved session requirement) |
| Fine grained financial locking | More simultaneous writes | More lock ordering and race cases to reason about; unnecessary at 26 users (basis: atomic financial operations) |
| One short mutation guard | Easy serialization of permission/roster/finance mutations | Limited throughput; selected until measured need (basis: deadline and correctness) |
| Queue based SMTP delivery | Better automatic retry isolation | Worker/queue lifecycle and more states; deferred (basis: explicit infrastructure exclusions) |
| Bounded synchronous SMTP | Small implementation and clear failure states | Request latency and manual resend after failure; selected (basis: small account population) |

## Rationale

Choose predictable PostgreSQL transactions and proven TypeScript crypto libraries over multi runtime infrastructure breadth. All arithmetic and permissions live in `server-only` Route Handler services. Snapshot attribution avoids rewriting history when members change groups. A Prisma transaction commits finance, audit and duplicate receipt together. These choices directly address the legacy audit findings while keeping the implementation small and deployable on Vercel.

The security workflow is still application code that needs careful testing; using `jose` and `argon2` does not make it automatically secure. The first slice therefore includes OTP/session failure tests and atomic deposit tests before expenses and extra pages. No date, overdraft or account policy is silently approved as a consequence of an implementation default.

## References

Sources only, as requested; no external reference links are included.

Project sources: approved `docs/scope/scope.md`; your revised full stack Next.js architecture decision and deadline clarification; the preceding read only legacy audit; local legacy `site/styles.css`, `site/index.html` and rendering functions in `site/app.js`.

Practices and official documentation checked: Next.js App Router Route Handlers and `server-only` boundaries; Prisma ORM PostgreSQL transactions, `Decimal`, and Prisma Migrate; Zod strict schema validation; `jose` JWT signing/verification and OWASP Argon2id/session/CSRF guidance; Nodemailer Gmail SMTP STARTTLS configuration; Vercel Node.js runtime and PostgreSQL pooling guidance. These support the decisions above, not a claim that deployment or Gmail delivery has been verified.

No additional skills or MCP tools were discovered or installed. You will name any that are needed.
