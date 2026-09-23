const state = {
  games: [],
  status: 'all',
  firmware: 'all',
  language: 'all',
  sort: 'newest',
  search: ''
};

const els = {
  grid: document.querySelector('#gameGrid'),
  empty: document.querySelector('#emptyState'),
  search: document.querySelector('#searchInput'),
  firmware: document.querySelector('#firmwareFilter'),
  language: document.querySelector('#languageFilter'),
  sort: document.querySelector('#sortFilter'),
  statusFilters: document.querySelector('#statusFilters'),
  summary: document.querySelector('#activeSummary'),
  total: document.querySelector('#totalCount'),
  released: document.querySelector('#releasedCount'),
  updated: document.querySelector('#updatedAt'),
  template: document.querySelector('#gameCardTemplate'),
  modal: document.querySelector('#gameModal'),
  modalContent: document.querySelector('#modalContent'),
  modalClose: document.querySelector('#modalClose'),
  dmcaModal: document.querySelector('#dmcaModal'),
  dmcaOpen: document.querySelector('#dmcaOpen'),
  dmcaOpenFooter: document.querySelector('#dmcaOpenFooter'),
  dmcaClose: document.querySelector('#dmcaClose')
};

const normalize = value => String(value || '').trim().toLowerCase();

const FLAG_MAP = {
  ARA: "🇸🇦",
  CHI: "🇨🇳",
  CRO: "🇭🇷",
  CZE: "🇨🇿",
  DAN: "🇩🇰",
  DUT: "🇳🇱",
  ENG: "🇬🇧",
  FIN: "🇫🇮",
  FRA: "🇫🇷",
  GER: "🇩🇪",
  GRE: "🇬🇷",
  HUN: "🇭🇺",
  ITA: "🇮🇹",
  JPN: "🇯🇵",
  KOR: "🇰🇷",
  NOR: "🇳🇴",
  POL: "🇵🇱",
  POR: "🇵🇹",
  "POR-PT": "🇵🇹",
  "POR-BR": "🇧🇷",
  ROM: "🇷🇴",
  RUS: "🇷🇺",
  SPA: "🇪🇸",
  SWE: "🇸🇪",
  TUR: "🇹🇷"
};

function renderLangBadge(code, type = "text") {
  const flag = FLAG_MAP[code] || "🌐";
  return `<span class="badge lang-badge ${type === "audio" ? "audio-lang" : "text-lang"}"><span class="lang-flag" aria-hidden="true">${flag}</span><span class="lang-code">${escapeHtml(code)}</span></span>`;
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[ch]));
}

function allLanguages(game) {
  const text = Array.isArray(game.languages?.text) ? game.languages.text : [];
  const audio = Array.isArray(game.languages?.audio) ? game.languages.audio : [];
  return [...new Set([...text, ...audio])];
}

function populateFilters() {
  const firmwares = [...new Set(state.games.map(g => g.firmware).filter(Boolean))]
    .sort((a,b) => String(a).localeCompare(String(b), undefined, {numeric:true}));

  const languages = [...new Set(state.games.flatMap(allLanguages))]
    .sort((a,b) => a.localeCompare(b));

  firmwares.forEach(fw => {
    const opt = document.createElement('option');
    opt.value = fw;
    opt.textContent = fw;
    els.firmware.appendChild(opt);
  });

  languages.forEach(lang => {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = lang;
    els.language.appendChild(opt);
  });
}

function filteredGames() {
  let games = state.games.filter(game => {
    const haystack = normalize([
      game.title,
      game.titleId,
      game.version,
      game.firmware,
      ...(allLanguages(game))
    ].join(' '));

    const matchesSearch = !state.search || haystack.includes(normalize(state.search));
    const matchesStatus = state.status === 'all' || normalize(game.status) === state.status;
    const matchesFw = state.firmware === 'all' || game.firmware === state.firmware;
    const matchesLang = state.language === 'all' || allLanguages(game).includes(state.language);

    return matchesSearch && matchesStatus && matchesFw && matchesLang;
  });

  games.sort((a,b) => {
    if (state.sort === 'az') return a.title.localeCompare(b.title);
    if (state.sort === 'za') return b.title.localeCompare(a.title);
    const ad = new Date(a.date || 0).getTime();
    const bd = new Date(b.date || 0).getTime();
    return bd - ad;
  });

  return games;
}

function badge(text) {
  const el = document.createElement('span');
  const key = normalize(text);
  el.className = 'badge';
  if (key.startsWith('fw ')) el.classList.add('badge-fw');
  if (key === 'dlc') el.classList.add('badge-dlc');
  if (key === 'ita audio') el.classList.add('badge-audio');
  if (key === 'ita text') el.classList.add('badge-text');
  el.textContent = text;
  return el;
}

function render() {
  const games = filteredGames();
  els.grid.innerHTML = '';
  els.empty.hidden = games.length !== 0;

  for (const game of games) {
    const node = els.template.content.cloneNode(true);
    const card = node.querySelector('.game-card');
    const open = node.querySelector('.card-open');
    const coverWrap = node.querySelector('.cover-wrap');
    const cover = node.querySelector('.cover');
    const fallback = node.querySelector('.cover-fallback');
    const status = node.querySelector('.status-badge');
    const title = node.querySelector('.game-title');
    const id = node.querySelector('.game-id');
    const badges = node.querySelector('.badges');

    title.textContent = game.title;
    id.textContent = [game.titleId, game.version].filter(Boolean).join(' • ');
    status.textContent = normalize(game.status) === 'released' ? 'RELEASED' : 'SOON';
    status.classList.add(normalize(game.status) === 'released' ? 'released' : 'soon');

    if (game.cover) {
      coverWrap.style.setProperty('--cover-image', `url("${game.cover.replace(/"/g, '%22')}")`);
      coverWrap.classList.add('has-cover');
      cover.src = game.cover;
      cover.alt = `${game.title} cover`;
      cover.referrerPolicy = 'no-referrer';
      cover.addEventListener('load', () => {
        if (fallback) fallback.hidden = true;
        coverWrap.classList.add('cover-loaded');
      });
      cover.addEventListener('error', () => {
        cover.hidden = true;
        if (fallback) fallback.hidden = false;
        coverWrap.classList.remove('cover-loaded');
      });
    } else {
      cover.hidden = true;
      if (fallback) fallback.hidden = false;
    }

    if (game.firmware) badges.appendChild(badge(`FW ${game.firmware}`));
    if (game.dlcAvailable) badges.appendChild(badge('DLC'));
    if (game.languages?.audio?.includes('ITA')) badges.appendChild(badge('ITA AUDIO'));
    else if (game.languages?.text?.includes('ITA')) badges.appendChild(badge('ITA TEXT'));

    open.addEventListener('click', () => openModal(game));
    card.dataset.titleId = game.titleId || '';
    els.grid.appendChild(node);
  }

  const pieces = [`${games.length} result${games.length === 1 ? '' : 's'}`];
  if (state.status !== 'all') pieces.push(state.status);
  if (state.firmware !== 'all') pieces.push(`FW ${state.firmware}`);
  if (state.language !== 'all') pieces.push(state.language);
  els.summary.textContent = pieces.join(' • ');
}

function openDmca() {
  if (els.dmcaModal) els.dmcaModal.showModal();
}

function openModal(game) {
  const textLangs = (game.languages?.text || []).map(x => renderLangBadge(x, "text")).join('');
  const audioLangs = (game.languages?.audio || []).map(x => renderLangBadge(x, "audio")).join('');

  const cover = game.cover
    ? `<img src="${escapeHtml(game.cover)}" alt="${escapeHtml(game.title)} cover">`
    : '';

  const actions = [];
  if (game.purchaseUrl) actions.push(`<a class="action game-download" href="${escapeHtml(game.purchaseUrl)}" target="_blank" rel="noopener noreferrer"><span class="download-dot"></span>${escapeHtml(game.downloadLabel || 'DOWNLOAD GAME')}</a>`);
  if (game.dlcUrl) actions.push(`<a class="action dlc-download" href="${escapeHtml(game.dlcUrl)}" target="_blank" rel="noopener noreferrer">DOWNLOAD DLC</a>`);
  if (game.infoUrl) actions.push(`<a class="action" href="${escapeHtml(game.infoUrl)}" target="_blank" rel="noopener">Official info</a>`);

  els.modalContent.innerHTML = `
    <div class="modal-layout">
      <div class="modal-art" ${game.cover ? `style="--modal-cover:url('${escapeHtml(game.cover).replace(/'/g, '%27')}')"` : ''}>${cover}</div>
      <div class="modal-info">
        <div class="eyebrow">${normalize(game.status) === 'released' ? 'RELEASED' : 'COMING SOON'}</div>
        <h2>${escapeHtml(game.title)}</h2>
        <div class="modal-sub">${escapeHtml(game.titleId || '')}</div>

        <div class="detail-grid">
          <div class="detail"><span>Version</span><strong>${escapeHtml(game.version || '—')}</strong></div>
          <div class="detail"><span>Firmware</span><strong>${escapeHtml(game.firmware || '—')}</strong></div>
          <div class="detail"><span>${escapeHtml(game.sizeLabel || 'Size')}</span><strong>${escapeHtml(game.size || '—')}</strong></div>
          <div class="detail"><span>Date</span><strong>${escapeHtml(game.date || '—')}</strong></div>
        </div>

        <div class="lang-block">
          <h4>Text languages</h4>
          <div class="lang-list">${textLangs || '<span class="badge">—</span>'}</div>
        </div>

        <div class="lang-block">
          <h4>Audio languages</h4>
          <div class="lang-list">${audioLangs || '<span class="badge">—</span>'}</div>
        </div>

        ${game.notes ? `<div class="modal-notes">${escapeHtml(game.notes)}</div>` : ''}
        ${actions.length ? `<div class="modal-actions">${actions.join('')}</div>` : ''}
      </div>
    </div>
  `;

  els.modal.showModal();
}

async function init() {
  try {
    const res = await fetch('games.json', {cache:'no-store'});
    if (!res.ok) throw new Error('Could not load games.json');
    const data = await res.json();
    state.games = Array.isArray(data.games) ? data.games : [];

    els.total.textContent = state.games.length;
    els.released.textContent = state.games.filter(g => normalize(g.status) === 'released').length;
    els.updated.textContent = data.updated || '—';

    populateFilters();
    render();
  } catch (err) {
    console.error(err);
    els.grid.innerHTML = '<div class="empty-state"><h2>Catalog unavailable</h2><p>Check games.json.</p></div>';
  }
}

els.search.addEventListener('input', e => { state.search = e.target.value; render(); });
els.firmware.addEventListener('change', e => { state.firmware = e.target.value; render(); });
els.language.addEventListener('change', e => { state.language = e.target.value; render(); });
els.sort.addEventListener('change', e => { state.sort = e.target.value; render(); });

els.statusFilters.addEventListener('click', e => {
  const button = e.target.closest('[data-status]');
  if (!button) return;
  state.status = button.dataset.status;
  els.statusFilters.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === button));
  render();
});

document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== els.search) {
    e.preventDefault();
    els.search.focus();
  }
  if (e.key === 'Escape' && els.modal.open) els.modal.close();
  if (e.key === 'Escape' && els.dmcaModal?.open) els.dmcaModal.close();
});

els.modalClose.addEventListener('click', () => els.modal.close());

if (els.dmcaOpen) els.dmcaOpen.addEventListener('click', openDmca);
if (els.dmcaOpenFooter) els.dmcaOpenFooter.addEventListener('click', openDmca);
if (els.dmcaClose) els.dmcaClose.addEventListener('click', () => els.dmcaModal.close());
if (els.dmcaModal) {
  els.dmcaModal.addEventListener('click', e => {
    const rect = els.dmcaModal.getBoundingClientRect();
    const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inside) els.dmcaModal.close();
  });
}
els.modal.addEventListener('click', e => {
  const rect = els.modal.getBoundingClientRect();
  const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  if (!inside) els.modal.close();
});

init();