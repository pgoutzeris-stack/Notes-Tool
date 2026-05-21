import { PAGE_PRESETS } from "./page-presets.js";
import { escapeHtml } from "./utils.js";

let overlayEl = null;

export function showPageSetup() {
  return new Promise((resolve) => {
    if (overlayEl) overlayEl.remove();

    overlayEl = document.createElement("div");
    overlayEl.className = "page-setup-overlay";
    overlayEl.innerHTML = `
      <div class="page-setup-modal" role="dialog" aria-labelledby="page-setup-title">
        <button type="button" class="page-setup-close" aria-label="Schließen"><i class="fa-solid fa-xmark"></i></button>
        <div class="page-setup-head">
          <span class="page-setup-kicker"><i class="fa-solid fa-wand-magic-sparkles"></i> Neues Dokument</span>
          <h2 id="page-setup-title">Format wählen</h2>
          <p>Wähle das Seitenverhältnis für dein Dokument — du kannst es später unter Layout anpassen.</p>
        </div>
        <div class="page-setup-grid">
          ${PAGE_PRESETS.map((p) => `
            <button type="button" class="page-setup-card ${p.id === "a4-portrait" ? "is-recommended" : ""}" data-preset="${p.id}">
              <div class="page-setup-preview page-setup-preview--${p.fluid ? "fluid" : p.orientation}" style="--page-ar: ${p.width} / ${p.height || 1}">
                <span class="page-setup-sheet" aria-hidden="true"></span>
              </div>
              <div class="page-setup-card-body">
                <span class="page-setup-cat">${escapeHtml(p.category)}</span>
                <strong>${escapeHtml(p.label)}</strong>
                <span>${escapeHtml(p.sub)}</span>
              </div>
              ${p.id === "a4-portrait" ? `<span class="page-setup-badge">Empfohlen</span>` : ""}
            </button>`).join("")}
        </div>
        <div class="page-setup-foot">
          <button type="button" class="btn-ghost page-setup-cancel">Abbrechen</button>
        </div>
      </div>`;

    document.body.appendChild(overlayEl);
    requestAnimationFrame(() => overlayEl.classList.add("is-visible"));

    const close = (value) => {
      overlayEl.classList.remove("is-visible");
      setTimeout(() => { overlayEl?.remove(); overlayEl = null; }, 200);
      resolve(value);
    };

    overlayEl.querySelector(".page-setup-close")?.addEventListener("click", () => close(null));
    overlayEl.querySelector(".page-setup-cancel")?.addEventListener("click", () => close(null));
    overlayEl.addEventListener("click", (e) => { if (e.target === overlayEl) close(null); });
    overlayEl.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => close(btn.dataset.preset));
    });
  });
}
