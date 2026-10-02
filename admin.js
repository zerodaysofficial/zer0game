import {
  buildGameRecord,
  coverFilePath,
  createCatalogUpdate,
  formatGithubError,
  gameFormValues,
  isOwnerLogin,
  searchCoverByPpsa,
  REPOSITORY_NAME,
  REPOSITORY_OWNER
} from './admin-core.mjs?v=20261003-cheat-download';

const API_ROOT = 'https://api.github.com';
const WRITE_BRANCH = 'main';
const MAX_COVER_BYTES = 8 * 1024 * 1024;
const MIME_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
};

const byId = id => document.getElementById(id);
const loginPanel = byId('loginPanel');
const editorPanel = byId('editorPanel');
const loginForm = byId('loginForm');
const entryForm = byId('entryForm');
const tokenInput = byId('githubToken');
const loginStatus = byId('loginStatus');
const saveStatus = byId('saveStatus');
const uploadButton = byId('uploadButton');
const coverSearchButton = byId('coverSearchButton');
const coverInput = byId('coverFile');
const coverPreview = byId('coverPreview');
const coverSearchStatus = byId('coverSearchStatus');
const catalogPanel = byId('catalogPanel');
const catalogSearch = byId('catalogSearch');
const catalogStatus = byId('catalogStatus');
const gameList = byId('gameList');
const refreshCatalogButton = byId('refreshCatalogButton');
const newEntryButton = byId('newEntryButton');
const cancelEditButton = byId('cancelEditButton');
const logoutButton = byId('logoutButton');

let tokenInMemory = '';
let previewUrl = '';
let selectedCoverUrl = '';
let selectedCoverTitleId = '';
let catalogGames = [];
let editingGame = null;
let saving = false;
let loginPending = false;
let coverSearchSequence = 0;
let coverSearchController = null;
let catalogLoadSequence = 0;

coverPreview.addEventListener('error', () => {
  if (!selectedCoverUrl || coverPreview.src !== selectedCoverUrl) return;
  selectedCoverUrl = '';
  selectedCoverTitleId = '';
  showExistingCover();
  setStatus(coverSearchStatus, 'La cover trovata non si carica. Puoi caricarla manualmente.', 'warning');
});

function setStatus(element, message, kind = '') {
  element.textContent = message;
  if (kind) element.dataset.kind = kind;
  else delete element.dataset.kind;
}

function apiUrl(path) {
  return API_ROOT + path;
}

async function githubRequest(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const response = await fetch(apiUrl(path), {
    ...options,
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${tokenInMemory}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(formatGithubError(response.status, method, path, payload.message));
  }
  return payload;
}

function contentsPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function decodeBase64Utf8(value) {
  const binary = atob(String(value || '').replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function toBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function localDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function getCatalog() {
  const path = `/repos/${REPOSITORY_OWNER}/${REPOSITORY_NAME}/contents/games.json?ref=${encodeURIComponent(WRITE_BRANCH)}`;
  const file = await githubRequest(path);
  if (!file.sha || !file.content) throw new Error('Impossibile leggere games.json. Verifica i permessi Contents del token.');

  let catalog;
  try {
    catalog = JSON.parse(decodeBase64Utf8(file.content));
  } catch {
    throw new Error('games.json non contiene JSON valido.');
  }
  if (!Array.isArray(catalog.games)) throw new Error('games.json non contiene la lista games attesa.');
  return { catalog, sha: file.sha };
}

function validateCover(file) {
  if (!file) throw new Error('Seleziona una cover.');
  if (!MIME_EXTENSIONS[file.type]) throw new Error('La cover deve essere PNG, JPG o WebP.');
  if (file.size > MAX_COVER_BYTES) throw new Error('La cover supera il limite di 8 MB.');
}

function normalizedTitleId(value) {
  return String(value || '').trim().toUpperCase().replace(/_00$/, '');
}

function clearCoverPreview() {
  if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  previewUrl = '';
  coverPreview.removeAttribute('src');
  coverPreview.hidden = true;
}

function showCoverPreview(src) {
  clearCoverPreview();
  coverPreview.src = src;
  coverPreview.hidden = false;
}

function showExistingCover() {
  if (editingGame?.cover) showCoverPreview(editingGame.cover);
  else clearCoverPreview();
}

function invalidateCoverSearch() {
  coverSearchSequence++;
  coverSearchController?.abort();
  coverSearchController = null;
  coverSearchButton.disabled = saving;
}

function canLoadCover(url, signal) {
  return new Promise(resolve => {
    const image = new Image();
    let timer;
    const finish = valid => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      image.onload = null;
      image.onerror = null;
      image.removeAttribute('src');
      resolve(valid);
    };
    const abort = () => finish(false);
    image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0);
    image.onerror = () => finish(false);
    image.referrerPolicy = 'no-referrer';
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) return abort();
    timer = setTimeout(abort, 8000);
    image.src = url;
  });
}

function resetCoverSelection() {
  invalidateCoverSearch();
  selectedCoverUrl = '';
  selectedCoverTitleId = '';
  clearCoverPreview();
  setStatus(coverSearchStatus, '');
}

function isEditing(game) {
  return editingGame && game.title === editingGame.title && String(game.titleId || '') === String(editingGame.titleId || '');
}

function renderCatalog() {
  const query = catalogSearch.value.trim().toLowerCase();
  const visibleGames = catalogGames.filter(game =>
    String(game.title || '').toLowerCase().includes(query) || String(game.titleId || '').toLowerCase().includes(query)
  );
  byId('catalogCount').textContent = query
    ? `${visibleGames.length} di ${catalogGames.length} schede`
    : `${catalogGames.length} schede`;
  const fragment = document.createDocumentFragment();
  for (const game of visibleGames) {
    const row = document.createElement('div');
    row.className = 'admin-game-row';
    row.setAttribute('role', 'listitem');
    if (isEditing(game)) row.dataset.editing = 'true';
    const image = document.createElement('img');
    image.className = 'admin-game-cover';
    image.alt = '';
    image.loading = 'lazy';
    if (game.cover) image.src = game.cover;
    const details = document.createElement('div');
    const title = document.createElement('p');
    title.className = 'admin-game-title';
    title.textContent = game.title || 'Senza titolo';
    const metadata = document.createElement('p');
    metadata.className = 'admin-game-details';
    metadata.textContent = [game.titleId || 'Senza PPSA', game.version, game.status === 'released' ? 'Released' : 'Soon'].filter(Boolean).join(' · ');
    details.append(title, metadata);
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'admin-button admin-button-quiet';
    editButton.textContent = 'Modifica';
    editButton.addEventListener('click', () => selectGame(game));
    row.append(image, details, editButton);
    fragment.append(row);
  }
  if (!visibleGames.length) {
    const empty = document.createElement('p');
    empty.className = 'admin-game-empty';
    empty.textContent = catalogGames.length ? 'Nessuna scheda corrisponde alla ricerca.' : 'Il catalogo è vuoto. Aggiungi la prima scheda.';
    fragment.append(empty);
  }
  gameList.replaceChildren(fragment);
}

function showNewEntry() {
  if (saving) return;
  editingGame = null;
  entryForm.reset();
  resetCoverSelection();
  byId('entryHeading').textContent = 'Nuova scheda';
  byId('editingStatus').textContent = 'Compila i dati e seleziona una cover per aggiungere un gioco.';
  byId('link').required = true;
  uploadButton.textContent = 'Upload';
  cancelEditButton.hidden = true;
  setStatus(saveStatus, '');
  renderCatalog();
}

function selectGame(game, focus = true) {
  if (saving) return;
  entryForm.reset();
  editingGame = structuredClone(game);
  resetCoverSelection();
  const values = gameFormValues(game);
  for (const [field, value] of Object.entries(values)) {
    const input = byId(field);
    if (!input) continue;
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = value;
  }
  byId('entryHeading').textContent = 'Modifica scheda';
  byId('editingStatus').textContent = `Stai modificando “${game.title}”. Puoi mantenere la cover attuale oppure sostituirla.`;
  byId('link').required = false;
  uploadButton.textContent = 'Salva modifiche';
  cancelEditButton.hidden = false;
  showExistingCover();
  setStatus(saveStatus, '');
  renderCatalog();
  if (focus) {
    byId('entryHeading').focus({ preventScroll: true });
    byId('entryHeading').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function setSaving(value) {
  saving = value;
  byId('entryFields').disabled = value;
  catalogPanel.inert = value;
  for (const button of [uploadButton, cancelEditButton, logoutButton, refreshCatalogButton, newEntryButton, coverSearchButton]) {
    button.disabled = value;
  }
}

function readFormRecord(coverPath, original) {
  return buildGameRecord({
    title: byId('title').value,
    titleId: byId('titleId').value,
    version: byId('version').value,
    firmware: byId('firmware').value,
    size: byId('size').value,
    status: byId('status').value,
    genres: byId('genres').value,
    link: byId('link').value,
    dlcLink: byId('dlcLink').value,
    cheatEnabled: byId('cheatEnabled').checked,
    cheatLink: byId('cheatLink').value,
    cover: coverPath,
    technicalInfo: byId('technicalInfo').value,
    credit: byId('credit').value
  }, localDate(), original);
}

async function uploadCover(file, path, title) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const body = {
    message: `Add cover for ${title}`,
    content: toBase64(bytes),
    branch: WRITE_BRANCH
  };
  return githubRequest(`/repos/${REPOSITORY_OWNER}/${REPOSITORY_NAME}/contents/${contentsPath(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function saveRecord(record, sha, catalog, original) {
  const nextCatalog = createCatalogUpdate(catalog, record, original, localDate());
  const body = {
    message: `${original ? 'Update' : 'Add'} ${record.title} ${original ? 'in' : 'to'} catalog`,
    content: toBase64(new TextEncoder().encode(`${JSON.stringify(nextCatalog, null, 2)}\n`)),
    sha,
    branch: WRITE_BRANCH
  };
  await githubRequest(`/repos/${REPOSITORY_OWNER}/${REPOSITORY_NAME}/contents/games.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return nextCatalog;
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (loginPending) return;
  loginPending = true;
  const loginButton = loginForm.querySelector('button[type=submit]');
  loginButton.disabled = true;
  tokenInMemory = tokenInput.value.trim();
  setStatus(loginStatus, 'Verifico l’account GitHub…');

  try {
    const user = await githubRequest('/user');
    if (!isOwnerLogin(user.login)) {
      tokenInMemory = '';
      throw new Error('Questo pannello è riservato al proprietario del repository.');
    }

    const loaded = await getCatalog();
    catalogGames = loaded.catalog.games;
    catalogSearch.value = '';
    showNewEntry();
    tokenInput.value = '';
    loginPanel.hidden = true;
    editorPanel.hidden = false;
    setStatus(loginStatus, '');
  } catch (error) {
    tokenInMemory = '';
    tokenInput.value = '';
    setStatus(loginStatus, error.message || 'Accesso non riuscito.', 'error');
  } finally {
    loginPending = false;
    loginButton.disabled = false;
  }
});

logoutButton.addEventListener('click', () => {
  if (saving) return;
  catalogLoadSequence++;
  refreshCatalogButton.disabled = false;
  tokenInMemory = '';
  catalogGames = [];
  catalogSearch.value = '';
  showNewEntry();
  editorPanel.hidden = true;
  loginPanel.hidden = false;
  setStatus(catalogStatus, '');
});

catalogSearch.addEventListener('input', renderCatalog);
newEntryButton.addEventListener('click', showNewEntry);
cancelEditButton.addEventListener('click', showNewEntry);

refreshCatalogButton.addEventListener('click', async () => {
  if (saving || !tokenInMemory) return;
  const requestId = ++catalogLoadSequence;
  refreshCatalogButton.disabled = true;
  setStatus(catalogStatus, 'Aggiorno l’elenco…');
  try {
    const loaded = await getCatalog();
    if (requestId !== catalogLoadSequence || !tokenInMemory) return;
    catalogGames = loaded.catalog.games;
    renderCatalog();
    setStatus(catalogStatus, 'Elenco aggiornato. Seleziona Modifica per aprire i dati più recenti.', 'success');
  } catch (error) {
    if (requestId === catalogLoadSequence) setStatus(catalogStatus, error.message, 'error');
  } finally {
    if (requestId === catalogLoadSequence) refreshCatalogButton.disabled = saving;
  }
});

byId('titleId').addEventListener('input', () => {
  invalidateCoverSearch();
  setStatus(coverSearchStatus, '');
  if (selectedCoverUrl && normalizedTitleId(byId('titleId').value) !== selectedCoverTitleId) {
    selectedCoverUrl = '';
    selectedCoverTitleId = '';
    showExistingCover();
    setStatus(coverSearchStatus, 'Il PPSA è cambiato. Cerca di nuovo la cover.', 'warning');
  }
});

coverSearchButton.addEventListener('click', async () => {
  if (saving) return;
  const titleId = normalizedTitleId(byId('titleId').value);
  invalidateCoverSearch();
  const requestId = coverSearchSequence;
  const controller = new AbortController();
  coverSearchController = controller;
  coverSearchButton.disabled = true;
  setStatus(coverSearchStatus, `Cerco la cover per ${titleId}…`);
  try {
    const result = await searchCoverByPpsa(titleId, {
      signal: controller.signal,
      verifyImage: url => canLoadCover(url, controller.signal)
    });
    if (requestId !== coverSearchSequence) return;
    if (!result) throw new Error(`Non ho trovato una cover caricabile per ${titleId}.`);

    selectedCoverUrl = result.imageUrl;
    selectedCoverTitleId = titleId;
    coverInput.value = '';
    showCoverPreview(result.imageUrl);
    setStatus(coverSearchStatus, `Trovata: ${result.title}. La cover verrà adattata al riquadro 3:4 del sito.`, 'success');
    setStatus(saveStatus, '');
  } catch (error) {
    if (requestId !== coverSearchSequence) return;
    const invalidId = !/^PPSA\d{5}$/.test(titleId);
    setStatus(coverSearchStatus, invalidId ? error.message : `${error.message} Puoi anche caricare un file.`, invalidId ? 'error' : 'warning');
  } finally {
    if (requestId === coverSearchSequence) {
      coverSearchController = null;
      coverSearchButton.disabled = saving;
    }
  }
});

coverInput.addEventListener('change', () => {
  if (saving) return;
  invalidateCoverSearch();
  const file = coverInput.files?.[0];
  if (!file) {
    selectedCoverUrl = '';
    selectedCoverTitleId = '';
    showExistingCover();
    return;
  }
  try {
    validateCover(file);
    selectedCoverUrl = '';
    selectedCoverTitleId = '';
    clearCoverPreview();
    previewUrl = URL.createObjectURL(file);
    coverPreview.src = previewUrl;
    coverPreview.hidden = false;
    setStatus(coverSearchStatus, '');
    setStatus(saveStatus, '');
  } catch (error) {
    coverInput.value = '';
    selectedCoverUrl = '';
    selectedCoverTitleId = '';
    showExistingCover();
    setStatus(saveStatus, error.message, 'error');
  }
});

entryForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (saving) return;
  if (!tokenInMemory) {
    setStatus(saveStatus, 'Accedi di nuovo per continuare.', 'error');
    return;
  }

  const coverFile = coverInput.files?.[0];
  const original = editingGame ? structuredClone(editingGame) : null;
  const coverUrl = selectedCoverTitleId === normalizedTitleId(byId('titleId').value)
    ? selectedCoverUrl
    : '';
  let coverUploaded = false;
  invalidateCoverSearch();
  catalogLoadSequence++;
  setSaving(true);
  setStatus(saveStatus, 'Controllo i dati…');

  try {
    if (coverFile) validateCover(coverFile);
    if (!coverFile && !coverUrl && !original?.cover) throw new Error('Cerca la cover con il PPSA o carica un file.');

    const ext = coverFile ? MIME_EXTENSIONS[coverFile.type] : '';
    const coverPath = coverFile
      ? coverFilePath(byId('title').value, `cover.${ext}`, String(Date.now()))
      : coverUrl || original.cover;
    const record = readFormRecord(coverPath, original);
    setStatus(saveStatus, 'Leggo il catalogo…');
    const beforeUpload = await getCatalog();
    createCatalogUpdate(beforeUpload.catalog, record, original, localDate());

    if (coverFile) {
      setStatus(saveStatus, 'Carico la cover…');
      await uploadCover(coverFile, coverPath, record.title);
      coverUploaded = true;
    }

    setStatus(saveStatus, 'Verifico gli ultimi aggiornamenti…');
    const latest = await getCatalog();
    setStatus(saveStatus, original ? 'Salvo le modifiche…' : 'Salvo la scheda…');
    const savedCatalog = await saveRecord(record, latest.sha, latest.catalog, original);
    catalogGames = savedCatalog.games;
    setSaving(false);
    if (original) selectGame(record, false);
    else showNewEntry();
    setStatus(saveStatus, `“${record.title}”: scheda ${original ? 'aggiornata' : 'aggiunta al catalogo'}.`, 'success');
  } catch (error) {
    const partial = coverUploaded ? ' La cover è stata caricata, ma la scheda non è stata salvata.' : '';
    setStatus(saveStatus, `${error.message || 'Salvataggio non riuscito.'}${partial}`, 'error');
  } finally {
    setSaving(false);
  }
});
