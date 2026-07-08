import express from "express";
import session from "express-session";
import multer from "multer";
import path from "path";
import { existsSync, mkdirSync } from "fs";
import { unlink } from "fs/promises";
import { fileURLToPath } from "url";

import { config } from "./config.js";
import {
  listShoes,
  getShoe,
  createShoe,
  updateShoe,
  deleteShoe,
  ensureDirs,
  UPLOADS_DIR,
} from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
await ensureDirs();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 12 }, // 12h
  })
);

// ---- Auth guards -----------------------------------------------------------
function requireGallery(req, res, next) {
  if (req.session.gallery) return next();
  return res.redirect("/login");
}
function requireAdmin(req, res, next) {
  if (req.session.admin) return next();
  return res.redirect("/admin/login");
}
function requireAdminApi(req, res, next) {
  if (req.session.admin) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

// ---- Uploads (multer) ------------------------------------------------------
// We stash files in a temp field first because the shoe id may be created in
// the same request; the route moves/assigns them after the record exists.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const id = req.params.id || req.body.__id || "tmp";
    const dir = path.join(UPLOADS_DIR, id);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const name =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, name);
  },
});
function imageFilter(req, file, cb) {
  if (/^image\//.test(file.mimetype)) cb(null, true);
  else cb(new Error("Povoleny jsou pouze obrázky"));
}
const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: config.maxUploadBytes },
});

// ---- Static & uploads ------------------------------------------------------
app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/static", express.static(path.join(__dirname, "public")));

// ---- Auth pages ------------------------------------------------------------
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.post("/login", (req, res) => {
  if ((req.body.code || "").trim() === config.accessCode) {
    req.session.gallery = true;
    return res.redirect("/");
  }
  res.redirect("/login?error=1");
});

app.get("/admin/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-login.html"));
});
app.post("/admin/login", (req, res) => {
  if ((req.body.password || "") === config.adminPassword) {
    req.session.admin = true;
    req.session.gallery = true; // admins can view too
    return res.redirect("/admin");
  }
  res.redirect("/admin/login?error=1");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// ---- Pages -----------------------------------------------------------------
app.get("/", requireGallery, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/admin", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// ---- API -------------------------------------------------------------------
// Public (gallery-gated) read.
app.get("/api/shoes", requireGallery, async (req, res) => {
  res.json(await listShoes());
});
app.get("/api/shoes/:id", requireGallery, async (req, res) => {
  const shoe = await getShoe(req.params.id);
  if (!shoe) return res.status(404).json({ error: "Not found" });
  res.json(shoe);
});

// Tells the admin UI whether the current session is an admin.
app.get("/api/me", (req, res) => {
  res.json({ gallery: !!req.session.gallery, admin: !!req.session.admin });
});

// Create a shoe (with optional photos).
app.post(
  "/api/shoes",
  requireAdminApi,
  upload.array("photos", config.maxPhotosPerShoe),
  async (req, res) => {
    const shoe = await createShoe({
      title: req.body.title,
      brand: req.body.brand,
      size: req.body.size,
      color: req.body.color,
      price: req.body.price,
      description: req.body.description,
      photos: [],
    });
    // Files were saved under uploads/tmp — move logical refs to the new id.
    const photos = await relocateFiles(req.files, shoe.id);
    const updated = await updateShoe(shoe.id, { photos });
    res.status(201).json(updated);
  }
);

// Update fields and/or append photos.
app.put(
  "/api/shoes/:id",
  requireAdminApi,
  (req, res, next) => {
    req.body.__id = req.params.id; // so multer stores into the right folder
    next();
  },
  upload.array("photos", config.maxPhotosPerShoe),
  async (req, res) => {
    const shoe = await getShoe(req.params.id);
    if (!shoe) return res.status(404).json({ error: "Not found" });

    const newPhotos = (req.files || []).map(
      (f) => `${req.params.id}/${path.basename(f.path)}`
    );
    const photos = [...shoe.photos, ...newPhotos].slice(
      0,
      config.maxPhotosPerShoe
    );

    const updated = await updateShoe(req.params.id, {
      title: req.body.title,
      brand: req.body.brand,
      size: req.body.size,
      color: req.body.color,
      price: req.body.price,
      description: req.body.description,
      photos,
    });
    res.json(updated);
  }
);

// Delete a single photo from a shoe.
app.delete("/api/shoes/:id/photos", requireAdminApi, async (req, res) => {
  const shoe = await getShoe(req.params.id);
  if (!shoe) return res.status(404).json({ error: "Not found" });
  const photo = req.body.photo;
  if (!shoe.photos.includes(photo))
    return res.status(404).json({ error: "Photo not found" });

  const abs = path.join(UPLOADS_DIR, photo);
  if (existsSync(abs)) await unlink(abs).catch(() => {});
  const photos = shoe.photos.filter((p) => p !== photo);
  const updated = await updateShoe(req.params.id, { photos });
  res.json(updated);
});

// Delete a whole shoe.
app.delete("/api/shoes/:id", requireAdminApi, async (req, res) => {
  const ok = await deleteShoe(req.params.id);
  if (!ok) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

// Move files from uploads/tmp/* into uploads/<id>/ and return relative refs.
import { rename } from "fs/promises";
async function relocateFiles(files, id) {
  const refs = [];
  const destDir = path.join(UPLOADS_DIR, id);
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
  for (const f of files || []) {
    const base = path.basename(f.path);
    const dest = path.join(destDir, base);
    if (path.resolve(f.path) !== path.resolve(dest)) {
      await rename(f.path, dest).catch(() => {});
    }
    refs.push(`${id}/${base}`);
  }
  return refs;
}

// ---- Error handler (e.g. upload too large / wrong type) --------------------
app.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
});

app.listen(config.port, () => {
  console.log(`botylazi gallery running at http://localhost:${config.port}`);
  console.log(`  Gallery access code : ${config.accessCode}`);
  console.log(`  Admin password      : ${config.adminPassword}`);
});
