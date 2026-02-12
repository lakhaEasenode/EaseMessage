# Campaign System Redesign — Detailed Changelog

**Date:** February 13, 2026
**Branch:** `campaign`
**Author:** Mohammad Parvez + Claude Code

---

## Why This Change Was Made

The campaign feature previously sent WhatsApp messages in a **blocking synchronous for-loop** inside an Express request handler. For a 10,000-contact campaign, this would block the Node.js event loop for minutes or hours, make 10k sequential HTTP calls, and write to MongoDB 20k times. The scheduler was a bare `setInterval` with no persistence, no retries, and no crash recovery. Delivery status webhooks were completely unhandled. Template variable substitution didn't work (the `components` array was always empty).

This change replaces the entire campaign processing pipeline with a **Redis + BullMQ async job queue architecture** while adding missing features: delivery tracking, template variables, pause/resume/cancel, and opt-in validation.

---

## Architecture: Before vs After

### BEFORE (Blocking)
```
[POST /start] → Express handler → for(contact of contacts) {
    await sendMessage(contact)      // Blocks event loop
    await saveMessage(contact)      // One DB write per message
} → response (after ALL messages sent)
```

### AFTER (Async Queue)
```
[POST /start] → API returns immediately (status: queued)
       │
       ▼
[Redis: campaign-orchestrator queue]  ← One job per campaign
       │
       ▼
[Orchestrator Worker]  ← Validates, fetches contacts, fans out
       │
       ▼
[Redis: campaign-messages queue]  ← One job per message
       │
       ▼
[Message Worker (10 concurrent)]  ← Rate-limited 50/s, 3 retries
       │
       ▼
[Meta Graph API v24.0]  ──webhook──▶  [Webhook Handler]
                                        ↓
                                   Updates delivered/read/failed stats
```

---

## New Files Created (8)

### 1. `server/config/redis.js` (29 lines)

**Purpose:** IORedis connection singleton shared by all BullMQ queues and workers.

**Key details:**
- Connects to `process.env.REDIS_URL` (default: `redis://localhost:6379`)
- Sets `maxRetriesPerRequest: null` — required by BullMQ
- Event listeners for connection errors and successful connect
- `closeRedis()` function for graceful shutdown

```js
// Usage
const { getRedisConnection } = require('./config/redis');
const redis = getRedisConnection(); // Returns singleton
```

---

### 2. `server/queues/campaignQueue.js` (45 lines)

**Purpose:** Defines two BullMQ queues with lazy initialization.

**Queues:**
| Queue | Purpose | Default Job Options |
|-------|---------|-------------------|
| `campaign-orchestrator` | One job per campaign start | None |
| `campaign-messages` | One job per message send | 3 attempts, exponential backoff (5s/10s/20s), keep 1000 completed / 5000 failed |

**Key details:**
- Lazy singleton pattern — queues only created on first access
- `closeQueues()` cleans up both queues on shutdown

---

### 3. `server/workers/index.js` (48 lines)

**Purpose:** Worker lifecycle management — start and stop all campaign workers.

**Exports:**
- `startWorkers()` — Creates both workers + adds repeatable `check-scheduled` job (every 30s)
- `stopWorkers()` — Gracefully closes workers + queues

**Key details:**
- Called from `server/index.js` on server startup
- The scheduled campaign checker is a BullMQ repeatable job (persisted in Redis, survives restarts)

---

### 4. `server/workers/campaignOrchestratorWorker.js` (232 lines)

**Purpose:** Handles campaign fan-out — validates resources, fetches contacts, filters opt-in, enqueues individual message jobs.

**Jobs handled:**

| Job Name | Trigger | Logic |
|----------|---------|-------|
| `start-campaign` | API call to `POST /campaigns/:id/start` | Validates phone/WABA/template, fetches contacts, filters opt-in, bulk-enqueues message jobs |
| `check-scheduled` | Repeatable every 30s | Finds campaigns where `scheduledAt <= now`, atomically transitions to `queued` |

**Key functions:**

- **`buildTemplateComponents(contact, variableMapping)`** — Resolves template variables `{{1}}`, `{{2}}` from contact fields or static values. Returns Meta API `components` array format.

- **`processStartCampaign(job)`** — Full campaign validation pipeline:
  1. Validates phone number exists
  2. Validates WABA has access token
  3. Validates template is still APPROVED
  4. Sets campaign status to `running`, records `startedAt`
  5. Fetches all active contacts in the target list
  6. Filters to only `optedIn === true` contacts
  7. Updates stats: `totalContacts`, `skippedOptOut`, `totalToSend`
  8. Pre-resolves `sendUrl`, `accessToken`, template data (zero DB reads per message)
  9. Bulk-enqueues message jobs via `messageQueue.addBulk()`
  10. If `sendingInterval > 0`, applies incremental delay to each job

- **`processCheckScheduled()`** — Uses atomic `findOneAndUpdate` to prevent double-processing of scheduled campaigns

**Concurrency:** 1 (processes one campaign at a time)

---

### 5. `server/workers/campaignMessageWorker.js` (226 lines)

**Purpose:** Sends individual WhatsApp messages with retry logic, rate limiting, and pause/cancel awareness.

**Job handled:** `send-message` — Sends one template message to one contact via Meta Graph API.

**Processing flow:**
1. **Pause/cancel check** — Reads campaign status from DB
   - If `cancelled`: Discards job, increments `processed`
   - If `paused`: Throws `CAMPAIGN_PAUSED` error → BullMQ retries later
2. **Build Meta API payload** with template name, language, components
3. **Send via `axios.post()`** to `graph.facebook.com/v24.0/{phoneNumberId}/messages`
4. **Extract `wamid`** from Meta response (used for webhook delivery tracking)
5. **Save Message document** with `campaignId`, `wamid`, status `sent`
6. **Atomic stats update** — `$inc: { 'stats.sent': 1, 'stats.processed': 1 }`
7. **Check completion** — If `processed >= totalToSend`, mark campaign as completed/failed

**Error handling:**
| HTTP Status | Action |
|-------------|--------|
| `429` (rate limit) | Throw → BullMQ retries with exponential backoff |
| `4xx` (permanent: bad number, blocked, etc.) | Save failed Message, increment `stats.failed`, NO retry |
| `5xx` / network error | Throw → BullMQ retries |
| All retries exhausted | `worker.on('failed')` handler saves final failure record |

**Rate limiting:** BullMQ worker `limiter: { max: 50, duration: 1000 }` (50 API calls/second, below Meta's 80/s standard tier)

**Concurrency:** `CAMPAIGN_CONCURRENCY` env var (default: 10)

---

### 6. `CAMPAIGN_TODO.md` (detailed implementation phases)

**Purpose:** Comprehensive TODO/guide tracking all 6 implementation phases with file lists, steps, and status markers.

---

### 7. `CAMPAIGN_IMPLEMENTATION_STEPS.md` (step-by-step implementation)

**Purpose:** Earlier implementation guide covering P0 (bugs/security), P1 (CRUD), P2 (execution engine), P3 (frontend).

---

### 8. `.claude/settings.local.json`

**Purpose:** Claude Code local settings for this project.

---

## Modified Files (13)

### 1. `server/models/Campaign.js`

**What changed:** Extended schema with new statuses, stats, and fields.

**Status enum — before:**
```
['draft', 'scheduled', 'running', 'completed', 'failed']
```

**Status enum — after:**
```
['draft', 'scheduled', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled']
```

**New stats fields:**
| Field | Type | Purpose |
|-------|------|---------|
| `totalContacts` | Number | All contacts in list at campaign start |
| `skippedOptOut` | Number | Contacts filtered out (not opted in) |
| `totalToSend` | Number | Eligible contacts (`totalContacts - skippedOptOut`) |
| `processed` | Number | Jobs completed (success + permanent failure) |
| `deliveryFailed` | Number | Webhook-reported delivery failures |

**New document fields:**
| Field | Type | Purpose |
|-------|------|---------|
| `templateVariableMapping` | Array | Maps template `{{N}}` to contact fields or static values |
| `startedAt` | Date | When campaign execution began |
| `completedAt` | Date | When campaign finished (completed/failed/cancelled) |
| `errorMessage` | String | Failure reason for failed campaigns |

**New indexes:**
- `{ user: 1 }` — Fast lookup by user
- `{ status: 1, scheduledAt: 1 }` — Efficient scheduled campaign queries

---

### 2. `server/models/Message.js`

**What changed:** Added campaign tracking and WhatsApp message ID fields.

**New fields:**
| Field | Type | Purpose |
|-------|------|---------|
| `campaignId` | ObjectId (indexed) | Links message to its parent campaign |
| `wamid` | String (indexed) | WhatsApp Message ID from Meta API response — used for delivery tracking via webhooks |
| `errorCode` | Number | Meta API error code for failed messages |
| `errorMessage` | String | Human-readable error description |

**New status value:** Added `'pending'` to status enum.

---

### 3. `server/services/campaignService.js` (completely rewritten — 239 lines)

**What changed:** Replaced blocking send loop with async queue-based architecture. Added new service methods.

**Methods (all new or rewritten):**

| Method | Purpose |
|--------|---------|
| `createCampaign(userId, data)` | Create campaign with validation of phone/template/list. Accepts `templateVariableMapping`. |
| `getVerifiedTemplatesForPhone(userId, phoneNumberId)` | Get APPROVED templates — **now filters by userId** (security fix) |
| `getCampaign(userId, campaignId)` | Fetch single campaign with populated refs |
| `updateCampaign(userId, campaignId, data)` | Update draft/scheduled campaign — re-validates refs |
| `deleteCampaign(userId, campaignId)` | Delete draft/scheduled campaign only |
| `startCampaign(userId, campaignId)` | **Atomic** `findOneAndUpdate` → `queued`, enqueue to orchestrator. Returns immediately. |
| `pauseCampaign(userId, campaignId)` | Atomic: `running` → `paused` |
| `resumeCampaign(userId, campaignId)` | Atomic: `paused` → `running` |
| `cancelCampaign(userId, campaignId)` | Atomic: `running/paused/queued` → `cancelled` |
| `getCampaignMessages(userId, campaignId, page, limit)` | Paginated messages with contact populate |
| `getCampaigns(userId)` | List all user's campaigns with populated refs |

**Concurrency control:** `startCampaign` uses `findOneAndUpdate` with status filter — if two API calls hit simultaneously, only one succeeds.

---

### 4. `server/controllers/campaignController.js` (151 lines)

**What changed:** Added controller methods for all new service operations.

**New methods:**
- `getCampaign` — `GET /:id`
- `updateCampaign` — `PUT /:id`
- `deleteCampaign` — `DELETE /:id`
- `startCampaign` — `POST /:id/start`
- `pauseCampaign` — `POST /:id/pause`
- `resumeCampaign` — `POST /:id/resume`
- `cancelCampaign` — `POST /:id/cancel`
- `getCampaignMessages` — `GET /:id/messages?page=1&limit=50`
- `getVerifiedTemplates` — `GET /templates/:phoneNumberId`

---

### 5. `server/routes/campaigns.js` (61 lines)

**What changed:** Added new route endpoints for campaign lifecycle management.

**Full route table:**
| Method | Path | Controller | Purpose |
|--------|------|-----------|---------|
| `GET` | `/` | `getCampaigns` | List all user campaigns |
| `POST` | `/` | `createCampaign` | Create new campaign |
| `GET` | `/templates/:phoneNumberId` | `getVerifiedTemplates` | Get APPROVED templates for phone |
| `POST` | `/:id/start` | `startCampaign` | Queue campaign for async processing |
| `POST` | `/:id/pause` | `pauseCampaign` | Pause running campaign |
| `POST` | `/:id/resume` | `resumeCampaign` | Resume paused campaign |
| `POST` | `/:id/cancel` | `cancelCampaign` | Cancel active campaign |
| `GET` | `/:id/messages` | `getCampaignMessages` | Paginated campaign messages |
| `GET` | `/:id` | `getCampaign` | Get single campaign |
| `PUT` | `/:id` | `updateCampaign` | Update draft/scheduled campaign |
| `DELETE` | `/:id` | `deleteCampaign` | Delete draft/scheduled campaign |

---

### 6. `server/schedulers/campaignScheduler.js` (24 lines)

**What changed:** Replaced `setInterval()` with BullMQ repeatable job.

**Before:**
```js
setInterval(() => {
    // Check for scheduled campaigns
}, 60000);
```

**After:**
```js
await orchestratorQueue.add('check-scheduled', {}, {
    repeat: { every: 30000 },
    removeOnComplete: true
});
```

**Benefits:** Persists across restarts (stored in Redis), guaranteed single execution even with multiple processes, runs every 30s instead of 60s.

---

### 7. `server/index.js` (244 lines)

**What changed:** Added Redis + worker initialization and graceful shutdown.

**New behavior:**
1. After MongoDB connects and seeds, checks Redis connection via `redis.ping()`
2. If Redis available: starts campaign workers via `startWorkers()`
3. If Redis unavailable: logs warning, server still starts (campaigns just won't work)
4. Graceful shutdown on `SIGTERM`/`SIGINT`: stops workers, closes Redis, then exits

---

### 8. `server/routes/whatsapp.js` (webhook delivery status tracking)

**What changed:** Added handling for Meta's delivery status webhooks (`value.statuses`).

**New behavior (after existing message handling):**
```
Webhook receives → value.statuses array
  For each status update:
    1. Find Message by wamid
    2. Only progress forward: sent → delivered → read (never backwards)
    3. If failed: save error code + message
    4. Update Campaign stats ($inc on delivered/read/deliveryFailed)
```

**Status progression order:** `failed(0) < sent(1) < delivered(2) < read(3)`

This means `stats.delivered` and `stats.read` update in **real-time** as Meta sends webhook callbacks, even after the campaign has completed.

---

### 9. `server/package.json`

**What changed:** Added two new dependencies.
- `bullmq` — Redis-based job queue for Node.js
- `ioredis` — Redis client for Node.js (required by BullMQ)

---

### 10. `server/package-lock.json`

**What changed:** Lock file updated with new dependency trees (~640 lines added).

---

### 11. `client/src/components/campaigns/CampaignDetail.jsx` (334 lines)

**What changed:** Complete UI overhaul with new campaign controls and stats display.

**New features:**
- **Action buttons based on status:**
  - Draft → "Start Campaign" button
  - Running → "Pause" button
  - Paused → "Resume" button
  - Running/Paused/Queued → "Cancel" button
  - Draft/Scheduled → "Delete" button
- **Progress bar** for running/queued campaigns showing `processed / totalToSend`
- **Error message display** for failed campaigns (red banner)
- **Enhanced stats section** with visual bars for sent, delivered, read, failed
- **Timestamp display** for startedAt and completedAt
- **Opt-out info** showing skipped contacts count
- **Auto-polling** every 3 seconds when campaign is running or queued
- **Status badges** for all 8 statuses with unique colors and animated icons

---

### 12. `client/src/components/campaigns/CampaignList.jsx` (172 lines)

**What changed:** Enhanced table with new status badges and inline stats.

**New features:**
- Status badges for all 8 statuses (queued=yellow, paused=orange, cancelled=gray, etc.)
- **Progress info column:**
  - Running/queued → Progress bar with percentage
  - Completed → Sent count + delivery rate
  - Other → Sent + Read counts
- Eye button wired to `onView(campaign._id)` callback

---

### 13. `client/src/components/campaigns/CreateCampaign.jsx` (308 lines)

**What changed:** Fixed timezone bug in campaign scheduling.

**Fix:** When user selects a date/time via `datetime-local` input, JavaScript's `new Date()` now properly interprets it as local time and converts to UTC ISO string before sending to the API.

```js
// Before (bug: local time sent as UTC)
await axios.post(`${API_URL}/campaigns`, formData, config);

// After (local time properly converted to UTC)
const payload = { ...formData };
if (payload.scheduledAt) {
    payload.scheduledAt = new Date(payload.scheduledAt).toISOString();
}
await axios.post(`${API_URL}/campaigns`, payload, config);
```

---

## New Environment Variables

Add these to `server/.env`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `CAMPAIGN_CONCURRENCY` | `10` | Number of concurrent message worker threads |
| `META_RATE_LIMIT_PER_SECOND` | `50` | Max Meta API calls per second (Meta's limit is 80/s) |

---

## Campaign Status Flow

```
draft ──────────┬──▶ scheduled ──────┐
                │                     │
                │   (scheduledAt      │  (scheduledAt reached,
                │    not set)         │   auto-detected every 30s)
                │                     │
                ▼                     ▼
            queued ◀──────────────────┘
                │
                ▼
            running ──────▶ paused
                │              │
                │              ▼
                │          running (resume)
                │
                ▼
          completed / failed

  Any of [running, paused, queued] ──▶ cancelled
  Any of [draft, scheduled] ──▶ (deleted)
```

---

## Features Implemented

1. **Async Campaign Processing** — Non-blocking, queue-based execution via Redis + BullMQ
2. **Pause / Resume / Cancel** — Runtime control with pause check in message worker
3. **Template Variable Substitution** — `{{1}}`, `{{2}}` resolved from contact fields or static values
4. **Opt-in Filtering** — Only sends to contacts with `optedIn === true`
5. **Delivery Status Tracking** — Real-time webhook updates for delivered/read receipts
6. **Scheduled Campaigns** — Auto-start via persistent BullMQ repeatable job
7. **Crash Recovery** — Job state persisted in Redis, survives process restarts
8. **Concurrency Control** — Atomic `findOneAndUpdate` prevents double-start race condition
9. **Rate Limiting** — 50 API calls/second (configurable, below Meta's 80/s limit)
10. **Retry Logic** — 3 attempts with exponential backoff (5s → 10s → 20s)
11. **Enhanced Statistics** — totalContacts, skippedOptOut, totalToSend, processed, deliveryFailed
12. **Timezone Fix** — Local datetime properly converted to UTC for scheduling
13. **Frontend UI** — Status badges, progress bars, action buttons, real-time polling

---

## What's NOT Done Yet (Future Work)

- **Phase 5 Frontend**: `TemplateVariableMapper.jsx` component (UI for mapping template variables to contact fields during campaign creation)
- **Migration Script**: `server/migrate_campaign_v2.js` to backfill existing campaign/message documents with new fields
- **List Opt-in Stats**: `GET /api/lists/:id/stats` endpoint
- **Audience Selector Enhancement**: Show opt-in counts per list in campaign creation UI
