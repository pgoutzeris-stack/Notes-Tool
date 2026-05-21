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

export function defaultDocumentContent() {
  return {
    version: 1,
    viewport: { x: 0, y: 0, zoom: 1 },
    objects: [],
    presentation: { slides: [] },
  };
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
