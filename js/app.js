import {
  listDocuments, listFolders, createDocument, createFolder, getDocument,
  updateDocument, deleteDocument, ensureDefaultFolder,
} from "./api.js";
import { renderDashboard, extractClusters } from "./dashboard.js";
import { NotesEditor } from "./editor.js";
import { updateAppHeader } from "./header.js";
import { exportJson, exportHtml, exportMarkdown, exportPng, exportPdf } from "./export.js";
import { debounce } from "./utils.js";

let sb;
let userId;
let booted = false;
let state = {
  documents: [],
  folders: [],
  clusters: [],
  loadError: null,
  filter: { folderId: "all", cluster: null, q: "", sort: "updated", view: "grid" },
  currentDoc: null,
};

let editor;
const saveDebounced = debounce(saveCurrentDoc, 1200);

export function initApp(supabase) {
  sb = supabase;
  userId = window.RootsUser?._uid;
  window.notesUpdateHeader = updateAppHeader;
  if (!userId) {
    showAuthHint();
    return;
  }
  if (booted) {
    void loadDashboard();
    return;
  }
  booted = true;

  editor = new NotesEditor(document.getElementById("screen-editor"), {
    onChange: (doc, immediate) => {
      state.currentDoc = doc;
      setSaveStatus("Speichert…");
      if (immediate) saveCurrentDoc();
      else saveDebounced();
    },
    onSaveStatus: setSaveStatus,
  });
  editor.onBack = () => showDashboard();
  editor.onExport = (type) => exportCurrent(type);

  loadDashboard();
}

async function loadDashboard() {
  showDashboard();
  paintDashboard();
  try {
    await ensureDefaultFolder(sb, userId);
    state.folders = await listFolders(sb, userId);
    state.documents = await listDocuments(sb, userId);
    state.clusters = extractClusters(state.documents);
    state.loadError = null;
    paintDashboard();
  } catch (e) {
    console.error("Notes loadDashboard", e);
    state.loadError = e.message || "Notizen konnten nicht geladen werden";
    paintDashboard();
    toast(state.loadError, "error");
  }
}

function paintDashboard() {
  renderDashboard(document.getElementById("screen-dashboard"), state, {
    onNew: createNewNote,
    onNewFolder: createNewFolder,
    onFilter: (patch) => {
      Object.assign(state.filter, patch);
      paintDashboard();
    },
    onOpen: openNote,
    onToggleFav: toggleFavorite,
    onDelete: removeNote,
  });
}

function showDashboard() {
  document.getElementById("screen-dashboard").style.display = "flex";
  document.getElementById("screen-editor").style.display = "none";
  document.getElementById("screen-auth-hint")?.setAttribute("hidden", "");
  document.getElementById("screen-loading")?.classList.add("is-done");
  document.body.classList.add("body-dashboard");
  document.body.classList.remove("body-editor");
  updateAppHeader();
}

function showEditor() {
  document.getElementById("screen-dashboard").style.display = "none";
  document.getElementById("screen-editor").style.display = "flex";
  document.getElementById("screen-auth-hint")?.setAttribute("hidden", "");
  document.getElementById("screen-loading")?.classList.add("is-done");
  document.body.classList.add("body-editor");
  document.body.classList.remove("body-dashboard");
  updateAppHeader();
}

async function createNewNote() {
  userId = window.RootsUser?._uid || userId;
  if (!userId) {
    toast("Bitte warte, bis das Notes Tool vollständig geladen ist.", "error");
    return;
  }
  showEditor();
  setSaveStatus("Erstelle…");
  editor.load({
    title: "Neue Notiz",
    tags: [],
    cluster_label: state.filter.cluster || null,
    content: { version: 1, viewport: { x: 0, y: 0, zoom: 1 }, objects: [], presentation: { slides: [] } },
  });
  try {
    const folderId = state.filter.folderId !== "all" && state.filter.folderId !== "fav"
      ? state.filter.folderId
      : state.folders[0]?.id;
    const doc = await createDocument(sb, userId, {
      title: "Neue Notiz",
      folderId,
      clusterLabel: state.filter.cluster,
    });
    state.documents.unshift(doc);
    document.getElementById("screen-auth-hint")?.setAttribute("hidden", "");
    document.getElementById("screen-loading")?.classList.add("is-done");
    await openNote(doc.id, { alreadyVisible: true });
  } catch (e) {
    console.error("Notes createNewNote", e);
    showDashboard();
    toast(e.message || "Notiz konnte nicht erstellt werden", "error");
  }
}

async function createNewFolder() {
  const name = prompt("Ordnername:");
  if (!name?.trim()) return;
  const folder = await createFolder(sb, userId, name.trim());
  state.folders.push(folder);
  paintDashboard();
  toast("Ordner erstellt", "success");
}

async function openNote(id, opts = {}) {
  if (!opts.alreadyVisible) showEditor();
  setSaveStatus("Lade…");
  try {
    const doc = await getDocument(sb, id);
    state.currentDoc = doc;
    const tagsEl = editor.root.querySelector("#insp-tags");
    const clusterEl = editor.root.querySelector("#insp-cluster");
    if (tagsEl) tagsEl.value = (doc.tags || []).join(", ");
    if (clusterEl) clusterEl.value = doc.cluster_label || "";
    editor.load(doc);
    showEditor();
    setSaveStatus("Gespeichert");
  } catch (e) {
    if (!opts.alreadyVisible) showDashboard();
    toast("Notiz konnte nicht geöffnet werden", "error");
  }
}

async function saveCurrentDoc() {
  const doc = state.currentDoc;
  if (!doc?.id) return;
  try {
    const patch = {
      title: doc.title,
      content: doc.content,
      tags: doc.tags || [],
      cluster_label: doc.cluster_label || null,
    };
    await updateDocument(sb, doc.id, patch);
    const idx = state.documents.findIndex((d) => d.id === doc.id);
    if (idx >= 0) state.documents[idx] = { ...state.documents[idx], ...patch, updated_at: new Date().toISOString() };
    setSaveStatus("Gespeichert");
  } catch (e) {
    setSaveStatus("Fehler beim Speichern");
    toast("Speichern fehlgeschlagen", "error");
  }
}

async function toggleFavorite(id) {
  const doc = state.documents.find((d) => d.id === id);
  if (!doc) return;
  const is_favorite = !doc.is_favorite;
  await updateDocument(sb, id, { is_favorite });
  doc.is_favorite = is_favorite;
  paintDashboard();
}

async function removeNote(id) {
  if (!confirm("Notiz wirklich löschen?")) return;
  await deleteDocument(sb, id);
  state.documents = state.documents.filter((d) => d.id !== id);
  paintDashboard();
  toast("Notiz gelöscht", "info");
}

async function exportCurrent(type) {
  const doc = state.currentDoc;
  if (!doc) return;
  try {
    const canvas = editor.getCanvasEl();
    if (type === "json") await exportJson(doc);
    else if (type === "html") await exportHtml(doc, canvas);
    else if (type === "md") await exportMarkdown(doc);
    else if (type === "png") await exportPng(canvas, doc.title);
    else if (type === "pdf") await exportPdf(canvas, doc.title);
    toast("Export abgeschlossen", "success");
  } catch (e) {
    toast(e.message || "Export fehlgeschlagen", "error");
  }
}

function setSaveStatus(text) {
  const el = document.getElementById("editor-save-status");
  if (el) el.textContent = text;
}

function toast(msg, kind = "info") {
  const c = document.getElementById("toast-container");
  const t = document.createElement("div");
  t.className = `toast ${kind === "error" ? "error" : kind === "success" ? "success" : ""}`;
  t.innerHTML = `<i class="fa-solid fa-circle-info"></i><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add("fade-out"); setTimeout(() => t.remove(), 300); }, 3200);
}

window.notesToast = toast;

function showAuthHint() {
  if (booted) return;
  const el = document.getElementById("screen-auth-hint");
  if (el) el.hidden = false;
  document.getElementById("screen-loading")?.classList.add("is-done");
  document.getElementById("screen-dashboard").style.display = "none";
  document.getElementById("screen-editor").style.display = "none";
}

window.notesSoftRefresh = async () => {
  userId = window.RootsUser?._uid || userId;
  if (booted && userId) {
    document.getElementById("screen-auth-hint")?.setAttribute("hidden", "");
    await loadDashboard();
    return;
  }
  void window.RootsUserBridge?.syncAuthFromParentStorage?.();
};
