# Campaign System — Step-by-Step Implementation Guide

This document lists every change needed for the campaign feature, organized by priority. Check off each step as you complete it.

---

## P0 — Bugs & Security Fixes (Do These First)

### Step 1: Fix security bug in template fetching
**File:** `server/services/campaignService.js` (lines 54-68)

**Problem:** `getVerifiedTemplatesForPhone()` on line 65 queries `Template.find({ status: 'APPROVED' })` with no `userId` filter. Any authenticated user can see ALL approved templates from every user in the system.

**What to change:** Replace line 65-67:
```js
// BEFORE (broken):
return await Template.find({
    status: 'APPROVED'
});

// AFTER (fixed):
return await Template.find({
    userId: userId,
    wabaId: phone.wabaId,
    status: 'APPROVED'
});
```

The `phone` variable (already fetched and validated on line 55) has a `wabaId` field. This scopes templates to the correct user AND their specific WhatsApp Business Account.

- [ ] Done

---

### Step 2: Fix `server/seed.js` — schema mismatches
**File:** `server/seed.js`

**What's wrong (lines 29-60):**

| Line | Field Used | Correct Schema Field | Problem |
|------|-----------|---------------------|---------|
| 30-33 | `name` | `firstName` (required) | Wrong field name |
| 30-33 | _(missing)_ | `userId` (required) | Not provided |
| 30-33 | _(missing)_ | `countryCode` (required) | Not provided |
| 30-33 | _(missing)_ | `optedIn` (required) | Not provided |
| 30-33 | `source` | `optInSource` | Wrong field name |
| 42 | `templateName` | `templateId` (ObjectId ref) | Wrong field — needs ObjectId |
| 43 | `status: 'sent'` | _(not in enum)_ | Valid values: `draft`, `scheduled`, `running`, `completed`, `failed` |
| 39-60 | _(missing)_ | `user`, `phoneNumberId`, `templateId`, `listId` | All required Campaign fields missing |

**How to fix — rewrite `seedData()` to:**
1. Find or create a test User (needed as `userId` / `user` ref for all other records)
2. Create contacts with correct fields:
   ```js
   {
       userId: testUser._id,
       firstName: 'John',
       lastName: 'Doe',
       countryCode: '1',
       phoneNumber: '234567890',
       email: 'john@example.com',
       tags: ['lead'],
       optedIn: true,
       optInSource: 'manual'
   }
   ```
3. Create a List and associate contacts to it
4. Create Template records (or find existing ones) to get valid ObjectId refs
5. Create a WhatsAppPhoneNumber record (or find existing one) for `phoneNumberId`
6. Create Campaign records with ALL required refs:
   ```js
   {
       user: testUser._id,
       name: 'Summer Sale',
       phoneNumberId: phoneNumber._id,
       templateId: template._id,
       listId: list._id,
       status: 'completed',  // NOT 'sent'
       stats: { sent: 120, delivered: 115, read: 90 }
   }
   ```

**Also fix:** The inline `seedData()` function inside `server/index.js` (lines 55-112) has the exact same problems — apply the same fixes there.

- [ ] Done

---

### Step 3: Clean up `server/index.js` — duplicate routes & unused variables
**File:** `server/index.js`

**Problem 1 — Auth route registered twice:**
- Line 35: `app.use('/api/auth', require('./routes/auth'));` ← first registration
- Line 45: `app.use('/api/auth', require('./routes/auth'));` ← duplicate

**Fix:** Delete line 35.

**Problem 2 — Unused variable declarations (lines 36-42):**
```js
const contactRoutes = require('./routes/contacts');   // never used
const listRoutes = require('./routes/lists');          // never used
const statsRoutes = require('./routes/stats');         // never used
const campaignRoutes = require('./routes/campaigns');  // never used
const whatsappRoutes = require('./routes/whatsapp');   // never used
const templateRoutes = require('./routes/templates');  // never used
const dashboardRoutes = require('./routes/dashboard'); // never used
```
These are declared but the routes are re-required inline on lines 46-53.

**Fix:** Delete lines 36-42. Keep only the clean block starting at line 44:
```js
// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/lists', require('./routes/lists'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/dashboard', require('./routes/dashboard'));
```

- [ ] Done

---

## P1 — Complete Campaign CRUD

### Step 4: Add `GET /api/campaigns/:id` — get single campaign

**Files to edit:**
1. `server/services/campaignService.js` — add method:
   ```js
   async getCampaign(userId, campaignId) {
       const campaign = await Campaign.findOne({ _id: campaignId, user: userId })
           .populate('phoneNumberId', 'displayPhoneNumber verifiedName')
           .populate('templateId', 'name components language category')
           .populate('listId', 'name contactCount');
       if (!campaign) throw new Error('Campaign not found');
       return campaign;
   }
   ```

2. `server/controllers/campaignController.js` — add method:
   ```js
   async getCampaign(req, res) {
       try {
           const campaign = await campaignService.getCampaign(req.user.id, req.params.id);
           res.json(campaign);
       } catch (err) {
           console.error('Error fetching campaign:', err.message);
           res.status(404).json({ msg: err.message });
       }
   }
   ```

3. `server/routes/campaigns.js` — add route **AFTER** the `/templates/:phoneNumberId` route (line 19):
   ```js
   // @route   GET api/campaigns/:id
   // @desc    Get single campaign
   // @access  Private
   router.get('/:id', auth, campaignController.getCampaign);
   ```

   **Important:** `/:id` MUST come AFTER `/templates/:phoneNumberId` — otherwise Express would match `templates` as a campaign ID.

- [ ] Done

---

### Step 5: Add `PUT /api/campaigns/:id` — update draft/scheduled campaigns

**Files to edit:**
1. `server/services/campaignService.js` — add method:
   ```js
   async updateCampaign(userId, campaignId, updateData) {
       const campaign = await Campaign.findOne({ _id: campaignId, user: userId });
       if (!campaign) throw new Error('Campaign not found');
       if (!['draft', 'scheduled'].includes(campaign.status)) {
           throw new Error('Can only edit draft or scheduled campaigns');
       }

       const { name, phoneNumberId, templateId, listId, scheduledAt, sendingInterval } = updateData;

       // Re-validate refs if they changed
       if (phoneNumberId && phoneNumberId !== campaign.phoneNumberId.toString()) {
           const phone = await WhatsAppPhoneNumber.findOne({ _id: phoneNumberId, userId });
           if (!phone) throw new Error('Invalid phone number');
       }
       if (templateId && templateId !== campaign.templateId.toString()) {
           const template = await Template.findById(templateId);
           if (!template || template.status !== 'APPROVED') throw new Error('Invalid or unapproved template');
       }
       if (listId && listId !== campaign.listId.toString()) {
           const list = await List.findOne({ _id: listId, userId });
           if (!list) throw new Error('Invalid list');
       }

       // Apply updates
       if (name) campaign.name = name;
       if (phoneNumberId) campaign.phoneNumberId = phoneNumberId;
       if (templateId) campaign.templateId = templateId;
       if (listId) campaign.listId = listId;
       if (scheduledAt !== undefined) {
           campaign.scheduledAt = scheduledAt || null;
           campaign.status = scheduledAt ? 'scheduled' : 'draft';
       }
       if (sendingInterval !== undefined) campaign.sendingInterval = sendingInterval;
       campaign.updatedAt = Date.now();

       return await campaign.save();
   }
   ```

2. `server/controllers/campaignController.js` — add method:
   ```js
   async updateCampaign(req, res) {
       try {
           const campaign = await campaignService.updateCampaign(req.user.id, req.params.id, req.body);
           res.json(campaign);
       } catch (err) {
           console.error('Error updating campaign:', err.message);
           res.status(400).json({ msg: err.message });
       }
   }
   ```

3. `server/routes/campaigns.js` — add route:
   ```js
   // @route   PUT api/campaigns/:id
   // @desc    Update a campaign (draft/scheduled only)
   // @access  Private
   router.put('/:id', auth, campaignController.updateCampaign);
   ```

- [ ] Done

---

### Step 6: Add `DELETE /api/campaigns/:id` — delete draft/scheduled campaigns

**Files to edit:**
1. `server/services/campaignService.js` — add method:
   ```js
   async deleteCampaign(userId, campaignId) {
       const campaign = await Campaign.findOne({ _id: campaignId, user: userId });
       if (!campaign) throw new Error('Campaign not found');
       if (!['draft', 'scheduled'].includes(campaign.status)) {
           throw new Error('Can only delete draft or scheduled campaigns');
       }
       await Campaign.deleteOne({ _id: campaignId });
       return { msg: 'Campaign deleted' };
   }
   ```

2. `server/controllers/campaignController.js` — add method:
   ```js
   async deleteCampaign(req, res) {
       try {
           const result = await campaignService.deleteCampaign(req.user.id, req.params.id);
           res.json(result);
       } catch (err) {
           console.error('Error deleting campaign:', err.message);
           res.status(400).json({ msg: err.message });
       }
   }
   ```

3. `server/routes/campaigns.js` — add route:
   ```js
   // @route   DELETE api/campaigns/:id
   // @desc    Delete a campaign (draft/scheduled only)
   // @access  Private
   router.delete('/:id', auth, campaignController.deleteCampaign);
   ```

- [ ] Done

---

### Step 7: Wire up View button in CampaignList + add CampaignDetail modal

**File 1: `client/src/components/campaigns/CampaignList.jsx`**

Add `onView` to component props:
```jsx
const CampaignList = ({ campaigns, loading, onCreateEndpoint, onView }) => {
```

Update the Eye button (line 110-112) to call `onView`:
```jsx
<button
    onClick={() => onView(campaign._id)}
    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
>
    <Eye size={18} />
</button>
```

**File 2: Create new `client/src/components/campaigns/CampaignDetail.jsx`**

Build a modal component that:
- Takes `campaignId` and `onClose` as props
- Calls `GET /api/campaigns/:id` to fetch full campaign data
- Displays: campaign name, status badge, sender info (phone), template preview, audience (list name + contact count)
- Shows stats: sent / delivered / read / failed counts with progress bars
- Action buttons:
  - "Delete" button (only visible when status is `draft` or `scheduled`) → calls `DELETE /api/campaigns/:id`
  - "Start Campaign" button (only visible when status is `draft`) → calls `POST /api/campaigns/:id/start` (implemented in Step 8)
- When status is `running`: poll `GET /api/campaigns/:id` every 5 seconds to update stats in real-time

**File 3: `client/src/pages/Campaigns.jsx`**

Add state for the selected campaign and render the detail modal:
```jsx
const [selectedCampaignId, setSelectedCampaignId] = useState(null);

// In the JSX, pass onView to CampaignList:
<CampaignList
    campaigns={campaigns}
    loading={loading}
    onCreateEndpoint={() => setView('create')}
    onView={(id) => setSelectedCampaignId(id)}
/>

// Render detail modal when a campaign is selected:
{selectedCampaignId && (
    <CampaignDetail
        campaignId={selectedCampaignId}
        onClose={() => {
            setSelectedCampaignId(null);
            fetchCampaigns(); // refresh list after potential changes
        }}
    />
)}
```

- [ ] Done

---

## P2 — Campaign Execution Engine

### Step 8: Add `POST /api/campaigns/:id/start` — start a campaign

**File 1: `server/routes/campaigns.js`** — add route (before `/:id` routes):
```js
// @route   POST api/campaigns/:id/start
// @desc    Start executing a campaign
// @access  Private
router.post('/:id/start', auth, campaignController.startCampaign);
```

**File 2: `server/controllers/campaignController.js`** — add method:
```js
async startCampaign(req, res) {
    try {
        const campaign = await campaignService.startCampaign(req.user.id, req.params.id);
        res.json(campaign);
    } catch (err) {
        console.error('Error starting campaign:', err.message);
        res.status(400).json({ msg: err.message });
    }
}
```

**File 3: `server/services/campaignService.js`** — this is the big one. Add these requires at the top:
```js
const Contact = require('../models/Contact');
const Message = require('../models/Message');
const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');
const axios = require('axios');
```

Then add the `startCampaign` method:
```js
async startCampaign(userId, campaignId) {
    // 1. Find and validate campaign
    const campaign = await Campaign.findOne({ _id: campaignId, user: userId });
    if (!campaign) throw new Error('Campaign not found');
    if (!['draft', 'scheduled'].includes(campaign.status)) {
        throw new Error('Campaign can only be started from draft or scheduled status');
    }

    // 2. Set status to running
    campaign.status = 'running';
    campaign.updatedAt = Date.now();
    await campaign.save();

    // 3. Get contacts from the target list
    const contacts = await Contact.findActive({
        lists: campaign.listId,
        userId: userId
    });

    // 4. Get phone number record and WABA for access token
    const phoneRecord = await WhatsAppPhoneNumber.findById(campaign.phoneNumberId);
    if (!phoneRecord) {
        campaign.status = 'failed';
        await campaign.save();
        throw new Error('Phone number not found');
    }

    const waba = await WhatsAppBusinessAccount.findById(phoneRecord.wabaId);
    if (!waba || !waba.accessToken) {
        campaign.status = 'failed';
        await campaign.save();
        throw new Error('WhatsApp Business Account not found or missing access token');
    }

    // 5. Get template data
    const template = await Template.findById(campaign.templateId);
    if (!template) {
        campaign.status = 'failed';
        await campaign.save();
        throw new Error('Template not found');
    }

    // 6. Send messages to each contact
    const sendUrl = `https://graph.facebook.com/v24.0/${phoneRecord.phoneNumberId}/messages`;

    for (const contact of contacts) {
        try {
            const phoneNumber = contact.countryCode + contact.phoneNumber;

            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: phoneNumber,
                type: 'template',
                template: {
                    name: template.name,
                    language: { code: template.language || 'en_US' },
                    components: []
                }
            };

            await axios.post(sendUrl, payload, {
                headers: {
                    'Authorization': `Bearer ${waba.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            // Save message record
            await new Message({
                contact: contact._id,
                content: `Template: ${template.name}`,
                type: 'template',
                direction: 'outbound',
                status: 'sent',
                timestamp: new Date()
            }).save();

            campaign.stats.sent += 1;
        } catch (err) {
            console.error(`Campaign ${campaignId}: Failed to send to ${contact._id}:`, err.message);
            campaign.stats.failed += 1;
        }

        // Save progress periodically
        campaign.updatedAt = Date.now();
        await campaign.save();

        // Wait between messages if interval is set
        if (campaign.sendingInterval > 0) {
            await new Promise(resolve => setTimeout(resolve, campaign.sendingInterval * 1000));
        }
    }

    // 7. Mark campaign as completed (or failed if ALL messages failed)
    campaign.status = campaign.stats.sent > 0 ? 'completed' : 'failed';
    campaign.updatedAt = Date.now();
    await campaign.save();

    return campaign;
}
```

**Key notes:**
- The WhatsApp API payload structure is reused from `server/routes/messages.js` (lines 140-154)
- Errors are caught per-contact so one failure doesn't stop the whole campaign
- `stats.sent` and `stats.failed` are incremented and saved after each message
- Campaign is saved after each message so the frontend can poll for real-time progress

- [ ] Done

---

### Step 9: Add `user` field index to Campaign model
**File:** `server/models/Campaign.js`

Add after the schema definition (before `module.exports`):
```js
CampaignSchema.index({ user: 1 });
CampaignSchema.index({ status: 1, scheduledAt: 1 }); // for the scheduler query
```

- [ ] Done

---

### Step 10: Add scheduled campaign runner
**File 1: Create new `server/schedulers/campaignScheduler.js`:**
```js
const Campaign = require('../models/Campaign');
const campaignService = require('../services/campaignService');

const startScheduler = () => {
    console.log('Campaign scheduler started (checking every 60s)');

    setInterval(async () => {
        try {
            const dueCampaigns = await Campaign.find({
                status: 'scheduled',
                scheduledAt: { $lte: new Date() }
            });

            for (const campaign of dueCampaigns) {
                console.log(`Starting scheduled campaign: ${campaign.name} (${campaign._id})`);
                try {
                    await campaignService.startCampaign(campaign.user.toString(), campaign._id.toString());
                } catch (err) {
                    console.error(`Failed to start campaign ${campaign._id}:`, err.message);
                }
            }
        } catch (err) {
            console.error('Scheduler error:', err.message);
        }
    }, 60000); // every 60 seconds
};

module.exports = { startScheduler };
```

**File 2: `server/index.js`** — import and start the scheduler after the server starts:
```js
const { startScheduler } = require('./schedulers/campaignScheduler');

// Inside startServer(), after app.listen():
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startScheduler(); // Add this line
});
```

- [ ] Done

---

## P3 — Frontend Enhancements

### Step 11: Fix the `hideButton` prop in CampaignSummary
**File:** `client/src/components/campaigns/CampaignSummary.jsx`

The component receives `hideButton` as a prop (passed from `CreateCampaign.jsx` line 259 as `hideButton={true}`) but never uses it — the submit button always renders, creating a duplicate button alongside the footer button.

**Fix:** Accept `hideButton` in the destructured props and conditionally render the button:

```jsx
// BEFORE (line 2):
const CampaignSummary = ({ formData, selectedPhone, selectedTemplate, selectedList, onSubmit, submitting }) => {

// AFTER:
const CampaignSummary = ({ formData, selectedPhone, selectedTemplate, selectedList, onSubmit, submitting, hideButton }) => {
```

Then wrap the button (lines 68-74) with a condition:
```jsx
{!hideButton && (
    <button
        onClick={onSubmit}
        disabled={submitting}
        className="w-full bg-blue-600 ..."
    >
        {submitting ? 'Creating Campaign...' : 'Make It Real 🚀'}
    </button>
)}
```

- [ ] Done

---

## File Change Summary

| # | File | Type | What Changes |
|---|------|------|-------------|
| 1 | `server/services/campaignService.js` | Edit | Fix template filter; add `getCampaign`, `updateCampaign`, `deleteCampaign`, `startCampaign` |
| 2 | `server/controllers/campaignController.js` | Edit | Add `getCampaign`, `updateCampaign`, `deleteCampaign`, `startCampaign` |
| 3 | `server/routes/campaigns.js` | Edit | Add 5 new routes |
| 4 | `server/seed.js` | Edit | Rewrite with correct schema fields |
| 5 | `server/index.js` | Edit | Remove duplicates, fix seedData, add scheduler |
| 6 | `server/models/Campaign.js` | Edit | Add indexes |
| 7 | `server/schedulers/campaignScheduler.js` | **New** | Scheduled campaign runner |
| 8 | `client/src/components/campaigns/CampaignList.jsx` | Edit | Wire up View button |
| 9 | `client/src/components/campaigns/CampaignDetail.jsx` | **New** | Campaign detail modal |
| 10 | `client/src/components/campaigns/CampaignSummary.jsx` | Edit | Use `hideButton` prop |
| 11 | `client/src/pages/Campaigns.jsx` | Edit | Add selected campaign state + detail modal |

---

## How to Verify

### After P0 (Steps 1-3):
```bash
cd server && node seed.js
# Should complete without errors

# Start server, login as two different users
# Verify user A can't see user B's templates during campaign creation
```

### After P1 (Steps 4-7):
- Create a campaign via UI → verify it shows in the list
- Click the Eye icon → verify the detail modal opens with correct data
- Delete a draft campaign → verify it disappears from the list

### After P2 (Steps 8-10):
- Create a campaign targeting a list with test contacts
- Click "Start Campaign" in the detail modal
- Watch status change: `draft` → `running` → `completed`
- Check MongoDB Messages collection for new outbound template messages
- Verify `stats.sent` matches the number of contacts in the list
- Create a scheduled campaign with a time 2 minutes in the future → verify it auto-starts

### After P3 (Step 11):
- Open campaign creation wizard, go to Step 2
- Verify only ONE submit button is visible (the footer button), not two
