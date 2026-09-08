# REST API Contract

All routes are prefixed with `/api/v1`. Success responses use `{ "success": true, "data": ... }`; failures use `{ "success": false, "error": { "code", "message", "details?" } }`.

## Authentication and user

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `PATCH /users/me`

## Masters and conversations

- `GET /masters`
- `GET /masters/:slug`

Master detail responses include `guideTitle` and a validated `guideContent` block array. Supported block types are `heading`, `paragraph`, `list`, `quote`, `table`, and `image`. Admin create/update requests accept the same structured guide alongside the AI persona fields.
- `POST /conversations`
- `GET /conversations?masterId=&page=1&limit=20`
- `GET /conversations/:id`
- `GET /conversations/:id/messages?cursor=&limit=20`
- `DELETE /conversations/:id`
- `POST /chat/messages` (Server-Sent Events stream; accepts `Idempotency-Key`)

## Plans, usage, payments and invoices

- `GET /subscriptions/plans`
- `GET /subscriptions/current`
- `GET /subscriptions/usage`
- `POST /payments/create-order`
- `POST /payments/verify`
- `POST /payments/webhook`
- `GET /payments`
- `GET /payments/:id`
- `GET /invoices`
- `GET /invoices/:id`

## Administration (`ADMIN` or `SUPER_ADMIN`)

- `GET /admin/dashboard`
- `GET /admin/users`
- `PATCH /admin/users/:id`
- `POST /admin/masters`
- `GET /admin/masters`
- `PATCH /admin/masters/:id`
- `DELETE /admin/masters/:id` (soft deactivate)
- `GET /admin/conversations`
- `GET /admin/subscriptions`
- `GET /admin/payments`
- `GET /admin/activity-logs`
- `GET /admin/reports/revenue`
- `GET /admin/settings`
- `PATCH /admin/settings/:key`
- `GET /admin/plans`
- `POST /admin/plans`
- `PATCH /admin/plans/:id`

## Operations

- `GET /health/live`
- `GET /health/ready`
- Swagger UI: `/docs`
- OpenAPI JSON: `/docs-json`
