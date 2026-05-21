import { presetLabel } from "./page-presets.js";

export async function exportJson(doc) {
  const blob = new Blob([JSON.stringify(doc.content, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${safeName(doc.title)}.json`);
}

export async function exportHtml(doc) {
  const page = doc.content?.page || {};
  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>${escape(doc.title)}</title>
<style>
  body{margin:0;font-family:'Circular Std',system-ui,sans-serif;background:#eef2f7;padding:2rem;color:#0f172a}
  .page{max-width:${page.width || 794}px;margin:0 auto;background:#fff;box-shadow:0 12px 40px rgba(15,23,42,.12);border-radius:4px;padding:${page.margins?.top || 72}px ${page.margins?.right || 72}px}
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
  const canvas = await html2canvas(target, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
  canvas.toBlob((blob) => downloadBlob(blob, `${safeName(title)}.png`));
}

export async function exportPdf(pageEl, title) {
  const html2pdf = window.html2pdf;
  if (!html2pdf) throw new Error("html2pdf nicht geladen");
  const page = pageEl?.querySelector?.(".doc-page") || pageEl;
  const clone = page.cloneNode(true);
  clone.style.transform = "none";
  clone.style.boxShadow = "none";
  const wrap = document.createElement("div");
  wrap.style.padding = "0";
  wrap.style.background = "#fff";
  wrap.appendChild(clone);
  const preset = pageEl?.dataset?.preset || "a4";
  await html2pdf().set({
    margin: 0,
    filename: `${safeName(title)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  }).from(wrap).save();
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