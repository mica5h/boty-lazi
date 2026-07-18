// Gallery front-end: fetch shoes, render cards, lightbox viewer.
const galleryEl = document.getElementById("gallery");
const emptyEl = document.getElementById("empty");
const noMatchEl = document.getElementById("noMatch");
const filtersEl = document.getElementById("filters");

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function metaRow(label, value) {
  if (!value) return "";
  return `<div class="meta"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
}

function groupLabel(value) {
  const g = groups.find((x) => x.value === value);
  return g ? g.label : value;
}

function groupTagsHtml(shoe) {
  const gs = shoe.groups || [];
  if (!gs.length) return "";
  return `<div class="group-tags">${gs
    .map((g) => `<span class="group-tag">${esc(groupLabel(g))}</span>`)
    .join("")}</div>`;
}

function cardHtml(shoe) {
  const photos = shoe.photos || [];
  const cover = photos[0]
    ? `<img src="/uploads/${esc(photos[0])}" alt="${esc(shoe.title)}" loading="lazy" />`
    : `<div class="noimg">Bez fotky</div>`;

  return `
    <article class="card" data-id="${esc(shoe.id)}">
      <div class="cover">${cover}</div>
      <div class="body">
        <h2>${esc(shoe.title)}</h2>
        ${shoe.brand ? `<div class="brand">${esc(shoe.brand)}</div>` : ""}
        ${groupTagsHtml(shoe)}
        <div class="metas">
          ${metaRow("Velikost", shoe.size)}
          ${metaRow("Barva", shoe.color)}
          ${metaRow("Cena", shoe.price)}
        </div>
        ${shoe.description ? `<p class="desc">${esc(shoe.description)}</p>` : ""}
      </div>
    </article>`;
}

let shoes = [];
let groups = [];
let activeFilter = "all";

function renderFilters() {
  const btn = (value, label) =>
    `<button class="filter-btn${
      value === activeFilter ? " active" : ""
    }" data-group="${esc(value)}">${esc(label)}</button>`;
  // Only offer groups that actually have items.
  const used = new Set(shoes.flatMap((s) => s.groups || []));
  const available = groups.filter((g) => used.has(g.value));
  if (!available.length) {
    filtersEl.hidden = true;
    return;
  }
  filtersEl.hidden = false;
  filtersEl.innerHTML =
    btn("all", "Vše") + available.map((g) => btn(g.value, g.label)).join("");
  filtersEl.querySelectorAll(".filter-btn").forEach((b) =>
    b.addEventListener("click", () => {
      activeFilter = b.dataset.group;
      renderFilters();
      renderGallery();
    })
  );
}

function renderGallery() {
  const list =
    activeFilter === "all"
      ? shoes
      : shoes.filter((s) => (s.groups || []).includes(activeFilter));

  noMatchEl.hidden = list.length > 0;
  galleryEl.innerHTML = list.map(cardHtml).join("");
  galleryEl.querySelectorAll(".card").forEach((el) => {
    el.addEventListener("click", () => openLightbox(el.dataset.id));
  });
}

async function load() {
  const [meRes, shoesRes, groupsRes] = await Promise.all([
    fetch("/api/me"),
    fetch("/api/shoes"),
    fetch("/api/groups"),
  ]);
  const me = await meRes.json();
  if (me.admin) document.getElementById("adminLink").hidden = false;

  groups = await groupsRes.json();
  shoes = await shoesRes.json();
  if (!shoes.length) {
    emptyEl.hidden = false;
    return;
  }
  renderFilters();
  renderGallery();
}

// ---- Lightbox --------------------------------------------------------------
const lb = document.getElementById("lightbox");
const lbImg = document.getElementById("lbImg");
const lbThumbs = document.getElementById("lbThumbs");
const lbInfo = document.getElementById("lbInfo");
let current = { photos: [], idx: 0 };

function openLightbox(id) {
  const shoe = shoes.find((s) => s.id === id);
  if (!shoe) return;
  current = { photos: shoe.photos || [], idx: 0 };

  lbInfo.innerHTML = `
    <h2>${esc(shoe.title)}</h2>
    ${shoe.brand ? `<div class="brand">${esc(shoe.brand)}</div>` : ""}
    ${groupTagsHtml(shoe)}
    <div class="metas">
      ${metaRow("Velikost", shoe.size)}
      ${metaRow("Barva", shoe.color)}
      ${metaRow("Cena", shoe.price)}
    </div>
    ${shoe.description ? `<p class="desc">${esc(shoe.description)}</p>` : ""}`;

  lbThumbs.innerHTML = current.photos
    .map(
      (p, i) =>
        `<img src="/uploads/${esc(p)}" data-i="${i}" alt="" />`
    )
    .join("");
  lbThumbs.querySelectorAll("img").forEach((t) =>
    t.addEventListener("click", () => showPhoto(+t.dataset.i))
  );

  showPhoto(0);
  lb.hidden = false;
}

function showPhoto(i) {
  if (!current.photos.length) {
    lbImg.removeAttribute("src");
    return;
  }
  current.idx = (i + current.photos.length) % current.photos.length;
  lbImg.src = "/uploads/" + current.photos[current.idx];
  lbThumbs.querySelectorAll("img").forEach((t, j) =>
    t.classList.toggle("active", j === current.idx)
  );
}

document.getElementById("lbClose").onclick = () => (lb.hidden = true);
document.getElementById("lbPrev").onclick = () => showPhoto(current.idx - 1);
document.getElementById("lbNext").onclick = () => showPhoto(current.idx + 1);
lb.addEventListener("click", (e) => {
  if (e.target === lb) lb.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (lb.hidden) return;
  if (e.key === "Escape") lb.hidden = true;
  if (e.key === "ArrowLeft") showPhoto(current.idx - 1);
  if (e.key === "ArrowRight") showPhoto(current.idx + 1);
});

load();
