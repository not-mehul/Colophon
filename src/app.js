/*************************************************************************
 * GLOBAL STATE & CONFIGURATION
 *************************************************************************/
const state = {
  themeMode: 'system', // 'system' | 'dusk' | 'dawn'

  config: {
    defaultCoverTheme: 'classic',
    googleApiKey: '',
    isbndbApiKey: '',
    customCatalogUrl: '',
    customCatalogKey: '',
    corsProxyUrl: '',
    maxCatalogResults: 8,
    minCoverWidth: 1000,
    zipCompressionLevel: 6,
    autoDualCover: true,
    autoPurgeOrphans: false
  },

  zip: null,
  fileName: '',
  fileSize: 0,
  mimetypeValid: false,
  mimetypeExists: false,
  containerValid: false,
  opfPath: '',
  opfDir: '',
  opfXmlString: '',
  opfDoc: null,
  epubVersion: '3.0',

  originalMeta: null,
  meta: {
    title: '',
    creator: '',
    identifier: '',
    language: 'en',
    publisher: '',
    date: '',
    series: '',
    seriesIndex: '',
    subjects: [],
    description: ''
  },

  cover: {
    exists: false,
    manifestId: '',
    href: '',
    fullZipPath: '',
    mediaType: 'image/jpeg',
    blobUrl: '',
    uint8Array: null,
    width: 0,
    height: 0,
    byteSize: 0,
    hasEpub2Meta: false,
    hasEpub3Prop: false,
    modified: false
  },
  originalCoverSnapshot: null,

  structure: {
    manifestItems: [],
    brokenLinks: [],
    orphanFiles: [],
    removedOrphanBackups: [],
    spineItems: [],
    spineChapters: [],
    originalSpineChapters: [],
    filesModified: false,
    hasNavDoc: false,
    hasNcxToc: false,
    ncxZipPath: '',
    navZipPath: '',
    chapterCount: 0,
    cssCount: 0,
    fontCount: 0,
    imageCount: 0,
    totalWords: 0
  },

  lastAuditScore: 0,
  lastAuditChecks: [],
  searchSource: 'both',
  searchResults: [],
  selectedCandidate: null,
  activeCoverTheme: 'classic',
  activeTab: 'inspection',
  dragSrcIndex: null,
  toastTimer: null
};

/*************************************************************************
 * §2 & §10. THEME: System, Dusk or Dawn, and a live token reader
 *************************************************************************/
const THEME_KEY = 'colophon:theme';
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

const token = (name, el = document.documentElement) =>
  getComputedStyle(el).getPropertyValue(name).trim();

/** Reads a token from either palette, whatever the page theme is (§2, §8.16). */
function themeToken(name, theme) {
  let probe = document.getElementById(`themeProbe-${theme}`);
  if (!probe) {
    probe = document.createElement('div');
    probe.id = `themeProbe-${theme}`;
    probe.hidden = true;
    probe.setAttribute('data-theme', theme);
    document.body.appendChild(probe);
  }
  return token(name, probe);
}

function readStoredTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dusk' || saved === 'dawn' ? saved : 'system';
  } catch (e) {
    return 'system';
  }
}

function applyTheme(mode) {
  state.themeMode = mode;
  const dark = mode === 'system' ? darkQuery.matches : mode === 'dusk';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');

  // Browser chrome follows the page surface (§14 System bars).
  const surface = token('--bg-grad-mid');
  if (surface) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface);

  // The header switch is binary: aria-checked shows Dawn (§8.9).
  document.getElementById('headerThemeSwitch')?.setAttribute('aria-checked', dark ? 'false' : 'true');

  // Settings offers all three (§8.17).
  ['system', 'dusk', 'dawn'].forEach(m => {
    document.getElementById(`themeSeg-${m}`)?.setAttribute('aria-checked', m === mode ? 'true' : 'false');
  });

  window.dispatchEvent(new Event('themechange'));
}

function setThemeMode(mode) {
  applyTheme(mode);
  try {
    if (mode === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, mode);
  } catch (e) { /* private mode: the choice lasts for this visit */ }
}

/** Tapping the header switch on System picks the side the OS is not showing. */
function toggleHeaderBinaryTheme() {
  const currentlyLight = document.documentElement.getAttribute('data-theme') === 'light';
  setThemeMode(currentlyLight ? 'dusk' : 'dawn');
}

darkQuery.addEventListener('change', () => {
  if (state.themeMode === 'system') applyTheme('system');
});

window.addEventListener('themechange', () => {
  drawScoreDial(state.lastAuditScore || 0);
  if (document.getElementById('coverGenModal')?.open) renderTypographicCoverCanvas();
});

function handleSwitchKey(e, fn) {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    fn();
  }
}

/*************************************************************************
 * §8.10 & §8.11 MODALS AND SHEETS (native <dialog>, one overlay stack)
 *************************************************************************/
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog || dialog.open) return;
  dialog.classList.remove('closing');
  dialog.showModal();
  // Start reading at the title rather than on the first control (§15).
  const title = dialog.querySelector('.modal-title, .sheet-title');
  if (title) {
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
}

/** Plays the 160ms exit (§11) before the dialog leaves the top layer. */
function closeDialog(id) {
  const dialog = document.getElementById(id);
  if (!dialog || !dialog.open || dialog.classList.contains('closing')) return;
  if (prefersReducedMotion()) {
    dialog.close();
    return;
  }
  dialog.classList.add('closing');
  const done = () => {
    dialog.classList.remove('closing');
    if (dialog.open) dialog.close();
  };
  dialog.addEventListener('animationend', done, { once: true });
  setTimeout(done, 240);
}

function wireDialogs() {
  document.querySelectorAll('dialog').forEach(dialog => {
    // Escape and system back close the topmost overlay first (§14).
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeDialog(dialog.id);
    });
    // A tap on the backdrop dismisses (§8.10).
    dialog.addEventListener('click', (e) => {
      if (e.target !== dialog) return;
      const card = dialog.querySelector('.modal-card') || dialog;
      const r = (dialog.classList.contains('sheet') ? dialog : card).getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside || dialog.classList.contains('modal-dialog')) closeDialog(dialog.id);
    });
  });
  wireSheetSwipe(document.getElementById('settingsSheet'));
}

/** Swipe the sheet down from its handle or header to dismiss it (§8.11). */
function wireSheetSwipe(sheet) {
  if (!sheet) return;
  let startY = null;
  let dy = 0;
  const grab = sheet.querySelectorAll('.sheet-handle, .sheet-head');
  grab.forEach(el => el.addEventListener('pointerdown', (e) => {
    if (window.innerWidth >= 900 || e.target.closest('button')) return;
    startY = e.clientY;
    dy = 0;
    sheet.style.transition = 'none';
    el.setPointerCapture(e.pointerId);
  }));
  grab.forEach(el => el.addEventListener('pointermove', (e) => {
    if (startY === null) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  }));
  const end = () => {
    if (startY === null) return;
    startY = null;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (dy > 80) closeDialog(sheet.id);
  };
  grab.forEach(el => {
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  });
}

function openSettingsSheet() {
  openDialog('settingsSheet');
}

/*************************************************************************
 * INITIALIZATION & TAB RAIL (§8.5)
 *************************************************************************/
const TABS = ['inspection', 'imprint', 'signatures', 'catalog'];

window.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  applyTheme(readStoredTheme());
  wireDialogs();
  wireToastHost();
  drawScoreDial(0);
  requestAnimationFrame(() => updateTabRailIndicator(false));
  window.addEventListener('resize', () => updateTabRailIndicator(false));
  document.fonts?.ready.then(() => updateTabRailIndicator(false));
});

function switchTab(tabId) {
  if (!TABS.includes(tabId)) tabId = 'inspection';
  state.activeTab = tabId;

  TABS.forEach(id => {
    const btn = document.getElementById(`tabBtn-${id}`);
    const panel = document.getElementById(`panel-${id}`);
    const isSelected = (id === tabId);
    if (btn) {
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      btn.tabIndex = isSelected ? 0 : -1;
    }
    if (panel) panel.classList.toggle('hidden', !(isSelected && (state.zip || id === 'catalog')));
  });

  // The empty bench shows until an archive is open.
  document.getElementById('emptyArchiveSection')
    ?.classList.toggle('hidden', Boolean(state.zip) || tabId === 'catalog');

  if (tabId === 'signatures' && state.zip) {
    updateExportFilenamePreview();
    renderSpineOrderTable();
  }
  if (tabId === 'catalog' && state.zip) {
    const input = document.getElementById('onlineSearchInput');
    if (input && !input.value.trim()) prefillSearchFromEpub();
  }

  updateTabRailIndicator(true);
}

/** Arrow keys move between tabs (§15). */
function handleTabRailKey(e) {
  const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (!step) return;
  e.preventDefault();
  const i = TABS.indexOf(state.activeTab);
  const next = TABS[(i + step + TABS.length) % TABS.length];
  switchTab(next);
  document.getElementById(`tabBtn-${next}`)?.focus();
}

/** Slides the amber rule under the active word and keeps that tab in view. */
function updateTabRailIndicator(scroll) {
  const activeBtn = document.getElementById(`tabBtn-${state.activeTab}`);
  const indicator = document.getElementById('tabRailIndicator');
  const wrap = document.querySelector('.tab-rail-wrap');
  if (!activeBtn || !indicator) return;

  indicator.style.width = `${activeBtn.offsetWidth}px`;
  indicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;

  if (scroll && wrap) {
    const left = activeBtn.offsetLeft;
    const right = left + activeBtn.offsetWidth;
    if (left < wrap.scrollLeft || right > wrap.scrollLeft + wrap.clientWidth) {
      wrap.scrollTo({ left: left - (wrap.clientWidth - activeBtn.offsetWidth) / 2, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }
}

/*************************************************************************
 * §8.12 TOAST AND UNDO (one at a time, pauses while touched, no overshoot)
 *************************************************************************/
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/** "1 file", "3 files". */
function plural(n, one, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`;
}

const toast = { remaining: 0, startedAt: 0 };

function dismissToast() {
  const host = document.getElementById('toastHost');
  const box = host?.querySelector('.toast-box');
  clearTimeout(state.toastTimer);
  state.toastTimer = null;
  if (!box) return;
  box.classList.add('leaving');
  setTimeout(() => { if (box.parentNode === host) host.innerHTML = ''; }, prefersReducedMotion() ? 0 : 160);
}

function scheduleToastDismiss(ms) {
  clearTimeout(state.toastTimer);
  toast.remaining = ms;
  toast.startedAt = Date.now();
  state.toastTimer = setTimeout(dismissToast, ms);
}

function wireToastHost() {
  const host = document.getElementById('toastHost');
  if (!host) return;
  const pause = () => {
    if (!state.toastTimer) return;
    clearTimeout(state.toastTimer);
    state.toastTimer = null;
    toast.remaining -= Date.now() - toast.startedAt;
  };
  const resume = () => {
    if (state.toastTimer || !host.querySelector('.toast-box')) return;
    scheduleToastDismiss(Math.max(toast.remaining, 1500));
  };
  host.addEventListener('pointerenter', pause);
  host.addEventListener('pointerdown', pause);
  host.addEventListener('pointerleave', resume);
  host.addEventListener('focusin', pause);
  host.addEventListener('focusout', resume);
}

function showToast(message, options = {}) {
  const { actionLabel = null, onAction = null, isAlert = false } = options;
  const host = document.getElementById('toastHost');
  if (!host) return;

  host.innerHTML = `
    <div class="toast-box" role="${isAlert ? 'alert' : 'status'}">
      <span>${escapeHtml(message)}</span>
      ${actionLabel ? `<button type="button" class="toast-action" id="toastActionBtn">${escapeHtml(actionLabel)}</button>` : ''}
    </div>
  `;

  if (actionLabel && typeof onAction === 'function') {
    document.getElementById('toastActionBtn')?.addEventListener('click', () => {
      onAction();
      dismissToast();
    });
  }

  scheduleToastDismiss(actionLabel ? 6000 : 4000);
}

/*************************************************************************
 * §8.15 SCORE DIAL (270° Arc SVG using --scale-1 to --scale-5)
 *************************************************************************/
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180.0;
  return {
    x: cx + (r * Math.cos(rad)),
    y: cy + (r * Math.sin(rad))
  };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', start.x.toFixed(2), start.y.toFixed(2),
    'A', r, r, 0, largeArcFlag, 0, end.x.toFixed(2), end.y.toFixed(2)
  ].join(' ');
}

function drawScoreDial(score) {
  const clamped = Math.max(0, Math.min(100, Math.round(score || 0)));
  const trackPath = document.getElementById('dialTrackPath');
  const valuePath = document.getElementById('dialValuePath');
  const scoreEl = document.getElementById('dialScoreNumber');
  const tierEl = document.getElementById('dialTierLabel');
  if (!trackPath || !valuePath) return;

  const cx = 90, cy = 88, r = 64;
  const startAngle = -135;
  const maxEndAngle = 135; // 270° total span
  trackPath.setAttribute('d', describeArc(cx, cy, r, startAngle, maxEndAngle));

  const currentEnd = startAngle + (270 * (clamped / 100));
  if (clamped <= 0) {
    valuePath.setAttribute('d', '');
  } else {
    valuePath.setAttribute('d', describeArc(cx, cy, r, startAngle, currentEnd));
  }

  // §3.7 Quality scale tiers
  let tierName = 'Challenging';
  let scaleVar = '--scale-5';
  if (clamped >= 85) {
    tierName = 'Exceptional';
    scaleVar = '--scale-1';
  } else if (clamped >= 72) {
    tierName = 'Strong';
    scaleVar = '--scale-2';
  } else if (clamped >= 58) {
    tierName = 'Decent';
    scaleVar = '--scale-3';
  } else if (clamped >= 42) {
    tierName = 'Mixed';
    scaleVar = '--scale-4';
  }

  valuePath.setAttribute('stroke', token(scaleVar) || `var(${scaleVar})`);
  if (scoreEl) scoreEl.textContent = String(clamped);
  if (tierEl) tierEl.textContent = tierName;
}

/*************************************************************************
 * SETTINGS & API KEY CONFIGURATION (§8.17)
 *************************************************************************/
function onConfigInputChange(key, value) {
  state.config[key] = value.trim();
  updateApiKeyBadges();
}

function setConfigValue(key, value) {
  state.config[key] = value;

  if (key === 'defaultCoverTheme') {
    state.activeCoverTheme = value;
    ['classic', 'minimal', 'noir', 'eink'].forEach(t => {
      document.getElementById(`covSeg-${t}`)?.setAttribute('aria-checked', t === value ? 'true' : 'false');
    });
  } else if (key === 'maxCatalogResults') {
    [6, 8, 12].forEach(n => {
      document.getElementById(`maxResSeg-${n}`)?.setAttribute('aria-checked', n === value ? 'true' : 'false');
    });
  } else if (key === 'minCoverWidth') {
    [800, 1000, 1200].forEach(w => {
      document.getElementById(`covResSeg-${w}`)?.setAttribute('aria-checked', w === value ? 'true' : 'false');
    });
    const minH = Math.round(value * 1.5);
    const hintEl = document.getElementById('coverResolutionHint');
    if (hintEl) {
      hintEl.textContent = `Aim for ${value} × ${minH} px, a 2:3 portrait. Find one online, upload your own, or compose a typographic plate.`;
    }
    if (state.zip) runQualityAudit(false);
  } else if (key === 'zipCompressionLevel') {
    [3, 6, 9].forEach(lvl => {
      document.getElementById(`zipSeg-${lvl}`)?.setAttribute('aria-checked', lvl === value ? 'true' : 'false');
    });
  }
}

function toggleBooleanConfig(key) {
  state.config[key] = !state.config[key];
  const sw = document.getElementById(`switch-${key}`);
  if (sw) sw.setAttribute('aria-checked', state.config[key] ? 'true' : 'false');
}

function toggleKeyVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  if (btn) {
    btn.innerHTML = `<i data-lucide="${isHidden ? 'eye-off' : 'eye'}"></i>`;
    lucide.createIcons({ nodes: [btn] });
  }
}

function updateApiKeyBadges() {
  const keys = ['googleApiKey', 'isbndbApiKey', 'customCatalogKey'];
  let activeCount = 0;
  keys.forEach(k => {
    const hasVal = Boolean(state.config[k]);
    if (hasVal) activeCount++;
    const chip = document.getElementById(`status-${k}`);
    if (chip) {
      chip.textContent = hasVal ? 'Active' : 'Optional';
      chip.className = `status-chip ${hasVal ? 'sage' : ''}`;
    }
  });

  const summaryChip = document.getElementById('apiKeysConfiguredBadge');
  if (summaryChip) {
    summaryChip.textContent = `${plural(activeCount, 'key')} active`;
    summaryChip.className = `status-chip ${activeCount > 0 ? 'sage' : ''}`;
  }

  const tabBadge = document.getElementById('tabBadge-keys');
  if (tabBadge) {
    if (activeCount > 0) {
      tabBadge.textContent = String(activeCount);
      tabBadge.classList.remove('hidden');
    } else {
      tabBadge.classList.add('hidden');
    }
  }

  const hint = document.getElementById('catalogKeyStatusHint');
  if (hint) {
    hint.textContent = activeCount > 0
      ? `Searching with ${plural(activeCount, 'API key')}.`
      : 'Searches Open Library and Google Books. Add API keys in Settings for more.';
  }
}

async function testCatalogConnection(provider) {
  try {
    if (provider === 'google') {
      const keyParam = state.config.googleApiKey ? `&key=${encodeURIComponent(state.config.googleApiKey)}` : '';
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:9780141439518&maxResults=1${keyParam}`);
      if (res.ok) {
        showToast('Google Books answered. The key works.');
      } else {
        showToast(`Google Books refused the request (${res.status}). Check the API key.`, { isAlert: true });
      }
    } else if (provider === 'isbndb') {
      if (!state.config.isbndbApiKey) {
        showToast('Add an ISBNdb key first, then test it.', { isAlert: true });
        return;
      }
      const res = await fetch('https://api2.isbndb.com/book/9780141439518', {
        headers: { 'Authorization': state.config.isbndbApiKey }
      });
      if (res.ok) {
        showToast('ISBNdb answered. The key works.');
      } else {
        showToast(`ISBNdb refused the request (${res.status}). Check the API key.`, { isAlert: true });
      }
    }
  } catch (err) {
    showToast("Couldn't reach the catalog. Check your connection, or set a cover proxy in Settings.", { isAlert: true });
  }
}

function exportConfigJson() {
  const payload = {
    app: 'Colophon',
    version: '2.4.0',
    themeMode: state.themeMode,
    config: state.config,
    exportPattern: document.getElementById('exportPatternInput')?.value || '',
    batchRenamePattern: document.getElementById('batchRenamePattern')?.value || ''
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'colophon-config.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 3000);
  showToast('Settings exported.');
}

async function importConfigJson(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.themeMode) applyTheme(data.themeMode);
    if (data.config && typeof data.config === 'object') {
      Object.assign(state.config, data.config);
      document.getElementById('cfg-googleApiKey').value = state.config.googleApiKey || '';
      document.getElementById('cfg-isbndbApiKey').value = state.config.isbndbApiKey || '';
      document.getElementById('cfg-customCatalogUrl').value = state.config.customCatalogUrl || '';
      document.getElementById('cfg-customCatalogKey').value = state.config.customCatalogKey || '';
      document.getElementById('cfg-corsProxyUrl').value = state.config.corsProxyUrl || '';
      setConfigValue('defaultCoverTheme', state.config.defaultCoverTheme || 'classic');
      setConfigValue('maxCatalogResults', state.config.maxCatalogResults || 8);
      setConfigValue('minCoverWidth', state.config.minCoverWidth || 1000);
      setConfigValue('zipCompressionLevel', state.config.zipCompressionLevel || 6);
      document.getElementById('switch-autoDualCover')?.setAttribute('aria-checked', state.config.autoDualCover ? 'true' : 'false');
      document.getElementById('switch-autoPurgeOrphans')?.setAttribute('aria-checked', state.config.autoPurgeOrphans ? 'true' : 'false');
      updateApiKeyBadges();
    }
    if (data.exportPattern && document.getElementById('exportPatternInput')) {
      document.getElementById('exportPatternInput').value = data.exportPattern;
    }
    if (data.batchRenamePattern && document.getElementById('batchRenamePattern')) {
      document.getElementById('batchRenamePattern').value = data.batchRenamePattern;
    }
    showToast('Settings restored.');
  } catch (err) {
    showToast("That file isn't a Colophon settings file. Nothing was changed.", { isAlert: true });
  }
  e.target.value = '';
}

function exportInspectionReport(format) {
  if (!state.zip) {
    showToast('Open an EPUB first, then export its report.', { isAlert: true });
    return;
  }
  if (format === 'json') {
    const report = {
      edition: state.meta,
      score: state.lastAuditScore,
      opfPath: state.opfPath,
      epubVersion: state.epubVersion,
      cover: {
        exists: state.cover.exists,
        width: state.cover.width,
        height: state.cover.height,
        byteSize: state.cover.byteSize
      },
      diagnostics: state.lastAuditChecks
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'colophon-inspection.json';
    a.click();
  } else {
    const lines = [
      `# Colophon Inspection Report — ${state.meta.title || 'Untitled Edition'}`,
      ``,
      `- **Author**: ${state.meta.creator || 'Unknown'}`,
      `- **Identifier**: ${state.meta.identifier || 'None'}`,
      `- **Quality Score**: ${state.lastAuditScore} / 100`,
      `- **Package**: ${state.opfPath} (EPUB ${state.epubVersion})`,
      `- **Cover Plate**: ${state.cover.exists ? `${state.cover.width}×${state.cover.height} px` : 'Missing'}`,
      ``,
      `## Diagnostic Ledger`,
      ...state.lastAuditChecks.map(c => `### ${c.title} (${c.score}/${c.maxScore})\n` + c.items.map(i => `- [${i.status.toUpperCase()}] ${i.text}`).join('\n'))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'colophon-inspection.md';
    a.click();
  }
  showToast('Report exported.');
}

/*************************************************************************
 * SAMPLE EDITION GENERATOR (Synthetic Specimen Archive)
 *************************************************************************/
async function loadSampleEpub() {
  try {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
    zip.file('META-INF/container.xml', containerXml);

    const sampleCoverBlob = await createSampleLowResCoverBlob();
    const sampleCoverArray = new Uint8Array(await sampleCoverBlob.arrayBuffer());
    zip.file('OEBPS/images/cover.jpg', sampleCoverArray);

    const cssContent = `body { font-family: Georgia, serif; line-height: 1.65; margin: 2em; }
h1, h2 { font-weight: normal; font-style: italic; }
p { text-indent: 1.25em; margin: 0.5em 0; }`;
    zip.file('OEBPS/styles/main.css', cssContent);

    const chIntro = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head><title>I. Foundations of Digital Bookmaking</title><link rel="stylesheet" type="text/css" href="../styles/main.css"/></head>
<body>
  <h1>I. Foundations of Digital Bookmaking</h1>
  <p>Digital publications combine portable typography with structured metadata inside an open archive format. When properly packaged, an electronic edition adapts gracefully across screen sizes, pixel densities, and assistive reading technologies.</p>
  <p>Inside every archive lies a container descriptor, a package document, and a sequence of content documents organized along a reading spine.</p>
</body>
</html>`;

    const chTypography = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head><title>II. Proportion and Responsive Measure</title><link rel="stylesheet" type="text/css" href="../styles/main.css"/></head>
<body>
  <h1>II. Proportion and Responsive Measure</h1>
  <p>Flexible spacing, relative font sizing, and clean semantic markup ensure that readers can customize margins, line heights, and typefaces without breaking page layout rules.</p>
  <p>Well-crafted stylesheets avoid rigid pixel dimensions and embrace fluid containers that respect user preferences on both tablet displays and electronic ink screens.</p>
</body>
</html>`;

    const chMetadata = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head><title>III. The Printer's Colophon and Imprint</title><link rel="stylesheet" type="text/css" href="../styles/main.css"/></head>
<body>
  <h1>III. The Printer's Colophon and Imprint</h1>
  <p>Accurate bibliographic records allow personal libraries and catalog systems to index titles by author, series, publication date, and subject classification.</p>
  <p>Including high-resolution cover artwork alongside both modern and legacy manifest declarations guarantees visual consistency across every generation of reading device.</p>
</body>
</html>`;

    // Intentionally unsequenced filenames so the user can test the Signatures renamer
    zip.file('OEBPS/text/zz_opening_leaf.xhtml', chIntro);
    zip.file('OEBPS/text/draft_folio_b.xhtml', chTypography);
    zip.file('OEBPS/text/09_colophon_notes.xhtml', chMetadata);

    // Intentional unreferenced orphan file for inspection test
    zip.file('OEBPS/extras/printer_scratch_note.txt', 'Unmanifested proofreader note left in archive.');

    const ncxXml = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:colophon-specimen-2026"/></head>
  <docTitle><text>The Art of Digital Bookmaking</text></docTitle>
  <navMap>
<navPoint id="navPoint-1" playOrder="1">
  <navLabel><text>I. Foundations of Digital Bookmaking</text></navLabel>
  <content src="text/zz_opening_leaf.xhtml"/>
</navPoint>
<navPoint id="navPoint-2" playOrder="2">
  <navLabel><text>II. Proportion and Responsive Measure</text></navLabel>
  <content src="text/draft_folio_b.xhtml"/>
</navPoint>
<navPoint id="navPoint-3" playOrder="3">
  <navLabel><text>III. The Printer's Colophon and Imprint</text></navLabel>
  <content src="text/09_colophon_notes.xhtml"/>
</navPoint>
  </navMap>
</ncx>`;
    zip.file('OEBPS/toc.ncx', ncxXml);

    const opfXml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
<dc:title>The Art of Digital Bookmaking</dc:title>
<dc:creator>Clara Vance</dc:creator>
<dc:language>en</dc:language>
<dc:date>2024</dc:date>
<dc:subject>Typography</dc:subject>
<dc:subject>Book Design</dc:subject>
<meta name="cover" content="cover-img"/>
  </metadata>
  <manifest>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
<item id="style" href="styles/main.css" media-type="text/css"/>
<item id="cover-img" href="images/cover.jpg" media-type="image/jpeg"/>
<item id="ch1" href="text/zz_opening_leaf.xhtml" media-type="application/xhtml+xml"/>
<item id="ch2" href="text/draft_folio_b.xhtml" media-type="application/xhtml+xml"/>
<item id="ch3" href="text/09_colophon_notes.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
<itemref idref="ch1"/>
<itemref idref="ch2"/>
<itemref idref="ch3"/>
  </spine>
</package>`;
    zip.file('OEBPS/content.opf', opfXml);

    const blob = await zip.generateAsync({ type: 'blob' });
    const file = new File([blob], 'unbound_specimen.epub', { type: 'application/epub+zip' });
    await processEpubFile(file);
    showToast('Sample edition opened.');
  } catch (err) {
    showToast("Couldn't build the sample edition. Try reloading the page.", { isAlert: true });
  }
}

function createSampleLowResCoverBlob() {
  return new Promise((resolve) => {
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 450;
    const ctx = c.getContext('2d');
    const serif = token('--font-serif');
    ctx.fillStyle = themeToken('--bg-grad-top', 'dark');
    ctx.fillRect(0, 0, 300, 450);

    ctx.strokeStyle = themeToken('--accent-amber', 'dark');
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 260, 410);

    ctx.fillStyle = themeToken('--text-heading', 'dark');
    ctx.textAlign = 'center';
    ctx.font = `22px ${serif}`;
    ctx.fillText('THE ART OF', 150, 150);
    ctx.fillText('DIGITAL', 150, 182);
    ctx.fillText('BOOKMAKING', 150, 214);

    ctx.fillStyle = themeToken('--accent-amber', 'dark');
    ctx.font = `italic 13px ${serif}`;
    ctx.fillText('Low-Resolution Proof (300×450)', 150, 275);

    ctx.fillStyle = themeToken('--text-dim', 'dark');
    ctx.font = `15px ${serif}`;
    ctx.fillText('Clara Vance', 150, 380);

    c.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
  });
}

/*************************************************************************
 * DRAG & DROP / FILE INPUT HANDLERS
 *************************************************************************/
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('dropzonePanel')?.classList.add('drop-active');
}

function handleDragLeave(e) {
  e.preventDefault();
  document.getElementById('dropzonePanel')?.classList.remove('drop-active');
}

async function handleDrop(e) {
  e.preventDefault();
  document.getElementById('dropzonePanel')?.classList.remove('drop-active');
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    await processEpubFile(files[0]);
  }
}

async function handleFileSelect(e) {
  const files = e.target.files;
  if (files && files.length > 0) {
    await processEpubFile(files[0]);
  }
  e.target.value = '';
}

/*************************************************************************
 * EPUB ARCHIVE PARSER
 *************************************************************************/
function resolveZipPath(baseDir, relativeHref) {
  if (!relativeHref) return '';
  const cleanHref = decodeURIComponent(relativeHref.split('#')[0]);
  if (!baseDir) return cleanHref.replace(/^\/+/, '');
  const stack = baseDir.split('/').filter(Boolean);
  const parts = cleanHref.split('/');
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

function getRelativePath(fromDir, toFullZipPath) {
  const fromParts = (fromDir || '').split('/').filter(Boolean);
  const toParts = (toFullZipPath || '').split('/').filter(Boolean);
  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common++;
  }
  const upCount = fromParts.length - common;
  const relParts = [];
  for (let i = 0; i < upCount; i++) relParts.push('..');
  for (let i = common; i < toParts.length; i++) relParts.push(toParts[i]);
  return relParts.join('/');
}

async function processEpubFile(file) {
  try {
    state.fileName = file.name || 'edition.epub';
    state.fileSize = file.size || 0;

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    state.zip = zip;

    // 1. Check mimetype
    const mimeFile = zip.file('mimetype');
    state.mimetypeExists = !!mimeFile;
    state.mimetypeValid = false;
    if (mimeFile) {
      const mimeText = (await mimeFile.async('string')).trim();
      state.mimetypeValid = (mimeText === 'application/epub+zip');
    }

    // 2. Parse META-INF/container.xml
    const containerFile = zip.file('META-INF/container.xml');
    state.containerValid = false;
    state.opfPath = '';
    state.opfDir = '';
    const parser = new DOMParser();

    if (containerFile) {
      const containerXml = await containerFile.async('string');
      const containerDoc = parser.parseFromString(containerXml, 'application/xml');
      const rootfileEl = containerDoc.querySelector('rootfile');
      if (rootfileEl && rootfileEl.getAttribute('full-path')) {
        state.opfPath = rootfileEl.getAttribute('full-path').trim();
        state.containerValid = true;
      }
    }

    if (!state.opfPath) {
      const opfCandidate = Object.keys(zip.files).find(p => p.toLowerCase().endsWith('.opf'));
      if (opfCandidate) state.opfPath = opfCandidate;
      else throw new Error('No OPF package document found in archive.');
    }

    const lastSlash = state.opfPath.lastIndexOf('/');
    state.opfDir = lastSlash >= 0 ? state.opfPath.substring(0, lastSlash + 1) : '';

    // 3. Parse OPF XML
    const opfZipEntry = zip.file(state.opfPath);
    if (!opfZipEntry) throw new Error(`Package file missing at ${state.opfPath}.`);
    state.opfXmlString = await opfZipEntry.async('string');
    state.opfDoc = parser.parseFromString(state.opfXmlString, 'application/xml');

    const packageEl = state.opfDoc.querySelector('package') || state.opfDoc.documentElement;
    state.epubVersion = packageEl?.getAttribute('version') || '2.0';

    // 4. Extract Imprint Metadata & Analyze Manifest/Spine
    extractOpfMetadata(state.opfDoc);
    await analyzeManifestAndSpine();

    // 5. Update UI
    document.getElementById('editionSummaryBar')?.classList.remove('hidden');
    document.getElementById('bindExportBtn').disabled = false;

    populateMetadataForm();
    updateCoverStudioUI();
    updateTopBanner();
    updateExportFilenamePreview();
    renderSpineOrderTable();
    runQualityAudit(false);
    prefillSearchFromEpub();

    switchTab(state.activeTab);
  } catch (err) {
    showToast(`Couldn't read that EPUB (${err.message}). Check that it is a valid .epub file.`, { isAlert: true });
  }
}

function getDcElementText(doc, localName) {
  const els = doc.getElementsByTagNameNS('*', localName);
  if (els && els.length > 0) return (els[0].textContent || '').trim();
  const fallback = doc.querySelector(`dc\\:${localName}, ${localName}`);
  return fallback ? (fallback.textContent || '').trim() : '';
}

function getAllDcElementsText(doc, localName) {
  const list = [];
  const els = doc.getElementsByTagNameNS('*', localName);
  if (els && els.length > 0) {
    for (let i = 0; i < els.length; i++) {
      const val = (els[i].textContent || '').trim();
      if (val) list.push(val);
    }
  }
  return list;
}

function extractOpfMetadata(doc) {
  const title = getDcElementText(doc, 'title') || '';
  const creators = getAllDcElementsText(doc, 'creator');
  const creator = creators.join(', ');
  const identifiers = getAllDcElementsText(doc, 'identifier');
  let identifier = identifiers.find(id => /97[89][-\s]?\d|\b\d{9}[\dXx]\b|isbn/i.test(id)) || identifiers[0] || '';
  identifier = identifier.replace(/^urn:isbn:/i, '').trim();

  const language = getDcElementText(doc, 'language') || 'en';
  const publisher = getDcElementText(doc, 'publisher') || '';
  const rawDate = getDcElementText(doc, 'date') || '';
  const date = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
  const description = getDcElementText(doc, 'description') || '';
  const subjects = getAllDcElementsText(doc, 'subject');

  let series = '';
  let seriesIndex = '';
  doc.querySelectorAll('metadata > meta').forEach(m => {
    const nameAttr = (m.getAttribute('name') || '').toLowerCase();
    const propAttr = (m.getAttribute('property') || '').toLowerCase();
    if (nameAttr === 'calibre:series') series = m.getAttribute('content') || '';
    else if (nameAttr === 'calibre:series_index') seriesIndex = m.getAttribute('content') || '';
    else if (propAttr === 'belongs-to-collection') series = (m.textContent || '').trim();
    else if (propAttr === 'group-position') seriesIndex = (m.textContent || '').trim();
  });

  state.meta = {
    title,
    creator,
    identifier,
    language,
    publisher,
    date,
    series,
    seriesIndex,
    subjects: [...subjects],
    description
  };
  state.originalMeta = JSON.parse(JSON.stringify(state.meta));
}

async function analyzeManifestAndSpine() {
  const doc = state.opfDoc;
  const zip = state.zip;

  const manifestItems = [];
  const brokenLinks = [];
  const manifestedZipPaths = new Set();

  const itemEls = doc.querySelectorAll('manifest > item');
  let hasNavDoc = false;
  let hasNcxToc = false;
  let ncxZipPath = '';
  let navZipPath = '';
  let cssCount = 0;
  let fontCount = 0;
  let imageCount = 0;

  let epub2CoverId = '';
  doc.querySelectorAll('metadata > meta').forEach(m => {
    if ((m.getAttribute('name') || '').toLowerCase() === 'cover') {
      epub2CoverId = m.getAttribute('content') || '';
    }
  });

  let coverItem = null;
  let hasEpub2Meta = !!epub2CoverId;
  let hasEpub3Prop = false;

  itemEls.forEach(el => {
    const id = el.getAttribute('id') || '';
    const href = el.getAttribute('href') || '';
    const mediaType = el.getAttribute('media-type') || '';
    const properties = el.getAttribute('properties') || '';
    const fullPath = resolveZipPath(state.opfDir, href);

    const existsInZip = !!zip.file(fullPath);
    if (existsInZip) manifestedZipPaths.add(fullPath);
    else brokenLinks.push({ id, href, fullPath });

    if (properties.split(/\s+/).includes('nav')) {
      hasNavDoc = true;
      navZipPath = fullPath;
    }
    if (mediaType === 'application/x-dtbncx+xml' || href.toLowerCase().endsWith('.ncx')) {
      hasNcxToc = true;
      ncxZipPath = fullPath;
    }
    if (mediaType === 'text/css' || href.toLowerCase().endsWith('.css')) cssCount++;
    if (mediaType.includes('font') || /\.(ttf|otf|woff2?)$/i.test(href)) fontCount++;
    if (mediaType.startsWith('image/')) imageCount++;

    const isPropCover = properties.split(/\s+/).includes('cover-image');
    if (isPropCover) hasEpub3Prop = true;

    const itemObj = { id, href, fullPath, mediaType, properties, existsInZip };
    manifestItems.push(itemObj);

    if (isPropCover || (epub2CoverId && id === epub2CoverId)) {
      coverItem = itemObj;
    }
  });

  if (!coverItem) {
    coverItem = manifestItems.find(it =>
      it.mediaType.startsWith('image/') && /cover/i.test(it.id + ' ' + it.href)
    );
  }

  const orphanFiles = [];
  Object.keys(zip.files).forEach(zipPath => {
    const entry = zip.files[zipPath];
    if (entry.dir) return;
    if (zipPath === 'mimetype' || zipPath.startsWith('META-INF/') || zipPath === state.opfPath) return;
    if (!manifestedZipPaths.has(zipPath)) orphanFiles.push(zipPath);
  });

  const spineItems = [];
  const spineChapters = [];
  let totalWords = 0;
  const itemMap = new Map(manifestItems.map(i => [i.id, i]));
  const itemrefEls = doc.querySelectorAll('spine > itemref');
  const parser = new DOMParser();

  for (let idx = 0; idx < itemrefEls.length; idx++) {
    const ref = itemrefEls[idx];
    const idref = ref.getAttribute('idref') || '';
    const linear = ref.getAttribute('linear') || 'yes';
    const mItem = itemMap.get(idref);
    spineItems.push({ idref, linear, inManifest: !!mItem });

    if (mItem && mItem.existsInZip) {
      const zipEntry = zip.file(mItem.fullPath);
      let words = 0;
      let detectedTitle = '';
      if (zipEntry) {
        try {
          const rawHtml = await zipEntry.async('string');
          const htmlDoc = parser.parseFromString(rawHtml, 'text/html');
          const hEl = htmlDoc.querySelector('h1, h2, h3, title');
          if (hEl && hEl.textContent.trim()) {
            detectedTitle = hEl.textContent.trim().replace(/\s+/g, ' ');
          }
          const bodyText = (htmlDoc.body ? htmlDoc.body.textContent : rawHtml.replace(/<[^>]+>/g, ' ')) || '';
          const matches = bodyText.trim().match(/\S+/g);
          words = matches ? matches.length : 0;
          totalWords += words;
        } catch (e) {}
      }

      const pathParts = mItem.fullPath.split('/');
      const currentFileName = pathParts.pop();
      const folderPrefix = pathParts.length > 0 ? pathParts.join('/') + '/' : '';

      spineChapters.push({
        manifestId: mItem.id,
        originalIndex: idx + 1,
        detectedTitle: detectedTitle || `Signature ${idx + 1}`,
        originalFullPath: mItem.fullPath,
        originalHref: mItem.href,
        folderPrefix,
        currentFileName,
        newFileName: currentFileName,
        wordCount: words
      });
    }
  }

  state.structure = {
    manifestItems,
    brokenLinks,
    orphanFiles,
    removedOrphanBackups: [],
    spineItems,
    spineChapters,
    originalSpineChapters: JSON.parse(JSON.stringify(spineChapters)),
    filesModified: false,
    hasNavDoc,
    hasNcxToc,
    ncxZipPath,
    navZipPath,
    chapterCount: spineChapters.length,
    cssCount,
    fontCount,
    imageCount,
    totalWords
  };

  const chBadge = document.getElementById('tabBadge-chapters');
  if (chBadge) {
    chBadge.textContent = String(spineChapters.length);
    chBadge.classList.remove('hidden');
  }

  if (state.cover.blobUrl) URL.revokeObjectURL(state.cover.blobUrl);

  if (coverItem && coverItem.existsInZip) {
    const coverZipFile = zip.file(coverItem.fullPath);
    const uint8 = await coverZipFile.async('uint8array');
    const blob = new Blob([uint8], { type: coverItem.mediaType || 'image/jpeg' });
    const blobUrl = URL.createObjectURL(blob);
    const dims = await getImageDimensions(blobUrl);

    state.cover = {
      exists: true,
      manifestId: coverItem.id,
      href: coverItem.href,
      fullZipPath: coverItem.fullPath,
      mediaType: coverItem.mediaType || 'image/jpeg',
      blobUrl,
      uint8Array: uint8,
      width: dims.width,
      height: dims.height,
      byteSize: uint8.byteLength,
      hasEpub2Meta,
      hasEpub3Prop,
      modified: false
    };
  } else {
    state.cover = {
      exists: false,
      manifestId: '',
      href: '',
      fullZipPath: '',
      mediaType: 'image/jpeg',
      blobUrl: '',
      uint8Array: null,
      width: 0,
      height: 0,
      byteSize: 0,
      hasEpub2Meta: false,
      hasEpub3Prop: false,
      modified: false
    };
  }

  state.originalCoverSnapshot = {
    ...state.cover,
    uint8Array: state.cover.uint8Array ? new Uint8Array(state.cover.uint8Array) : null
  };
}

function getImageDimensions(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });
}

/*************************************************************************
 * QUALITY AUDIT ENGINE
 *************************************************************************/
function isSpineSequentiallyNamed() {
  const chs = state.structure.spineChapters;
  if (chs.length <= 1) return true;
  const names = chs.map(c => c.newFileName.toLowerCase());
  const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (let i = 0; i < names.length; i++) {
    if (names[i] !== sorted[i]) return false;
  }
  return true;
}

function runQualityAudit() {
  if (!state.zip) return;
  const checks = [];
  const minW = state.config.minCoverWidth || 1000;
  const minH = Math.round(minW * 1.4);

  // 1. Archive & Container (18 pts)
  let containerScore = 0;
  const containerItems = [];
  if (state.mimetypeExists && state.mimetypeValid) {
    containerScore += 9;
    containerItems.push({ status: 'pass', text: 'The mimetype entry is first and uncompressed' });
  } else {
    containerItems.push({ status: 'fail', text: 'The mimetype entry is missing or malformed' });
  }
  if (state.containerValid && state.opfPath) {
    containerScore += 9;
    containerItems.push({ status: 'pass', text: `The container points to ${state.opfPath}` });
  } else {
    containerItems.push({ status: 'warn', text: 'META-INF/container.xml is missing or incomplete' });
  }
  checks.push({ title: 'Archive and container', score: containerScore, maxScore: 18, items: containerItems });

  // 2. Bibliographic Imprint (25 pts)
  let metaScore = 0;
  const metaItems = [];
  if (state.meta.title.trim()) {
    metaScore += 6;
    metaItems.push({ status: 'pass', text: `Title: ${state.meta.title.slice(0, 30)}` });
  } else {
    metaItems.push({ status: 'fail', text: 'No title (<dc:title>)' });
  }
  if (state.meta.creator.trim()) {
    metaScore += 6;
    metaItems.push({ status: 'pass', text: `Author: ${state.meta.creator.slice(0, 28)}` });
  } else {
    metaItems.push({ status: 'fail', text: 'No author (<dc:creator>)' });
  }
  if (state.meta.identifier.trim()) {
    metaScore += 4;
    metaItems.push({ status: 'pass', text: `Identifier: ${state.meta.identifier}` });
  } else {
    metaItems.push({ status: 'warn', text: 'No ISBN or other identifier' });
  }
  if (state.meta.description.trim().length >= 30) {
    metaScore += 5;
    metaItems.push({ status: 'pass', text: `Synopsis (${state.meta.description.length} characters)` });
  } else {
    metaItems.push({ status: 'warn', text: 'The synopsis is missing or very short' });
  }
  if (state.meta.publisher.trim() && state.meta.subjects.length > 0) {
    metaScore += 4;
    metaItems.push({ status: 'pass', text: `Publisher and ${plural(state.meta.subjects.length, 'subject')}` });
  } else {
    metaItems.push({ status: 'warn', text: 'The publisher or subjects are missing' });
  }
  checks.push({ title: 'Imprint', score: metaScore, maxScore: 25, items: metaItems, actionLabel: 'Edit imprint', actionTab: 'imprint' });

  // 3. Frontispiece & Cover Plate (22 pts)
  let coverScore = 0;
  const coverItems = [];
  if (state.cover.exists) {
    coverScore += 8;
    const w = state.cover.width;
    const h = state.cover.height;
    if (w >= minW && h >= minH) {
      coverScore += 8;
      coverItems.push({ status: 'pass', text: `Large enough (${w} × ${h} px)` });
    } else if (w >= 600 && h >= 800) {
      coverScore += 4;
      coverItems.push({ status: 'warn', text: `Smaller than ideal (${w} × ${h} px; ${minW} × ${Math.round(minW * 1.5)} preferred)` });
    } else {
      coverItems.push({ status: 'warn', text: `Too small (${w} × ${h} px)` });
    }

    const ratio = h > 0 ? (h / w) : 0;
    if (ratio >= 1.3 && ratio <= 1.75) {
      coverScore += 2;
      coverItems.push({ status: 'pass', text: `Portrait (1:${ratio.toFixed(2)})` });
    } else {
      coverItems.push({ status: 'warn', text: `Unusual proportions (1:${ratio.toFixed(2)})` });
    }

    if (state.cover.hasEpub2Meta && state.cover.hasEpub3Prop) {
      coverScore += 4;
      coverItems.push({ status: 'pass', text: 'Tagged for both EPUB 2 and EPUB 3' });
    } else {
      coverScore += 2;
      coverItems.push({ status: 'warn', text: 'Tagged for one EPUB version only' });
    }
  } else {
    coverItems.push({ status: 'fail', text: 'No cover' });
  }
  checks.push({ title: 'Cover', score: coverScore, maxScore: 22, items: coverItems, actionLabel: 'Edit the cover', actionTab: 'imprint' });

  // 4. Spine & Navigation TOC (15 pts)
  let navScore = 0;
  const navItems = [];
  if (state.structure.chapterCount > 0) {
    navScore += 8;
    navItems.push({ status: 'pass', text: `${plural(state.structure.chapterCount, 'chapter')} in the spine` });
  } else {
    navItems.push({ status: 'fail', text: 'No chapters in the spine' });
  }
  if (state.structure.hasNavDoc || state.structure.hasNcxToc) {
    navScore += 7;
    const tocKinds = [
      state.structure.hasNavDoc ? 'EPUB 3 Nav' : '',
      state.structure.hasNcxToc ? 'NCX' : ''
    ].filter(Boolean).join(' + ');
    navItems.push({ status: 'pass', text: `Table of contents (${tocKinds})` });
  } else {
    navItems.push({ status: 'warn', text: 'No table of contents (nav or NCX)' });
  }
  checks.push({ title: 'Spine and contents', score: navScore, maxScore: 15, items: navItems });

  // 5. Manifest Hygiene (10 pts)
  let manifestScore = 0;
  const manifestCheckItems = [];
  if (state.structure.brokenLinks.length === 0) {
    manifestScore += 6;
    manifestCheckItems.push({ status: 'pass', text: `All ${plural(state.structure.manifestItems.length, 'manifest file')} present` });
  } else {
    manifestCheckItems.push({ status: 'fail', text: `${plural(state.structure.brokenLinks.length, 'manifest file')} missing` });
  }
  if (state.structure.orphanFiles.length === 0) {
    manifestScore += 4;
    manifestCheckItems.push({ status: 'pass', text: 'No orphan files' });
  } else {
    manifestCheckItems.push({ status: 'warn', text: `${plural(state.structure.orphanFiles.length, 'file')} not in the manifest` });
  }
  checks.push({ title: 'Manifest', score: manifestScore, maxScore: 10, items: manifestCheckItems });

  // 6. Signature Sequence (10 pts)
  let seqScore = 0;
  const seqItems = [];
  if (isSpineSequentiallyNamed()) {
    seqScore += 10;
    seqItems.push({ status: 'pass', text: 'Chapter files are named in reading order' });
  } else {
    seqScore += 4;
    seqItems.push({ status: 'warn', text: 'Chapter file names are out of sequence' });
  }
  seqItems.push({ status: 'pass', text: `Exports as ${computeFormattedExportFilename()}` });
  checks.push({ title: 'Chapter order', score: seqScore, maxScore: 10, items: seqItems, actionLabel: 'Number the files', actionTab: 'signatures' });

  const totalScore = checks.reduce((acc, c) => acc + c.score, 0);
  state.lastAuditScore = totalScore;
  state.lastAuditChecks = checks;

  drawScoreDial(totalScore);
  updateVerdictCopy(totalScore);
  renderTelemetryTiles();
  renderRepairBanners();
  renderAuditLedger(checks);

  const scoreBadge = document.getElementById('tabBadge-score');
  if (scoreBadge) {
    scoreBadge.textContent = String(totalScore);
    scoreBadge.classList.remove('hidden');
  }
  requestAnimationFrame(() => updateTabRailIndicator());
}

function updateVerdictCopy(score) {
  const heading = document.getElementById('auditVerdictHeading');
  const hint = document.getElementById('auditVerdictHint');
  if (!heading || !hint) return;

  if (score >= 85) {
    heading.textContent = 'Ready to shelve';
    hint.textContent = 'The container, imprint, cover and reading order all meet the reference checks.';
  } else if (score >= 72) {
    heading.textContent = 'Sound, with small gaps';
    hint.textContent = 'Well formed. The ledger below lists the optional fixes.';
  } else if (score >= 58) {
    heading.textContent = 'Readable, needs polish';
    hint.textContent = 'It opens everywhere, but the cover, file order or imprint need attention.';
  } else {
    heading.textContent = 'Needs repair';
    hint.textContent = 'Work through the Imprint, Chapters and Catalog tabs to finish this edition.';
  }
}

function renderTelemetryTiles() {
  document.getElementById('opfPathLabel').textContent = state.opfPath || 'content.opf';
  document.getElementById('statChapters').textContent = String(state.structure.chapterCount);

  const tocParts = [];
  if (state.structure.hasNavDoc) tocParts.push('Nav');
  if (state.structure.hasNcxToc) tocParts.push('NCX');
  document.getElementById('statTocSub').textContent = tocParts.length ? tocParts.join(' + ') : 'No TOC';

  const words = state.structure.totalWords;
  document.getElementById('statWords').textContent = words.toLocaleString();
  document.getElementById('statReadTime').textContent = `${Math.max(1, Math.round(words / 230))} min read`;

  if (state.cover.exists && state.cover.width > 0) {
    document.getElementById('statCoverDims').textContent = `${state.cover.width}×${state.cover.height}`;
    const ratio = (state.cover.height / state.cover.width).toFixed(2);
    document.getElementById('statCoverRatio').textContent = `1:${ratio}`;
  } else {
    document.getElementById('statCoverDims').textContent = 'None';
    document.getElementById('statCoverRatio').textContent = 'No cover';
  }

  document.getElementById('statManifestFiles').textContent = String(state.structure.manifestItems.length);
  document.getElementById('statOrphanSub').textContent = plural(state.structure.orphanFiles.length, 'orphan');
}

/** §8.13 A banner that fixes its problem is a button with a trailing chevron. */
function repairBanner({ icon, headline, detail, onclick }) {
  return `
    <button type="button" class="notice-banner notice actionable" onclick="${onclick}">
      <i class="icon-18 banner-icon" data-lucide="${icon}"></i>
      <span class="banner-text"><strong>${headline}</strong> ${detail}</span>
      <i class="chevron" data-lucide="chevron-right"></i>
    </button>
  `;
}

function renderRepairBanners() {
  const host = document.getElementById('repairBannersHost');
  if (!host) return;
  const banners = [];

  const orphans = state.structure.orphanFiles.length;
  if (orphans > 0) {
    banners.push(repairBanner({
      icon: 'file-warning',
      headline: `${plural(orphans, 'file')} not in the manifest.`,
      detail: 'Remove them.',
      onclick: 'cleanOrphanFiles()'
    }));
  }

  if (state.cover.exists && (!state.cover.hasEpub2Meta || !state.cover.hasEpub3Prop)) {
    banners.push(repairBanner({
      icon: 'layers',
      headline: 'The cover is tagged for one EPUB version only.',
      detail: 'Add both tags.',
      onclick: 'fixCoverCompatibilityFlags()'
    }));
  }

  if (!isSpineSequentiallyNamed()) {
    banners.push(repairBanner({
      icon: 'list-ordered',
      headline: 'Chapter files are out of sequence.',
      detail: 'Number them in order.',
      onclick: "switchTab('signatures')"
    }));
  }

  if (banners.length === 0) {
    banners.push(`
      <div class="notice-banner success">
        <i class="icon-18 banner-icon" data-lucide="check"></i>
        <span class="banner-text">The container, manifest and reading order pass every structural check.</span>
      </div>
    `);
  }

  host.innerHTML = banners.join('');
  lucide.createIcons({ nodes: [host] });
}

/* §7.2 Rows inside one panel, each with a §8.15 meter */
const CHECK_ICON = { pass: 'check', warn: 'alert-triangle', fail: 'x-circle' };
const CHECK_WORD = { pass: 'Passed', warn: 'Warning', fail: 'Failed' };

function renderAuditLedger(checks) {
  const grid = document.getElementById('auditCardsGrid');
  if (!grid) return;

  grid.innerHTML = checks.map(card => {
    const pct = Math.round((card.score / card.maxScore) * 100);
    const meterClass = pct >= 85 ? '' : 'amber';

    // Colour never carries meaning alone (§15): each icon has a spoken word.
    const itemsHtml = card.items.map(it => `
      <li class="check-item ${it.status}">
        <i class="icon-14" data-lucide="${CHECK_ICON[it.status] || 'check'}"></i>
        <span class="visually-hidden">${CHECK_WORD[it.status] || ''}:</span>
        <span>${escapeHtml(it.text)}</span>
      </li>
    `).join('');

    const title = card.actionTab
      ? `<button type="button" class="ledger-title-link" onclick="switchTab('${card.actionTab}')" aria-label="${escapeHtml(card.title)}: ${escapeHtml(card.actionLabel || 'open section')}">
           <span class="card-title">${escapeHtml(card.title)}</span>
           <i class="icon-14" data-lucide="arrow-up-right"></i>
         </button>`
      : `<span class="card-title">${escapeHtml(card.title)}</span>`;

    return `
      <div class="ledger-row">
        <div class="ledger-row-head">
          ${title}
          <span class="data-text amber">${card.score} / ${card.maxScore}</span>
        </div>
        <div class="meter-track" role="meter" aria-valuemin="0" aria-valuemax="${card.maxScore}" aria-valuenow="${card.score}" aria-label="${escapeHtml(card.title)}">
          <div class="meter-fill ${meterClass}" style="width: ${pct}%;"></div>
        </div>
        <ul class="check-list">${itemsHtml}</ul>
      </div>
    `;
  }).join('');

  lucide.createIcons({ nodes: [grid] });
}

async function cleanOrphanFiles() {
  if (!state.zip || state.structure.orphanFiles.length === 0) return;
  const backups = [];
  for (const path of state.structure.orphanFiles) {
    const entry = state.zip.file(path);
    if (entry) {
      const bytes = await entry.async('uint8array');
      backups.push({ path, bytes });
      state.zip.remove(path);
    }
  }
  state.structure.removedOrphanBackups = backups;
  state.structure.orphanFiles = [];
  state.structure.filesModified = true;
  updateDirtyTracking();
  runQualityAudit();

  showToast(`Removed ${plural(backups.length, 'orphan file')}.`, {
    actionLabel: 'Undo',
    onAction: () => {
      backups.forEach(b => {
        state.zip.file(b.path, b.bytes);
        state.structure.orphanFiles.push(b.path);
      });
      state.structure.removedOrphanBackups = [];
      updateDirtyTracking();
      runQualityAudit();
    }
  });
}

function fixCoverCompatibilityFlags() {
  if (!state.cover.exists) return;
  state.cover.hasEpub2Meta = true;
  state.cover.hasEpub3Prop = true;
  state.cover.modified = true;
  updateDirtyTracking();
  runQualityAudit();
  showToast('Added both EPUB 2 and EPUB 3 cover tags.');
}

/*************************************************************************
 * TAB 2: IMPRINT & COVER STUDIO
 *************************************************************************/
function populateMetadataForm() {
  const m = state.meta;
  document.getElementById('metaTitle').value = m.title || '';
  document.getElementById('metaCreator').value = m.creator || '';
  document.getElementById('metaIdentifier').value = m.identifier || '';
  document.getElementById('metaDate').value = m.date || '';
  document.getElementById('metaPublisher').value = m.publisher || '';
  document.getElementById('metaSeries').value = m.series || '';
  document.getElementById('metaSeriesIndex').value = m.seriesIndex || '';
  document.getElementById('metaDescription').value = m.description || '';

  const langSelect = document.getElementById('metaLanguage');
  const normalizedLang = (m.language || 'en').trim();
  if (!Array.from(langSelect.options).some(o => o.value === normalizedLang)) {
    const opt = document.createElement('option');
    opt.value = normalizedLang;
    opt.textContent = normalizedLang;
    langSelect.appendChild(opt);
  }
  langSelect.value = normalizedLang;

  renderSubjectPills();
  updateDirtyTracking();
}

function onMetadataFieldInput() {
  state.meta.title = document.getElementById('metaTitle').value;
  state.meta.creator = document.getElementById('metaCreator').value;
  state.meta.identifier = document.getElementById('metaIdentifier').value;
  state.meta.date = document.getElementById('metaDate').value;
  state.meta.publisher = document.getElementById('metaPublisher').value;
  state.meta.language = document.getElementById('metaLanguage').value;
  state.meta.series = document.getElementById('metaSeries').value;
  state.meta.seriesIndex = document.getElementById('metaSeriesIndex').value;
  state.meta.description = document.getElementById('metaDescription').value;

  updateTopBanner();
  updateExportFilenamePreview();
  updateDirtyTracking();
  if (state.zip) runQualityAudit();
}

function renderSubjectPills() {
  const container = document.getElementById('subjectPillsContainer');
  const countEl = document.getElementById('subjectCountLabel');
  const subjects = state.meta.subjects || [];
  if (countEl) countEl.textContent = String(subjects.length);

  if (!container) return;
  if (subjects.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = subjects.map((subj, idx) => `
    <span class="tag-chip">
      <span>${escapeHtml(subj)}</span>
      <button type="button" class="tag-chip-remove" onclick="removeSubjectTag(${idx})" aria-label="Remove ${escapeHtml(subj)}">
        <i class="icon-14" data-lucide="x"></i>
      </button>
    </span>
  `).join('');
  lucide.createIcons({ nodes: [container] });
}

function removeSubjectTag(idx) {
  state.meta.subjects.splice(idx, 1);
  renderSubjectPills();
  updateDirtyTracking();
  if (state.zip) runQualityAudit();
}

function handleTagKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.replace(/,/g, '').trim();
    if (val && !state.meta.subjects.includes(val)) {
      state.meta.subjects.push(val);
      renderSubjectPills();
      updateDirtyTracking();
      if (state.zip) runQualityAudit();
    }
    e.target.value = '';
  }
}

function stripDescriptionHtml() {
  const raw = document.getElementById('metaDescription').value;
  const cleaned = raw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  document.getElementById('metaDescription').value = cleaned;
  onMetadataFieldInput();
  showToast('HTML removed from the synopsis.');
}

function resetMetadataToOriginal() {
  if (!state.originalMeta) return;
  state.meta = JSON.parse(JSON.stringify(state.originalMeta));
  if (state.originalCoverSnapshot) {
    if (state.cover.blobUrl) URL.revokeObjectURL(state.cover.blobUrl);
    const snap = state.originalCoverSnapshot;
    let newBlobUrl = '';
    if (snap.uint8Array) {
      const blob = new Blob([snap.uint8Array], { type: snap.mediaType || 'image/jpeg' });
      newBlobUrl = URL.createObjectURL(blob);
    }
    state.cover = {
      ...snap,
      blobUrl: newBlobUrl,
      uint8Array: snap.uint8Array ? new Uint8Array(snap.uint8Array) : null,
      modified: false
    };
  }
  populateMetadataForm();
  updateCoverStudioUI();
  updateTopBanner();
  updateExportFilenamePreview();
  if (state.zip) runQualityAudit();
  showToast('Imprint and cover reverted to the original.');
}

function updateCoverStudioUI() {
  const previewImg = document.getElementById('editorCoverPreview');
  const placeholder = document.getElementById('editorCoverPlaceholder');
  const barImg = document.getElementById('barCoverImg');
  const barIcon = document.getElementById('barCoverIcon');
  const modChip = document.getElementById('coverModifiedChip');

  if (state.cover.exists && state.cover.blobUrl) {
    previewImg.src = state.cover.blobUrl;
    previewImg.classList.remove('hidden');
    placeholder.classList.add('hidden');

    barImg.src = state.cover.blobUrl;
    barImg.classList.remove('hidden');
    barIcon.classList.add('hidden');

    document.getElementById('coverMetaDims').textContent = `${state.cover.width} × ${state.cover.height} px`;
    const ratio = state.cover.width > 0 ? (state.cover.height / state.cover.width).toFixed(2) : '—';
    document.getElementById('coverMetaAspect').textContent = `1 : ${ratio}`;
    document.getElementById('coverMetaSize').textContent = formatBytes(state.cover.byteSize);
  } else {
    previewImg.src = '';
    previewImg.classList.add('hidden');
    placeholder.classList.remove('hidden');

    barImg.src = '';
    barImg.classList.add('hidden');
    barIcon.classList.remove('hidden');

    document.getElementById('coverMetaDims').textContent = 'None';
    document.getElementById('coverMetaAspect').textContent = '—';
    document.getElementById('coverMetaSize').textContent = '0 KB';
  }

  if (state.cover.modified) modChip.classList.remove('hidden');
  else modChip.classList.add('hidden');
}

async function handleCoverUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    await applyNewCoverBytes(uint8, file.type || 'image/jpeg');
    showToast('Cover replaced.');
  } catch (err) {
    showToast("Couldn't read that image. Try a JPEG, PNG or WebP file.", { isAlert: true });
  }
  e.target.value = '';
}

async function applyNewCoverBytes(uint8Array, mediaType = 'image/jpeg') {
  if (state.cover.blobUrl) URL.revokeObjectURL(state.cover.blobUrl);
  const blob = new Blob([uint8Array], { type: mediaType });
  const blobUrl = URL.createObjectURL(blob);
  const dims = await getImageDimensions(blobUrl);

  const ext = mediaType.includes('png') ? 'png' : mediaType.includes('webp') ? 'webp' : 'jpg';
  const defaultHref = `images/cover.${ext}`;
  const href = state.cover.href || defaultHref;
  const fullZipPath = state.cover.fullZipPath || resolveZipPath(state.opfDir, href);

  state.cover = {
    exists: true,
    manifestId: state.cover.manifestId || 'cover-image-item',
    href,
    fullZipPath,
    mediaType,
    blobUrl,
    uint8Array,
    width: dims.width,
    height: dims.height,
    byteSize: uint8Array.byteLength,
    hasEpub2Meta: true,
    hasEpub3Prop: true,
    modified: true
  };

  updateCoverStudioUI();
  updateDirtyTracking();
  if (state.zip) runQualityAudit();
}

/* §8.10 Modal: Typographic Cover Studio */
function openTypographicCoverModal() {
  document.getElementById('cgTitle').value = state.meta.title || 'Untitled edition';
  document.getElementById('cgSubtitle').value = state.meta.series
    ? `${state.meta.series}${state.meta.seriesIndex ? ' · Volume ' + state.meta.seriesIndex : ''}`
    : 'A digital edition';
  document.getElementById('cgAuthor').value = state.meta.creator || 'Anonymous';

  selectCoverTheme(state.config.defaultCoverTheme || 'classic');
  openDialog('coverGenModal');
  renderTypographicCoverCanvas();
  // Redraw once Fraunces is ready, so the plate is set in the house serif (§5.1).
  document.fonts?.load('400 92px Fraunces').then(() => renderTypographicCoverCanvas());
}

function closeTypographicCoverModal() {
  closeDialog('coverGenModal');
}

function selectCoverTheme(themeName) {
  state.activeCoverTheme = themeName;
  ['classic', 'minimal', 'noir', 'eink'].forEach(t => {
    document.getElementById(`modalTheme-${t}`)?.setAttribute('aria-checked', t === themeName ? 'true' : 'false');
  });
  renderTypographicCoverCanvas();
}

function renderTypographicCoverCanvas() {
  const canvas = document.getElementById('typoCoverCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const title = (document.getElementById('cgTitle').value || 'Untitled').trim();
  const subtitle = (document.getElementById('cgSubtitle').value || '').trim();
  const author = (document.getElementById('cgAuthor').value || '').trim();
  const theme = state.activeCoverTheme;

  // The plate is artwork that outlives the app's theme, so it reads a fixed
  // palette (Dusk or Dawn) from a probe element, never a literal colour (§2, §8.16).
  const dusk = (n) => themeToken(n, 'dark');
  const dawn = (n) => themeToken(n, 'light');
  const duskBgTop = dusk('--bg-grad-top');
  const duskBgBot = dusk('--bg-grad-bot');
  const duskHeading = dusk('--text-heading');
  const duskAmber = dusk('--accent-amber');
  const duskAmberRgb = dusk('--accent-amber-rgb');
  const duskSage = dusk('--accent-sage');

  const dawnBgTop = dawn('--bg-grad-top');
  const dawnBgBot = dawn('--bg-grad-bot');
  const dawnHeading = dawn('--text-heading');
  const dawnAmber = dawn('--accent-amber');
  const dawnDim = dawn('--text-dim');

  const serif = token('--font-serif');
  const mono = token('--font-mono');

  if (theme === 'classic') {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, duskBgTop);
    grad.addColorStop(1, duskBgBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = duskAmber;
    ctx.lineWidth = 4;
    ctx.strokeRect(72, 72, W - 144, H - 144);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(92, 92, W - 184, H - 184);

    ctx.fillStyle = duskAmber;
    ctx.font = `italic 36px ${serif}`;
    ctx.textAlign = 'center';
    ctx.fillText(subtitle.toUpperCase(), W / 2, 240);

    ctx.fillStyle = duskHeading;
    ctx.font = `92px ${serif}`;
    wrapCanvasText(ctx, title, W / 2, 600, W - 260, 112);

    ctx.strokeStyle = duskAmber;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 140, 1180);
    ctx.lineTo(W / 2 + 140, 1180);
    ctx.stroke();

    ctx.fillStyle = duskHeading;
    ctx.font = `52px ${serif}`;
    ctx.fillText(author, W / 2, 1540);
  } else if (theme === 'minimal') {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, dawnBgTop);
    grad.addColorStop(1, dawnBgBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = dawnAmber;
    ctx.fillRect(110, 160, 120, 6);

    ctx.textAlign = 'left';
    ctx.fillStyle = dawnHeading;
    ctx.font = `96px ${serif}`;
    wrapCanvasText(ctx, title, 110, 380, W - 220, 114);

    ctx.fillStyle = dawnAmber;
    ctx.font = `italic 42px ${serif}`;
    ctx.fillText(subtitle, 110, 1020);

    ctx.fillStyle = dawnDim;
    ctx.font = `50px ${serif}`;
    ctx.fillText(author, 110, 1580);
  } else if (theme === 'noir') {
    ctx.fillStyle = duskBgBot;
    ctx.fillRect(0, 0, W, H);

    const rad = ctx.createRadialGradient(W * 0.8, H * 0.2, 40, W * 0.8, H * 0.2, 900);
    rad.addColorStop(0, `rgba(${duskAmberRgb}, 0.22)`);
    rad.addColorStop(1, `rgba(${duskAmberRgb}, 0)`);
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = `rgba(${duskAmberRgb}, 0.4)`;
    ctx.lineWidth = 2;
    ctx.strokeRect(64, 64, W - 128, H - 128);

    ctx.textAlign = 'center';
    ctx.fillStyle = duskSage;
    ctx.font = `32px ${mono}`;
    ctx.fillText(subtitle.toUpperCase(), W / 2, 260);

    ctx.fillStyle = duskHeading;
    ctx.font = `98px ${serif}`;
    wrapCanvasText(ctx, title, W / 2, 660, W - 240, 116);

    ctx.fillStyle = duskAmber;
    ctx.font = `italic 54px ${serif}`;
    ctx.fillText(author, W / 2, 1560);
  } else {
    ctx.fillStyle = dawnBgTop;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = dawnHeading;
    ctx.lineWidth = 8;
    ctx.strokeRect(64, 64, W - 128, H - 128);
    ctx.lineWidth = 2;
    ctx.strokeRect(86, 86, W - 172, H - 172);

    ctx.fillStyle = dawnHeading;
    ctx.fillRect(86, 86, W - 172, 150);
    ctx.fillStyle = dawnBgTop;
    ctx.textAlign = 'center';
    ctx.font = `34px ${mono}`;
    ctx.fillText((subtitle || 'A digital edition').toUpperCase(), W / 2, 175);

    ctx.fillStyle = dawnHeading;
    ctx.font = `92px ${serif}`;
    wrapCanvasText(ctx, title, W / 2, 580, W - 260, 110);

    ctx.fillStyle = dawnHeading;
    ctx.font = `54px ${serif}`;
    ctx.fillText(author, W / 2, 1540);
  }
}

function wrapCanvasText(ctx, text, x, startY, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  let line = '';
  let y = startY;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, y);
}

function applyGeneratedTypographicCover() {
  const canvas = document.getElementById('typoCoverCanvas');
  if (!canvas) return;
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const uint8 = new Uint8Array(await blob.arrayBuffer());
    await applyNewCoverBytes(uint8, 'image/jpeg');
    closeTypographicCoverModal();
    showToast('Plate set as the cover (1200 × 1800 px).');
  }, 'image/jpeg', 0.92);
}

function updateTopBanner() {
  document.getElementById('barTitle').textContent = state.meta.title || 'Untitled edition';
  document.getElementById('barAuthor').textContent = state.meta.creator || 'Unknown author';
  document.getElementById('barEpubSpec').textContent = `EPUB ${state.epubVersion}`;
  document.getElementById('barFileSize').textContent = formatBytes(state.fileSize);
  document.getElementById('barFilename').textContent = computeFormattedExportFilename();
}

function updateDirtyTracking() {
  if (!state.originalMeta) return;
  let changes = 0;
  const fields = ['title', 'creator', 'identifier', 'language', 'publisher', 'date', 'series', 'seriesIndex', 'description'];
  fields.forEach(k => {
    if ((state.meta[k] || '') !== (state.originalMeta[k] || '')) changes++;
  });
  if (JSON.stringify(state.meta.subjects) !== JSON.stringify(state.originalMeta.subjects)) changes++;
  if (state.cover.modified) changes++;
  if (state.structure.filesModified) changes++;

  const badge = document.getElementById('dirtyBadge');
  const chip = document.getElementById('barModifiedChip');
  if (changes > 0) {
    badge.textContent = String(changes);
    badge.classList.remove('hidden');
    chip?.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
    chip?.classList.add('hidden');
  }
}

/*************************************************************************
 * TAB 3: SIGNATURES & FILE RENAMER
 *************************************************************************/
function sanitizeFilenameSegment(str) {
  return String(str || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeFormattedExportFilename() {
  const patternInput = document.getElementById('exportPatternInput');
  const orderInput = document.getElementById('customShelfOrder');
  const pattern = patternInput ? patternInput.value : '{Order} - {Author} - {Title} ({Year})';
  const orderVal = sanitizeFilenameSegment(orderInput ? orderInput.value : '01') || '01';

  const titleVal = sanitizeFilenameSegment(state.meta.title) || 'Untitled';
  const authorVal = sanitizeFilenameSegment(state.meta.creator) || 'Unknown Author';
  const seriesVal = sanitizeFilenameSegment(state.meta.series) || '';
  const seriesIdxVal = sanitizeFilenameSegment(state.meta.seriesIndex) || '';
  const yearMatch = (state.meta.date || '').match(/\d{4}/);
  const yearVal = yearMatch ? yearMatch[0] : '';
  const isbnVal = sanitizeFilenameSegment(state.meta.identifier) || '';
  const langVal = sanitizeFilenameSegment(state.meta.language) || 'en';

  let result = pattern
    .replace(/\{Order\}/gi, orderVal)
    .replace(/\{Author\}/gi, authorVal)
    .replace(/\{Title\}/gi, titleVal)
    .replace(/\{Series\}/gi, seriesVal)
    .replace(/\{SeriesIndex\}/gi, seriesIdxVal)
    .replace(/\{Year\}/gi, yearVal)
    .replace(/\{ISBN\}/gi, isbnVal)
    .replace(/\{Lang\}/gi, langVal);

  result = result
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/#\s*-/g, '-')
    .replace(/\s+-\s+-\s+/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-_]+|[\s\-_]+$/g, '')
    .trim();

  if (!result) result = 'edition';
  if (!result.toLowerCase().endsWith('.epub')) result += '.epub';
  return result;
}

function updateExportFilenamePreview() {
  const previewEl = document.getElementById('exportFilenamePreview');
  const formatted = computeFormattedExportFilename();
  if (previewEl) previewEl.textContent = formatted;
  const barFileEl = document.getElementById('barFilename');
  if (barFileEl && state.zip) barFileEl.textContent = formatted;
}

function insertFilenameToken(tokenStr) {
  const input = document.getElementById('exportPatternInput');
  if (!input) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const val = input.value;
  input.value = val.slice(0, start) + tokenStr + val.slice(end);
  input.focus();
  updateExportFilenamePreview();
}

function setFilenamePreset(presetStr) {
  const input = document.getElementById('exportPatternInput');
  if (!input) return;
  input.value = presetStr;
  updateExportFilenamePreview();
}

function renderSpineOrderTable() {
  const list = document.getElementById('spineOrderList');
  if (!list) return;
  const chapters = state.structure.spineChapters;

  if (!chapters || chapters.length === 0) {
    list.innerHTML = `<div class="row-item"><p class="hint flush">This edition's spine lists no chapters.</p></div>`;
    return;
  }

  list.innerHTML = chapters.map((ch, idx) => {
    const isRenamed = ch.newFileName !== ch.currentFileName;
    const isMoved = (idx + 1) !== ch.originalIndex;
    return `
      <div class="row-item sig-row"
           draggable="true"
           ondragstart="handleRowDragStart(event, ${idx})"
           ondragover="handleRowDragOver(event)"
           ondragleave="handleRowDragLeave(event)"
           ondrop="handleRowDrop(event, ${idx})"
           ondragend="handleRowDragEnd(event)">
        <div class="sig-row-main">
          <i class="sig-grip" data-lucide="grip-vertical"></i>
          <span class="data-text amber sig-index">${String(idx + 1).padStart(2, '0')}</span>
          <div class="sig-row-text">
            <div class="sig-row-title">
              <span class="row-title ellipsis">${escapeHtml(ch.detectedTitle)}</span>
              ${isMoved ? `<span class="status-chip amber">Was ${ch.originalIndex}</span>` : ''}
            </div>
            <span class="data-small dim ellipsis">${escapeHtml(ch.folderPrefix + ch.currentFileName)} · ${plural(ch.wordCount, 'word').replace(/^\d+/, ch.wordCount.toLocaleString())}</span>
          </div>
        </div>

        <div class="sig-row-controls">
          <input type="text"
                 value="${escapeHtml(ch.newFileName)}"
                 oninput="onChapterNameInput(${idx}, this.value)"
                 aria-label="New file name for chapter ${idx + 1}"
                 autocapitalize="off" spellcheck="false" enterkeyhint="done"
                 class="input mono${isRenamed ? ' changed' : ''}" />
          <button type="button" class="btn-icon" onclick="moveSpineChapter(${idx}, -1)" ${idx === 0 ? 'disabled' : ''} aria-label="Move chapter ${idx + 1} up">
            <i data-lucide="chevron-up"></i>
          </button>
          <button type="button" class="btn-icon" onclick="moveSpineChapter(${idx}, 1)" ${idx === chapters.length - 1 ? 'disabled' : ''} aria-label="Move chapter ${idx + 1} down">
            <i data-lucide="chevron-down"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons({ nodes: [list] });
}


function handleRowDragStart(e, index) {
  state.dragSrcIndex = index;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleRowDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function handleRowDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleRowDrop(e, targetIndex) {
  e.stopPropagation();
  e.currentTarget.classList.remove('drag-over');
  const srcIndex = state.dragSrcIndex;
  if (srcIndex === null || srcIndex === targetIndex) return;

  const list = state.structure.spineChapters;
  const [moved] = list.splice(srcIndex, 1);
  list.splice(targetIndex, 0, moved);

  state.structure.filesModified = true;
  renderSpineOrderTable();
  updateDirtyTracking();
  if (state.zip) runQualityAudit();
}

function handleRowDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.sig-row').forEach(r => r.classList.remove('drag-over'));
  state.dragSrcIndex = null;
}

function moveSpineChapter(index, delta) {
  const list = state.structure.spineChapters;
  const newIndex = index + delta;
  if (newIndex < 0 || newIndex >= list.length) return;
  const [item] = list.splice(index, 1);
  list.splice(newIndex, 0, item);
  state.structure.filesModified = true;
  renderSpineOrderTable();
  updateDirtyTracking();
  if (state.zip) runQualityAudit();
}

function onChapterNameInput(index, val) {
  const ch = state.structure.spineChapters[index];
  if (!ch) return;
  const cleaned = val.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
  ch.newFileName = cleaned || ch.currentFileName;
  state.structure.filesModified = true;
  updateDirtyTracking();
  if (state.zip) runQualityAudit();
}

function sortSpineChaptersByTitle() {
  state.structure.spineChapters.sort((a, b) =>
    a.detectedTitle.localeCompare(b.detectedTitle, undefined, { numeric: true })
  );
  state.structure.filesModified = true;
  renderSpineOrderTable();
  updateDirtyTracking();
  if (state.zip) runQualityAudit();
  showToast('Sorted by chapter heading.');
}

function sortSpineChaptersByCurrentName() {
  state.structure.spineChapters.sort((a, b) =>
    a.currentFileName.localeCompare(b.currentFileName, undefined, { numeric: true })
  );
  state.structure.filesModified = true;
  renderSpineOrderTable();
  updateDirtyTracking();
  if (state.zip) runQualityAudit();
  showToast('Sorted by file name.');
}

function reverseSpineChapterOrder() {
  state.structure.spineChapters.reverse();
  state.structure.filesModified = true;
  renderSpineOrderTable();
  updateDirtyTracking();
  if (state.zip) runQualityAudit();
  showToast('Reading order reversed.');
}

function resetSpineOrderAndNames() {
  if (!state.structure.originalSpineChapters.length) return;
  state.structure.spineChapters = JSON.parse(JSON.stringify(state.structure.originalSpineChapters));
  state.structure.filesModified = false;
  renderSpineOrderTable();
  updateDirtyTracking();
  if (state.zip) runQualityAudit();
  showToast('Order and file names reset.');
}

function slugifyText(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28) || 'section';
}

function applyBatchSequentialRename() {
  const pattern = (document.getElementById('batchRenamePattern').value || 'chapter_{num}_{slug}.xhtml').trim();
  const startIdx = parseInt(document.getElementById('batchStartIndex').value || '1', 10);
  const padWidth = parseInt(document.getElementById('batchZeroPad').value || '3', 10);

  const usedNames = new Set();
  state.structure.spineChapters.forEach((ch, idx) => {
    const numStr = String(startIdx + idx).padStart(padWidth, '0');
    const slugStr = slugifyText(ch.detectedTitle);
    const origParts = ch.currentFileName.split('.');
    const ext = origParts.length > 1 ? origParts.pop() : 'xhtml';
    const origStem = origParts.join('.') || 'chapter';

    let candidate = pattern
      .replace(/\{num\}/gi, numStr)
      .replace(/\{slug\}/gi, slugStr)
      .replace(/\{orig\}/gi, origStem);

    if (!/\.(xhtml|html|htm|xml)$/i.test(candidate)) {
      candidate += `.${ext}`;
    }

    if (usedNames.has(candidate.toLowerCase())) {
      candidate = candidate.replace(/(\.[^.]+)$/, `_${idx + 1}$1`);
    }
    usedNames.add(candidate.toLowerCase());
    ch.newFileName = candidate;
  });

  state.structure.filesModified = true;
  renderSpineOrderTable();
  updateDirtyTracking();
  if (state.zip) runQualityAudit();
  showToast(`Numbered ${plural(state.structure.spineChapters.length, 'chapter file')}.`);
}

/*************************************************************************
 * TAB 4: CATALOG MATCH (Google Books + Open Library + ISBNdb + Custom)
 *************************************************************************/
function setSearchSource(src) {
  state.searchSource = src;
  ['both', 'google', 'openlibrary', 'isbndb'].forEach(id => {
    document.getElementById(`srcSeg-${id}`)?.setAttribute('aria-checked', id === src ? 'true' : 'false');
  });
}

function prefillSearchFromEpub() {
  const input = document.getElementById('onlineSearchInput');
  if (!input) return;
  const parts = [state.meta.title, state.meta.creator].filter(Boolean).join(' ').trim();
  input.value = parts || state.meta.identifier || '';
}

function computeSimilarityConfidence(candidate) {
  let score = 52;
  const epubTitle = (state.meta.title || '').toLowerCase().trim();
  const epubAuthor = (state.meta.creator || '').toLowerCase().trim();
  const epubIsbn = (state.meta.identifier || '').replace(/[^0-9Xx]/g, '');

  const candTitle = (candidate.title || '').toLowerCase().trim();
  const candAuthor = (candidate.creator || '').toLowerCase().trim();
  const candIsbn = (candidate.identifier || '').replace(/[^0-9Xx]/g, '');

  if (epubIsbn && candIsbn && (candIsbn.includes(epubIsbn) || epubIsbn.includes(candIsbn))) score += 42;
  if (epubTitle && candTitle) {
    if (candTitle === epubTitle) score += 28;
    else if (candTitle.includes(epubTitle) || epubTitle.includes(candTitle)) score += 18;
  }
  if (epubAuthor && candAuthor) {
    const firstAuthor = epubAuthor.split(',')[0].trim();
    if (candAuthor.includes(firstAuthor) || firstAuthor.includes(candAuthor)) score += 18;
  }
  if (candidate.coverUrl) score += 4;
  return Math.min(99, score);
}

async function executeOnlineSearch() {
  const query = document.getElementById('onlineSearchInput').value.trim();
  if (!query) {
    showToast('Type a title, author or ISBN to search.', { isAlert: true });
    return;
  }

  const btn = document.getElementById('onlineSearchBtn');
  const statusEl = document.getElementById('onlineResultsStatus');
  const gridEl = document.getElementById('onlineResultsGrid');

  btn.disabled = true;
  statusEl.classList.remove('hidden');
  statusEl.textContent = `Searching for “${query}”…`;
  gridEl.innerHTML = '';
  closeComparisonPanel();

  const maxRes = state.config.maxCatalogResults || 8;
  try {
    const tasks = [];
    if (state.searchSource === 'both' || state.searchSource === 'google') {
      tasks.push(fetchGoogleBooks(query, maxRes));
    }
    if (state.searchSource === 'both' || state.searchSource === 'openlibrary') {
      tasks.push(fetchOpenLibrary(query, maxRes));
    }
    if (state.searchSource === 'isbndb' || (state.searchSource === 'both' && state.config.isbndbApiKey)) {
      tasks.push(fetchIsbndb(query, maxRes));
    }
    if (state.config.customCatalogUrl) {
      tasks.push(fetchCustomCatalog(query));
    }

    const settled = await Promise.allSettled(tasks);
    let combined = [];
    settled.forEach(res => {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        combined = combined.concat(res.value);
      }
    });

    combined.forEach(item => {
      item.confidence = computeSimilarityConfidence(item);
    });
    combined.sort((a, b) => b.confidence - a.confidence);
    state.searchResults = combined;

    if (combined.length === 0) {
      statusEl.textContent = `Nothing matched “${query}”. Try a shorter title, or check your API keys in Settings.`;
    } else {
      statusEl.classList.add('hidden');
      renderOnlineSearchResults(combined);
    }
  } catch (err) {
    statusEl.textContent = "Couldn't reach the catalogs. Your edition is unaffected; try again when you're online.";
  } finally {
    btn.disabled = false;
  }
}

async function fetchGoogleBooks(query, maxRes) {
  const keyParam = state.config.googleApiKey ? `&key=${encodeURIComponent(state.config.googleApiKey)}` : '';
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxRes}${keyParam}`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = await resp.json();
  if (!Array.isArray(data.items)) return [];

  return data.items.map(item => {
    const info = item.volumeInfo || {};
    const ids = info.industryIdentifiers || [];
    const isbn13 = ids.find(i => i.type === 'ISBN_13')?.identifier;
    const isbn10 = ids.find(i => i.type === 'ISBN_10')?.identifier;
    let coverUrl = info.imageLinks?.extraLarge || info.imageLinks?.large || info.imageLinks?.medium || info.imageLinks?.thumbnail || '';
    if (coverUrl) {
      coverUrl = coverUrl.replace(/^http:\/\//i, 'https://').replace('&edge=curl', '');
    }
    return {
      source: 'Google Books',
      title: info.title || '',
      creator: (info.authors || []).join(', '),
      identifier: isbn13 || isbn10 || '',
      publisher: info.publisher || '',
      date: info.publishedDate || '',
      language: info.language || 'en',
      subjects: info.categories || [],
      description: (info.description || '').replace(/<[^>]*>/g, ''),
      coverUrl
    };
  });
}

async function fetchOpenLibrary(query, maxRes) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${maxRes}`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = await resp.json();
  if (!Array.isArray(data.docs)) return [];

  return data.docs.map(doc => {
    const coverId = doc.cover_i;
    const isbn = Array.isArray(doc.isbn) && doc.isbn.length > 0 ? doc.isbn[0] : '';
    const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : '';
    return {
      source: 'Open Library',
      title: doc.title || '',
      creator: (doc.author_name || []).slice(0, 3).join(', '),
      identifier: isbn,
      publisher: (doc.publisher || [])[0] || '',
      date: doc.first_publish_year ? String(doc.first_publish_year) : '',
      language: Array.isArray(doc.language) && doc.language[0] ? doc.language[0] : 'en',
      subjects: (doc.subject || []).slice(0, 6),
      description: doc.first_sentence ? (Array.isArray(doc.first_sentence) ? doc.first_sentence[0] : doc.first_sentence) : '',
      coverUrl
    };
  });
}

async function fetchIsbndb(query, maxRes) {
  if (!state.config.isbndbApiKey) return [];
  const url = `https://api2.isbndb.com/books/${encodeURIComponent(query)}?pageSize=${maxRes}`;
  const resp = await fetch(url, {
    headers: { 'Authorization': state.config.isbndbApiKey }
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  if (!Array.isArray(data.books)) return [];

  return data.books.map(b => ({
    source: 'ISBNdb',
    title: b.title || b.title_long || '',
    creator: (b.authors || []).join(', '),
    identifier: b.isbn13 || b.isbn || '',
    publisher: b.publisher || '',
    date: b.date_published || '',
    language: b.language || 'en',
    subjects: b.subjects || [],
    description: (b.synopsis || '').replace(/<[^>]*>/g, ''),
    coverUrl: b.image || ''
  }));
}

async function fetchCustomCatalog(query) {
  if (!state.config.customCatalogUrl) return [];
  const targetUrl = state.config.customCatalogUrl.includes('{query}')
    ? state.config.customCatalogUrl.replace(/\{query\}/g, encodeURIComponent(query))
    : `${state.config.customCatalogUrl}?q=${encodeURIComponent(query)}`;
  const headers = {};
  if (state.config.customCatalogKey) {
    headers['Authorization'] = state.config.customCatalogKey.startsWith('Bearer ')
      ? state.config.customCatalogKey
      : `Bearer ${state.config.customCatalogKey}`;
  }
  const resp = await fetch(targetUrl, { headers });
  if (!resp.ok) return [];
  const data = await resp.json();
  const items = Array.isArray(data) ? data : (data.items || data.results || []);
  return items.map(it => ({
    source: 'Custom Catalog',
    title: it.title || '',
    creator: Array.isArray(it.authors) ? it.authors.join(', ') : (it.creator || it.author || ''),
    identifier: it.isbn || it.identifier || '',
    publisher: it.publisher || '',
    date: it.date || it.publishedDate || '',
    language: it.language || 'en',
    subjects: Array.isArray(it.subjects) ? it.subjects : [],
    description: it.description || '',
    coverUrl: it.coverUrl || it.image || ''
  }));
}

/* §7.2 Card layout for Catalog items (Thumbnail + Serif Title + Mono line + Icon Actions) */
function renderOnlineSearchResults(results) {
  const grid = document.getElementById('onlineResultsGrid');
  grid.innerHTML = results.map((r, idx) => {
    const coverHtml = r.coverUrl
      ? `<img src="${escapeHtml(r.coverUrl)}" alt="" loading="lazy" onerror="this.remove()" />`
      : `<i class="icon-18" data-lucide="book"></i>`;

    const swapCoverBtn = r.coverUrl
      ? `<button type="button" class="btn btn-muted btn-dense" onclick="swapCoverFromCandidateIndex(${idx})">
           <i data-lucide="image-down"></i>
           <span>Use cover</span>
         </button>`
      : '';

    // §7.2 Card: thumbnail, serif title, mono metadata line, one trailing figure.
    return `
      <article class="panel result-card">
        <div class="cover-thumb result-thumb">${coverHtml}</div>
        <div class="result-body">
          <div class="result-head">
            <div class="result-title-block">
              <span class="status-chip">${escapeHtml(r.source)}</span>
              <h3 class="card-title ellipsis">${escapeHtml(r.title || 'Untitled')}</h3>
              <div class="body-small muted ellipsis">${escapeHtml(r.creator || 'Unknown author')}</div>
            </div>
            <div class="result-figure">
              <div class="stat-value">${r.confidence}<span class="stat-unit">%</span></div>
              <span class="field-label flush">Match</span>
            </div>
          </div>
          <div class="data-small dim">
            ${[r.date, r.publisher, r.identifier ? `ISBN ${r.identifier}` : ''].filter(Boolean).map(escapeHtml).join(' · ')}
          </div>
          <div class="button-row">
            <button type="button" class="btn btn-secondary btn-dense" onclick="openComparisonDrawer(${idx})">
              <i data-lucide="git-compare"></i>
              <span>Compare</span>
            </button>
            ${swapCoverBtn}
          </div>
        </div>
      </article>
    `;
  }).join('');
  lucide.createIcons({ nodes: [grid] });
}


/*************************************************************************
 * ONLINE COVER PLATE & FRONTISPIECE FINDER + CORS-SAFE FETCHER
 *************************************************************************/
function upgradeCoverUrlResolution(url) {
  if (!url) return '';
  let clean = url.trim().replace(/^http:\/\//i, 'https://');
  if (clean.includes('books.google.com/books/content')) {
    clean = clean.replace(/&edge=curl/gi, '');
    if (/zoom=\d/.test(clean)) {
      clean = clean.replace(/zoom=\d/, 'zoom=2');
    }
  }
  return clean;
}

async function fetchRemoteCoverBytes(rawUrl) {
  const hiResUrl = upgradeCoverUrlResolution(rawUrl);
  const candidates = [];
  if (state.config.corsProxyUrl) {
    candidates.push(`${state.config.corsProxyUrl}${encodeURIComponent(hiResUrl)}`);
  }
  candidates.push(hiResUrl);
  if (hiResUrl !== rawUrl) candidates.push(rawUrl.replace(/^http:\/\//i, 'https://'));
  // Public fallback image proxy if publisher blocks direct browser CORS
  candidates.push(`https://wsrv.nl/?url=${encodeURIComponent(hiResUrl)}&output=jpg`);

  for (const target of candidates) {
    try {
      const resp = await fetch(target);
      if (resp.ok) {
        const blob = await resp.blob();
        if (blob.size > 400) {
          return {
            uint8: new Uint8Array(await blob.arrayBuffer()),
            mediaType: blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg'
          };
        }
      }
    } catch (err) {
      // Try next candidate
    }
  }
  throw new Error('Remote cover host refused connection.');
}

async function swapCoverFromUrl(url, sourceLabel = 'online catalog') {
  if (!url) return false;
  try {
    showToast(`Downloading the cover from ${sourceLabel}…`);
    const { uint8, mediaType } = await fetchRemoteCoverBytes(url);
    await applyNewCoverBytes(uint8, mediaType);
    showToast(`Cover replaced (${state.cover.width} × ${state.cover.height} px).`);
    return true;
  } catch (err) {
    showToast("Couldn't download that cover. Try another, or set a cover proxy in Settings.", { isAlert: true });
    return false;
  }
}

async function swapCoverFromCandidateIndex(idx) {
  const cand = state.searchResults[idx];
  if (!cand || !cand.coverUrl) return;
  await swapCoverFromUrl(cand.coverUrl, cand.source);
}

function openOnlineCoverModal() {
  const modal = document.getElementById('onlineCoverModal');
  if (!modal) return;
  const qInput = document.getElementById('coverFinderQueryInput');
  if (qInput && !qInput.value.trim()) {
    const defaultQuery = [state.meta.title, state.meta.creator].filter(Boolean).join(' ').trim() || state.meta.identifier || '';
    qInput.value = defaultQuery;
  }
  openDialog('onlineCoverModal');
  if (qInput && qInput.value.trim()) {
    searchOnlineCoverPlates();
  } else {
    document.getElementById('coverFinderStatus').textContent = 'Search by title, author or ISBN to see covers.';
    document.getElementById('coverFinderGrid').innerHTML = '';
  }
}

function closeOnlineCoverModal() {
  closeDialog('onlineCoverModal');
}

async function applyDirectCoverUrlInput() {
  const input = document.getElementById('directCoverUrlInput');
  const url = input ? input.value.trim() : '';
  if (!url) {
    showToast('Paste an image URL first.', { isAlert: true });
    return;
  }
  const ok = await swapCoverFromUrl(url, 'direct URL');
  if (ok) {
    input.value = '';
    closeOnlineCoverModal();
  }
}

async function searchOnlineCoverPlates() {
  const qInput = document.getElementById('coverFinderQueryInput');
  const query = qInput ? qInput.value.trim() : '';
  if (!query) {
    showToast('Type a title, author or ISBN to search.', { isAlert: true });
    return;
  }

  const btn = document.getElementById('coverFinderSearchBtn');
  const statusEl = document.getElementById('coverFinderStatus');
  const gridEl = document.getElementById('coverFinderGrid');

  btn.disabled = true;
  statusEl.classList.remove('hidden');
  statusEl.textContent = `Searching Open Library and Google Books for “${query}”…`;
  gridEl.innerHTML = '';

  try {
    const limit = state.config.maxCatalogResults || 8;
    const tasks = [
      fetchOpenLibrary(query, limit),
      fetchGoogleBooks(query, limit)
    ];
    if (state.config.isbndbApiKey) {
      tasks.push(fetchIsbndb(query, limit));
    }

    const settled = await Promise.allSettled(tasks);
    let covers = [];
    settled.forEach(res => {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        covers = covers.concat(res.value.filter(item => Boolean(item.coverUrl)));
      }
    });

    state.coverFinderResults = covers;

    if (covers.length === 0) {
      statusEl.textContent = `No covers found for “${query}”. Try a shorter title, or paste an image URL.`;
    } else {
      statusEl.classList.add('hidden');
      gridEl.innerHTML = covers.map((c, i) => `
        <button type="button" class="cover-plate-card" onclick="selectCoverFromFinder(${i})" aria-label="Use the ${escapeHtml(c.source)} cover for ${escapeHtml(c.title || 'this record')}">
          <span class="cover-thumb">
            <img src="${escapeHtml(c.coverUrl)}" alt="" loading="lazy" />
          </span>
          <span class="data-small amber ellipsis">${escapeHtml(c.source)}</span>
          <span class="body-small heading ellipsis">${escapeHtml(c.title || 'Untitled')}</span>
        </button>
      `).join('');
      lucide.createIcons({ nodes: [gridEl] });
    }
  } catch (err) {
    statusEl.textContent = "Couldn't reach the catalogs. Your edition is unaffected; try again when you're online.";
  } finally {
    btn.disabled = false;
  }
}

async function selectCoverFromFinder(index) {
  const item = (state.coverFinderResults || [])[index];
  if (!item || !item.coverUrl) return;
  const ok = await swapCoverFromUrl(item.coverUrl, item.source);
  if (ok) closeOnlineCoverModal();
}

function openComparisonDrawer(idx) {
  const cand = state.searchResults[idx];
  if (!cand) return;
  state.selectedCandidate = cand;

  const rows = [
    { key: 'title', label: 'Title', current: state.meta.title, online: cand.title },
    { key: 'creator', label: 'Author', current: state.meta.creator, online: cand.creator },
    { key: 'identifier', label: 'ISBN', current: state.meta.identifier, online: cand.identifier },
    { key: 'publisher', label: 'Publisher', current: state.meta.publisher, online: cand.publisher },
    { key: 'date', label: 'Date', current: state.meta.date, online: cand.date },
    { key: 'language', label: 'Language', current: state.meta.language, online: cand.language },
    { key: 'subjects', label: 'Subjects', current: state.meta.subjects.join(', '), online: (cand.subjects || []).join(', ') },
    { key: 'description', label: 'Synopsis', current: state.meta.description, online: cand.description }
  ];

  const container = document.getElementById('comparisonRowsContainer');
  let html = rows.map(r => {
    const hasOnline = Boolean(r.online && String(r.online).trim());
    return `
      <label class="row-item interactive compare-row${hasOnline ? '' : ' unavailable'}">
        <span class="compare-pick">
          <input type="checkbox" class="check" data-comp-field="${r.key}" ${hasOnline ? 'checked' : 'disabled'} />
          <span class="field-label flush">${escapeHtml(r.label)}</span>
        </span>
        <span class="compare-values">
          <span class="body-small dim">
            <span class="field-label">Now</span>
            ${escapeHtml(r.current || '—')}
          </span>
          <span class="body-small heading">
            <span class="field-label">${escapeHtml(cand.source)}</span>
            ${escapeHtml(r.online || '—')}
          </span>
        </span>
      </label>
    `;
  }).join('');

  if (cand.coverUrl) {
    html += `
      <label class="row-item interactive compare-row">
        <span class="compare-pick">
          <input type="checkbox" class="check" data-comp-field="cover" checked />
          <span class="field-label flush">Cover</span>
        </span>
        <span class="compare-values">
          <span class="body-small dim">
            <span class="field-label">Now</span>
            ${state.cover.exists ? `${state.cover.width} × ${state.cover.height} px` : 'No cover'}
          </span>
          <span class="compare-cover">
            <span class="cover-thumb"><img src="${escapeHtml(cand.coverUrl)}" alt="" /></span>
            <span class="body-small heading">${escapeHtml(cand.source)} cover</span>
          </span>
        </span>
      </label>
    `;
  }

  container.innerHTML = html;
  const panel = document.getElementById('comparisonPanel');
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
}

function closeComparisonPanel() {
  document.getElementById('comparisonPanel')?.classList.add('hidden');
  state.selectedCandidate = null;
}

function toggleAllComparisonCheckboxes(checked) {
  document.querySelectorAll('#comparisonRowsContainer input[type="checkbox"]:not(:disabled)').forEach(cb => {
    cb.checked = checked;
  });
}

async function applySelectedMatchFields() {
  const cand = state.selectedCandidate;
  if (!cand) return;

  const checkboxes = document.querySelectorAll('#comparisonRowsContainer input[type="checkbox"]:checked');
  let appliedCount = 0;

  for (const cb of checkboxes) {
    const field = cb.getAttribute('data-comp-field');
    if (field === 'cover' && cand.coverUrl) {
      const ok = await swapCoverFromUrl(cand.coverUrl, cand.source);
      if (ok) appliedCount++;
    } else if (field === 'subjects') {
      if (Array.isArray(cand.subjects) && cand.subjects.length > 0) {
        state.meta.subjects = [...new Set([...state.meta.subjects, ...cand.subjects])];
        appliedCount++;
      }
    } else if (field && cand[field]) {
      state.meta[field] = cand[field];
      appliedCount++;
    }
  }

  populateMetadataForm();
  updateTopBanner();
  updateExportFilenamePreview();
  if (state.zip) runQualityAudit();
  closeComparisonPanel();
  showToast(`Imported ${plural(appliedCount, 'field')} from ${cand.source}.`);
}

/*************************************************************************
 * SPEC-COMPLIANT EPUB RE-PACKAGER & EXPORTER
 *************************************************************************/
async function exportUpdatedEpub() {
  if (!state.zip || !state.opfDoc) return;
  const btn = document.getElementById('bindExportBtn');
  btn.disabled = true;

  try {
    const doc = state.opfDoc;
    const zip = state.zip;

    // Optional auto-purge orphans per Settings
    if (state.config.autoPurgeOrphans && state.structure.orphanFiles.length > 0) {
      state.structure.orphanFiles.forEach(p => zip.remove(p));
      state.structure.orphanFiles = [];
    }

    // 1. Sync Dublin Core Metadata
    let metadataEl = doc.querySelector('metadata');
    if (!metadataEl) {
      metadataEl = doc.createElement('metadata');
      doc.documentElement.prepend(metadataEl);
    }

    const dcNs = 'http://purl.org/dc/elements/1.1/';
    function setOrUpdateDc(tag, value) {
      const existing = metadataEl.getElementsByTagNameNS('*', tag);
      while (existing.length > 0) existing[0].parentNode.removeChild(existing[0]);
      if (value && String(value).trim()) {
        const el = doc.createElementNS(dcNs, `dc:${tag}`);
        el.textContent = String(value).trim();
        metadataEl.appendChild(el);
      }
    }

    setOrUpdateDc('title', state.meta.title || 'Untitled');
    setOrUpdateDc('language', state.meta.language || 'en');
    setOrUpdateDc('publisher', state.meta.publisher);
    setOrUpdateDc('date', state.meta.date);
    setOrUpdateDc('description', state.meta.description);

    const existingCreators = metadataEl.getElementsByTagNameNS('*', 'creator');
    while (existingCreators.length > 0) existingCreators[0].parentNode.removeChild(existingCreators[0]);
    (state.meta.creator || '').split(',').map(s => s.trim()).filter(Boolean).forEach(author => {
      const el = doc.createElementNS(dcNs, 'dc:creator');
      el.textContent = author;
      metadataEl.appendChild(el);
    });

    if (state.meta.identifier.trim()) {
      const idEls = metadataEl.getElementsByTagNameNS('*', 'identifier');
      if (idEls.length > 0) idEls[0].textContent = state.meta.identifier.trim();
      else {
        const idEl = doc.createElementNS(dcNs, 'dc:identifier');
        idEl.setAttribute('id', 'BookId');
        idEl.textContent = state.meta.identifier.trim();
        metadataEl.appendChild(idEl);
      }
    }

    const existingSubjects = metadataEl.getElementsByTagNameNS('*', 'subject');
    while (existingSubjects.length > 0) existingSubjects[0].parentNode.removeChild(existingSubjects[0]);
    state.meta.subjects.forEach(subj => {
      const el = doc.createElementNS(dcNs, 'dc:subject');
      el.textContent = subj;
      metadataEl.appendChild(el);
    });

    metadataEl.querySelectorAll('meta[name="calibre:series"], meta[name="calibre:series_index"]').forEach(n => n.remove());
    if (state.meta.series.trim()) {
      const sMeta = doc.createElement('meta');
      sMeta.setAttribute('name', 'calibre:series');
      sMeta.setAttribute('content', state.meta.series.trim());
      metadataEl.appendChild(sMeta);
    }
    if (state.meta.seriesIndex.trim()) {
      const idxMeta = doc.createElement('meta');
      idxMeta.setAttribute('name', 'calibre:series_index');
      idxMeta.setAttribute('content', state.meta.seriesIndex.trim());
      metadataEl.appendChild(idxMeta);
    }

    // 2. Sync Cover Plate & Dual Compatibility Tags
    const manifestEl = doc.querySelector('manifest');
    if (state.cover.exists && state.cover.uint8Array && manifestEl) {
      zip.file(state.cover.fullZipPath, state.cover.uint8Array);

      let coverItemEl = Array.from(manifestEl.querySelectorAll('item')).find(
        el => el.getAttribute('id') === state.cover.manifestId || el.getAttribute('href') === state.cover.href
      );
      if (!coverItemEl) {
        coverItemEl = doc.createElement('item');
        coverItemEl.setAttribute('id', state.cover.manifestId || 'cover-image-item');
        coverItemEl.setAttribute('href', state.cover.href);
        manifestEl.appendChild(coverItemEl);
      }
      coverItemEl.setAttribute('media-type', state.cover.mediaType || 'image/jpeg');

      if (state.config.autoDualCover || state.cover.hasEpub3Prop) {
        coverItemEl.setAttribute('properties', 'cover-image');
      }
      if (state.config.autoDualCover || state.cover.hasEpub2Meta) {
        metadataEl.querySelectorAll('meta[name="cover"]').forEach(n => n.remove());
        const epub2CoverMeta = doc.createElement('meta');
        epub2CoverMeta.setAttribute('name', 'cover');
        epub2CoverMeta.setAttribute('content', coverItemEl.getAttribute('id'));
        metadataEl.appendChild(epub2CoverMeta);
      }
    }

    // 3. Apply Signature File Renaming & Spine Reordering
    const renameMap = new Map();
    const spineEl = doc.querySelector('spine');

    if (state.structure.spineChapters.length > 0 && manifestEl && spineEl) {
      Array.from(spineEl.querySelectorAll('itemref')).forEach(el => el.remove());

      for (const ch of state.structure.spineChapters) {
        const oldFullPath = ch.originalFullPath;
        const newFullPath = ch.folderPrefix + ch.newFileName;
        const newRelativeHref = getRelativePath(state.opfDir, newFullPath);

        if (oldFullPath !== newFullPath && zip.file(oldFullPath)) {
          const contentBytes = await zip.file(oldFullPath).async('uint8array');
          zip.remove(oldFullPath);
          zip.file(newFullPath, contentBytes);
          renameMap.set(ch.currentFileName, ch.newFileName);
          ch.originalFullPath = newFullPath;
          ch.currentFileName = ch.newFileName;
          ch.originalHref = newRelativeHref;
        }

        const mItemEl = Array.from(manifestEl.querySelectorAll('item')).find(
          el => el.getAttribute('id') === ch.manifestId
        );
        if (mItemEl) mItemEl.setAttribute('href', newRelativeHref);

        const itemrefEl = doc.createElement('itemref');
        itemrefEl.setAttribute('idref', ch.manifestId);
        spineEl.appendChild(itemrefEl);
      }
    }

    if (renameMap.size > 0) {
      const tocPaths = [state.structure.ncxZipPath, state.structure.navZipPath].filter(Boolean);
      for (const tocPath of tocPaths) {
        const tocEntry = zip.file(tocPath);
        if (tocEntry) {
          let tocText = await tocEntry.async('string');
          renameMap.forEach((newName, oldName) => {
            tocText = tocText.split(oldName).join(newName);
          });
          zip.file(tocPath, tocText);
        }
      }
    }

    // 4. Serialize Updated OPF XML
    const serializer = new XMLSerializer();
    zip.file(state.opfPath, serializer.serializeToString(doc));

    // 5. Repackage Archive (mimetype first & uncompressed STORE)
    const exportZip = new JSZip();
    exportZip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    const compLevel = state.config.zipCompressionLevel || 6;
    for (const p of Object.keys(zip.files)) {
      const entry = zip.files[p];
      if (entry.dir || p === 'mimetype') continue;
      const bytes = await entry.async('uint8array');
      exportZip.file(p, bytes, { compression: 'DEFLATE', compressionOptions: { level: compLevel } });
    }

    const outBlob = await exportZip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
    const downloadName = computeFormattedExportFilename();

    const link = document.createElement('a');
    link.href = URL.createObjectURL(outBlob);
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);

    state.originalMeta = JSON.parse(JSON.stringify(state.meta));
    state.cover.modified = false;
    state.structure.filesModified = false;
    state.structure.spineChapters.forEach((c, i) => { c.originalIndex = i + 1; });
    state.structure.originalSpineChapters = JSON.parse(JSON.stringify(state.structure.spineChapters));

    updateDirtyTracking();
    renderSpineOrderTable();
    runQualityAudit();
    showToast(`Bound ${downloadName}.`);
  } catch (err) {
    showToast(`Couldn't bind the EPUB (${err.message}). Your edits are still here; try again.`, { isAlert: true });
  } finally {
    btn.disabled = false;
  }
}
