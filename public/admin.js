// Admin panel: create / edit / delete shoes and manage photos.
const form = document.getElementById("shoeForm");
const listEl = document.getElementById("adminList");
const formTitle = document.getElementById("formTitle");
const cancelBtn = document.getElementById("cancelBtn");
const existingBox = document.getElementById("existing");
const existingList = document.getElementById("existingList");
const msg = document.getElementById("msg");

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function showMsg(text, ok = true) {
  msg.textContent = text;
  msg.className = "msg " + (ok ? "ok" : "error");
  msg.hidden = false;
  setTimeout(() => (msg.hidden = true), 3000);
}

let editingId = null;

// ---- Groups ----------------------------------------------------------------
const groupChecksEl = document.getElementById("groupChecks");
let GROUPS = [];

async function loadGroups() {
  const res = await fetch("/api/groups");
  GROUPS = await res.json();
  groupChecksEl.innerHTML = GROUPS.map(
    (g) => `
      <label class="group-check">
        <input type="checkbox" name="groups" value="${esc(g.value)}" />
        <span>${esc(g.label)}</span>
      </label>`
  ).join("");
}

function setGroupChecks(values) {
  const set = new Set(values || []);
  groupChecksEl
    .querySelectorAll('input[name="groups"]')
    .forEach((cb) => (cb.checked = set.has(cb.value)));
}

function groupLabel(value) {
  const g = GROUPS.find((x) => x.value === value);
  return g ? g.label : value;
}

async function loadList() {
  const res = await fetch("/api/shoes");
  if (res.status === 401) {
    location.href = "/admin/login";
    return;
  }
  const shoes = await res.json();
  if (!shoes.length) {
    listEl.innerHTML = `<p class="muted">Zatím žádné boty.</p>`;
    return;
  }
  listEl.innerHTML = shoes
    .map(
      (s) => `
      <div class="admin-row" data-id="${esc(s.id)}">
        <div class="admin-thumb">
          ${
            s.photos && s.photos[0]
              ? `<img src="/uploads/${esc(s.photos[0])}" alt="" />`
              : `<div class="noimg small">—</div>`
          }
        </div>
        <div class="admin-meta">
          <b>${esc(s.title)}</b>
          <span class="muted small">${esc(s.brand || "")} ·
            ${esc(s.size || "?")} · ${esc(s.color || "?")} ·
            ${(s.photos || []).length} fotek</span>
          ${
            (s.groups || []).length
              ? `<span class="group-tags">${s.groups
                  .map((g) => `<span class="group-tag">${esc(groupLabel(g))}</span>`)
                  .join("")}</span>`
              : ""
          }
        </div>
        <div class="admin-actions">
          <button class="edit" data-id="${esc(s.id)}">Upravit</button>
          <button class="del ghost" data-id="${esc(s.id)}">Smazat</button>
        </div>
      </div>`
    )
    .join("");

  listEl.querySelectorAll(".edit").forEach((b) =>
    b.addEventListener("click", () => startEdit(b.dataset.id))
  );
  listEl.querySelectorAll(".del").forEach((b) =>
    b.addEventListener("click", () => del(b.dataset.id))
  );
}

async function startEdit(id) {
  const res = await fetch("/api/shoes/" + id);
  const s = await res.json();
  editingId = id;
  form.id.value = s.id;
  form.title.value = s.title || "";
  form.brand.value = s.brand || "";
  form.size.value = s.size || "";
  form.color.value = s.color || "";
  form.price.value = s.price || "";
  form.description.value = s.description || "";
  setGroupChecks(s.groups);

  formTitle.textContent = "Upravit botu";
  cancelBtn.hidden = false;
  renderExisting(id, s.photos || []);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderExisting(id, photos) {
  if (!photos.length) {
    existingBox.hidden = true;
    existingList.innerHTML = "";
    return;
  }
  existingBox.hidden = false;
  existingList.innerHTML = photos
    .map(
      (p) => `
      <div class="existing-item">
        <img src="/uploads/${esc(p)}" alt="" />
        <button type="button" class="rm" data-photo="${esc(p)}">✕</button>
      </div>`
    )
    .join("");
  existingList.querySelectorAll(".rm").forEach((b) =>
    b.addEventListener("click", () => removePhoto(id, b.dataset.photo))
  );
}

async function removePhoto(id, photo) {
  if (!confirm("Odebrat tuto fotku?")) return;
  const res = await fetch(`/api/shoes/${id}/photos`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photo }),
  });
  const s = await res.json();
  renderExisting(id, s.photos || []);
  loadList();
}

function resetForm() {
  editingId = null;
  form.reset();
  form.id.value = "";
  formTitle.textContent = "Přidat botu";
  cancelBtn.hidden = true;
  existingBox.hidden = true;
  existingList.innerHTML = "";
}

cancelBtn.addEventListener("click", resetForm);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  fd.delete("id"); // sent via URL instead

  const url = editingId ? "/api/shoes/" + editingId : "/api/shoes";
  const method = editingId ? "PUT" : "POST";
  const res = await fetch(url, { method, body: fd });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showMsg(err.error || "Uložení se nezdařilo", false);
    return;
  }
  showMsg(editingId ? "Bota upravena." : "Bota přidána.");
  resetForm();
  loadList();
});

async function del(id) {
  if (!confirm("Smazat tuto botu a všechny její fotky?")) return;
  const res = await fetch("/api/shoes/" + id, { method: "DELETE" });
  if (res.ok) {
    showMsg("Bota smazána.");
    if (editingId === id) resetForm();
    loadList();
  } else {
    showMsg("Smazání se nezdařilo", false);
  }
}

loadGroups().then(loadList);
