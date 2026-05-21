import { uid, clamp, debounce } from "./utils.js";
import { appHeaderHtml, updateAppHeader } from "./header.js";

const GRID = 8;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;

export class NotesEditor {
  constructor(root, { onChange, onSaveStatus }) {
    this.root = root;
    this.onChange = onChange;
    this.onSaveStatus = onSaveStatus;
    this.doc = null;
    this.tool = "select";
    this.selected = new Set();
    this.drag = null;
    this.history = [];
    this.historyIndex = -1;
    this.connectFrom = null;
    this._renderConnectors = debounce(() => this.renderConnectors(), 16);

    this.buildUi();
    updateAppHeader();
    this.bindEvents();
  }

  buildUi() {
    this.root.innerHTML = `
      <div class="editor-shell">
        ${appHeaderHtml("Notiz bearbeiten")}
        <div class="editor-subbar">
          <button type="button" class="btn-ghost" data-action="back"><i class="fa-solid fa-arrow-left"></i> Übersicht</button>
          <input type="text" class="editor-title-input" id="editor-title" placeholder="Titel der Notiz" />
          <div class="editor-save-status" id="editor-save-status">Gespeichert</div>
          <div class="editor-subbar-actions">
            <button type="button" class="btn-ghost" data-action="undo" title="Rückgängig"><i class="fa-solid fa-rotate-left"></i></button>
            <button type="button" class="btn-ghost" data-action="redo" title="Wiederholen"><i class="fa-solid fa-rotate-right"></i></button>
            <button type="button" class="btn-ghost" data-export="png"><i class="fa-solid fa-image"></i> PNG</button>
            <button type="button" class="btn-ghost" data-export="pdf"><i class="fa-solid fa-file-pdf"></i> PDF</button>
            <button type="button" class="btn-ghost" data-export="html"><i class="fa-solid fa-code"></i> HTML</button>
            <button type="button" class="btn-ghost" data-export="md"><i class="fa-solid fa-file-lines"></i> MD</button>
            <button type="button" class="btn-ghost" data-export="json"><i class="fa-solid fa-database"></i> JSON</button>
            <button type="button" class="btn-primary" data-action="present"><i class="fa-solid fa-display"></i> Präsentieren</button>
          </div>
        </div>
        <div class="editor-body">
          <aside class="editor-toolbar">
            <div class="tool-group-label">Auswahl</div>
            <button type="button" class="tool-btn is-active" data-tool="select" title="Auswählen"><i class="fa-solid fa-arrow-pointer"></i></button>
            <button type="button" class="tool-btn" data-tool="pan" title="Verschieben"><i class="fa-solid fa-hand"></i></button>
            <div class="tool-group-label">Formen</div>
            <button type="button" class="tool-btn" data-tool="rect"><i class="fa-regular fa-square"></i></button>
            <button type="button" class="tool-btn" data-tool="ellipse"><i class="fa-regular fa-circle"></i></button>
            <button type="button" class="tool-btn" data-tool="diamond"><i class="fa-regular fa-gem"></i></button>
            <button type="button" class="tool-btn" data-tool="arrow"><i class="fa-solid fa-arrow-right-long"></i></button>
            <button type="button" class="tool-btn" data-tool="line"><i class="fa-solid fa-minus"></i></button>
            <button type="button" class="tool-btn" data-tool="connector"><i class="fa-solid fa-bezier-curve"></i></button>
            <div class="tool-group-label">Inhalt</div>
            <button type="button" class="tool-btn" data-tool="text"><i class="fa-solid fa-font"></i></button>
            <button type="button" class="tool-btn" data-tool="sticky"><i class="fa-solid fa-note-sticky"></i></button>
            <button type="button" class="tool-btn" data-tool="table"><i class="fa-solid fa-table"></i></button>
            <button type="button" class="tool-btn" data-tool="frame"><i class="fa-regular fa-window-maximize"></i></button>
            <div class="tool-group-label">Anordnen</div>
            <button type="button" class="tool-btn" data-align="left"><i class="fa-solid fa-align-left"></i></button>
            <button type="button" class="tool-btn" data-align="center-h"><i class="fa-solid fa-align-center"></i></button>
            <button type="button" class="tool-btn" data-align="top"><i class="fa-solid fa-arrow-up"></i></button>
            <button type="button" class="tool-btn" data-align="distribute-h"><i class="fa-solid fa-grip-lines"></i></button>
            <button type="button" class="tool-btn" data-rotate="45"><i class="fa-solid fa-rotate-right"></i></button>
          </aside>
          <div class="editor-canvas-wrap" id="editor-canvas-wrap">
            <div class="canvas-viewport" id="canvas-viewport">
              <svg class="canvas-connectors" id="canvas-connectors"></svg>
              <div class="canvas-world" id="canvas-world"></div>
              <div class="selection-box editor-ui" id="selection-box" hidden></div>
            </div>
          </div>
          <aside class="editor-inspector">
            <div class="inspector-title">Eigenschaften</div>
            <label>Farbe<input type="color" id="insp-fill" value="#ffffff"></label>
            <label>Rahmen<input type="color" id="insp-stroke" value="#206efb"></label>
            <label>Schriftgröße<input type="number" id="insp-font" min="10" max="72" value="16"></label>
            <label>Deckkraft<input type="range" id="insp-opacity" min="0.2" max="1" step="0.05" value="1"></label>
            <label>Tags<input type="text" id="insp-tags" placeholder="workshop, idee"></label>
            <label>Cluster<input type="text" id="insp-cluster" placeholder="Projekt A"></label>
          </aside>
        </div>
        <div class="format-bar editor-ui" id="format-bar">
          <button type="button" data-cmd="bold"><i class="fa-solid fa-bold"></i></button>
          <button type="button" data-cmd="italic"><i class="fa-solid fa-italic"></i></button>
          <button type="button" data-cmd="underline"><i class="fa-solid fa-underline"></i></button>
          <button type="button" data-cmd="insertUnorderedList"><i class="fa-solid fa-list-ul"></i></button>
          <button type="button" data-cmd="insertOrderedList"><i class="fa-solid fa-list-ol"></i></button>
          <select id="format-heading">
            <option value="p">Fließtext</option>
            <option value="h1">Überschrift 1</option>
            <option value="h2">Überschrift 2</option>
            <option value="h3">Überschrift 3</option>
          </select>
        </div>
      </div>
      <div class="present-overlay" id="present-overlay" hidden>
        <div class="present-toolbar">
          <button type="button" data-present="prev"><i class="fa-solid fa-chevron-left"></i></button>
          <span id="present-counter">1 / 1</span>
          <button type="button" data-present="next"><i class="fa-solid fa-chevron-right"></i></button>
          <button type="button" data-present="close"><i class="fa-solid fa-xmark"></i> Beenden</button>
        </div>
        <div class="present-stage" id="present-stage"></div>
      </div>`;

    this.titleInput = this.root.querySelector("#editor-title");
    this.viewport = this.root.querySelector("#canvas-viewport");
    this.world = this.root.querySelector("#canvas-world");
    this.connectorsSvg = this.root.querySelector("#canvas-connectors");
    this.selectionBox = this.root.querySelector("#selection-box");
    this.formatBar = this.root.querySelector("#format-bar");
    this.presentOverlay = this.root.querySelector("#present-overlay");
  }

  bindEvents() {
    this.root.querySelectorAll("[data-tool]").forEach((btn) => {
      btn.addEventListener("click", () => this.setTool(btn.dataset.tool));
    });
    this.root.querySelectorAll("[data-align]").forEach((btn) => {
      btn.addEventListener("click", () => this.alignSelected(btn.dataset.align));
    });
    this.root.querySelector("[data-rotate]")?.addEventListener("click", () => this.rotateSelected(45));
    this.root.querySelector("[data-action=undo]")?.addEventListener("click", () => this.undo());
    this.root.querySelector("[data-action=redo]")?.addEventListener("click", () => this.redo());
    this.root.querySelector("[data-action=back]")?.addEventListener("click", () => this.onBack?.());
    this.root.querySelector("[data-action=present]")?.addEventListener("click", () => this.startPresentation());

    this.root.querySelectorAll("[data-export]").forEach((btn) => {
      btn.addEventListener("click", () => this.onExport?.(btn.dataset.export));
    });

    this.titleInput.addEventListener("input", () => {
      if (!this.doc) return;
      this.doc.title = this.titleInput.value;
      this.emitChange(false);
    });

    ["insp-fill", "insp-stroke", "insp-font", "insp-opacity", "insp-tags", "insp-cluster"].forEach((id) => {
      this.root.querySelector(`#${id}`)?.addEventListener("input", () => this.applyInspector());
    });

    this.formatBar.querySelectorAll("[data-cmd]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        document.execCommand(btn.dataset.cmd, false, null);
      });
    });
    this.root.querySelector("#format-heading")?.addEventListener("change", (e) => {
      document.execCommand("formatBlock", false, e.target.value);
    });

    this.viewport.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
    this.viewport.addEventListener("mousedown", (e) => this.onPointerDown(e));
    window.addEventListener("mousemove", (e) => this.onPointerMove(e));
    window.addEventListener("mouseup", () => this.onPointerUp());
    window.addEventListener("keydown", (e) => this.onKeyDown(e));

    this.presentOverlay.querySelector("[data-present=close]")?.addEventListener("click", () => this.stopPresentation());
    this.presentOverlay.querySelector("[data-present=prev]")?.addEventListener("click", () => this.stepPresentation(-1));
    this.presentOverlay.querySelector("[data-present=next]")?.addEventListener("click", () => this.stepPresentation(1));
  }

  load(doc) {
    this.doc = doc;
    if (typeof this.doc.content === "string") {
      try { this.doc.content = JSON.parse(this.doc.content); } catch { this.doc.content = null; }
    }
    if (!this.doc.content || typeof this.doc.content !== "object") {
      this.doc.content = { version: 1, viewport: { x: 0, y: 0, zoom: 1 }, objects: [], presentation: { slides: [] } };
    }
    if (!this.doc.content.viewport) this.doc.content.viewport = { x: 0, y: 0, zoom: 1 };
    if (!Array.isArray(this.doc.content.objects)) this.doc.content.objects = [];
    this.titleInput.value = doc.title || "";
    this.selected.clear();
    this.stopPresentation();
    this.pushHistory(true);
    this.renderAll();
  }

  get content() { return this.doc?.content; }

  setTool(tool) {
    this.tool = tool;
    this.connectFrom = null;
    this.root.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("is-active", b.dataset.tool === tool));
    this.viewport.style.cursor = tool === "pan" ? "grab" : tool === "connector" ? "crosshair" : "default";
  }

  objects() { return this.content.objects || []; }

  objById(id) { return this.objects().find((o) => o.id === id); }

  renderAll() {
    this.applyViewport();
    this.world.innerHTML = "";
    const sorted = [...this.objects()].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    sorted.forEach((obj) => this.world.appendChild(this.renderObject(obj)));
    this.renderConnectors();
    this.updateSelectionUi();
  }

  applyViewport() {
    const vp = this.content.viewport;
    this.world.style.transform = `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`;
    this.connectorsSvg.style.transform = `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`;
  }

  renderObject(obj) {
    const el = document.createElement("div");
    el.className = `canvas-obj canvas-obj--${obj.type}`;
    el.dataset.id = obj.id;
    el.style.left = `${obj.x}px`;
    el.style.top = `${obj.y}px`;
    el.style.width = `${obj.w}px`;
    el.style.height = `${obj.h}px`;
    el.style.transform = `rotate(${obj.rotation || 0}deg)`;
    el.style.zIndex = obj.zIndex || 1;
    el.style.opacity = obj.opacity ?? 1;
    el.style.background = obj.fill || "#ffffff";
    el.style.borderColor = obj.stroke || "#206efb";
    if (obj.type === "sticky") el.style.background = obj.fill || "#fef08a";

    if (["text", "sticky", "rect", "frame"].includes(obj.type)) {
      const body = document.createElement("div");
      body.className = "obj-body";
      body.contentEditable = "true";
      body.spellcheck = true;
      body.innerHTML = obj.content || (obj.type === "sticky" ? "<p>Notiz…</p>" : "<p>Text eingeben</p>");
      body.style.fontSize = `${obj.fontSize || 16}px`;
      body.addEventListener("input", debounce(() => {
        obj.content = body.innerHTML;
        this.emitChange(false);
      }, 300));
      body.addEventListener("focus", () => { this.selected = new Set([obj.id]); this.updateSelectionUi(); });
      el.appendChild(body);
    } else if (obj.type === "table") {
      el.appendChild(this.renderTable(obj));
    } else if (obj.type === "ellipse") {
      el.style.borderRadius = "50%";
    } else if (obj.type === "diamond") {
      el.style.transform += " rotate(45deg)";
      el.classList.add("is-diamond");
    } else if (obj.type === "frame") {
      el.classList.add("is-frame");
      const label = document.createElement("div");
      label.className = "frame-label";
      label.textContent = obj.label || "Frame";
      el.appendChild(label);
    }

    if (this.selected.has(obj.id)) el.classList.add("is-selected");

    el.addEventListener("mousedown", (e) => {
      if (this.tool === "connector") return;
      e.stopPropagation();
      if (e.target.closest(".obj-body") && this.tool === "select") return;
      this.selectObject(obj.id, e.shiftKey);
      if (this.tool === "select") this.startDrag(e, "move");
    });

    return el;
  }

  renderTable(obj) {
    const table = document.createElement("table");
    table.className = "obj-table";
    const rows = obj.rows || 2;
    const cols = obj.cols || 2;
    if (!obj.cells) obj.cells = {};
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c < cols; c++) {
        const td = document.createElement("td");
        td.contentEditable = true;
        td.innerHTML = obj.cells[`${r}-${c}`] || "";
        td.addEventListener("input", debounce(() => {
          obj.cells[`${r}-${c}`] = td.innerHTML;
          this.emitChange(false);
        }, 300));
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    return table;
  }

  renderConnectors() {
    this.connectorsSvg.innerHTML = "";
    for (const obj of this.objects()) {
      if (obj.type !== "connector" && obj.type !== "line" && obj.type !== "arrow") continue;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const d = this.connectorPath(obj);
      path.setAttribute("d", d);
      path.setAttribute("stroke", obj.stroke || "#206efb");
      path.setAttribute("stroke-width", String(obj.strokeWidth || 2));
      path.setAttribute("fill", "none");
      if (obj.type === "arrow") path.setAttribute("marker-end", "url(#arrowhead)");
      this.connectorsSvg.appendChild(path);
    }
    if (!this.connectorsSvg.querySelector("#arrowhead")) {
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      defs.innerHTML = `<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#206efb"/></marker>`;
      this.connectorsSvg.appendChild(defs);
    }
  }

  connectorPath(obj) {
    let x1 = obj.x, y1 = obj.y, x2 = obj.x2 ?? obj.x + 120, y2 = obj.y2 ?? obj.y;
    if (obj.fromId) {
      const a = this.anchorPoint(obj.fromId, obj.fromAnchor || "center");
      if (a) { x1 = a.x; y1 = a.y; }
    }
    if (obj.toId) {
      const b = this.anchorPoint(obj.toId, obj.toAnchor || "center");
      if (b) { x2 = b.x; y2 = b.y; }
    }
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }

  anchorPoint(id, anchor) {
    const o = this.objById(id);
    if (!o) return null;
    const map = {
      center: [o.x + o.w / 2, o.y + o.h / 2],
      top: [o.x + o.w / 2, o.y],
      bottom: [o.x + o.w / 2, o.y + o.h],
      left: [o.x, o.y + o.h / 2],
      right: [o.x + o.w, o.y + o.h / 2],
    };
    const p = map[anchor] || map.center;
    return { x: p[0], y: p[1] };
  }

  onWheel(e) {
    e.preventDefault();
    const vp = this.content.viewport;
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    vp.zoom = clamp(vp.zoom * delta, MIN_ZOOM, MAX_ZOOM);
    this.applyViewport();
  }

  onPointerDown(e) {
    if (e.button !== 0) return;
    const rect = this.viewport.getBoundingClientRect();
    const vp = this.content.viewport;
    const wx = (e.clientX - rect.left - vp.x) / vp.zoom;
    const wy = (e.clientY - rect.top - vp.y) / vp.zoom;

    if (this.tool === "pan" || (this.tool === "select" && e.target === this.viewport || e.target === this.world)) {
      if (this.tool === "select" && !e.shiftKey && (e.target === this.viewport || e.target === this.world)) {
        this.selected.clear();
        this.updateSelectionUi();
        this.drag = { type: "marquee", sx: e.clientX, sy: e.clientY };
        this.selectionBox.hidden = false;
        return;
      }
      this.drag = { type: "pan", sx: e.clientX, sy: e.clientY, ox: vp.x, oy: vp.y };
      return;
    }

    if (this.tool === "connector") {
      const hit = e.target.closest(".canvas-obj");
      if (!hit) return;
      const id = hit.dataset.id;
      if (!this.connectFrom) {
        this.connectFrom = id;
        return;
      }
      this.addObject({
        type: "connector",
        x: 0, y: 0, w: 0, h: 0,
        fromId: this.connectFrom,
        toId: id,
        fromAnchor: "center",
        toAnchor: "center",
        stroke: "#206efb",
      });
      this.connectFrom = null;
      this.setTool("select");
      return;
    }

    if (["rect", "ellipse", "diamond", "text", "sticky", "table", "frame", "line", "arrow"].includes(this.tool)) {
      const defaults = {
        rect: { w: 180, h: 100, fill: "#ffffff" },
        ellipse: { w: 140, h: 140, fill: "#eff6ff" },
        diamond: { w: 120, h: 120, fill: "#ecfeff" },
        text: { w: 260, h: 80, fill: "#ffffff", content: "<p>Text eingeben</p>" },
        sticky: { w: 180, h: 140, fill: "#fef08a", content: "<p>Notiz…</p>" },
        table: { w: 240, h: 120, rows: 2, cols: 2, cells: {} },
        frame: { w: 420, h: 280, fill: "#f8fafc", label: "Frame" },
        line: { w: 0, h: 0, x2: wx + 120, y2: wy },
        arrow: { w: 0, h: 0, x2: wx + 120, y2: wy },
      };
      const base = defaults[this.tool] || { w: 160, h: 100 };
      this.addObject({
        type: this.tool,
        x: snap(wx),
        y: snap(wy),
        ...base,
      });
      this.setTool("select");
    }
  }

  onPointerMove(e) {
    if (!this.drag) return;
    if (this.drag.type === "pan") {
      const vp = this.content.viewport;
      vp.x = this.drag.ox + (e.clientX - this.drag.sx);
      vp.y = this.drag.oy + (e.clientY - this.drag.sy);
      this.applyViewport();
      return;
    }
    if (this.drag.type === "move") {
      const dx = (e.clientX - this.drag.sx) / this.content.viewport.zoom;
      const dy = (e.clientY - this.drag.sy) / this.content.viewport.zoom;
      for (const id of this.selected) {
        const o = this.objById(id);
        if (!o || o.locked) continue;
        o.x = snap(this.drag.origins[id].x + dx);
        o.y = snap(this.drag.origins[id].y + dy);
      }
      this.renderAll();
      return;
    }
    if (this.drag.type === "marquee") {
      const x = Math.min(this.drag.sx, e.clientX);
      const y = Math.min(this.drag.sy, e.clientY);
      const w = Math.abs(e.clientX - this.drag.sx);
      const h = Math.abs(e.clientY - this.drag.sy);
      Object.assign(this.selectionBox.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    }
  }

  onPointerUp() {
    if (this.drag?.type === "marquee") {
      const box = this.selectionBox.getBoundingClientRect();
      this.world.querySelectorAll(".canvas-obj").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top) {
          this.selected.add(el.dataset.id);
        }
      });
      this.selectionBox.hidden = true;
      this.updateSelectionUi();
    }
    if (this.drag?.type === "move") this.commitHistory();
    this.drag = null;
  }

  startDrag(e, type) {
    const origins = {};
    for (const id of this.selected) {
      const o = this.objById(id);
      if (o) origins[id] = { x: o.x, y: o.y };
    }
    this.drag = { type, sx: e.clientX, sy: e.clientY, origins };
  }

  selectObject(id, additive) {
    if (!additive) this.selected = new Set([id]);
    else if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    this.updateSelectionUi();
  }

  updateSelectionUi() {
    this.world.querySelectorAll(".canvas-obj").forEach((el) => {
      el.classList.toggle("is-selected", this.selected.has(el.dataset.id));
    });
    const first = this.selected.size === 1 ? this.objById([...this.selected][0]) : null;
    if (first) {
      this.root.querySelector("#insp-fill").value = toHex(first.fill || "#ffffff");
      this.root.querySelector("#insp-stroke").value = toHex(first.stroke || "#206efb");
      this.root.querySelector("#insp-font").value = first.fontSize || 16;
      this.root.querySelector("#insp-opacity").value = first.opacity ?? 1;
    }
    const showFormat = first && ["text", "sticky"].includes(first.type);
    this.formatBar?.classList.toggle("is-visible", showFormat);
  }

  applyInspector() {
    for (const id of this.selected) {
      const o = this.objById(id);
      if (!o) continue;
      o.fill = this.root.querySelector("#insp-fill").value;
      o.stroke = this.root.querySelector("#insp-stroke").value;
      o.fontSize = Number(this.root.querySelector("#insp-font").value) || 16;
      o.opacity = Number(this.root.querySelector("#insp-opacity").value) || 1;
    }
    const tags = this.root.querySelector("#insp-tags").value.split(",").map((t) => t.trim()).filter(Boolean);
    const cluster = this.root.querySelector("#insp-cluster").value.trim() || null;
    if (this.doc) {
      this.doc.tags = tags;
      this.doc.cluster_label = cluster;
    }
    this.renderAll();
    this.emitChange(false);
  }

  addObject(partial) {
    const obj = {
      id: uid(),
      zIndex: this.objects().length + 1,
      rotation: 0,
      opacity: 1,
      stroke: "#206efb",
      strokeWidth: 2,
      ...partial,
    };
    this.content.objects.push(obj);
    this.selected = new Set([obj.id]);
    this.commitHistory();
    this.renderAll();
    this.emitChange(false);
  }

  alignSelected(mode) {
    const items = [...this.selected].map((id) => this.objById(id)).filter(Boolean);
    if (items.length < 2 && !["left", "top"].includes(mode)) return;
    if (mode === "left") {
      const min = Math.min(...items.map((o) => o.x));
      items.forEach((o) => { o.x = min; });
    } else if (mode === "center-h") {
      const cx = items.reduce((s, o) => s + o.x + o.w / 2, 0) / items.length;
      items.forEach((o) => { o.x = cx - o.w / 2; });
    } else if (mode === "top") {
      const min = Math.min(...items.map((o) => o.y));
      items.forEach((o) => { o.y = min; });
    } else if (mode === "distribute-h") {
      items.sort((a, b) => a.x - b.x);
      const first = items[0];
      const last = items[items.length - 1];
      const gap = (last.x - first.x) / (items.length - 1);
      items.forEach((o, i) => { o.x = first.x + gap * i; });
    }
    this.commitHistory();
    this.renderAll();
    this.emitChange(false);
  }

  rotateSelected(deg) {
    for (const id of this.selected) {
      const o = this.objById(id);
      if (o) o.rotation = ((o.rotation || 0) + deg) % 360;
    }
    this.commitHistory();
    this.renderAll();
    this.emitChange(false);
  }

  onKeyDown(e) {
    if (e.target.isContentEditable) return;
    if ((e.metaKey || e.ctrlKey) && e.key === "z") { e.preventDefault(); this.undo(); }
    if ((e.metaKey || e.ctrlKey) && e.key === "y") { e.preventDefault(); this.redo(); }
    if (["Delete", "Backspace"].includes(e.key) && this.selected.size) {
      this.content.objects = this.objects().filter((o) => !this.selected.has(o.id));
      this.selected.clear();
      this.commitHistory();
      this.renderAll();
      this.emitChange(false);
    }
    if (this.selected.size && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      const d = e.shiftKey ? GRID * 2 : GRID;
      const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
      const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
      for (const id of this.selected) {
        const o = this.objById(id);
        if (o) { o.x += dx; o.y += dy; }
      }
      this.renderAll();
      this.emitChange(false);
    }
  }

  pushHistory(reset = false) {
    if (reset) {
      this.history = [JSON.stringify(this.content)];
      this.historyIndex = 0;
      return;
    }
  }

  commitHistory() {
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(JSON.stringify(this.content));
    if (this.history.length > 80) this.history.shift();
    this.historyIndex = this.history.length - 1;
  }

  undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    this.content = JSON.parse(this.history[this.historyIndex]);
    this.renderAll();
    this.emitChange(false);
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    this.content = JSON.parse(this.history[this.historyIndex]);
    this.renderAll();
    this.emitChange(false);
  }

  emitChange(immediate) {
    this.onChange?.(this.doc, immediate);
  }

  getCanvasEl() { return this.viewport; }

  startPresentation() {
    const frames = this.objects().filter((o) => o.type === "frame");
    const slides = frames.length ? frames : this.objects().filter((o) => ["rect", "sticky", "text"].includes(o.type)).slice(0, 5);
    if (!slides.length) return;
    this._slides = slides;
    this._slideIndex = 0;
    this.content.presentation.slides = slides.map((s) => s.id);
    this.presentOverlay.hidden = false;
    this.renderPresentationSlide();
  }

  renderPresentationSlide() {
    const slide = this._slides[this._slideIndex];
    const stage = this.root.querySelector("#present-stage");
    const counter = this.root.querySelector("#present-counter");
    counter.textContent = `${this._slideIndex + 1} / ${this._slides.length}`;
    stage.innerHTML = "";
    const clone = this.renderObject({ ...slide });
    clone.style.position = "relative";
    clone.style.left = "0";
    clone.style.top = "0";
    clone.style.transform = `rotate(${slide.rotation || 0}deg)`;
    stage.appendChild(clone);
  }

  stepPresentation(dir) {
    this._slideIndex = clamp(this._slideIndex + dir, 0, this._slides.length - 1);
    this.renderPresentationSlide();
  }

  stopPresentation() {
    this.presentOverlay.hidden = true;
  }

  captureThumbnail() {
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;left:-9999px;top:0;width:320px;height:180px;overflow:hidden;background:#fff";
    const mini = this.world.cloneNode(true);
    mini.style.transform = "scale(0.25)";
    mini.style.transformOrigin = "top left";
    wrap.appendChild(mini);
    document.body.appendChild(wrap);
    return wrap;
  }
}

function snap(v) { return Math.round(v / GRID) * GRID; }

function toHex(c) {
  if (!c || c.startsWith("#")) return c || "#ffffff";
  return "#ffffff";
}
