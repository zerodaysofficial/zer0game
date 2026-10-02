export const REPOSITORY_OWNER = 'zerodaysofficial';
export const REPOSITORY_NAME = 'zer0game';

const MAX_TEXT_LENGTH = 8000;
const PLAYSTATION_STORE_API = 'https://store.playstation.com/store/api/chihiro/00_09_000';
const LIBRARY_IMAGE_HOST = 'pub-ce6b40c14d144a128552570bcf6bb628.r2.dev';
const COVER_LIBRARY_URLS = [
  'https://pippo26442999.github.io/.exFAT/exFAT.json',
  'https://raw.githubusercontent.com/Pippo26442999/.exFAT/main/exFAT.json'
];

function cleanText(value, field, required = false) {
  const text = String(value ?? '').trim();
  if (required && !text) throw new Error(field + ' is required.');
  if (text.length > MAX_TEXT_LENGTH) throw new Error(field + ' is too long.');
  return text;
}

function cleanLink(value) {
  let url;
  try {
    url = new URL(String(value ?? '').trim());
  } catch {
    throw new Error('Enter a valid HTTPS link.');
  }

  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new Error('LINK must use HTTPS and cannot contain embedded credentials.');
  }
  return url.href;
}

function cleanCoverPath(value) {
  const path = String(value ?? '').trim();
  if (/^covers\/[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp)$/i.test(path)) return path;

  const remoteCover = safePlayStationImageUrl(path) || safeLibraryImageUrl(path);
  if (remoteCover) return remoteCover;

  throw new Error('Upload a PNG, JPEG or WebP cover, or use a cover found by PPSA.');
}

function normalizePpsa(value) {
  const titleId = String(value ?? '').trim().toUpperCase().replace(/_00$/, '');
  if (!/^PPSA\d{5}$/.test(titleId)) throw new Error('Inserisci un Title ID PS5 valido (es. PPSA28997).');
  return titleId;
}

function safePlayStationImageUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    const hostname = url.hostname.toLowerCase();
    const isPlayStationHost = hostname === 'playstation.com' || hostname.endsWith('.playstation.com')
      || hostname.endsWith('.dl.playstation.net');
    return url.protocol === 'https:' && isPlayStationHost && !url.username && !url.password
      ? url.href
      : '';
  } catch {
    return '';
  }
}

function safeLibraryImageUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'https:' && url.hostname.toLowerCase() === LIBRARY_IMAGE_HOST
      && url.pathname.startsWith('/exFAT/') && /\.(avif|png|jpe?g|webp)$/i.test(url.pathname)
      && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

export function extractLibraryCover(payload, titleId) {
  const ppsa = normalizePpsa(titleId);
  if (!Array.isArray(payload)) return null;
  for (const game of payload) {
    const tags = Array.isArray(game?.tags) ? game.tags : [];
    const identifiers = [game?.titleId, ...tags].flatMap(value =>
      String(value ?? '').toUpperCase().match(/\bPPSA\d{5}(?:_00)?\b/g) ?? []
    );
    if (!identifiers.some(value => value.replace(/_00$/, '') === ppsa)) continue;
    const imageUrl = safeLibraryImageUrl(game.image);
    if (imageUrl) return { title: String(game.title ?? 'Gioco trovato').trim(), imageUrl };
  }
  return null;
}

export function buildPsStoreCoverSearchUrls(titleId) {
  const ppsa = normalizePpsa(titleId);
  const encodedPpsa = encodeURIComponent(ppsa);
  return [
    `${PLAYSTATION_STORE_API}/container/us/en/999/${encodedPpsa}_00?size=999`,
    `${PLAYSTATION_STORE_API}/tumbler/us/en/999/${encodedPpsa}?size=10&gkb=1&start=0&mode=game`
  ];
}

export function extractPsStoreCover(payload) {
  const products = Array.isArray(payload?.links)
    ? payload.links
    : Array.isArray(payload?.results)
      ? payload.results
      : payload && typeof payload === 'object'
        ? [payload]
        : [];

  const productRank = product => {
    const types = Array.isArray(product?.gameContentTypesList) ? product.gameContentTypesList : [];
    if (types.some(type => type?.key === 'FULL_GAME')) return 0;
    if (types.some(type => type?.key === 'BUNDLE')) return 1;
    return types.length ? 3 : 2;
  };
  for (const product of [...products].sort((a, b) => productRank(a) - productRank(b))) {
    if (productRank(product) === 3) continue;
    const rawImages = product?.images ?? product?.media?.images ?? product?.coverImages ?? [];
    const images = Array.isArray(rawImages) ? rawImages : [rawImages];
    const orderedImages = [...images].sort((a, b) => {
      const rank = image => /master|cover/i.test(String(image?.type ?? '')) ? 0 : 1;
      return rank(a) - rank(b);
    });
    const imageUrl = orderedImages
      .map(image => typeof image === 'string' ? image : image?.url ?? image?.imageUrl ?? image?.href)
      .map(safePlayStationImageUrl)
      .find(Boolean);

    if (imageUrl) {
      return {
        title: String(product?.name ?? product?.title ?? product?.localizedName ?? 'Gioco trovato').trim(),
        imageUrl
      };
    }
  }

  return null;
}

export async function searchCoverByPpsa(titleId, {
  fetchImpl = globalThis.fetch,
  verifyImage = async () => true,
  signal
} = {}) {
  const storeUrls = buildPsStoreCoverSearchUrls(titleId);
  const sources = [
    ...COVER_LIBRARY_URLS.map(url => ({ url, extract: payload => extractLibraryCover(payload, titleId) })),
    ...storeUrls.map(url => ({ url, extract: extractPsStoreCover }))
  ];
  let reachable = false;
  for (const source of sources) {
    signal?.throwIfAborted();
    try {
      const timeout = AbortSignal.timeout(8000);
      const response = await fetchImpl(source.url, {
        cache: 'no-store',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout
      });
      if (!response.ok) continue;
      const payload = await response.json();
      reachable = true;
      const result = source.extract(payload);
      if (result && await verifyImage(result.imageUrl)) {
        signal?.throwIfAborted();
        return result;
      }
    } catch {
      signal?.throwIfAborted();
      // A failed catalog or image must not prevent trying the next source.
    }
  }
  signal?.throwIfAborted();
  if (!reachable) throw new Error('Impossibile raggiungere i cataloghi delle cover. Riprova tra poco.');
  return null;
}

export function formatGithubError(status, method, path, detail = '') {
  const verb = String(method || 'GET').toUpperCase();
  const route = String(path || '/').split('?')[0];
  const code = Number(status) || 0;
  const message = String(detail || `GitHub ha restituito HTTP ${code}.`);
  const prefix = `GitHub ha rifiutato ${verb} ${route} (HTTP ${code})`;

  if (code === 403 && /resource not accessible by personal access token|forbidden/i.test(message)) {
    return `${prefix}: il token non ha accesso alla scrittura. Nel token fine-grained seleziona il repository zer0game e imposta Contents: Read and write.`;
  }

  return `${prefix}: ${message}`;
}

export function gameFormValues(game = {}) {
  const notes = String(game.notes ?? '');
  const creditMatch = notes.match(/(?:^|\s+)Catalog credits:\s*([^\n]*)$/i);
  return {
    title: String(game.title ?? ''),
    titleId: String(game.titleId ?? ''),
    version: String(game.version ?? ''),
    firmware: String(game.firmware ?? ''),
    size: String(game.size ?? ''),
    status: String(game.status ?? 'soon'),
    genres: Array.isArray(game.genres) ? game.genres.join(', ') : '',
    link: String(game.directUrl ?? ''),
    dlcLink: String(game.dlcDirectUrl ?? ''),
    cheatEnabled: Boolean(game.cheatEnabled),
    cheatLink: String(game.cheatDirectUrl ?? ''),
    technicalInfo: creditMatch ? notes.slice(0, creditMatch.index).trimEnd() : notes,
    credit: creditMatch ? creditMatch[1].trim() : ''
  };
}

export function buildGameRecord(input, date = new Date().toISOString().slice(0, 10), existing = null) {
  const title = cleanText(input?.title, 'Title', true);
  const status = String(input?.status ?? 'soon').trim().toLowerCase();
  if (!['soon', 'released'].includes(status)) throw new Error('Choose Soon or Released.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date must use YYYY-MM-DD.');

  const genres = cleanText(input?.genres, 'Genres')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const unchangedCover = existing && String(input?.cover ?? '').trim() === existing.cover;
  const cover = unchangedCover ? existing.cover : cleanCoverPath(input?.cover);
  const technicalInfo = cleanText(input?.technicalInfo, 'Technical information');
  const credit = cleanText(input?.credit, 'Credits');
  const originalForm = existing ? gameFormValues(existing) : null;
  const unchangedNotes = originalForm && technicalInfo === originalForm.technicalInfo && credit === originalForm.credit;
  const notes = unchangedNotes ? existing.notes : [
    technicalInfo,
    credit ? 'Catalog credits: ' + credit : ''
  ].filter(Boolean).join('\n');

  const defaults = {
    date,
    languages: { text: [], audio: [] },
    dlcAvailable: false,
    languageSource: ''
  };
  const record = {
    ...(existing || defaults),
    title,
    titleId: cleanText(input?.titleId, 'Title ID'),
    version: cleanText(input?.version, 'Version'),
    firmware: cleanText(input?.firmware, 'Firmware'),
    size: cleanText(input?.size, 'Size'),
    status,
    cover,
    notes,
    genres
  };

  const link = String(input?.link ?? '').trim();
  if (!existing || link || Object.hasOwn(existing, 'directUrl')) {
    record.directUrl = !link && existing ? '' : cleanLink(link);
  }

  if (Object.hasOwn(input, 'dlcLink')) {
    const dlcLink = String(input.dlcLink ?? '').trim();
    if (dlcLink || (existing && Object.hasOwn(existing, 'dlcDirectUrl'))) {
      record.dlcDirectUrl = dlcLink ? cleanLink(dlcLink) : '';
    }
    if (dlcLink) record.dlcAvailable = true;
  }

  if (Object.hasOwn(input, 'cheatEnabled') || Object.hasOwn(input, 'cheatLink')) {
    const cheatEnabled = Boolean(input.cheatEnabled);
    const cheatLink = String(input.cheatLink ?? '').trim();
    const storedCheatLink = String(existing?.cheatDirectUrl ?? '').trim();
    const resolvedCheatLink = cheatLink || storedCheatLink;

    if (cheatEnabled && !resolvedCheatLink) {
      throw new Error('Add a valid HTTPS cheat link before enabling cheats.');
    }

    record.cheatEnabled = cheatEnabled;
    if (resolvedCheatLink) record.cheatDirectUrl = cleanLink(resolvedCheatLink);
  }

  if (!unchangedCover) {
    const libraryCover = Boolean(safeLibraryImageUrl(cover));
    record.ps5Frame = true;
    record.coverSource = libraryCover ? 'Pippo Library'
      : /^https:\/\//i.test(cover) ? 'PlayStation Store' : 'Owner-uploaded cover';
    record.coverFit = libraryCover ? 'contain' : 'cover';
  }
  return record;
}

export function createCatalogUpdate(catalog, record, original = null, date = new Date().toISOString().slice(0, 10)) {
  const games = catalog.games;
  let editIndex = -1;
  const normalizedTitle = game => String(game.title ?? '').trim().toLowerCase();
  const normalizedId = game => String(game.titleId ?? '').trim().toUpperCase();

  if (original) {
    const matches = games.map((game, index) => ({ game, index })).filter(({ game }) =>
      game.title === original.title && String(game.titleId ?? '') === String(original.titleId ?? '')
    );
    if (!matches.length) throw new Error('La scheda non è più nel catalogo. Ricarica l’elenco e selezionala di nuovo.');
    if (matches.length !== 1) throw new Error('Non è possibile identificare questa scheda in modo univoco.');
    editIndex = matches[0].index;
    if (JSON.stringify(matches[0].game) !== JSON.stringify(original)) {
      throw new Error('La scheda è stata modificata nel frattempo. Ricarica l’elenco e selezionala di nuovo.');
    }
  }

  const duplicate = games.find((game, index) => index !== editIndex && (
    ((!original || normalizedTitle(record) !== normalizedTitle(original)) && normalizedTitle(game) === normalizedTitle(record)) ||
    (normalizedId(record) && (!original || normalizedId(record) !== normalizedId(original)) && normalizedId(game) === normalizedId(record))
  ));
  if (duplicate) throw new Error(`Esiste già una scheda per “${duplicate.title || duplicate.titleId}”.`);

  const nextGames = [...games];
  if (original) nextGames[editIndex] = record;
  else nextGames.push(record);
  return { ...catalog, updated: date, games: nextGames };
}

export function coverFilePath(title, filename, stamp) {
  const ext = String(filename ?? '').toLowerCase().split('.').pop();
  if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    throw new Error('Cover must be a PNG, JPEG or WebP image.');
  }
  const slug = String(title ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'game';
  const safeStamp = String(stamp ?? '').replace(/[^0-9-]/g, '') || 'upload';
  return 'covers/' + slug + '-' + safeStamp + '.' + (ext === 'jpeg' ? 'jpg' : ext);
}

export function isOwnerLogin(login) {
  return login === REPOSITORY_OWNER;
}
