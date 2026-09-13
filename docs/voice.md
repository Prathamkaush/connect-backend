# In-app AI voice calls

Implementation date: 12 September 2026. **Disabled by default. Live provider/audio acceptance is still required before enabling for customers.**

This feature uses browser microphone/speaker audio over WebRTC. It does not use phone numbers, SIMs, or a telecom provider. Text chat continues to use the existing AI provider and question accounting.

## Setup

1. Install backend dependencies with `npm ci`, then run `npm run prisma:generate` and `npm run prisma:deploy` against the intended database. Deploy the additive migration before starting this backend version. The upgrade was tested against isolated PostgreSQL, including existing subscriber rows.
2. Keep `VOICE_ENABLED=false` until the manual checks below are complete. Set `OPENAI_API_KEY` on the backend only. It is independent of `AI_PROVIDER`, which may remain `openrouter` or `gemini` for text.
3. Start with these settings (also present in `.env.example`):

   ```dotenv
   VOICE_ENABLED=false
   VOICE_REALTIME_MODEL=gpt-realtime-2.1-mini
   VOICE_MAX_CALL_SECONDS=180
   VOICE_RETAIN_ASSISTANT_TRANSCRIPTS=false
   OPENAI_API_KEY=
   ```

4. In **Admin → Teachers**, enable calling for one teacher, choose a built-in synthetic voice, and optionally set voice-specific instructions. The existing persona, topic restrictions, platform safety rules and bounded teacher guide are included automatically. No attempt is made to reproduce a historical person's actual voice.
5. In **Admin → Plans**, enter included voice minutes and enable voice for new purchases. For example, a plan with 100 text questions and 20 voice minutes stores 1,200 seconds. No existing plan or price is automatically changed.
6. To test locally, enable voice in a private environment, restart the backend, and use **Admin → Voice Calls → Manual test call**. The frontend still uses `NEXT_PUBLIC_API_URL`; no OpenAI credential belongs in frontend configuration. Use HTTPS in deployment; localhost also permits microphone access.

## Subscription and accounting rules

- Text questions and voice seconds are independent. Spoken turns never call `UsageService` or create a `QuestionUsage` entry.
- Voice is shared by all teachers within the user's active subscription. Seven minutes with Buddha plus five with Krishna use 720 of 1,200 seconds, leaving 480 seconds (8:00). Fifty typed questions from a 100-question plan still leave 50 text questions.
- The existing billing cycle is a fixed `validityDays` period beginning with verified payment, not calendar-month renewal. Purchasing again replaces the active paid subscription and starts a new period. There is no automatic renewal, carryover, or reconnect reset.
- Plan voice allowance is snapshotted on order creation and copied to the subscription on verified payment. Editing a plan affects future orders only. Legacy plans, orders and subscriptions receive zero voice seconds. Existing prices, text balances and validity periods are preserved.
- PostgreSQL locks the user row for reservation and payment activation. A unique active-user slot prevents parallel calls across tabs, devices and replicas. A call reserves up to the lesser of available allowance, remaining subscription lifetime and the configured per-call cap.
- A durable deadline is saved before audio is enabled. Customer time begins when the backend receives the provider's activation acknowledgement; microphone/ICE setup is excluded. The initial activation handshake does not extend the deadline. Count elapsed connected time, including listening, silence and muted time, rounded up to the next second and capped at the reservation/deadline.
- Disconnects are handled by terminating the provider call, not accepting a client-supplied pause timestamp. The interval until confirmed hang-up can be charged. A new explicit call uses the same period's remaining balance; the confirmed interval between calls costs no customer seconds. Browser refresh/tab closure is recovered through the heartbeat timeout.
- Failed setup releases customer time without deduction. Finalization is transactionally idempotent. No reservation or active-user slot is released while provider termination is unconfirmed.

## Server enforcement and recovery

The backend forwards an **audio-only** SDP offer through the unified call-creation endpoint. It rejects additional media and SCTP/data-channel negotiation. No permanent or temporary provider credential, provider call ID, or session configuration is returned to the browser. This deliberately prevents a modified browser from sending `session.update`, changing instructions, enabling paid input transcription or generating extra responses over a provider data channel.

The call starts with turn detection and input transcription disabled. The backend attaches an authenticated sideband WebSocket, stores the provider ID before delivering the SDP answer, and enables VAD only after reserving time and persisting the deadline. VAD supports spoken turns and interruptions. The browser supplies no billable timestamps or duration values. Optional prior context must belong to the same authenticated user and teacher and is limited to an existing 2,000-character summary.

The backend sends an actual provider `POST /realtime/calls/{call_id}/hangup` at the deadline. This runs independently of the Redis control lock so a pending activation cannot postpone the cutoff. Every backend instance also reconciles durable open calls once per second, handling expiry, subscription replacement, disabled accounts/teachers, setup timeout, abandoned browser heartbeats, stale sideband leases and retries of unconfirmed hang-ups. Heartbeats never extend the deadline. Provider hang-up failures remain visible as `STOPPING`, with retry attempts and an error in the admin records.

Run at least two backend replicas with shared PostgreSQL and Redis for recovery during an individual process restart. Synchronize server clocks and avoid scale-to-zero while calls exist. Sideband/browser leases expire after 10 seconds; setup expires after 30 seconds. Locally known provider IDs are also used for emergency hang-up if database or Redis access fails. Reconciliation runs even when `VOICE_ENABLED=false`, allowing a restart with voice disabled to drain existing calls.

There are no browser-submitted provider events or new webhook endpoints. Provider events are received over the backend-authenticated TLS WebSocket. Session creation is rate-limited to five attempts per user and twenty per IP per minute. Customer endpoints enforce ownership; admin test creation and aggregate records require an administrator role.

### Operational limits and launch blockers

- The official examples negotiate a browser data channel. This implementation intentionally omits it for server control. **Successful audio-only SDP negotiation and sideband activation must be confirmed with the real provider before launch.** If the provider requires a client data channel, do not enable one as a workaround: use a trusted media gateway or a provider-enforced client-control policy instead.
- The Realtime controls reviewed do not expose a provider-enforced absolute duration or trusted browser ICE-state events. Activation is gated on the server and disconnections end calls; exact transport-level timestamps are not available. Customer accounting uses server activation/confirmed hang-up timestamps, not packet-level connection duration.
- A durable reconciler cannot guarantee instant remote termination if every backend replica is down or all provider network paths fail. Deadline hang-up also has network latency. The application retains/retries failed terminations, caps customer deductions, and reports pending calls; **strict zero-overrun termination during a total outage is not established by this implementation.** Validate cutoff latency and operational recovery before customer release. A stronger guarantee requires a provider-enforced lifetime or a trusted media gateway that fails closed.
- An ambiguous create failure before receiving the provider call ID cannot be queried by an application idempotency key. It is not retried automatically. No SDP answer has reached the browser and no model responses were enabled in this case. Inspect provider usage if this occurs.
- Raw audio is never recorded by this application. Assistant transcript retention is separately opt-in; input transcription remains off and is not silently billed. This describes application storage, not OpenAI's account-level data-retention policy.

## Call records and provider spending

`VoiceCall` stores user, teacher, subscription period, provider ID, model, reservation, lifecycle timestamps, billable seconds, end reason and termination failures. `VoiceResponseUsage` stores measured `response.done` usage by unique response ID; replay does not double count. Lost sideband events can make these metrics incomplete. No raw audio is saved. Optional assistant transcript text is stored separately from usage.

Admin tests use the same provider controls, require teacher calling to be enabled, have a maximum of 180 seconds, and have `isAdminTest=true` with no customer subscription reservation. They still cost API credit. The admin screen explicitly separates them from customer records and shows raw measured response metrics. It does not label an estimated dollar amount as actual invoiced spending. Check OpenAI's project usage for the bill.

The default configurable model is `gpt-realtime-2.1-mini`. At the documentation check, the official pricing page lists audio input/output at **$10/$20 per million tokens** and text input/output at **$0.60/$2.40 per million tokens**; cached rates differ. This is not a fixed price per call minute. Context and response length affect spending. [Official pricing](https://developers.openai.com/api/docs/pricing), [model](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini).

The implementation uses Node's native `fetch` for the documented multipart SDP flow and `ws` for sideband control, leaving the existing text SDK unchanged. [WebRTC flow](https://developers.openai.com/api/docs/guides/voice-webrtc), [sideband controls](https://developers.openai.com/api/docs/guides/voice-server-controls), [create-call schema](https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/create), [actual WebRTC hang-up](https://developers.openai.com/api/reference/python/resources/realtime/subresources/calls/methods/hangup).

## API

All endpoints require the existing Bearer authentication. Returned data uses the existing response envelope.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/voice/allowance` | Feature availability, period balance and active call |
| POST | `/voice/calls` | `{masterId, requestId: UUID, sdp, conversationId?}` → app call ID and SDP answer |
| POST | `/voice/calls/:id/activate` | Enable audio after browser WebRTC connection |
| POST | `/voice/calls/:id/heartbeat` | Liveness/status only; cannot extend time |
| POST | `/voice/calls/:id/end` | Request actual provider termination |
| GET | `/voice/calls?before=ISO_DATE` | User call history, 50 records per page |
| GET | `/admin/voice/calls?before=ISO_DATE` | Admin records including provider metrics |
| POST | `/admin/voice/test-calls` | Explicit admin test, independent of customer allowance |

Existing master and plan admin endpoints accept `voiceEnabled`, master `voice`/`voiceInstructions`, and plan `voiceSeconds`. Existing subscription responses now include independent voice totals/used/reserved/remaining fields.

## Automated verification

Results from this implementation run:

- **40 tests passed across 9 suites**, including the opt-in PostgreSQL integration suite and HTTP authentication tests. All provider/payment calls were mocked; no API credit was spent.
- Backend build and lint of all changed backend modules passed.
- Frontend production build and full lint passed.
- All four migrations applied to an isolated local PostgreSQL database. Comparing that database with the Prisma schema found no difference. The project/deployed database was not migrated by this run.
- Full backend lint still reports two pre-existing `no-require-imports` errors in `src/payments/razorpay.service.ts` and its test; these unrelated files were left unchanged.
- Browser setup failed before navigation because the browser tool could not initialize its sandbox metadata. There was no browser/audio or paid OpenAI test.

`npm test` uses mock provider HTTP and never initiates an OpenAI or Razorpay payment. The PostgreSQL suite is opt-in:

```powershell
$env:VOICE_TEST_DATABASE_URL='postgresql://postgres:voice-test-only@127.0.0.1:55439/voice_test'
npm test
```

Use an isolated local database named **voice_test**. The suite creates a randomly named schema, applies the old migrations, creates legacy fixtures, applies the voice migration, and removes only that test schema afterward. It rejects non-local or differently named databases. No project `.env` is loaded by the suite. It covers real PostgreSQL concurrency, period accounting, legacy migration, verified payment/invoice integration with a mocked gateway, ownership and recovery. HTTP tests exercise JWT authentication, disabled accounts, admin roles and request validation.

## Manual smoke test — no more than 2–3 minutes total

Nothing in setup or the automated suite starts a paid call. With only $5 credit, use a dedicated OpenAI project/key and check its current usage first. Disable automatic credit recharge if you do not want it. Do not treat a notification budget as a guaranteed hard spending cap.

1. Set `VOICE_MAX_CALL_SECONDS=60` for the first test, enable voice privately, and choose one enabled teacher in **Admin → Voice Calls**. Press **Start paid API test** yourself.
2. Confirm microphone permission, audible playback, AI identification, natural spoken turns, interruption, mute/unmute and desktop/mobile layout. Allow the first 60-second call to reach its deadline; confirm audio actually stops and the admin record has a confirmed terminal status. Try a fresh spoken turn after cutoff: it must receive no response.
3. Use at most another 60–120 seconds to check explicit End call and a network disconnect/refresh. Confirm the old provider call is terminated before a new one starts and that customer/test usage stays separate. Do not run these as automatic paid tests.
4. Inspect OpenAI project usage before and after (allow reporting lag). Compare available measured response metrics; no dollar cost is guaranteed from wall-clock minutes. Return `VOICE_ENABLED=false` after the test.

Before customer launch, also manually validate real quota/expiry cutoffs, two-tab blocking, backend restart recovery, API hang-up failure behavior, audio-only SDP compatibility, and that no actual provider session survives a confirmed termination. Browser automation was unavailable in the implementation environment, so microphone, playback, mobile behavior and actual provider termination were **not verified**.
