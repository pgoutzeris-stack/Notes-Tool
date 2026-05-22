const LOGO_SVG = `<svg viewBox="0 0 16 16" fill="none" width="16" height="16">
  <rect x="2" y="2" width="5" height="5" rx="1.5" fill="white" opacity="0.9"/>
  <rect x="9" y="2" width="5" height="5" rx="1.5" fill="white" opacity="0.6"/>
  <rect x="2" y="9" width="5" height="5" rx="1.5" fill="white" opacity="0.6"/>
  <rect x="9" y="9" width="5" height="5" rx="1.5" fill="white" opacity="0.3"/>
</svg>`;

export function appHeaderHtml(subtitle) {
  return `
    <header class="sop-header app-topbar" role="banner">
      <div class="header-left">
        <div class="logo-mark" aria-hidden="true">${LOGO_SVG}</div>
        <span class="wordmark">ROOTS <span>NOTES</span></span>
        <div class="header-divider" aria-hidden="true"></div>
        <span class="header-sub">${subtitle}</span>
      </div>
      <div class="header-right">
        <div id="roots-sync-status" class="roots-sync-wrap" aria-live="polite"></div>
      </div>
    </header>`;
}

export function updateAppHeader() {
  window.RootsUserBridge?.mountSyncStatus?.(window.RootsUser?._sb);
}
