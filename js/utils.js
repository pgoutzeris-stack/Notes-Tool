export function uid() {
  return crypto.randomUUID();
}

export function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export function debounce(fn, ms = 400) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

import { getPagePreset } from "./page-presets.js";

export function defaultDocumentContent(presetId = "a4-portrait", html) {
  const preset = getPagePreset(presetId);
  return {
    version: 2,
    page: {
      preset: preset.id,
      width: preset.width,
      height: preset.height,
      fluid: !!preset.fluid,
      orientation: preset.orientation,
      margins: { ...preset.margins },
    },
    html: html || "<p>Beginne zu schreiben…</p>",
    settings: { zoom: 100, focusMode: false },
  };
}

export function migrateDocumentContent(content) {
  if (!content || typeof content !== "object") return defaultDocumentContent();
  if (content.version === 2 && content.page) return content;

  const parts = [];
  for (const obj of content.objects || []) {
    if (obj.content) parts.push(obj.content);
    else if (obj.type === "table" && obj.cells) {
      parts.push("<table>" + Object.entries(obj.cells).map(([, v]) => `<tr><td>${v}</td></tr>`).join("") + "</table>");
    }
  }
  const html = parts.length ? parts.join("") : "<p><em>Inhalt aus alter Canvas-Notiz migriert.</em></p><p>Beginne hier neu zu schreiben…</p>";
  return defaultDocumentContent("a4-portrait", html);
}

export function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
