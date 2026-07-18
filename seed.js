// Dev-only seed: creates a few sample shoes with SVG placeholder photos.
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS = path.join(__dirname, "uploads");
const DATA = path.join(__dirname, "data");

function svg(label, sub, bg, fg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="${bg}"/>
  <path d="M120 380 q40-40 120-40 l180 0 q120 0 220 60 l40 20 0 40 -560 0 z" fill="${fg}" opacity="0.9"/>
  <path d="M120 380 q40-40 120-40 l60 0 -20 40 -160 0 z" fill="#ffffff" opacity="0.25"/>
  <circle cx="640" cy="440" r="14" fill="#ffffff" opacity="0.5"/>
  <text x="400" y="180" font-family="Helvetica,Arial" font-size="64" font-weight="bold" fill="#ffffff" text-anchor="middle">${label}</text>
  <text x="400" y="240" font-family="Helvetica,Arial" font-size="30" fill="#ffffff" opacity="0.8" text-anchor="middle">${sub}</text>
</svg>`;
}

const shoes = [
  {
    title: "Air Runner 90",
    brand: "Nike",
    size: "42 / US 9",
    color: "Crimson",
    price: "€139",
    description: "Cushioned everyday running shoe with a breathable mesh upper.",
    groups: ["panske", "boty"],
    bg: "#b3324a",
    fg: "#7d1f33",
  },
  {
    title: "Classic Leather",
    brand: "Reebok",
    size: "41 / US 8",
    color: "White",
    price: "€89",
    description: "Timeless soft leather sneaker. Goes with everything.",
    groups: ["panske", "boty"],
    bg: "#4a6bff",
    fg: "#2f47b8",
  },
  {
    title: "Trail Beast GTX",
    brand: "Salomon",
    size: "44 / US 10.5",
    color: "Forest / Lime",
    price: "€175",
    description: "Waterproof trail runner with aggressive grip for wet terrain.",
    groups: ["panske", "boty"],
    bg: "#2f8f5b",
    fg: "#1f6b41",
  },
  {
    title: "Retro Court",
    brand: "Adidas",
    size: "43 / US 10",
    color: "Cream / Green",
    price: "€110",
    description: "Vintage tennis silhouette in premium suede.",
    groups: ["panske", "boty"],
    bg: "#d9a441",
    fg: "#a87c26",
  },
];

const records = [];
let t = 1700000000000;

for (let i = 0; i < shoes.length; i++) {
  const s = shoes[i];
  const id = "seed" + (i + 1);
  const dir = path.join(UPLOADS, id);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });

  const angles = ["Side", "Top", "Sole", "Back"];
  const photos = [];
  for (let j = 0; j < angles.length; j++) {
    const file = `${id}-${j + 1}.svg`;
    await writeFile(path.join(dir, file), svg(s.brand, `${s.title} · ${angles[j]}`, s.bg, s.fg));
    photos.push(`${id}/${file}`);
  }

  records.push({
    id,
    title: s.title,
    brand: s.brand,
    size: s.size,
    color: s.color,
    price: s.price,
    description: s.description,
    groups: s.groups || [],
    photos,
    createdAt: t + i * 1000,
  });
}

if (!existsSync(DATA)) await mkdir(DATA, { recursive: true });
await writeFile(path.join(DATA, "shoes.json"), JSON.stringify(records, null, 2));
console.log(`Seeded ${records.length} shoes with ${records.length * 4} photos.`);
