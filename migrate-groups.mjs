// One-off migration: ensure every item in data/shoes.json has a valid `groups`
// array. Safe to run repeatedly (idempotent) — it only fills in items that are
// missing groups and cleans out any unknown group values.
//
// Usage (from the app directory):
//   node migrate-groups.mjs                 # dry run: shows what would change
//   node migrate-groups.mjs --apply         # write changes (makes a backup first)
//
// Options:
//   --apply                 actually write the file (otherwise dry run only)
//   --file <path>           data file to migrate (default: ./data/shoes.json)
//   --default <a,b,...>     groups to assign to items that have none
//                           (default: panske,boty — the current catalog is
//                            men's footwear; fix women's/clothing items later
//                            in the admin panel)
import { readFile, writeFile, copyFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Args ------------------------------------------------------------------
const argv = process.argv.slice(2);
function opt(name, fallback) {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
}
const APPLY = argv.includes("--apply");
const DATA_FILE = path.resolve(__dirname, opt("--file", "data/shoes.json"));

// ---- Validation against the central group list -----------------------------
const VALID = new Set(config.groups.map((g) => g.value));

function sanitize(input) {
  const arr = Array.isArray(input) ? input : input == null ? [] : [input];
  const seen = new Set();
  for (const raw of arr) {
    const v = String(raw).trim();
    if (VALID.has(v)) seen.add(v);
  }
  return [...seen];
}

const DEFAULT_GROUPS = sanitize(opt("--default", "panske,boty").split(","));
if (!DEFAULT_GROUPS.length) {
  console.error(
    `No valid --default groups given. Valid values: ${[...VALID].join(", ")}`
  );
  process.exit(1);
}

// ---- Run -------------------------------------------------------------------
if (!existsSync(DATA_FILE)) {
  console.error(`Data file not found: ${DATA_FILE}`);
  process.exit(1);
}

const raw = await readFile(DATA_FILE, "utf-8");
const items = JSON.parse(raw || "[]");
if (!Array.isArray(items)) {
  console.error("Data file does not contain a JSON array.");
  process.exit(1);
}

const changes = [];
for (const item of items) {
  const before = Array.isArray(item.groups) ? [...item.groups] : undefined;
  const cleaned = sanitize(item.groups);
  const after = cleaned.length ? cleaned : [...DEFAULT_GROUPS];
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  if (changed) {
    changes.push({ id: item.id, title: item.title, before, after });
    item.groups = after;
  }
}

console.log(`Data file : ${DATA_FILE}`);
console.log(`Items     : ${items.length}`);
console.log(`Default   : [${DEFAULT_GROUPS.join(", ")}] (for items with none)`);
console.log(`Changes   : ${changes.length}`);
for (const c of changes) {
  const from = c.before === undefined ? "(none)" : `[${c.before.join(", ")}]`;
  console.log(`  ${c.id}  ${c.title ?? ""}: ${from} -> [${c.after.join(", ")}]`);
}

if (!changes.length) {
  console.log("\nNothing to migrate — all items already have valid groups.");
  process.exit(0);
}

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to write these changes.");
  process.exit(0);
}

// Backup, then write.
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = `${DATA_FILE}.bak-${stamp}`;
await copyFile(DATA_FILE, backup);
await writeFile(DATA_FILE, JSON.stringify(items, null, 2), "utf-8");
console.log(`\nBackup written : ${backup}`);
console.log(`Applied ${changes.length} change(s) to ${DATA_FILE}`);
