// Tiny JSON-file-backed store for shoe records.
// Records live in data/shoes.json; photos live under uploads/<id>/.
import { readFile, writeFile, mkdir, rm } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, "data");
export const UPLOADS_DIR = path.join(__dirname, "uploads");
const DATA_FILE = path.join(DATA_DIR, "shoes.json");

async function ensureDirs() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(UPLOADS_DIR)) await mkdir(UPLOADS_DIR, { recursive: true });
}

async function readAll() {
  await ensureDirs();
  if (!existsSync(DATA_FILE)) return [];
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
}

async function writeAll(shoes) {
  await ensureDirs();
  await writeFile(DATA_FILE, JSON.stringify(shoes, null, 2), "utf-8");
}

// A short unique-ish id without external deps.
function newId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export async function listShoes() {
  const shoes = await readAll();
  // newest first
  return shoes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function getShoe(id) {
  const shoes = await readAll();
  return shoes.find((s) => s.id === id) || null;
}

export async function createShoe(fields) {
  const shoes = await readAll();
  const shoe = {
    id: newId(),
    title: fields.title || "Untitled",
    brand: fields.brand || "",
    size: fields.size || "",
    color: fields.color || "",
    price: fields.price || "",
    description: fields.description || "",
    photos: fields.photos || [],
    createdAt: Date.now(),
  };
  shoes.push(shoe);
  await writeAll(shoes);
  return shoe;
}

export async function updateShoe(id, fields) {
  const shoes = await readAll();
  const idx = shoes.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const shoe = shoes[idx];
  for (const key of ["title", "brand", "size", "color", "price", "description"]) {
    if (fields[key] !== undefined) shoe[key] = fields[key];
  }
  if (fields.photos !== undefined) shoe.photos = fields.photos;
  shoes[idx] = shoe;
  await writeAll(shoes);
  return shoe;
}

export async function deleteShoe(id) {
  const shoes = await readAll();
  const idx = shoes.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  shoes.splice(idx, 1);
  await writeAll(shoes);
  // remove the shoe's photo folder
  const dir = path.join(UPLOADS_DIR, id);
  if (existsSync(dir)) await rm(dir, { recursive: true, force: true });
  return true;
}

export { ensureDirs };
