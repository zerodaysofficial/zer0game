const state = {
  games: [],
  status: 'all',
  firmware: 'all',
  language: 'all',
  category: 'all',
  sort: 'newest',
  search: '',
  page: 1,
  pageSize: 21
};

const els = {
  grid: document.querySelector('#gameGrid'),
  empty: document.querySelector('#emptyState'),
  search: document.querySelector('#searchInput'),
  firmware: document.querySelector('#firmwareFilter'),
  language: document.querySelector('#languageFilter'),
  category: document.querySelector('#categoryFilter'),
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
  dmcaClose: document.querySelector('#dmcaClose'),
  pagination: document.querySelector('#pagination'),
  prevPage: document.querySelector('#prevPage'),
  nextPage: document.querySelector('#nextPage'),
  pageNumbers: document.querySelector('#pageNumbers'),
  pageInfo: document.querySelector('#pageInfo')
};

const normalize = value => String(value || '').trim().toLowerCase();

const FLAG_MAP = {
  ARA: "🇸🇦",
  CHI: "🇨🇳",
  "CHI-S": "🇨🇳",
  "CHI-T": "🇹🇼",
  CRO: "🇭🇷",
  CZE: "🇨🇿",
  DAN: "🇩🇰",
  DUT: "🇳🇱",
  ENG: "🇬🇧",
  FIN: "🇫🇮",
  FRA: "🇫🇷",
  "FRA-CA": "🇨🇦",
  GER: "🇩🇪",
  GRE: "🇬🇷",
  HUN: "🇭🇺",
  IND: "🇮🇩",
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
  "SPA-MX": "🇲🇽",
  SWE: "🇸🇪",
  TUR: "🇹🇷",
  UKR: "🇺🇦",
  VIE: "🇻🇳"
};

function renderLangBadge(code, type = "text") {
  const flag = FLAG_MAP[code] || "🌐";
  return `<span class="badge lang-badge ${type === "audio" ? "audio-lang" : "text-lang"}"><span class="lang-flag" aria-hidden="true">${flag}</span><span class="lang-code">${escapeHtml(code)}</span></span>`;
}

function ps5CaseHeaderMarkup() {
  return '<div class="ps5-case-header" aria-hidden="true"><img class="ps5-logo-img" src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/PlayStation_5_logo_and_wordmark.svg/960px-PlayStation_5_logo_and_wordmark.svg.png" alt=""></div>';
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

function allGenres(game) {
  return Array.isArray(game.genres) ? game.genres.filter(Boolean) : [];
}

function canonicalFirmware(value) {
  const raw = String(value || '').trim();
  const key = raw.toLowerCase().replace(/\s+/g, ' ');

  if (key === '2.xx and above' || key === '2.xx and beyond') return '2.xx+';
  if (key === '4.xx backpork' || key === '4.xx backport') return '4.xx BackPort';

  return raw;
}

function zer0dayLockUrl(targetUrl) {
  try {
    const bytes = new TextEncoder().encode(targetUrl);
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return `lock.html?v=reactlock2#${btoa(binary)}`;
  } catch {
    return `lock.html?v=reactlock2&to=${encodeURIComponent(targetUrl)}`;
  }
}

function downloadSourceLabel(url) {
  const value = String(url || '').trim().toLowerCase();
  if (!value) return 'DOWNLOAD';

  if (value.includes('1024terabox.com') || value.includes('terabox.com')) return 'TERABOX';
  if (value.includes('akirabox.com') || value.includes('akirabox.to')) return 'AKIA';
  if (value.includes('vik1ngfile.site')) return 'VIKI';
  if (value.includes('fuckingfast.net')) return 'FUCKINGFAST';
  if (value.includes('datavaults.co')) return 'DATAVAULTS';
  if (value.includes('datanodes.to')) return 'DATANODES';
  if (value.includes('tinyurl.com')) return 'SHORT LINK';
  if (value.includes('urlvanish.com')) return 'SHORT LINK';

  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host) return host.split('.')[0].toUpperCase();
  } catch (_) {}

  return 'DOWNLOAD';
}


function cardTone(game) {
  const genres = allGenres(game).map(normalize);
  if (genres.includes('horror')) return 'tone-magenta';
  if (genres.includes('sports')) return 'tone-emerald';
  if (genres.includes('fighting')) return 'tone-crimson';
  if (genres.includes('rpg')) return 'tone-violet';

  const seed = [...String(game.title || '')].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return ['tone-cyan','tone-violet','tone-indigo'][seed % 3];
}

function versionLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return /^v/i.test(raw) ? raw : `v${raw}`;
}

function populateFilters() {
  const firmwares = [...new Set(state.games.map(g => canonicalFirmware(g.firmware)).filter(Boolean))]
    .sort((a,b) => String(a).localeCompare(String(b), undefined, {numeric:true}));

  const languages = [...new Set(state.games.flatMap(allLanguages))]
    .sort((a,b) => a.localeCompare(b));

  const categories = [...new Set(state.games.flatMap(allGenres))]
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

  categories.forEach(category => {
    const opt = document.createElement('option');
    opt.value = category;
    opt.textContent = category;
    els.category.appendChild(opt);
  });
}

function filteredGames() {
  let games = state.games.filter(game => {
    const haystack = normalize([
      game.title,
      game.titleId,
      game.version,
      game.firmware,
      ...(allLanguages(game)),
      ...(allGenres(game))
    ].join(' '));

    const matchesSearch = !state.search || haystack.includes(normalize(state.search));
    const matchesStatus = state.status === 'all' || normalize(game.status) === state.status;
    const matchesFw = state.firmware === 'all' || canonicalFirmware(game.firmware) === state.firmware;
    const matchesLang = state.language === 'all' || allLanguages(game).includes(state.language);
    const matchesCategory = state.category === 'all' || allGenres(game).includes(state.category);

    return matchesSearch && matchesStatus && matchesFw && matchesLang && matchesCategory;
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

function renderPagination(totalItems) {
  if (!els.pagination || !els.prevPage || !els.nextPage || !els.pageNumbers || !els.pageInfo) return;

  const totalPages = Math.max(1, Math.ceil(totalItems / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), totalPages);

  els.pagination.hidden = totalItems === 0 || totalPages <= 1;
  els.prevPage.disabled = state.page === 1;
  els.nextPage.disabled = state.page === totalPages;
  els.pageInfo.textContent = `Page ${state.page} of ${totalPages}`;
  els.pageNumbers.innerHTML = '';

  const pages = [];
  if (totalPages <= 7) {
    for (let page = 1; page <= totalPages; page++) pages.push(page);
  } else {
    pages.push(1);
    const start = Math.max(2, state.page - 2);
    const end = Math.min(totalPages - 1, state.page + 2);
    if (start > 2) pages.push('ellipsis-start');
    for (let page = start; page <= end; page++) pages.push(page);
    if (end < totalPages - 1) pages.push('ellipsis-end');
    pages.push(totalPages);
  }

  for (const value of pages) {
    if (typeof value !== 'number') {
      const dots = document.createElement('span');
      dots.className = 'page-ellipsis';
      dots.textContent = '…';
      els.pageNumbers.appendChild(dots);
      continue;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'page-number';
    button.textContent = String(value);
    button.setAttribute('aria-label', `Go to page ${value}`);

    if (value === state.page) {
      button.classList.add('active');
      button.setAttribute('aria-current', 'page');
    }

    button.addEventListener('click', () => {
      if (state.page === value) return;
      state.page = value;
      render();
      document.querySelector('#library')?.scrollIntoView({behavior:'smooth', block:'start'});
    });

    els.pageNumbers.appendChild(button);
  }
}

function render() {
  const games = filteredGames();
  const totalPages = Math.max(1, Math.ceil(games.length / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const startIndex = (state.page - 1) * state.pageSize;
  const pageGames = games.slice(startIndex, startIndex + state.pageSize);

  els.grid.innerHTML = '';
  els.empty.hidden = games.length !== 0;

  for (const game of pageGames) {
    const node = els.template.content.cloneNode(true);
    const card = node.querySelector('.game-card');
    const open = node.querySelector('.card-open');
    const coverWrap = node.querySelector('.cover-wrap');
    const cover = node.querySelector('.cover');
    const fallback = node.querySelector('.cover-fallback');
    const status = node.querySelector('.status-badge');
    const title = node.querySelector('.game-title');
    const badges = node.querySelector('.badges');

    const titleId = node.querySelector('.card-titleid');
    const version = node.querySelector('.card-version');
    const region = node.querySelector('.card-region');
    const fpkgSize = node.querySelector('.card-fpkg-size');
    const fullSize = node.querySelector('.card-full-size');
    const quickAkia = node.querySelector('.quick-akia');
    const quickDlc = node.querySelector('.quick-dlc');
    const downloadBlock = node.querySelector('.card-download-block');
    const downloadLabel = node.querySelector('.download-section-label');

    card.classList.add(cardTone(game));
    title.textContent = game.title;
    titleId.textContent = game.titleId || '';
    titleId.hidden = !game.titleId;
    version.textContent = versionLabel(game.version) || 'VERSION —';
    region.textContent = game.region || 'REGION —';

    const primarySize = game.fpkgSize || game.size || '';
    fpkgSize.textContent = primarySize ? `${primarySize} FPKG` : 'SIZE —';

    if (game.fullSize && game.fullSize !== primarySize) {
      fullSize.textContent = game.fullSize;
    } else {
      fullSize.hidden = true;
    }

    status.textContent = normalize(game.status) === 'released' ? 'RELEASED' : 'SOON';
    status.classList.add(normalize(game.status) === 'released' ? 'released' : 'soon');

    if (game.ps5Frame) {
      coverWrap.classList.add('ps5-case-card');
      if (game.coverFit === 'cover') coverWrap.classList.add('cover-fit-cover');
      coverWrap.insertAdjacentHTML('afterbegin', ps5CaseHeaderMarkup());
    }

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

    if (game.firmware) badges.appendChild(badge(`FW ${canonicalFirmware(game.firmware)}`));
    if (allGenres(game).length) {
      const categoryBadge = badge(allGenres(game)[0]);
      categoryBadge.classList.add('badge-category');
      badges.appendChild(categoryBadge);
    }
    if (game.dlcDirectUrl) badges.appendChild(badge('DLC'));
    if (game.languages?.audio?.includes('ITA')) badges.appendChild(badge('ITA AUDIO'));
    else if (game.languages?.text?.includes('ITA')) badges.appendChild(badge('ITA TEXT'));

    downloadLabel.textContent = game.directUrl ? 'GAME DOWNLOAD:' : 'DOWNLOAD:';

    if (game.directUrl) {
      const source = downloadSourceLabel(game.directUrl);
      quickAkia.textContent = source;
      quickAkia.setAttribute('aria-label', `Download game from ${source}`);
      quickAkia.href = zer0dayLockUrl(game.directUrl);
    } else {
      quickAkia.hidden = true;
    }

    if (game.dlcDirectUrl) {
      card.classList.add('has-separate-dlc');
      const dlcSource = downloadSourceLabel(game.dlcDirectUrl);
      quickDlc.textContent = `DLC · ${dlcSource}`;
      quickDlc.setAttribute('aria-label', `Download DLC from ${dlcSource}`);
      quickDlc.href = zer0dayLockUrl(game.dlcDirectUrl);
    } else {
      quickDlc.hidden = true;
    }

    if (!game.directUrl && !game.dlcDirectUrl) {
      downloadBlock.hidden = true;
    }

    open.addEventListener('click', () => {
      if (card.classList.contains('card-launching')) return;

      card.classList.add('card-launching');
      open.disabled = true;

      window.setTimeout(() => {
        card.classList.remove('card-launching');
        open.disabled = false;
        openModal(game);
      }, 360);
    });

    card.dataset.titleId = game.titleId || '';
    els.grid.appendChild(node);
  }

  renderPagination(games.length);

  const pieces = [`${games.length} result${games.length === 1 ? '' : 's'}`];
  if (games.length) pieces.push(`Page ${state.page} of ${totalPages}`);
  if (state.status !== 'all') pieces.push(state.status);
  if (state.firmware !== 'all') pieces.push(`FW ${state.firmware}`);
  if (state.language !== 'all') pieces.push(state.language);
  if (state.category !== 'all') pieces.push(state.category);
  els.summary.textContent = pieces.join(' • ');
}

function openDmca() {
  if (els.dmcaModal) els.dmcaModal.showModal();
}

function openModal(game) {
  const textLangs = (game.languages?.text || []).map(x => renderLangBadge(x, "text")).join('');
  const audioLangs = (game.languages?.audio || []).map(x => renderLangBadge(x, "audio")).join('');
  const genreBadges = allGenres(game).map(x => `<span class="badge genre-badge">${escapeHtml(x)}</span>`).join('');

  const cover = game.cover
    ? (game.ps5Frame
      ? `<div class="ps5-modal-case${game.coverFit === 'cover' ? ' cover-fit-cover' : ''}">${ps5CaseHeaderMarkup()}<img src="${escapeHtml(game.cover)}" alt="${escapeHtml(game.title)} cover"></div>`
      : `<img src="${escapeHtml(game.cover)}" alt="${escapeHtml(game.title)} cover">`)
    : '';

  const actions = [];
  const gameDownloadUrl = game.directUrl || '';
  const dlcDownloadUrl = game.dlcDirectUrl || '';

  if (gameDownloadUrl) actions.push(`<a class="action game-download" href="${escapeHtml(zer0dayLockUrl(gameDownloadUrl))}"><span class="download-dot"></span>${escapeHtml(game.downloadLabel || 'DOWNLOAD GAME')}</a>`);
  if (dlcDownloadUrl) actions.push(`<a class="action dlc-download" href="${escapeHtml(zer0dayLockUrl(dlcDownloadUrl))}">DOWNLOAD DLC</a>`);
  if (game.infoUrl) actions.push(`<a class="action" href="${escapeHtml(game.infoUrl)}" target="_blank" rel="noopener">LINK</a>`);

  els.modalContent.innerHTML = `
    <div class="modal-layout">
      <div class="modal-art" ${game.cover ? `style="--modal-cover:url('${escapeHtml(game.cover).replace(/'/g, '%27')}')"` : ''}>${cover}</div>
      <div class="modal-info">
        <div class="modal-scroll">
          <div class="eyebrow">${normalize(game.status) === 'released' ? 'RELEASED' : 'COMING SOON'}</div>
          <h2>${escapeHtml(game.title)}</h2>
          <div class="modal-sub">${escapeHtml(game.titleId || '')}</div>

          <div class="detail-grid">
            <div class="detail"><span>Version</span><strong>${escapeHtml(game.version || '—')}</strong></div>
            <div class="detail"><span>Firmware</span><strong>${escapeHtml(game.firmware || '—')}</strong></div>
            <div class="detail"><span>${escapeHtml(game.sizeLabel || 'Size')}</span><strong>${escapeHtml(game.size || '—')}</strong></div>
            <div class="detail"><span>Date</span><strong>${escapeHtml(game.date || '—')}</strong></div>
          </div>

          <div class="lang-block genre-block">
            <h4>Categories</h4>
            <div class="lang-list genre-list">${genreBadges || '<span class="badge">—</span>'}</div>
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
        </div>
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

els.search.addEventListener('input', e => { state.search = e.target.value; state.page = 1; render(); });
els.firmware.addEventListener('change', e => { state.firmware = e.target.value; state.page = 1; render(); });
els.language.addEventListener('change', e => { state.language = e.target.value; state.page = 1; render(); });
els.category.addEventListener('change', e => { state.category = e.target.value; state.page = 1; render(); });
els.sort.addEventListener('change', e => { state.sort = e.target.value; state.page = 1; render(); });

els.statusFilters.addEventListener('click', e => {
  const button = e.target.closest('[data-status]');
  if (!button) return;
  state.status = button.dataset.status;
  state.page = 1;
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

if (els.prevPage) {
  els.prevPage.addEventListener('click', () => {
    if (state.page <= 1) return;
    state.page -= 1;
    render();
    document.querySelector('#library')?.scrollIntoView({behavior:'smooth', block:'start'});
  });
}

if (els.nextPage) {
  els.nextPage.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(filteredGames().length / state.pageSize));
    if (state.page >= totalPages) return;
    state.page += 1;
    render();
    document.querySelector('#library')?.scrollIntoView({behavior:'smooth', block:'start'});
  });
}

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


function runHeroTypewriter() {
  const line1 = document.querySelector('#heroTypeLine1');
  const line2 = document.querySelector('#heroTypeLine2');
  const cursor1 = document.querySelector('#heroCursor1');
  const cursor2 = document.querySelector('#heroCursor2');
  const heading = document.querySelector('.hero-typewriter');
  if (!line1 || !line2 || !cursor1 || !cursor2 || !heading) return;

  const first = 'Your library.';
  const second = 'Zero clutter.';
  let cycleToken = 0;

  const sleep = ms => new Promise(resolve => window.setTimeout(resolve, ms));

  const setCursor = active => {
    cursor1.classList.toggle('active', active === 1);
    cursor2.classList.toggle('active', active === 2);
  };

  const typeText = async (element, text, baseDelay, token) => {
    for (let i = 0; i < text.length; i++) {
      if (token !== cycleToken) return false;
      element.textContent += text[i];

      const ch = text[i];
      const delay =
        ch === '.' ? 210 :
        ch === ' ' ? 60 :
        baseDelay + ((i % 4) * 9);

      await sleep(delay);
    }
    return true;
  };

  const playCycle = async () => {
    const token = ++cycleToken;

    heading.classList.remove('typewriter-fade');
    heading.classList.add('typewriter-running');
    line1.textContent = '';
    line2.textContent = '';
    setCursor(1);

    await sleep(420);
    if (!(await typeText(line1, first, 72, token))) return;

    await sleep(440);
    if (token !== cycleToken) return;
    setCursor(2);

    if (!(await typeText(line2, second, 78, token))) return;

    await sleep(2600);
    if (token !== cycleToken) return;
    setCursor(0);
    heading.classList.add('typewriter-fade');

    await sleep(520);
    if (token !== cycleToken) return;
    heading.classList.remove('typewriter-fade');

    await sleep(520);
    if (token !== cycleToken) return;
    playCycle();
  };

  playCycle();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      cycleToken++;
      line1.textContent = first;
      line2.textContent = second;
      setCursor(0);
      window.setTimeout(playCycle, 700);
    }
  });
}

runHeroTypewriter();

init();