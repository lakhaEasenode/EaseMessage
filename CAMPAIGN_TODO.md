# Campaign Feature Redesign — Implementation TODO

## Problem Statement

The current campaign system sends WhatsApp messages in a **blocking synchronous for-loop** that:
- Blocks the Node.js event loop for minutes/hours on large campaigns
- Has no crash recovery (process dies = lost progress)
- No retries for failed messages
- No concurrency control (same campaign can start twice)
- No delivery status tracking (delivered/read stats always 0)
- No template variable substitution
- No pause/resume capability

## Target Architecture

```
[API: Start Campaign] → [Redis: orchestrator queue] → [Orchestrator Worker]
                                                              │
                                                    (fans out contacts)
                                                              │
                                                              ▼
                                                   [Redis: messages queue]
                                                              │
                                                    (rate-limited, 50/s)
                                                              │
                                                              ▼
                                                   [Message Worker x10]
                                                              │
                                                              ▼
                                                    [Meta Graph API v24.0]
                                                              │
                                                       (webhook callback)
                                                              │
                                                              ▼
                                                    [Webhook Handler]
                                                    (updates delivered/read)
```

---

## PHASE 1: Infrastructure + Schema Changes
> **Goal**: Set up Redis/BullMQ foundation and prepare database schemas

### 1.1 Install Dependencies
- [ ] `npm install bullmq ioredis` in `server/`
- **bullmq**: Job queue library built on Redis. Provides reliable job processing with retries, rate limiting, delayed jobs, repeatable jobs, and concurrent workers.
- **ioredis**: High-performance Redis client for Node.js. Used by BullMQ internally and shared across our queues/workers.

### 1.2 Environment Variables
- [ ] Add to `server/.env`:
  ```
  REDIS_URL=redis://localhost:6379
  CAMPAIGN_CONCURRENCY=10
  META_RATE_LIMIT_PER_SECOND=50
  ```
- **REDIS_URL**: Connection string for Redis instance
- **CAMPAIGN_CONCURRENCY**: How many message-send jobs run in parallel (BullMQ worker concurrency). 10 = 10 simultaneous Meta API calls.
- **META_RATE_LIMIT_PER_SECOND**: Global rate limit for Meta API calls. Meta's standard tier allows 80/s — we set 50 to leave headroom.

### 1.3 Redis Connection Module — `server/config/redis.js`
- [ ] Create shared IORedis connection singleton
- **Why singleton**: BullMQ best practice — all queues and workers share one connection pool to avoid hitting Redis connection limits.
- **Graceful degradation**: App should start even if Redis is down (non-campaign features still work), but campaign operations return errors.

### 1.4 Campaign Schema Changes — `server/models/Campaign.js`
- [ ] Add new status values to enum: `'queued'`, `'paused'`, `'cancelled'`
- [ ] Add new stats fields:
  - `totalContacts` — total contacts in list at campaign start
  - `skippedOptOut` — contacts filtered because optedIn=false
  - `totalToSend` — eligible contacts (totalContacts - skippedOptOut)
  - `processed` — jobs completed (success + permanent failure). Used for completion detection.
  - `deliveryFailed` — delivery-time failures reported via Meta webhook
- [ ] Add `templateVariableMapping` array field — stores how template {{1}}, {{2}} map to contact fields
- [ ] Add `startedAt`, `completedAt` date fields — for tracking campaign duration
- [ ] Add `errorMessage` string field — stores why a campaign failed (e.g., "WABA access token expired")

### 1.5 Message Schema Changes — `server/models/Message.js`
- [ ] Add `campaignId` (ObjectId, indexed) — links message to the campaign that sent it
- [ ] Add `wamid` (String, indexed) — WhatsApp Message ID from Meta's API response. Used to match webhook delivery/read receipts back to the message.
- [ ] Add `errorCode` (Number) — Meta API error code for failed sends
- [ ] Add `errorMessage` (String) — Human-readable error from Meta

### 1.6 Migration Script — `server/migrate_campaign_v2.js`
- [ ] Add new fields with defaults to existing Campaign documents
- [ ] Add new fields to existing Message documents
- [ ] Backfill `totalToSend` from `sent + failed` for completed campaigns

---

## PHASE 2: Core Queue Pipeline
> **Goal**: Replace the blocking synchronous send loop with async job-based processing

### 2.1 Queue Definitions — `server/queues/campaignQueue.js`
- [ ] Define `campaign-orchestrator` queue — handles campaign-level operations (validation, fan-out, scheduling)
- [ ] Define `campaign-messages` queue — handles individual message sends with:
  - **3 retry attempts** with exponential backoff (5s, 10s, 20s)
  - **Auto-cleanup**: keep last 1000 completed jobs, last 5000 failed jobs
  - These defaults ensure failed sends get retried (e.g., network blip) but permanently failed messages (invalid number) don't clog the queue

### 2.2 Orchestrator Worker — `server/workers/campaignOrchestratorWorker.js`
- [ ] Handle `start-campaign` job:
  1. Load campaign with all populated refs (phone, WABA, template, list)
  2. Validate everything still exists and is valid (template still APPROVED, WABA token not expired)
  3. Set campaign status → `'running'`, record `startedAt`
  4. Fetch all active contacts in the target list
  5. Filter to only opted-in contacts (optedIn === true)
  6. Record stats: totalContacts, skippedOptOut, totalToSend
  7. **Pre-resolve all data**: Extract accessToken, build sendUrl, get template name/language. Pass all this as job data so message workers need ZERO database reads.
  8. Enqueue one `send-message` job per contact into `campaign-messages` queue
  9. If sendingInterval > 0, set incremental delay on each job (job N delayed by N * interval * 1000ms)

- [ ] Handle `check-scheduled` repeatable job (every 30s):
  1. Query for campaigns where status='scheduled' AND scheduledAt <= now
  2. For each, enqueue a `start-campaign` job
  3. Use atomic findOneAndUpdate to change status to 'queued' (prevents double-processing)

### 2.3 Message Worker — `server/workers/campaignMessageWorker.js`
- [ ] Process one `send-message` job per concurrency slot:
  1. **Pause check**: Load campaign status. If 'paused' or 'cancelled', throw a retriable error (job goes back to delayed state)
  2. Build Meta API payload from pre-resolved job data (template name, language, components)
  3. POST to Meta Graph API with 15s timeout
  4. Extract `wamid` from response (`response.data.messages[0].id`)
  5. Save Message document with campaignId, wamid, status='sent'
  6. Atomically increment `stats.sent` and `stats.processed` on Campaign using `$inc`
  7. **Completion detection**: After $inc, check if `processed >= totalToSend`. If so, set campaign status to 'completed' (or 'failed' if sent=0)

- [ ] Error handling:
  - **429 (rate limited)**: Throw error → BullMQ retries with exponential backoff
  - **4xx (permanent failure)**: Don't retry. Increment `stats.failed` + `stats.processed`. Save error details on Message.
  - **5xx / network error**: Throw error → BullMQ retries

- [ ] Rate limiting via BullMQ: `limiter: { max: 50, duration: 1000 }` (50 API calls/second globally)

### 2.4 Worker Init — `server/workers/index.js`
- [ ] Initialize both workers with Redis connection
- [ ] Set up error event listeners (log worker errors)
- [ ] Export `startWorkers()` and `stopWorkers()` functions

### 2.5 Rewrite startCampaign() — `server/services/campaignService.js`
- [ ] Replace the 100-line synchronous for-loop (lines 138-238) with:
  ```
  1. Atomic findOneAndUpdate: status from draft/scheduled → queued (prevents race condition)
  2. Add job to orchestrator queue
  3. Return immediately
  ```
- [ ] The API response is now instant (no more blocking for minutes)

### 2.6 Replace Scheduler — `server/schedulers/campaignScheduler.js`
- [ ] Remove setInterval-based polling
- [ ] Use BullMQ repeatable job (runs every 30s, survives restarts, single-execution guaranteed)

### 2.7 Wire Into Server — `server/index.js`
- [ ] Add Redis connection check on startup (ping test)
- [ ] Replace `startScheduler()` call with `startWorkers()`
- [ ] Add graceful shutdown: close workers and Redis connections on SIGTERM/SIGINT

---

## PHASE 3: Pause/Resume/Cancel + New Endpoints
> **Goal**: Give users control over running campaigns

### 3.1 New Service Methods — `server/services/campaignService.js`
- [ ] `pauseCampaign(userId, campaignId)`:
  - Atomic update: status from 'running' → 'paused'
  - Message worker checks campaign status before each send — paused campaigns get skipped

- [ ] `resumeCampaign(userId, campaignId)`:
  - Atomic update: status from 'paused' → 'running'
  - Pending message jobs will now proceed normally

- [ ] `cancelCampaign(userId, campaignId)`:
  - Atomic update: status from 'running'/'paused'/'queued' → 'cancelled'
  - Record completedAt timestamp
  - Message worker discards jobs for cancelled campaigns

- [ ] `getCampaignMessages(userId, campaignId, page, limit)`:
  - Paginated query: `Message.find({ campaignId }).sort({ timestamp: -1 }).skip().limit()`
  - Returns messages sent by this campaign with delivery status

### 3.2 New Controller Methods — `server/controllers/campaignController.js`
- [ ] Add pauseCampaign, resumeCampaign, cancelCampaign, getCampaignMessages

### 3.3 New Routes — `server/routes/campaigns.js`
- [ ] `POST /:id/pause` → pauseCampaign
- [ ] `POST /:id/resume` → resumeCampaign
- [ ] `POST /:id/cancel` → cancelCampaign
- [ ] `GET /:id/messages` → getCampaignMessages (query: ?page=1&limit=50)

### 3.4 List Opt-in Stats — `server/routes/lists.js`
- [ ] `GET /api/lists/:id/stats` → { totalContacts, optedInCount, optedOutCount }
- Used by frontend to show opt-in warnings in audience selector

---

## PHASE 4: Webhook Delivery Status Tracking
> **Goal**: Track delivered/read/failed status from Meta webhook callbacks

### 4.1 Enhance Webhook Handler — `server/routes/whatsapp.js`
- [ ] After existing `value.messages` block, add handling for `value.statuses`:
  1. Extract wamid and new status from webhook payload
  2. Find Message by wamid
  3. Only progress status forward (sent → delivered → read), never backwards
  4. Update Message.status in DB
  5. If message has campaignId, atomically increment the corresponding campaign stat

- **Why this matters**: Currently stats.delivered and stats.read are always 0. With this change, they update in real-time as Meta sends delivery confirmations — even hours after the campaign completed.

- **Status progression rules**:
  - `sent` (1) → `delivered` (2) → `read` (3): always forward
  - `failed` (0): can happen at any point, treated as terminal

---

## PHASE 5: Template Variable Substitution
> **Goal**: Make template parameters ({{1}}, {{2}}) actually work with contact data

### 5.1 Variable Resolution — Orchestrator Worker
- [ ] Add `buildTemplateComponents(contact, variableMapping)` function
- [ ] For each variable mapping entry, resolve the value from contact fields (firstName, lastName, etc.) or customAttributes, or use static value
- [ ] Build Meta API `components` array with resolved values
- [ ] Pass pre-resolved components as part of each message job data

### 5.2 Campaign Creation — `server/services/campaignService.js`
- [ ] Accept `templateVariableMapping` in createCampaign and updateCampaign
- [ ] Store on Campaign document

### 5.3 Frontend: Variable Mapper — `client/src/components/campaigns/TemplateVariableMapper.jsx`
- [ ] New component shown after template selection (only if template has variables)
- [ ] For each {{N}} placeholder: dropdown to select contact field or enter static value
- [ ] Field options: firstName, lastName, email, companyName + custom attributes

### 5.4 Update CreateCampaign — `client/src/components/campaigns/CreateCampaign.jsx`
- [ ] Add variable mapping sub-section in step 1 after template selection

---

## PHASE 6: Frontend Enhancements
> **Goal**: Update UI to show new statuses, controls, and enhanced stats

### 6.1 Campaign Detail — `client/src/components/campaigns/CampaignDetail.jsx`
- [ ] Add Pause/Resume/Cancel buttons based on campaign status
- [ ] Progress bar: processed / totalToSend * 100%
- [ ] Enhanced stats display: totalContacts, skippedOptOut, sent, delivered, read, failed
- [ ] Show startedAt / completedAt timestamps
- [ ] Show errorMessage if present
- [ ] Poll every 3s when status is 'running' or 'queued'

### 6.2 Campaign List — `client/src/components/campaigns/CampaignList.jsx`
- [ ] Add status badges for new statuses: queued (yellow), paused (orange), cancelled (gray)
- [ ] Show progress % for running campaigns
- [ ] Show delivery rate (delivered/sent) for completed campaigns

### 6.3 Audience Selector — `client/src/components/campaigns/AudienceSelector.jsx`
- [ ] Show opt-in stats: "X of Y contacts opted in" below each list
- [ ] Warning indicator if many contacts haven't opted in

### 6.4 Campaign Summary — `client/src/components/campaigns/CampaignSummary.jsx`
- [ ] Display template variable mappings in review section

---

## Files Inventory

### New Files
| File | Phase | Purpose |
|------|-------|---------|
| `server/config/redis.js` | 1 | IORedis connection singleton |
| `server/queues/campaignQueue.js` | 2 | BullMQ queue definitions |
| `server/workers/index.js` | 2 | Worker initialization |
| `server/workers/campaignOrchestratorWorker.js` | 2 | Campaign fan-out logic |
| `server/workers/campaignMessageWorker.js` | 2 | Individual message sends |
| `server/migrate_campaign_v2.js` | 1 | Schema migration script |
| `client/src/components/campaigns/TemplateVariableMapper.jsx` | 5 | Variable mapping UI |

### Modified Files
| File | Phase | Changes |
|------|-------|---------|
| `server/package.json` | 1 | Add bullmq, ioredis |
| `server/.env` | 1 | Add REDIS_URL, CAMPAIGN_CONCURRENCY, META_RATE_LIMIT_PER_SECOND |
| `server/models/Campaign.js` | 1 | Extended statuses, stats, variableMapping, timestamps |
| `server/models/Message.js` | 1 | Add campaignId, wamid, error fields |
| `server/services/campaignService.js` | 2,3 | Rewrite startCampaign + add pause/resume/cancel |
| `server/controllers/campaignController.js` | 3 | Add new controller methods |
| `server/routes/campaigns.js` | 3 | Add new route endpoints |
| `server/routes/whatsapp.js` | 4 | Add delivery status webhook handling |
| `server/routes/lists.js` | 3 | Add stats endpoint |
| `server/schedulers/campaignScheduler.js` | 2 | Replace with BullMQ repeatable |
| `server/index.js` | 2 | Redis init, start workers, graceful shutdown |
| `client/src/components/campaigns/CreateCampaign.jsx` | 5 | Add variable mapping step |
| `client/src/components/campaigns/CampaignDetail.jsx` | 6 | Pause/resume/cancel + enhanced stats |
| `client/src/components/campaigns/CampaignList.jsx` | 6 | New statuses + progress |
| `client/src/components/campaigns/AudienceSelector.jsx` | 6 | Opt-in stats |
| `client/src/components/campaigns/CampaignSummary.jsx` | 6 | Show variable mappings |
