const LOGO_SVG = `<svg viewBox="0 0 16 16" fill="none" width="16" height="16">
  <rect x="2" y="2" width="5" height="5" rx="1.5" fill="white" opacity="0.9"/>
  <rect x="9" y="2" width="5" height="5" rx="1.5" fill="white" opacity="0.6"/>
  <rect x="2" y="9" width="5" height="5" rx="1.5" fill="white" opacity="0.6"/>
  <rect x="9" y="9" width="5" height="5" rx="1.5" fill="white" opacity="0.3"/>
</svg>`;

export function appHeaderHtml(subtitle) {
  return `
    <header class="sop-header" id="app-topbar" role="banner">
      <div class="header-left">
        <div class="logo-mark" aria-hidden="true">${LOGO_SVG}</div>
        <span class="wordmark">ROOTS <span>NOTES</span></span>
        <div class="header-divider" aria-hidden="true"></div>
        <span class="header-sub">${subtitle}</span>
      </div>
      <div class="header-right">
        <div class="dash-avatar" id="user-avatar">?</div>
        <span id="user-name-topbar" class="header-sub">…</span>
      </div>
    </header>`;
}

export function updateAppHeader() {
  const p = window.RootsUser?._p || {};
  const name = p.full_name || p.email || '…';
  const label = p.position ? `${name} · ${p.position}` : name;
  const av = document.getElementById('user-avatar');
  const nm = document.getElementById('user-name-topbar');
  if (nm) nm.textContent = label;
  if (!av) return;
  if (p.avatar_url) {
    av.innerHTML = `<img src="${p.avatar_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    av.style.background = 'transparent';
  } else {
    av.textContent = window.RootsUser?._initials?.(p.full_name || p.email) || '?';
    av.style.background = '';
  }
}
