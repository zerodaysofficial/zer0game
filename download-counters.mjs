export const COUNTER_BASE = 'https://api.countapi.xyz';
export const COUNTER_NAMESPACE = 'zer0game.github.io';

function sanitizeCounterPart(value) {
  const normalized = String(value || '')
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');

  return normalized || 'unknown';
}

export function counterKey(identity = {}, kind = 'game') {
  const safeKind = kind === 'cheat' ? 'cheat' : 'game';
  const rawBase = identity.titleId || identity.title || 'unknown';
  const base = sanitizeCounterPart(rawBase);
  const maxBaseLength = 64 - safeKind.length - 1;
  return `${base.slice(0, maxBaseLength)}-${safeKind}`;
}

export function counterUrl(operation, key) {
  const op = operation === 'hit' ? 'hit' : 'get';
  return `${COUNTER_BASE}/${op}/${COUNTER_NAMESPACE}/${encodeURIComponent(key)}`;
}

export function formatDownloadCount(value) {
  const count = Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0;
  const formatted = new Intl.NumberFormat('en-US').format(count);
  return `${formatted} ${count === 1 ? 'click' : 'clicks'}`;
}

export function classifyDownloadTarget(classNames = []) {
  const classes = new Set(Array.from(classNames));
  if (classes.has('cheat-download') || classes.has('quick-cheat')) return 'cheat';
  if (classes.has('game-download') || classes.has('quick-akia')) return 'game';
  return null;
}

async function fetchCounter(operation, key) {
  const response = await fetch(counterUrl(operation, key), {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
    keepalive: operation === 'hit'
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_) {}

  if (response.status === 404 || Number(data?.status) === 404) return 0;
  if (!response.ok) throw new Error(`Counter request failed: ${response.status}`);

  const value = Number(data?.value);
  return Number.isFinite(value) ? value : 0;
}

export async function readCounter(key) {
  return fetchCounter('get', key);
}

export async function incrementCounter(key) {
  return fetchCounter('hit', key);
}

function injectCounterStyles() {
  if (document.querySelector('#zer0game-download-counter-styles')) return;

  const style = document.createElement('style');
  style.id = 'zer0game-download-counter-styles';
  style.textContent = `
    .download-count-badge{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:46px;
      padding:0 13px;
      border:1px solid rgba(255,255,255,.12);
      border-radius:12px;
      color:#aeb8ca;
      background:rgba(13,17,27,.78);
      box-shadow:0 8px 24px rgba(0,0,0,.14);
      font-size:10px;
      font-weight:800;
      letter-spacing:.06em;
      white-space:nowrap;
      user-select:none;
    }
    .download-count-badge[data-counter-kind="game"]{
      border-color:rgba(93,255,182,.22);
      color:#8df5ca;
    }
    .download-count-badge[data-counter-kind="cheat"]{
      border-color:rgba(139,92,255,.32);
      color:#c9bbff;
    }
    @media(max-width:680px){
      .download-count-badge{
        min-height:38px;
        padding:0 11px;
        font-size:9px;
      }
    }
  `;
  document.head.appendChild(style);
}

function modalIdentity(modalContent) {
  return {
    titleId: modalContent.querySelector('.modal-sub')?.textContent?.trim() || '',
    title: modalContent.querySelector('h2')?.textContent?.trim() || ''
  };
}

function cardIdentity(anchor) {
  const card = anchor.closest('.game-card');
  return {
    titleId: card?.dataset?.titleId?.trim() || '',
    title: card?.querySelector('.game-title')?.textContent?.trim() || ''
  };
}

function updateVisibleBadges(key, value) {
  document.querySelectorAll(`.download-count-badge[data-counter-key="${CSS.escape(key)}"]`).forEach(badge => {
    badge.textContent = formatDownloadCount(value);
    badge.dataset.counterLoaded = 'true';
  });
}

async function attachCounterBadge(action, identity, kind) {
  if (!action || action.dataset.counterDecorated === 'true') return;

  const key = counterKey(identity, kind);
  action.dataset.counterKey = key;
  action.dataset.counterKind = kind;
  action.dataset.counterDecorated = 'true';

  const badge = document.createElement('span');
  badge.className = 'download-count-badge';
  badge.dataset.counterKey = key;
  badge.dataset.counterKind = kind;
  badge.textContent = '… clicks';
  badge.setAttribute('aria-live', 'polite');
  action.insertAdjacentElement('afterend', badge);

  try {
    const value = await readCounter(key);
    updateVisibleBadges(key, value);
  } catch (error) {
    console.warn('[ZER0GAME] Could not load download counter', error);
    badge.textContent = '— clicks';
  }
}

export function decorateModalCounters(modalContent = document.querySelector('#modalContent')) {
  if (!modalContent) return;
  const identity = modalIdentity(modalContent);
  if (!identity.titleId && !identity.title) return;

  const gameAction = modalContent.querySelector('.game-download');
  const cheatAction = modalContent.querySelector('.cheat-download');

  if (gameAction) attachCounterBadge(gameAction, identity, 'game');
  if (cheatAction) attachCounterBadge(cheatAction, identity, 'cheat');
}

function handleDownloadClick(event) {
  const anchor = event.target.closest('a');
  if (!anchor) return;

  const kind = classifyDownloadTarget(anchor.classList);
  if (!kind) return;

  const modalContent = anchor.closest('#modalContent');
  const identity = modalContent ? modalIdentity(modalContent) : cardIdentity(anchor);
  const key = anchor.dataset.counterKey || counterKey(identity, kind);

  incrementCounter(key)
    .then(value => updateVisibleBadges(key, value))
    .catch(error => console.warn('[ZER0GAME] Could not increment download counter', error));
}

function startDownloadCounters() {
  injectCounterStyles();

  const modalContent = document.querySelector('#modalContent');
  if (modalContent) {
    decorateModalCounters(modalContent);
    const observer = new MutationObserver(() => decorateModalCounters(modalContent));
    observer.observe(modalContent, { childList: true, subtree: true });
  }

  document.addEventListener('click', handleDownloadClick, true);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startDownloadCounters, { once: true });
  } else {
    startDownloadCounters();
  }
}
