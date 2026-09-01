# Watermark Scanner Bot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot that detects visible watermarks in user-submitted images and videos, flags suspected content, and reports findings to an admin. It analyzes media for logos, text, or overlays and sends alerts with metadata and thumbnails to a specified admin chat.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Content moderators
- Community managers
- Platform owners

## Success criteria

- Admin receives alerts for all flagged watermarked content
- Users receive brief status updates on their submissions
- Admin can mark false positives or confirm reports via inline buttons

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu
- **Submit media** (command, actor: user, command: /Send image/video) — User sends media to the bot or mentions it in a group chat
  - inputs: image/video
  - outputs: status message
- **/reports** (command, actor: admin, command: /reports) — Request a list of recent flagged reports with pagination
  - inputs: none
  - outputs: paginated report list
- **Mark false positive** (button, actor: admin, callback: report:mark_false_positive) — Admin marks a report as a false positive
  - inputs: report ID
  - outputs: updated report status
- **Confirm** (button, actor: admin, callback: report:confirm) — Admin confirms a report as valid
  - inputs: report ID
  - outputs: updated report status

## Flows

### Public submission
_Trigger:_ User sends media or mentions bot in group

1. Receive media
2. Analyze for watermarks
3. Send 'Under review' status
4. Send final status to user

_Data touched:_ Submission, Detection result

### Admin notification
_Trigger:_ Detection confidence >= 0.75

1. Generate report
2. Send alert to admin chat
3. Include inline buttons for action

_Data touched:_ Report/alert

### Admin report list
_Trigger:_ /reports

1. Fetch last 50 flagged reports
2. Display paginated list
3. Include report details and actions

_Data touched:_ Report/alert

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Telegram chat ID where watermark alerts and reports are sent
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **Submission** _(retention: persistent)_ — User-submitted media (image/video) for analysis
  - fields: user_id, message_id, media_id, timestamp
- **Detection result** _(retention: persistent)_ — Analysis outcome of watermark detection
  - fields: confidence_score, detection_type, bounding_box, frame_time, thumbnail
- **Report/alert** _(retention: persistent)_ — Notification sent to admin with detection metadata
  - fields: user_info, media_preview, detection_metadata, admin_label

## Integrations

- **Telegram** (required) — Bot API messaging and media handling
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- ADMIN_CHAT_ID (Telegram chat ID for admin notifications)

## Notifications

- Admin receives alerts for flagged watermarked content
- Admin receives report list when using /reports

## Permissions & privacy

- Bot only stores metadata and thumbnails, not full media files
- User-submitted media is not altered or stored permanently
- Admin can mark false positives or confirm reports

## Edge cases

- Media without visible watermarks
- Low-confidence detections below threshold
- Admin chat ID not set or invalid

## Required tests

- Verify admin receives alerts for flagged content
- Test user receives status updates after submission
- Validate admin can mark false positives or confirm reports

## Assumptions

- Detection threshold is set to 0.75 confidence by default
- Admin chat ID is provided by the owner
- Bot replies to users with brief status messages only
