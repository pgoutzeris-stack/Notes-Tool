export async function exportJson(doc) {
  const blob = new Blob([JSON.stringify(doc.content, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${safeName(doc.title)}.json`);
}

export async function exportHtml(doc, canvasEl) {
  const clone = canvasEl.cloneNode(true);
  clone.querySelectorAll(".obj-handle, .selection-box, .editor-ui").forEach((n) => n.remove());
  const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>${escape(doc.title)}</title>
<style>body{margin:0;font-family:'Circular Std',system-ui,sans-serif;background:#f4f7fb;padding:2rem}
.canvas-wrap{position:relative;width:100%;min-height:600px;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(15,23,42,.08)}
</style></head><body><h1>${escape(doc.title)}</h1><div class="canvas-wrap">${clone.innerHTML}</div></body></html>`;
  downloadBlob(new Blob([html], { type: "text/html" }), `${safeName(doc.title)}.html`);
}

export async function exportMarkdown(doc) {
  const lines = [`# ${doc.title}`, ""];
  for (const obj of doc.content?.objects || []) {
    if (obj.type === "text" || obj.type === "sticky") {
      lines.push(stripHtml(obj.content || ""), "");
    } else if (obj.type === "table") {
      lines.push(tableToMd(obj), "");
    } else {
      lines.push(`- [${obj.type}] ${obj.label || ""}`.trim(), "");
    }
  }
  downloadBlob(new Blob([lines.join("\n")], { type: "text/markdown" }), `${safeName(doc.title)}.md`);
}

export async function exportPng(canvasEl, title) {
  const html2canvas = window.html2canvas;
  if (!html2canvas) throw new Error("html2canvas nicht geladen");
  const target = canvasEl.querySelector(".canvas-world") || canvasEl;
  const canvas = await html2canvas(target, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
  canvas.toBlob((blob) => downloadBlob(blob, `${safeName(title)}.png`));
}

export async function exportPdf(canvasEl, title) {
  const html2pdf = window.html2pdf;
  if (!html2pdf) throw new Error("html2pdf nicht geladen");
  const wrap = document.createElement("div");
  wrap.style.padding = "24px";
  wrap.style.background = "#fff";
  wrap.innerHTML = `<h1 style="font-family:'Circular Std',sans-serif;color:#0f172a">${escape(title)}</h1>`;
  const clone = (canvasEl.querySelector(".canvas-world") || canvasEl).cloneNode(true);
  clone.querySelectorAll(".obj-handle, .selection-box").forEach((n) => n.remove());
  wrap.appendChild(clone);
  await html2pdf().set({
    margin: 10,
    filename: `${safeName(title)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
  }).from(wrap).save();
}

function tableToMd(obj) {
  const rows = obj.rows || 2;
  const cols = obj.cols || 2;
  const cells = obj.cells || {};
  const lines = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push(stripHtml(cells[`${r}-${c}`] || ""));
    }
    lines.push(`| ${row.join(" | ")} |`);
    if (r === 0) lines.push(`| ${row.map(() => "---").join(" | ")} |`);
  }
  return lines.join("\n");
}

function stripHtml(html) {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.textContent || "";
}

function safeName(s) {
  return (s || "notiz").replace(/[^\w\-äöüÄÖÜß ]+/g, "").trim() || "notiz";
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
