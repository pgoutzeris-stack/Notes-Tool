import { getPagePreset } from "./page-presets.js";

export async function exportJson(doc) {
  const blob = new Blob([JSON.stringify(doc.content, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${safeName(doc.title)}.json`);
}

export async function exportHtml(doc) {
  const page = doc.content?.page || {};
  const preset = getPagePreset(page.preset);
  const width = page.width || preset.width || 794;
  const margins = page.margins || preset.margins || { top: 72, right: 72, bottom: 72, left: 72 };
  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>${escape(doc.title)}</title>
<style>
  body{margin:0;font-family:'Circular Std',system-ui,sans-serif;background:#eef2f7;padding:2rem;color:#0f172a}
  .page{max-width:${width}px;margin:0 auto;background:#fff;box-shadow:0 12px 40px rgba(15,23,42,.12);border-radius:4px;padding:${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px}
  .doc-callout{background:#eff6ff;border-left:4px solid #206efb;padding:1rem 1.25rem;border-radius:8px;margin:1rem 0}
  .doc-divider{border:none;border-top:1px solid #e2e8f0;margin:1.5rem 0}
  .doc-table{width:100%;border-collapse:collapse;margin:1rem 0}
  .doc-table td{border:1px solid #e2e8f0;padding:8px}
</style></head><body><h1>${escape(doc.title)}</h1><div class="page">${doc.content?.html || ""}</div></body></html>`;
  downloadBlob(new Blob([html], { type: "text/html" }), `${safeName(doc.title)}.html`);
}

export async function exportMarkdown(doc) {
  const lines = [`# ${doc.title}`, "", stripHtml(doc.content?.html || ""), ""];
  downloadBlob(new Blob([lines.join("\n")], { type: "text/markdown" }), `${safeName(doc.title)}.md`);
}

export async function exportPng(pageEl, title) {
  const html2canvas = window.html2canvas;
  if (!html2canvas) throw new Error("html2canvas nicht geladen");
  const target = pageEl?.querySelector?.(".doc-page") || pageEl;
  const wrap = target?.closest?.(".doc-page-wrap");
  const prevZoom = wrap?.style?.zoom || "";
  if (wrap) wrap.style.zoom = "1";
  try {
    const canvas = await html2canvas(target, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
    canvas.toBlob((blob) => downloadBlob(blob, `${safeName(title)}.png`));
  } finally {
    if (wrap) wrap.style.zoom = prevZoom;
  }
}

export async function exportPdf(pageEl, doc) {
  const html2pdf = window.html2pdf;
  if (!html2pdf) throw new Error("html2pdf nicht geladen");
  const pageNode = pageEl?.querySelector?.(".doc-page") || pageEl;
  const wrapEl = pageNode?.closest?.(".doc-page-wrap");
  const prevZoom = wrapEl?.style?.zoom || "";
  if (wrapEl) wrapEl.style.zoom = "1";

  const page = doc?.content?.page || {};
  const preset = getPagePreset(page.preset);
  const orientation = page.orientation || preset.orientation || "portrait";
  const jsPdfOpts = pdfFormatForPage(page, preset);

  const clone = pageNode.cloneNode(true);
  clone.style.transform = "none";
  clone.style.boxShadow = "none";
  const wrap = document.createElement("div");
  wrap.style.padding = "0";
  wrap.style.background = "#fff";
  wrap.appendChild(clone);

  try {
    await html2pdf().set({
      margin: 0,
      filename: `${safeName(doc?.title)}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", ...jsPdfOpts, orientation },
    }).from(wrap).save();
  } finally {
    if (wrapEl) wrapEl.style.zoom = prevZoom;
  }
}

function pdfFormatForPage(page, preset) {
  const id = page.preset || preset.id;
  if (id === "letter") return { format: "letter" };
  if (id === "a5-portrait") return { format: "a5" };
  if (id === "a4-landscape" || id === "a4-portrait") return { format: "a4" };
  if (page.fluid || preset.fluid) return { format: "a4" };
  const w = (page.width || preset.width || 794) * 0.264583;
  const h = (page.height || preset.height || 1123) * 0.264583;
  return { format: [w, h] };
}

function stripHtml(html) {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.textContent || "";
}

function safeName(s) {
  return (s || "dokument").replace(/[^\w\-äöüÄÖÜß ]+/g, "").trim() || "dokument";
}

function escape(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
