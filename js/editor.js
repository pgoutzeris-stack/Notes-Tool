import { debounce } from "./utils.js";
import { migrateDocumentContent } from "./utils.js";
import { appHeaderHtml, updateAppHeader } from "./header.js";
import { getPagePreset, PAGE_PRESETS, presetLabel } from "./page-presets.js";

const SLASH_COMMANDS = [
  { cmd: "h1", label: "Überschrift 1", icon: "fa-heading", action: () => formatBlock("h1") },
  { cmd: "h2", label: "Überschrift 2", icon: "fa-heading", action: () => formatBlock("h2") },
  { cmd: "liste", label: "Aufzählung", icon: "fa-list-ul", action: () => document.execCommand("insertUnorderedList") },
  { cmd: "nummer", label: "Nummerierte Liste", icon: "fa-list-ol", action: () => document.execCommand("insertOrderedList") },
  { cmd: "todo", label: "Checkliste", icon: "fa-square-check", action: () => insertChecklist() },
  { cmd: "zitat", label: "Zitat", icon: "fa-quote-left", action: () => insertBlock("blockquote", "Zitat eingeben…") },
  { cmd: "callout", label: "Hinweis-Box", icon: "fa-lightbulb", action: () => insertCallout() },
  { cmd: "trenner", label: "Trennlinie", icon: "fa-minus", action: () => insertDivider() },
  { cmd: "tabelle", label: "Tabelle 3×3", icon: "fa-table", action: () => insertTable(3, 3) },
];

export class NotesEditor {
  constructor(root, { onChange }) {
    this.root = root;
    this.onChange = onChange;
    this.doc = null;
    this.ribbonTab = "start";
    this.history = [];
    this.historyIndex = -1;
    this.slashOpen = false;

    this.buildUi();
    updateAppHeader();
    this.bindEvents();
  }

  buildUi() {
    this.root.innerHTML = `
      <div class="editor-shell doc-editor">
        ${appHeaderHtml("Dokument bearbeiten")}
        <div class="doc-ribbon">
          <div class="ribbon-tabs">
            <button type="button" class="ribbon-tab is-active" data-tab="start">Start</button>
            <button type="button" class="ribbon-tab" data-tab="insert">Einfügen</button>
            <button type="button" class="ribbon-tab" data-tab="layout">Layout</button>
          </div>
          <div class="ribbon-panels">
            <div class="ribbon-panel is-active" data-panel="start">
              <div class="ribbon-group">
                <button type="button" class="ribbon-btn" data-cmd="undo" title="Rückgängig"><i class="fa-solid fa-rotate-left"></i></button>
                <button type="button" class="ribbon-btn" data-cmd="redo" title="Wiederholen"><i class="fa-solid fa-rotate-right"></i></button>
              </div>
              <div class="ribbon-sep"></div>
              <div class="ribbon-group">
                <select class="ribbon-select" id="ribbon-style">
                  <option value="p">Fließtext</option>
                  <option value="h1">Überschrift 1</option>
                  <option value="h2">Überschrift 2</option>
                  <option value="h3">Überschrift 3</option>
                </select>
              </div>
              <div class="ribbon-sep"></div>
              <div class="ribbon-group">
                <button type="button" class="ribbon-btn" data-cmd="bold"><i class="fa-solid fa-bold"></i></button>
                <button type="button" class="ribbon-btn" data-cmd="italic"><i class="fa-solid fa-italic"></i></button>
                <button type="button" class="ribbon-btn" data-cmd="underline"><i class="fa-solid fa-underline"></i></button>
                <button type="button" class="ribbon-btn" data-cmd="strikeThrough"><i class="fa-solid fa-strikethrough"></i></button>
                <input type="color" class="ribbon-color" id="ribbon-text-color" value="#0f172a" title="Textfarbe">
                <input type="color" class="ribbon-color" id="ribbon-highlight" value="#fef08a" title="Markierung">
              </div>
              <div class="ribbon-sep"></div>
              <div class="ribbon-group">
                <button type="button" class="ribbon-btn" data-cmd="justifyLeft"><i class="fa-solid fa-align-left"></i></button>
                <button type="button" class="ribbon-btn" data-cmd="justifyCenter"><i class="fa-solid fa-align-center"></i></button>
                <button type="button" class="ribbon-btn" data-cmd="justifyRight"><i class="fa-solid fa-align-right"></i></button>
              </div>
            </div>
            <div class="ribbon-panel" data-panel="insert">
              <div class="ribbon-group">
                <button type="button" class="ribbon-btn" data-insert="link"><i class="fa-solid fa-link"></i> Link</button>
                <button type="button" class="ribbon-btn" data-insert="table"><i class="fa-solid fa-table"></i> Tabelle</button>
                <button type="button" class="ribbon-btn" data-insert="divider"><i class="fa-solid fa-minus"></i> Trennlinie</button>
                <button type="button" class="ribbon-btn" data-insert="callout"><i class="fa-solid fa-lightbulb"></i> Hinweis</button>
                <button type="button" class="ribbon-btn" data-insert="todo"><i class="fa-solid fa-square-check"></i> Checkliste</button>
              </div>
            </div>
            <div class="ribbon-panel" data-panel="layout">
              <div class="ribbon-group ribbon-group--wide">
                <label class="ribbon-label">Seitenformat
                  <select id="layout-preset" class="ribbon-select ribbon-select--wide"></select>
                </label>
                <label class="ribbon-label">Ränder
                  <select id="layout-margin" class="ribbon-select">
                    <option value="normal">Normal</option>
                    <option value="narrow">Schmal</option>
                    <option value="wide">Breit</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
          <div class="ribbon-actions">
            <button type="button" class="btn-ghost btn-ghost--sm" data-action="back"><i class="fa-solid fa-arrow-left"></i></button>
            <input type="text" class="doc-title-input" id="editor-title" placeholder="Dokumenttitel" />
            <span class="doc-save-status" id="editor-save-status">Gespeichert</span>
            <button type="button" class="btn-ghost btn-ghost--sm" data-action="focus" title="Fokusmodus"><i class="fa-solid fa-expand"></i></button>
            <button type="button" class="btn-ghost btn-ghost--sm" data-export="pdf"><i class="fa-solid fa-file-pdf"></i></button>
            <button type="button" class="btn-ghost btn-ghost--sm" data-export="md"><i class="fa-solid fa-file-lines"></i></button>
            <button type="button" class="btn-ghost btn-ghost--sm" data-export="json"><i class="fa-solid fa-database"></i></button>
          </div>
        </div>
        <div class="doc-workspace">
          <div class="doc-scroll" id="doc-scroll">
            <div class="doc-page-wrap" id="doc-page-wrap">
              <div class="doc-page" id="doc-page">
                <div class="doc-page-inner" id="doc-page-inner">
                  <div class="doc-content" id="doc-content" contenteditable="true" spellcheck="true"></div>
                </div>
              </div>
            </div>
          </div>
          <aside class="doc-inspector">
            <div class="inspector-title">Dokument</div>
            <div class="doc-meta-card">
              <span class="doc-meta-label">Format</span>
              <strong id="meta-preset">—</strong>
            </div>
            <div class="doc-meta-card">
              <span class="doc-meta-label">Wörter</span>
              <strong id="meta-words">0</strong>
            </div>
            <div class="doc-meta-card">
              <span class="doc-meta-label">Lesezeit</span>
              <strong id="meta-read">0 min</strong>
            </div>
            <label>Tags<input type="text" id="insp-tags" placeholder="workshop, idee"></label>
            <label>Cluster<input type="text" id="insp-cluster" placeholder="Projekt A"></label>
            <p class="doc-tip"><i class="fa-solid fa-bolt"></i> Tippe <kbd>/</kbd> für Blöcke: Überschrift, Tabelle, Checkliste…</p>
          </aside>
        </div>
        <div class="doc-statusbar">
          <span id="status-preset">A4</span>
          <span class="doc-status-sep">·</span>
          <span id="status-words">0 Wörter</span>
          <span class="doc-status-sep">·</span>
          <span id="status-chars">0 Zeichen</span>
          <div class="doc-zoom">
            <button type="button" class="ribbon-btn" data-zoom="-"><i class="fa-solid fa-minus"></i></button>
            <span id="status-zoom">100%</span>
            <button type="button" class="ribbon-btn" data-zoom="+"><i class="fa-solid fa-plus"></i></button>
          </div>
        </div>
        <div class="slash-menu" id="slash-menu" hidden></div>
      </div>`;

    this.titleInput = this.root.querySelector("#editor-title");
    this.contentEl = this.root.querySelector("#doc-content");
    this.pageEl = this.root.querySelector("#doc-page");
    this.pageInner = this.root.querySelector("#doc-page-inner");
    this.pageWrap = this.root.querySelector("#doc-page-wrap");
    this.slashMenu = this.root.querySelector("#slash-menu");
    this.layoutPreset = this.root.querySelector("#layout-preset");

    this.layoutPreset.innerHTML = PAGE_PRESETS.map((p) =>
      `<option value="${p.id}">${p.label}</option>`).join("");
  }

  bindEvents() {
    this.root.querySelectorAll(".ribbon-tab").forEach((tab) => {
      tab.addEventListener("click", () => this.setRibbonTab(tab.dataset.tab));
    });

    this.root.querySelectorAll("[data-cmd]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const cmd = btn.dataset.cmd;
        if (cmd === "undo") this.undo();
        else if (cmd === "redo") this.redo();
        else document.execCommand(cmd, false, null);
        this.syncFromEditor();
      });
    });

    this.root.querySelector("#ribbon-style")?.addEventListener("change", (e) => {
      formatBlock(e.target.value);
      this.syncFromEditor();
    });

    this.root.querySelector("#ribbon-text-color")?.addEventListener("input", (e) => {
      document.execCommand("foreColor", false, e.target.value);
      this.syncFromEditor();
    });

    this.root.querySelector("#ribbon-highlight")?.addEventListener("input", (e) => {
      document.execCommand("hiliteColor", false, e.target.value);
      this.syncFromEditor();
    });

    this.root.querySelectorAll("[data-insert]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = btn.dataset.insert;
        if (t === "link") insertLink();
        else if (t === "table") insertTable(3, 3);
        else if (t === "divider") insertDivider();
        else if (t === "callout") insertCallout();
        else if (t === "todo") insertChecklist();
        this.syncFromEditor();
      });
    });

    this.root.querySelector("[data-action=back]")?.addEventListener("click", () => this.onBack?.());
    this.root.querySelector("[data-action=focus]")?.addEventListener("click", () => this.toggleFocus());
    this.root.querySelectorAll("[data-export]").forEach((btn) => {
      btn.addEventListener("click", () => this.onExport?.(btn.dataset.export));
    });

    this.titleInput.addEventListener("input", () => {
      if (!this.doc) return;
      this.doc.title = this.titleInput.value;
      this.emitChange(false);
    });

    ["insp-tags", "insp-cluster"].forEach((id) => {
      this.root.querySelector(`#${id}`)?.addEventListener("input", () => this.syncMeta());
    });

    this.layoutPreset?.addEventListener("change", () => this.applyPagePreset(this.layoutPreset.value));
    this.root.querySelector("#layout-margin")?.addEventListener("change", (e) => this.applyMarginPreset(e.target.value));

    this.contentEl.addEventListener("input", debounce(() => this.syncFromEditor(), 200));
    this.contentEl.addEventListener("keydown", (e) => this.onContentKeydown(e));
    this.contentEl.addEventListener("keyup", () => this.updateStats());

    this.root.querySelectorAll("[data-zoom]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const delta = btn.dataset.zoom === "+" ? 10 : -10;
        this.setZoom((this.content.settings?.zoom || 100) + delta);
      });
    });

    document.addEventListener("click", (e) => {
      if (!this.slashMenu?.contains(e.target)) this.hideSlashMenu();
    });
  }

  load(doc) {
    this.doc = doc;
    if (typeof this.doc.content === "string") {
      try { this.doc.content = JSON.parse(this.doc.content); } catch { this.doc.content = null; }
    }
    this.doc.content = migrateDocumentContent(this.doc.content);
    if (!this.doc.content.settings) this.doc.content.settings = { zoom: 100, focusMode: false };

    this.titleInput.value = this.doc.title || "";
    this.contentEl.innerHTML = this.doc.content.html || "<p>Beginne zu schreiben…</p>";
    this.root.querySelector("#insp-tags").value = (this.doc.tags || []).join(", ");
    this.root.querySelector("#insp-cluster").value = this.doc.cluster_label || "";

    this.layoutPreset.value = this.doc.content.page.preset || "a4-portrait";
    this.applyPageStyles();
    this.setZoom(this.doc.content.settings.zoom || 100, false);
    this.setFocusMode(!!this.doc.content.settings.focusMode, false);
    this.pushHistory(true);
    this.updateStats();
    this.syncMeta();
  }

  applyPageStyles() {
    const page = this.doc.content.page;
    const preset = getPagePreset(page.preset);
    if (preset.fluid || page.fluid) {
      this.pageEl.classList.add("is-fluid");
      this.pageEl.style.width = "min(720px, calc(100% - 48px))";
      this.pageEl.style.minHeight = "840px";
      this.pageEl.style.height = "auto";
    } else {
      this.pageEl.classList.remove("is-fluid");
      this.pageEl.style.width = `${page.width}px`;
      this.pageEl.style.height = `${page.height}px`;
      this.pageEl.style.minHeight = "";
    }
    const m = page.margins || preset.margins;
    this.pageInner.style.padding = `${m.top}px ${m.right}px ${m.bottom}px ${m.left}px`;
    this.root.querySelector("#meta-preset").textContent = presetLabel(page.preset);
    this.root.querySelector("#status-preset").textContent = preset.label.split(" ")[0];
  }

  applyPagePreset(presetId) {
    const preset = getPagePreset(presetId);
    const page = this.doc.content.page;
    page.preset = preset.id;
    page.width = preset.width;
    page.height = preset.height;
    page.fluid = !!preset.fluid;
    page.orientation = preset.orientation;
    if (!page.margins) page.margins = { ...preset.margins };
    this.applyPageStyles();
    this.emitChange(false);
  }

  applyMarginPreset(mode) {
    const page = this.doc.content.page;
    const base = getPagePreset(page.preset).margins;
    const scale = mode === "narrow" ? 0.6 : mode === "wide" ? 1.4 : 1;
    page.margins = {
      top: Math.round(base.top * scale),
      right: Math.round(base.right * scale),
      bottom: Math.round(base.bottom * scale),
      left: Math.round(base.left * scale),
    };
    this.applyPageStyles();
    this.emitChange(false);
  }

  setZoom(value, save = true) {
    const z = Math.max(50, Math.min(150, value));
    this.doc.content.settings.zoom = z;
    this.pageWrap.style.transform = `scale(${z / 100})`;
    this.pageWrap.style.transformOrigin = "top center";
    this.root.querySelector("#status-zoom").textContent = `${z}%`;
    if (save) this.emitChange(false);
  }

  toggleFocus() {
    this.setFocusMode(!this.doc.content.settings.focusMode);
  }

  setFocusMode(on, save = true) {
    this.doc.content.settings.focusMode = on;
    this.root.querySelector(".doc-editor")?.classList.toggle("is-focus", on);
    if (save) this.emitChange(false);
  }

  setRibbonTab(tab) {
    this.ribbonTab = tab;
    this.root.querySelectorAll(".ribbon-tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === tab));
    this.root.querySelectorAll(".ribbon-panel").forEach((p) => p.classList.toggle("is-active", p.dataset.panel === tab));
  }

  syncFromEditor() {
    if (!this.doc) return;
    this.doc.content.html = this.contentEl.innerHTML;
    this.commitHistory();
    this.updateStats();
    this.emitChange(false);
  }

  syncMeta() {
    const tags = this.root.querySelector("#insp-tags").value.split(",").map((t) => t.trim()).filter(Boolean);
    const cluster = this.root.querySelector("#insp-cluster").value.trim() || null;
    this.doc.tags = tags;
    this.doc.cluster_label = cluster;
    this.emitChange(false);
  }

  updateStats() {
    const text = this.contentEl.innerText || "";
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const readMin = Math.max(1, Math.ceil(words / 200));
    this.root.querySelector("#meta-words").textContent = String(words);
    this.root.querySelector("#meta-read").textContent = `${readMin} min`;
    this.root.querySelector("#status-words").textContent = `${words} Wörter`;
    this.root.querySelector("#status-chars").textContent = `${chars} Zeichen`;
  }

  onContentKeydown(e) {
    if (e.key === "/" && !this.slashOpen) {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const textBefore = range.startContainer.textContent?.slice(0, range.startOffset) || "";
      if (textBefore.endsWith("/") || range.startOffset === 0 || /\s$/.test(textBefore.slice(0, -1) + "/")) {
        e.preventDefault();
        if (textBefore.endsWith("/")) {
          range.setStart(range.startContainer, range.startOffset - 1);
          range.deleteContents();
        }
        this.showSlashMenu(range);
      }
    }
    if (e.key === "Escape") this.hideSlashMenu();
  }

  showSlashMenu(range) {
    this.slashOpen = true;
    this.slashMenu.hidden = false;
    this.slashMenu.innerHTML = SLASH_COMMANDS.map((c) =>
      `<button type="button" class="slash-item" data-slash="${c.cmd}"><i class="fa-solid ${c.icon}"></i> ${c.label}</button>`).join("");
    const rect = range.getBoundingClientRect();
    this.slashMenu.style.left = `${rect.left}px`;
    this.slashMenu.style.top = `${rect.bottom + 6}px`;
    this.slashMenu.querySelectorAll(".slash-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cmd = SLASH_COMMANDS.find((c) => c.cmd === btn.dataset.slash);
        cmd?.action();
        this.hideSlashMenu();
        this.syncFromEditor();
      });
    });
  }

  hideSlashMenu() {
    this.slashOpen = false;
    if (this.slashMenu) this.slashMenu.hidden = true;
  }

  pushHistory(reset = false) {
    const snap = this.doc.content.html;
    if (reset) {
      this.history = [snap];
      this.historyIndex = 0;
      return;
    }
  }

  commitHistory() {
    const snap = this.doc.content.html;
    if (this.history[this.historyIndex] === snap) return;
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(snap);
    if (this.history.length > 60) this.history.shift();
    this.historyIndex = this.history.length - 1;
  }

  undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    this.contentEl.innerHTML = this.history[this.historyIndex];
    this.doc.content.html = this.contentEl.innerHTML;
    this.updateStats();
    this.emitChange(false);
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    this.contentEl.innerHTML = this.history[this.historyIndex];
    this.doc.content.html = this.contentEl.innerHTML;
    this.updateStats();
    this.emitChange(false);
  }

  emitChange(immediate) {
    this.onChange?.(this.doc, immediate);
  }

  getCanvasEl() {
    return this.root.querySelector("#doc-page");
  }

  captureThumbnail() {
    return this.getCanvasEl();
  }
}

function formatBlock(tag) {
  document.execCommand("formatBlock", false, tag);
}

function insertBlock(tag, placeholder) {
  document.execCommand("insertHTML", false, `<${tag}><p>${placeholder}</p></${tag}><p></p>`);
}

function insertDivider() {
  document.execCommand("insertHTML", false, `<hr class="doc-divider"><p></p>`);
}

function insertCallout() {
  document.execCommand("insertHTML", false,
    `<div class="doc-callout" contenteditable="true"><strong>Hinweis</strong><p>Text eingeben…</p></div><p></p>`);
}

function insertChecklist() {
  document.execCommand("insertHTML", false,
    `<ul class="doc-checklist"><li><input type="checkbox"> Aufgabe 1</li><li><input type="checkbox"> Aufgabe 2</li></ul><p></p>`);
}

function insertTable(rows, cols) {
  let html = "<table class='doc-table'><tbody>";
  for (let r = 0; r < rows; r++) {
    html += "<tr>";
    for (let c = 0; c < cols; c++) html += "<td>Inhalt</td>";
    html += "</tr>";
  }
  html += "</tbody></table><p></p>";
  document.execCommand("insertHTML", false, html);
}

function insertLink() {
  const url = prompt("Link-URL:");
  if (url) document.execCommand("createLink", false, url);
}
