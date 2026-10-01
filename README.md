# Campaign HQ

Personal campaign command center for organizing multiple e-commerce stores across Meta and TikTok.

## Core workflow

- **Today** — daily priorities and campaign next actions
- **Inbox** — capture ideas in seconds, organize later
- **Magazine** — keep each store separated
- **Campanii** — one searchable source for every campaign
- **Kanban** — Idea → Prep → Ready → Testing → Winner → Scale → Stopped
- **Creative links** — keep ad references and creative URLs inside each campaign
- **Metrics** — spend, revenue, orders and ROAS
- **Backup** — JSON export/import
- **Cloud sync** — Firestore + local browser backup

## Data architecture

Campaign HQ deliberately uses one Firestore workspace document (`campaign_hq/workspace`) as the cloud source of truth. This avoids partial-list synchronization races and keeps the personal workspace atomic.

## Run locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm run build
```
