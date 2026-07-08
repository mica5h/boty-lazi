// Gallery front-end: fetch shoes, render cards, lightbox viewer.
const galleryEl = document.getElementById("gallery");
const emptyEl = document.getElementById("empty");

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

function cardHtml(shoe) {
  const photos = shoe.photos || [];
  const cover = photos[0]
    ? `<img src="/uploads/${esc(photos[0])}" alt="${esc(shoe.title)}" loading="lazy" />`
    : `<div class="noimg">Bez fotky</div>`;

  const thumbs = photos
    .slice(1, 4)
    .map(
      (p) =>
        `<img src="/uploads/${esc(p)}" alt="" loading="lazy" />`
    )
    .join("");
  const more =
    photos.length > 4 ? `<span class="more">+${photos.length - 4}</span>` : "";

  return `
    <article class="card" data-id="${esc(shoe.id)}">
      <div class="cover">${cover}</div>
      ${thumbs ? `<div class="thumbs">${thumbs}${more}</div>` : ""}
      <div class="body">
        <h2>${esc(shoe.title)}</h2>
        ${shoe.brand ? `<div class="brand">${esc(shoe.brand)}</div>` : ""}
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

async function load() {
  const [meRes, shoesRes] = await Promise.all([
    fetch("/api/me"),
    fetch("/api/shoes"),
  ]);
  const me = await meRes.json();
  if (me.admin) document.getElementById("adminLink").hidden = false;

  shoes = await shoesRes.json();
  if (!shoes.length) {
    emptyEl.hidden = false;
    return;
  }
  galleryEl.innerHTML = shoes.map(cardHtml).join("");
  galleryEl.querySelectorAll(".card").forEach((el) => {
    el.addEventListener("click", () => openLightbox(el.dataset.id));
  });
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
