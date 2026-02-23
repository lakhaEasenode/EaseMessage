# Inbox Section Improvements — Detailed Changelog

**Date:** February 14, 2026
**Branch:** `inbox`
**Author:** Mohammad Parvez + Claude Code

---

## Why These Changes Were Made

A staff-level code review of the Inbox section identified **3 security vulnerabilities**, **3 bugs**, and **7 UX/architecture improvements**. The security issues allowed any authenticated user to read or send messages as another user. The conversation list search was non-functional. The template-loading logic was duplicated across two components. Error handling used blocking `alert()` calls. Message history loaded unbounded (no pagination). There were no unread message indicators. Typed-but-unsent messages were lost when switching conversations.

---

## Security Fixes (3)

### 1. Authorization on `GET /messages/:contactId`

**File:** `server/routes/messages.js` (lines 90-100)

**Before:** Any authenticated user could read any contact's messages by guessing a `contactId`. No ownership check.

**After:** Verifies the contact belongs to `req.user.id` and is not soft-deleted before returning messages.

```js
// NEW: Ownership check
const contact = await Contact.findOne({
    _id: req.params.contactId,
    userId: req.user.id,
    isDeleted: false
});
if (!contact) return res.status(404).json({ msg: 'Contact not found' });
```

---

### 2. Authorization on `POST /messages/send`

**File:** `server/routes/messages.js` (lines 140-148)

**Before:** `Contact.findById(contactId)` — no user scoping. Any user could send messages to any contact.

**After:** `Contact.findOne({ _id: contactId, userId: req.user.id, isDeleted: false })` — scoped to the authenticated user.

---

### 3. Conversations Aggregation Scoped to User

**File:** `server/routes/messages.js` (lines 14-85)

**Before:** `Message.aggregate()` ran over **all messages in the database** across all users, then filtered contacts afterward. At scale, this scans millions of documents unnecessarily and risks data leakage.

**After:**
1. First fetches the user's contact IDs: `Contact.find({ userId: req.user.id }).select('_id')`
2. Aggregation pipeline starts with `$match: { contact: { $in: userContactIds } }` — only touches this user's data
3. Also computes `unreadCount` per conversation in the same aggregation (see improvement #8)

---

## Bug Fixes (3)

### 4. Access Token Mismatch in Send Message

**File:** `server/routes/messages.js` (line 220)

**Before:** The route found the first WABA for the user (`wabaAccount`) AND the WABA for the default phone number (`phoneWaba`), but used `wabaAccount.accessToken` in the API call. If a user had multiple WABAs, the wrong token would be used.

**After:** Removed the redundant first WABA lookup. Now only uses `phoneWaba.accessToken` — the token from the WABA that owns the default phone number.

Also added `wamid` extraction from the Meta API response to enable delivery status tracking via webhooks:
```js
const wamid = response.data?.messages?.[0]?.id || null;
```

---

### 5. ConversationList Search Was Non-Functional

**Files:** `client/src/components/inbox/ConversationList.jsx`, `client/src/pages/Inbox.jsx`

**Before:** The search input had no `onChange` handler or state. It was purely decorative.

**After:**
- Added `searchQuery` state in `Inbox.jsx`
- Passed `searchQuery` and `onSearchChange` props to `ConversationList`
- Wired the input to controlled state
- Filtering logic searches by contact name (first + last) and phone number
- Combined with the existing status filter (both filters apply simultaneously)

---

### 6. Webhook Phone Number Matching Was Fragile

**File:** `server/routes/whatsapp.js` (lines 207-238)

**Before:** `phoneNumber: { $regex: from.slice(-10) }` — took the last 10 digits and did an unanchored regex match. Could match the wrong contact (e.g., two contacts with different country codes but same local number).

**After:**
1. Normalizes the sender number by stripping non-digits
2. Tries exact match first (`phoneNumber: normalizedFrom` or `phoneNumber: from`)
3. Falls back to anchored last-10-digit match (`$regex: last10 + '$'`) only if exact match fails
4. Also added `isDeleted: false` to the contact lookup
5. Fixed new contact creation: `lastName` set to empty string instead of hardcoded `'WhatsApp'`
6. Fixed message type mapping: now correctly maps `video`, `document` types instead of everything being `'image'`

---

## UX & Architecture Improvements (7)

### 7. Shared `useApprovedTemplates` Hook

**New file:** `client/src/hooks/useApprovedTemplates.js` (70 lines)

**Before:** ~50 lines of identical template-fetching logic was copy-pasted between `MessageInput.jsx` and `NewMessageModal.jsx`. Both independently fetched templates, found the default WABA, and filtered to approved.

**After:** Extracted to a shared React hook:
```js
const { templates, loading, fetchTemplates, resetTemplates } = useApprovedTemplates();
```

| Consumer | Before | After |
|----------|--------|-------|
| `MessageInput.jsx` | 54 lines of inline template logic | 3-line hook call |
| `NewMessageModal.jsx` | 46 lines of inline template logic | 3-line hook call |

Also cleaned up `MessageInput.jsx`: removed unused `Paperclip` and `axios` imports, removed the non-functional attachment button.

---

### 8. Toast Notification System

**New file:** `client/src/components/Toast.jsx` (85 lines)

**Before:** All error handling used native `alert()` calls, which block the UI thread and provide a jarring UX. Three `alert()` calls in `Inbox.jsx`.

**After:** Created a lightweight toast notification system:
- `ToastProvider` context wraps the app (added to `App.jsx`)
- `useToast()` hook returns `{ success, error, info }` methods
- Toasts auto-dismiss (4s for info/success, 6s for errors)
- Positioned top-right with slide-in animation
- Color-coded with icons (green success, red error, blue info)
- Dismissible with X button

All three `alert()` calls in `Inbox.jsx` replaced with `toast.error()`.

---

### 9. Unread Message Count Indicators

**Files:** `server/routes/messages.js`, `client/src/components/inbox/ConversationList.jsx`

**Before:** No concept of unread messages. New messages arriving (via polling) had no visual distinction.

**After:**
- **Backend:** The conversations aggregation now computes `unreadCount` per conversation — counts inbound messages where `status !== 'read'`
- **Frontend:** Each conversation item shows:
  - Green badge with unread count (capped at "99+")
  - Bolder name text when unread
  - Green-highlighted timestamp when unread
  - Bolder message preview when unread

---

### 10. Message Pagination

**File:** `server/routes/messages.js` (lines 87-131), `client/src/pages/Inbox.jsx`

**Before:** `GET /messages/:contactId` loaded **all messages** for a contact at once — unbounded query. A contact with 10,000 messages would return all of them.

**After:**
- **Backend:** Accepts `?page=1&limit=50` query params. Returns `{ messages, pagination: { page, limit, totalMessages, totalPages, hasMore } }`
- **Frontend:**
  - Loads page 1 (latest 50 messages) on conversation open
  - "Load older messages" button appears at top when `hasMore` is true
  - Older messages prepended to the array on load
  - Polling continues to fetch page 1 (latest messages) every 3s

---

### 11. Message Draft Persistence

**Files:** `client/src/pages/Inbox.jsx`, `client/src/components/inbox/MessageInput.jsx`, `client/src/components/inbox/ChatWindow.jsx`

**Before:** When switching between conversations, any typed-but-unsent message was lost (local state in `MessageInput` was destroyed on remount).

**After:**
- `Inbox.jsx` maintains a `drafts` map: `{ [contactId]: 'draft text' }`
- Draft state is passed down via `draft` and `onDraftChange` props through `ChatWindow` to `MessageInput`
- `MessageInput` uses the parent-controlled draft instead of local `useState`
- Switching away and back restores the draft
- Sending a message clears the draft for that contact

---

### 12. Removed Decorative Buttons

**File:** `client/src/components/inbox/ChatWindow.jsx`

**Before:** Phone, Video, and MoreVertical buttons rendered in the chat header with no click handlers — misleading users into thinking these features exist.

**After:** Removed all three non-functional buttons. Only the StatusSelector and mobile Info/Back buttons remain.

---

## Files Changed Summary

### New Files (3)
| File | Lines | Purpose |
|------|-------|---------|
| `client/src/hooks/useApprovedTemplates.js` | 70 | Shared hook for fetching approved templates |
| `client/src/components/Toast.jsx` | 85 | Toast notification system (context + component) |
| `INBOX_CHANGELOG.md` | — | This file |

### Modified Files (8)
| File | Changes |
|------|---------|
| `server/routes/messages.js` | Auth checks, user-scoped aggregation, unread count, pagination, access token fix, wamid capture |
| `server/routes/whatsapp.js` | Normalized phone matching, correct message type mapping, safer contact creation |
| `client/src/pages/Inbox.jsx` | Search state, draft persistence, pagination state, toast integration |
| `client/src/components/inbox/ConversationList.jsx` | Working search, unread badges, removed unused Filter import |
| `client/src/components/inbox/ChatWindow.jsx` | Removed decorative buttons, added load-more and draft props |
| `client/src/components/inbox/MessageInput.jsx` | Uses shared template hook, draft from props, removed unused imports |
| `client/src/components/inbox/NewMessageModal.jsx` | Uses shared template hook, cleaner loading states |
| `client/src/App.jsx` | Wrapped app with ToastProvider |

---

## What's NOT Done Yet (Future Work)

These were identified in the review but deferred as larger features:

| Priority | Item | Reason Deferred |
|----------|------|----------------|
| **P0** | WebSocket real-time messaging (replace polling) | Architecture change requiring Socket.IO setup on both client and server |
| **P0** | Media message rendering (images, videos, documents) | Requires new `MediaBubble` component + file handling infrastructure |
| **P1** | Template variable support in send flow | Requires UI for mapping `{{1}}`, `{{2}}` to contact fields |
| **P1** | Send read receipts back to WhatsApp | Requires Graph API call when user views messages |
| **P2** | Attachment sending (file upload) | Requires file upload endpoint + cloud storage |
| **P2** | Conversation list memoization (React.memo) | Performance optimization, not critical until large user bases |

---

**Last Updated:** February 14, 2026
**Status:** Implemented
