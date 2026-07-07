# 👟 boty-lazi

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

Then open http://localhost:3000

## Access

Defaults (override with environment variables):

| What            | Default      | Env var          |
|-----------------|--------------|------------------|
| Gallery code    | `SHOES2026`  | `ACCESS_CODE`    |
| Admin password  | `admin123`   | `ADMIN_PASSWORD` |
| Port            | `3000`       | `PORT`           |
| Session secret  | `change-me…` | `SESSION_SECRET` |

Example:

```bash
ACCESS_CODE=letmein ADMIN_PASSWORD=s3cret SESSION_SECRET=random-long-string npm start
```

- **Gallery** — `/` (enter the access code at `/login`)
- **Admin** — `/admin` (log in at `/admin/login`); add/edit/delete shoes and manage photos

## How it works

- `server.js` — Express app: sessions, auth guards, REST API, photo uploads (multer)
- `store.js` — JSON-file persistence for shoe records
- `config.js` — codes/passwords/limits (env-overridable)
- `public/` — frontend: gallery, lightbox, admin panel

## Notes / next steps

- Codes are checked in plaintext against `config.js` — fine for a personal/shared
  gallery. For real multi-user auth, swap in hashed passwords + a user store.
- Uploaded images are served as-is (not resized). Add sharp-based thumbnails if
  you host many large photos.
