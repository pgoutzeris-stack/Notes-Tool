import { escapeHtml, formatDate } from "./utils.js";
import { appHeaderHtml, updateAppHeader } from "./header.js";

export function renderDashboard(root, state, handlers) {
  const { documents, folders, filter, loadError } = state;
  const filtered = filterDocuments(documents, filter);

  root.innerHTML = `
    ${appHeaderHtml("Organisieren, visualisieren und exportieren")}
    <div class="dash-body">
      <aside class="dash-sidebar">
        <nav class="dash-nav">
          <div class="dash-nav-section">Ordner</div>
          <button type="button" class="dash-nav-item ${filter.folderId === "all" ? "active" : ""}" data-folder="all">
            <i class="fa-solid fa-layer-group"></i> Alle Notizen
          </button>
          <button type="button" class="dash-nav-item ${filter.folderId === "fav" ? "active" : ""}" data-folder="fav">
            <i class="fa-solid fa-star"></i> Favoriten
          </button>
          ${folders.map((f) => `
            <button type="button" class="dash-nav-item ${filter.folderId === f.id ? "active" : ""}" data-folder="${f.id}">
              <span class="folder-dot" style="background:${escapeHtml(f.color || "#206efb")}"></span>
              ${escapeHtml(f.name)}
            </button>`).join("")}
          <button type="button" class="dash-nav-item" id="btn-new-folder">
            <i class="fa-solid fa-folder-plus"></i> Neuer Ordner
          </button>
          <div class="dash-nav-section">Cluster</div>
          <button type="button" class="dash-nav-item ${!filter.cluster ? "active" : ""}" data-cluster="">
            <i class="fa-solid fa-diagram-project"></i> Alle
          </button>
          ${state.clusters.map((c) => `
            <button type="button" class="dash-nav-item ${filter.cluster === c ? "active" : ""}" data-cluster="${escapeHtml(c)}">
              <i class="fa-solid fa-tag"></i> ${escapeHtml(c)}
            </button>`).join("")}
        </nav>
      </aside>
      <main class="dash-main">
        ${loadError ? `<div class="notes-error-banner"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(loadError)}</div>` : ""}
        <div class="dash-toolbar">
          <h1 class="dash-title">Deine Notizen</h1>
          <div class="dash-search-wrap">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="search" class="dash-search" id="dash-search" placeholder="Notizen durchsuchen…" value="${escapeHtml(filter.q || "")}">
          </div>
          <select class="dash-select" id="dash-sort">
            <option value="updated" ${filter.sort === "updated" ? "selected" : ""}>Zuletzt bearbeitet</option>
            <option value="title" ${filter.sort === "title" ? "selected" : ""}>Titel A–Z</option>
            <option value="created" ${filter.sort === "created" ? "selected" : ""}>Neueste zuerst</option>
          </select>
          <div class="view-toggle">
            <button type="button" class="view-btn ${filter.view === "grid" ? "is-active" : ""}" data-view="grid" title="Raster"><i class="fa-solid fa-grip"></i></button>
            <button type="button" class="view-btn ${filter.view === "list" ? "is-active" : ""}" data-view="list" title="Liste"><i class="fa-solid fa-list"></i></button>
          </div>
          <button type="button" class="btn-primary" id="btn-new-note"><i class="fa-solid fa-plus"></i> Neue Notiz</button>
        </div>
        <div class="dash-content">
          <div class="notes-grid ${filter.view === "list" ? "notes-grid--list" : ""}" id="notes-grid">
            ${filtered.length ? filtered.map((d) => noteCard(d, folders)).join("") : `
              <div class="notes-empty">
                <i class="fa-solid fa-note-sticky"></i>
                <strong>Noch keine Notizen</strong>
                <span>Erstelle deine erste Notiz mit Formen, Tabellen und Verbindern.</span>
              </div>`}
          </div>
        </div>
      </main>
    </div>`;

  updateAppHeader();
  root.querySelector("#btn-new-note")?.addEventListener("click", handlers.onNew);
  root.querySelector("#btn-new-folder")?.addEventListener("click", handlers.onNewFolder);
  root.querySelector("#dash-search")?.addEventListener("input", (e) => handlers.onFilter({ q: e.target.value }));
  root.querySelector("#dash-sort")?.addEventListener("change", (e) => handlers.onFilter({ sort: e.target.value }));

  root.querySelectorAll("[data-folder]").forEach((btn) => {
    btn.addEventListener("click", () => handlers.onFilter({ folderId: btn.dataset.folder }));
  });
  root.querySelectorAll("[data-cluster]").forEach((btn) => {
    btn.addEventListener("click", () => handlers.onFilter({ cluster: btn.dataset.cluster || null }));
  });
  root.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => handlers.onFilter({ view: btn.dataset.view }));
  });

  root.querySelectorAll(".note-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".icon-btn")) return;
      handlers.onOpen(card.dataset.open);
    });
  });
  root.querySelectorAll("[data-fav]").forEach((btn) => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); handlers.onToggleFav(btn.dataset.fav); });
  });
  root.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); handlers.onDelete(btn.dataset.del); });
  });
}

function noteCard(doc, folders) {
  const folder = folders.find((f) => f.id === doc.folder_id);
  return `
    <article class="note-card" data-open="${doc.id}">
      <div class="note-card-preview">
        ${doc.thumbnail ? `<img src="${doc.thumbnail}" alt="">` : `<div class="note-card-placeholder"><i class="fa-solid fa-shapes"></i></div>`}
      </div>
      <div class="note-card-body">
        <div class="note-card-top">
          <h3>${escapeHtml(doc.title)}</h3>
          <div class="note-card-actions">
            <button type="button" class="icon-btn" data-fav="${doc.id}" title="Favorit">
              <i class="fa-${doc.is_favorite ? "solid" : "regular"} fa-star"></i>
            </button>
            <button type="button" class="icon-btn icon-btn--danger" data-del="${doc.id}" title="Löschen">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="note-card-meta">
          ${folder ? `<span><i class="fa-solid fa-folder"></i> ${escapeHtml(folder.name)}</span>` : ""}
          <span><i class="fa-regular fa-clock"></i> ${formatDate(doc.updated_at)}</span>
        </div>
        ${doc.tags?.length ? `<div class="note-tags">${doc.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
        ${doc.cluster_label ? `<span class="cluster-badge">${escapeHtml(doc.cluster_label)}</span>` : ""}
      </div>
    </article>`;
}

function filterDocuments(docs, filter) {
  let list = [...docs];
  if (filter.folderId === "fav") list = list.filter((d) => d.is_favorite);
  else if (filter.folderId && filter.folderId !== "all") list = list.filter((d) => d.folder_id === filter.folderId);
  if (filter.cluster) list = list.filter((d) => d.cluster_label === filter.cluster);
  if (filter.q) {
    const q = filter.q.toLowerCase();
    list = list.filter((d) => (d.title || "").toLowerCase().includes(q)
      || (d.tags || []).some((t) => t.toLowerCase().includes(q))
      || (d.cluster_label || "").toLowerCase().includes(q));
  }
  if (filter.sort === "title") list.sort((a, b) => (a.title || "").localeCompare(b.title || "", "de"));
  else if (filter.sort === "created") list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  else list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  return list;
}

export function extractClusters(documents) {
  const set = new Set();
  documents.forEach((d) => { if (d.cluster_label) set.add(d.cluster_label); });
  return [...set].sort((a, b) => a.localeCompare(b, "de"));
}
