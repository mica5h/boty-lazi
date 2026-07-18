# 👟 botylazi

A locked shoe gallery. Each shoe is shown as a card with up to 8 photos, a
title and meta (brand, size, color, price, description). Visitors need an
**access code** to view the gallery; a separate **admin password** unlocks
uploading and editing.

Built with Node.js + Express. Shoe data is stored in `data/shoes.json`; photos
are saved under `uploads/`. No database or external service required.

## Run

```bash
npm install
npm start          # or: npm run dev  (auto-restart on changes)
```

Then open http://localhost:8080 (or http://localhost:3000 with `npm run dev`)

## Access

Defaults (override with environment variables):

| What            | Default      | Env var          |
|-----------------|--------------|------------------|
| Gallery code    | `BotyLazi`   | `ACCESS_CODE`    |
| Admin password  | `Lazi123`    | `ADMIN_PASSWORD` |
| Port            | `8080`       | `PORT`           |
| Session secret  | `change-me…` | `SESSION_SECRET` |

Example:

```bash
ACCESS_CODE=letmein ADMIN_PASSWORD=s3cret SESSION_SECRET=random-long-string npm start
```

- **Gallery** — `/` (enter the access code at `/login`)
- **Admin** — `/admin` (log in at `/admin/login`); add/edit/delete shoes and manage photos

## Groups (categories)

Each item can belong to zero or more **groups**. The list is defined centrally
in `config.js` (`value` is stored on the record, `label` is shown in the UI):

| value      | label    |
|------------|----------|
| `panske`   | Pánské   |
| `damske`   | Dámské   |
| `boty`     | Boty     |
| `obleceni` | Oblečení |

- **Admin** — tick the groups on each item in the form (`/admin`).
- **Gallery** — a filter bar at the top lets visitors filter by group; only
  groups that actually have items appear. Cards and the lightbox show group tags.
- **API** — `GET /api/groups` returns the list for the frontend. Groups are
  validated against `config.js` on save (unknown values are dropped, deduped).

To add/rename a group, edit the `groups` array in `config.js` — no other code
changes needed.

## Deploy (Rosti)

Deploys go to [Rosti.cz](https://rosti.cz) via `rostictl` (config in `Rostifile`;
app id/company in `.rosti.state`):

```bash
rostictl deploy
```

`Rostifile` **excludes `data/` and `uploads/`** from upload, so redeploys never
clobber live records or photos.

## Backfilling groups on existing items

Because `data/` is excluded from deploy, items already on the server keep no
`groups` field after a deploy (they still work — just untagged and only under
"Vše"). Two ways to backfill:

1. **Per item** — edit each item in `/admin` and tick its groups.
2. **Bulk** — `migrate-prod.sh` pulls the live `data/shoes.json`, runs the
   idempotent `migrate-groups.mjs` over it, pushes it back, and verifies.
   `store.js` re-reads the file per request, so changes are live immediately
   (no restart).

```bash
# Get --host/--port from `rostictl ssh` or the Rosti dashboard (app 9114).
./migrate-prod.sh --host <node>.rosti.cz --port <port>            # dry run
./migrate-prod.sh --host <node>.rosti.cz --port <port> --apply    # apply
./migrate-prod.sh --host <node>.rosti.cz --port <port> --rollback # undo
```

Items with no groups get `panske,boty` by default (the current catalog is men's
footwear); override with `--default boty`. `--apply` saves a pre-migration
backup that `--rollback` restores. `migrate-groups.mjs` can also be run directly
against any `--file` (dry run by default; `--apply` to write, with its own
backup).

## How it works

- `server.js` — Express app: sessions, auth guards, REST API, photo uploads (multer)
- `store.js` — JSON-file persistence for shoe records
- `config.js` — codes/passwords/limits/groups (env-overridable)
- `public/` — frontend: gallery, lightbox, admin panel
- `migrate-groups.mjs` — idempotent backfill of `groups` on a data file
- `migrate-prod.sh` — pull/migrate/push/verify (+rollback) against the server

## Notes / next steps

- Codes are checked in plaintext against `config.js` — fine for a personal/shared
  gallery. For real multi-user auth, swap in hashed passwords + a user store.
- Uploaded images are served as-is (not resized). Add sharp-based thumbnails if
  you host many large photos.
