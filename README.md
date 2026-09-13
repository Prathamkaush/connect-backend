# Masters Backend

Production-oriented NestJS API for the connect2infinity **Masters** AI chat and subscription platform.

## What is included

- PostgreSQL data model and initial migration using Prisma
- bcrypt registration/login and short-lived access JWTs
- rotated, hashed, revocable refresh-token sessions
- user, Master, conversation and cursor-paginated message APIs
- Redis-cached Master prompts and system settings
- immutable platform safety rules that editable Master prompts cannot replace
- lightweight model-based topic classification with a conservative offline fallback
- bounded conversation context and configurable history summarisation
- provider-neutral Gemini/OpenAI responses streamed over Server-Sent Events
- per-user and per-IP Redis rate limits
- idempotency keys and Redis request locks against double submission
- transaction-safe free and subscription quota reservations
- immutable confirmed-usage ledger and automatic release after AI failure
- Razorpay order creation, server verification and signed/idempotent webhooks
- subscription activation and invoice records only after verified payment
- provider-ready payment architecture and Cloudflare R2 `StorageService`
- role-protected administration, analytics, reports and activity logs
- Swagger, health endpoints, seed data, unit tests and Docker Compose

Architecture and contracts are documented in [docs/architecture.md](docs/architecture.md) and [docs/api.md](docs/api.md).

Subscription-based in-app voice calls are implemented behind `VOICE_ENABLED=false`. See [voice setup, accounting, tests, and launch blockers](docs/voice.md). Existing plans/subscriptions default to zero voice time. No automated tests initiate paid calls.

## Local setup

Requirements: Node.js 22+, Docker, and Docker Compose.

```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
```

The API listens on `http://localhost:4000/api/v1`. Swagger is at `http://localhost:4000/docs`.

Gemini is the default provider for development. Add its key to `.env`:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_DEFAULT_MODEL=gemini-3.6-flash
```

When an OpenAI key is available, switching providers requires environment changes only; chat orchestration and teacher personas stay unchanged:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=your-openai-key
OPENAI_DEFAULT_MODEL=gpt-4.1-mini
```

Keep each teacher's model set to `provider-default` unless it deliberately needs a provider-specific override.

To seed a first super administrator, add these values before running the seed:

```dotenv
SEED_ADMIN_EMAIL=admin@connect2infinity.ai
SEED_ADMIN_PASSWORD=replace-with-a-strong-password
```

No administrator password is committed to the repository.

## Full container startup

```bash
docker compose up --build
```

The API container applies committed migrations before starting. In production, run migrations as a separate release step if multiple application replicas start concurrently.

## Authentication

Send the access token with protected requests:

```http
Authorization: Bearer <accessToken>
```

Refresh tokens are JWTs but are stored only as SHA-256 hashes in `RefreshSession`. Each refresh rotates and revokes the previous session. Browser integrations should transport refresh tokens in an HttpOnly, Secure, SameSite cookie through a same-origin BFF; the JSON DTO exists for mobile/native clients and initial integration.

## Streaming chat

Create a conversation first, then submit a message with a unique client-generated request key:

```http
POST /api/v1/chat/messages
Authorization: Bearer <accessToken>
Idempotency-Key: 8ed29b2e-ec79-49bc-af34-e858b249e980
Content-Type: application/json

{"conversationId":"...","message":"How can I act without attachment to the result?"}
```

The response is `text/event-stream` with `meta`, `delta`, `done`, or `error` events. Replaying a confirmed idempotency key returns the stored assistant message without consuming quota again.

## Quota safety

Free and paid capacity is reserved atomically in PostgreSQL before model invocation. A successful answer confirms the reservation, updates its quota source, and appends one `QuestionUsage` record. Permanent failures release the reservation. Expired reservations are recovered before the user’s next request.

PostgreSQL is always the source of truth. Redis is used only for rate windows, request locks, idempotency support and caches.

## Payment safety

The browser result is never trusted as proof of payment. `/payments/verify` checks the Razorpay signature and fetches the provider payment status. `/payments/webhook` validates the signature against the exact raw body. Subscription and invoice creation occur together in a transaction after verification.

Stripe can be added as a second provider without changing the `Payment`, `UserSubscription`, or `Invoice` models.

## Image storage

`StorageService` exposes `upload`, `delete`, and `getPublicUrl`. The R2 implementation uses immutable/versioned object keys and one-year cache headers by default. Recommended Master image keys look like:

```text
masters/krishna/krishna-a81c920.webp
```

Generate WebP/AVIF variants before calling storage and store their URLs/keys on `Master`. Never place production uploads in the Next.js public directory.

## Verification

```bash
npm run lint
npm test
npm run build
```

Readiness checks require both PostgreSQL and Redis:

- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`

## Production checklist

- replace every placeholder secret with at least 32 random bytes
- configure exact `FRONTEND_URL`; do not use wildcard CORS with credentials
- provide Gemini/OpenAI, Razorpay and R2 secrets through a secret manager
- terminate TLS at the load balancer and trust only the known proxy chain
- configure log aggregation and alerting for 5xx, AI failure, payment failure and quota-release rates
- back up PostgreSQL and test restoration regularly
- run multiple API replicas only with shared PostgreSQL and Redis
- add email verification/reset delivery and an HttpOnly-cookie web BFF before public launch

### OpenRouter free-model testing

In the backend `.env` (not `.env.example`), set:

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_DEFAULT_MODEL=openrouter/free
```

Restart the backend after changing these values. Existing teacher models use the configured free model when they do not specify a free OpenRouter model. This integration accepts only `openrouter/free` or model IDs ending in `:free`; it never falls back to a paid model. Chat streaming, classification, and summaries all use the selected provider. Free models still have rate limits, and a chat can require multiple provider requests.

OpenRouter documentation: https://openrouter.ai/docs/guides/routing/routers/free-router


### Customer details and invoice PDFs

Run `npm run prisma:deploy` and `npm run prisma:generate` before starting this version. The customer-details migration adds nullable phone, city and postal-code columns for existing accounts; all three fields are required for new registrations.

`GET /voice/calls?limit=3&before=<ISO timestamp>&beforeId=<call ID>` returns the next three owned customer calls, using a timestamp and ID cursor to preserve calls with identical timestamps. The default page size remains 50 for existing clients.

`GET /invoices/:id/pdf` requires the invoice owner's bearer token and returns a branded PDF attachment. New invoices save customer and plan details at purchase time; older invoices use available profile and subscription details. Amounts and tax come from the saved invoice. Configure `INVOICE_BUSINESS_NAME`, `INVOICE_BUSINESS_ADDRESS`, `INVOICE_SUPPORT_EMAIL` and `INVOICE_TAX_ID` with the actual seller details; optional unset details are omitted. PDFKit and the licensed Noto Sans Devanagari font package are runtime dependencies, including on production installs.
