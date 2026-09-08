# Masters Backend Architecture

## Runtime topology

```text
Next.js web clients
        |
        v
NestJS REST API (/api/v1)
  |-- JWT access authentication + rotated refresh sessions
  |-- role and ownership guards
  |-- validation, response envelope, exception filter
  |-- Redis rate limits, idempotency, locks and configuration cache
  |-- provider-neutral AI service with Gemini and OpenAI adapters
  |-- Razorpay payment adapter (provider interface permits Stripe later)
  |-- StorageService abstraction (Cloudflare R2 adapter)
        |
        +--> PostgreSQL via Prisma (source of truth)
        +--> Redis (ephemeral/cache only)
        +--> Gemini or OpenAI / Razorpay / Cloudflare R2
```

## Module boundaries

```text
src/
|-- main.ts
|-- app.module.ts
|-- config/                 # typed environment configuration
|-- common/
|   |-- constants/          # global immutable safety policy
|   |-- decorators/         # @CurrentUser and @Roles
|   |-- filters/            # consistent production-safe errors
|   |-- guards/             # JWT and role enforcement
|   |-- interceptors/       # success response envelope
|   |-- types/              # authenticated request claims
|   `-- utils/              # crypto and pagination helpers
|-- prisma/                 # database lifecycle and transactions
|-- redis/                  # cache, atomic counters and locks
|-- auth/                   # registration, login, refresh rotation, logout
|-- users/                  # user profile and admin-facing persistence
|-- masters/                # public master configuration reads
|-- conversations/          # ownership-safe conversation/history APIs
|-- messages/               # message persistence
|-- ai/
|   |-- ai-provider.interface.ts
|   |-- ai.service.ts       # provider-neutral classification, summaries and streaming
|   `-- providers/          # Gemini REST and OpenAI SDK adapters
|-- chat/
|   |-- prompt-builder.service.ts
|   |-- topic-classifier.service.ts
|   |-- conversation-context.service.ts
|   `-- chat.service.ts     # orchestration only
|-- subscriptions/          # plans and active subscription lifecycle
|-- usage/                  # atomic reservations + immutable ledger
|-- payments/               # provider-neutral flow + Razorpay adapter/webhook
|-- invoices/               # immutable invoice records
|-- storage/                # StorageService + R2 implementation
|-- admin/                  # protected analytics and management APIs
`-- health/                 # liveness/readiness
```

## Major data relationships

- A `User` owns many refresh sessions, conversations, subscriptions, usage entries, payments and invoices.
- A `Master` owns many conversations. Its editable persona is subordinate to immutable global safety rules.
- A `Conversation` belongs to exactly one user and one master and owns ordered messages.
- A `UserSubscription` is an instance of a `SubscriptionPlan`; quota reservations update it atomically.
- `QuestionUsage` is append-only. Reservation, confirmation and release events provide the billing audit trail.
- A `Payment` links a user and plan and may activate one subscription only after server-side signature/webhook verification.
- An `Invoice` belongs to one successful payment.
- An `ActivityLog` records privileged changes with the responsible administrator and request metadata.

## Critical request invariants

1. Identity always comes from verified JWT claims, never request-supplied user IDs.
2. Conversation ownership is checked before reading messages or invoking AI.
3. Global safety instructions are code-owned and precede all editable prompts.
4. Master configuration is read-through cached; updates invalidate its Redis key.
5. Rate limits apply per user and per IP before model invocation.
6. Out-of-domain requests return the configured fallback without model cost or quota consumption.
7. Accepted questions receive an atomic database reservation before the configured AI provider is called.
8. Reservations are confirmed with message/token metadata, or released on permanent upstream failure.
9. Payment success never activates access without server-side cryptographic verification.
10. Webhook events and chat request IDs are idempotent.
