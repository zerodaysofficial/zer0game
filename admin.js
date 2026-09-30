import {
  buildGameRecord,
  buildPsStoreCoverSearchUrls,
  coverFilePath,
  extractPsStoreCover,
  formatGithubError,
  isOwnerLogin,
  REPOSITORY_NAME,
  REPOSITORY_OWNER
} from './admin-core.mjs';

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

let tokenInMemory = '';
let previewUrl = '';
let selectedCoverUrl = '';
let selectedCoverTitleId = '';

coverPreview.addEventListener('error', () => {
  if (!selectedCoverUrl || coverPreview.src !== selectedCoverUrl) return;
  selectedCoverUrl = '';
  selectedCoverTitleId = '';
  clearCoverPreview();
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

function checkDuplicate(games, record) {
  const title = record.title.trim().toLocaleLowerCase();
  const titleId = record.titleId.trim().toLocaleUpperCase();
  const duplicate = games.find(game =>
    String(game.title || '').trim().toLocaleLowerCase() === title ||
    (titleId && String(game.titleId || '').trim().toLocaleUpperCase() === titleId)
  );
  if (duplicate) throw new Error(`Esiste già una scheda per “${duplicate.title || duplicate.titleId}”.`);
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

function readFormRecord(coverPath) {
  return buildGameRecord({
    title: byId('title').value,
    titleId: byId('titleId').value,
    version: byId('version').value,
    firmware: byId('firmware').value,
    size: byId('size').value,
    status: byId('status').value,
    genres: byId('genres').value,
    link: byId('link').value,
    cover: coverPath,
    technicalInfo: byId('technicalInfo').value,
    credit: byId('credit').value
  }, localDate());
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

async function saveRecord(record, sha, catalog) {
  const nextCatalog = {
    ...catalog,
    updated: localDate(),
    games: [...catalog.games, record]
  };
  const body = {
    message: `Add ${record.title} to catalog`,
    content: toBase64(new TextEncoder().encode(`${JSON.stringify(nextCatalog, null, 2)}\n`)),
    sha,
    branch: WRITE_BRANCH
  };
  return githubRequest(`/repos/${REPOSITORY_OWNER}/${REPOSITORY_NAME}/contents/games.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  tokenInMemory = tokenInput.value.trim();
  setStatus(loginStatus, 'Verifico l’account GitHub…');

  try {
    const user = await githubRequest('/user');
    if (!isOwnerLogin(user.login)) {
      tokenInMemory = '';
      throw new Error('Questo pannello è riservato al proprietario del repository.');
    }

    await getCatalog();
    tokenInput.value = '';
    loginPanel.hidden = true;
    editorPanel.hidden = false;
    setStatus(loginStatus, '');
  } catch (error) {
    tokenInMemory = '';
    tokenInput.value = '';
    setStatus(loginStatus, error.message || 'Accesso non riuscito.', 'error');
  }
});

byId('logoutButton').addEventListener('click', () => {
  tokenInMemory = '';
  entryForm.reset();
  editorPanel.hidden = true;
  loginPanel.hidden = false;
  selectedCoverUrl = '';
  selectedCoverTitleId = '';
  clearCoverPreview();
  setStatus(coverSearchStatus, '');
  setStatus(saveStatus, '');
});

byId('titleId').addEventListener('input', () => {
  if (selectedCoverUrl && normalizedTitleId(byId('titleId').value) !== selectedCoverTitleId) {
    selectedCoverUrl = '';
    selectedCoverTitleId = '';
    clearCoverPreview();
    setStatus(coverSearchStatus, 'Il PPSA è cambiato. Cerca di nuovo la cover.', 'warning');
  }
});

coverSearchButton.addEventListener('click', async () => {
  const titleId = normalizedTitleId(byId('titleId').value);
  let searchUrls;
  try {
    searchUrls = buildPsStoreCoverSearchUrls(titleId);
  } catch (error) {
    setStatus(coverSearchStatus, error.message, 'error');
    return;
  }

  coverSearchButton.disabled = true;
  setStatus(coverSearchStatus, `Cerco la cover per ${titleId} nel PlayStation Store…`);
  try {
    let result = null;
    let networkError = null;
    for (const searchUrl of searchUrls) {
      try {
        const response = await fetch(searchUrl, {
          cache: 'no-store',
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) continue;
        result = extractPsStoreCover(await response.json());
        if (result) break;
      } catch (error) {
        if (error instanceof TypeError) networkError = error;
      }
    }
    if (!result && networkError) throw networkError;
    if (!result) throw new Error(`Non ho trovato una cover per ${titleId}.`);

    selectedCoverUrl = result.imageUrl;
    selectedCoverTitleId = titleId;
    coverInput.value = '';
    showCoverPreview(result.imageUrl);
    setStatus(coverSearchStatus, `Trovata: ${result.title}. La cover verrà adattata al riquadro 3:4 del sito.`, 'success');
    setStatus(saveStatus, '');
  } catch (error) {
    selectedCoverUrl = '';
    selectedCoverTitleId = '';
    if (error instanceof TypeError) {
      setStatus(coverSearchStatus, 'La ricerca PS Store non è raggiungibile da questa pagina. Puoi caricare la cover manualmente.', 'warning');
    } else {
      setStatus(coverSearchStatus, `${error.message} Puoi caricare la cover manualmente.`, 'warning');
    }
  } finally {
    coverSearchButton.disabled = false;
  }
});

coverInput.addEventListener('change', () => {
  const file = coverInput.files?.[0];
  if (!file) return;
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
    clearCoverPreview();
    setStatus(saveStatus, error.message, 'error');
  }
});

entryForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!tokenInMemory) {
    setStatus(saveStatus, 'Accedi di nuovo per continuare.', 'error');
    return;
  }

  const coverFile = coverInput.files?.[0];
  const coverUrl = selectedCoverTitleId === normalizedTitleId(byId('titleId').value)
    ? selectedCoverUrl
    : '';
  let coverUploaded = false;
  uploadButton.disabled = true;
  setStatus(saveStatus, 'Controllo i dati…');

  try {
    if (coverFile) validateCover(coverFile);
    if (!coverFile && !coverUrl) throw new Error('Cerca la cover con il PPSA o carica un file.');

    const ext = coverFile ? MIME_EXTENSIONS[coverFile.type] : '';
    const coverPath = coverUrl || coverFilePath(byId('title').value, `cover.${ext}`, String(Date.now()));
    const record = readFormRecord(coverPath);
    setStatus(saveStatus, 'Leggo il catalogo (GET /contents/games.json)…');
    const beforeUpload = await getCatalog();
    checkDuplicate(beforeUpload.catalog.games, record);

    if (coverFile) {
      setStatus(saveStatus, `Carico la cover (PUT /contents/${coverPath})…`);
      await uploadCover(coverFile, coverPath, record.title);
      coverUploaded = true;
    }

    setStatus(saveStatus, 'Rileggo il catalogo (GET /contents/games.json)…');
    const latest = await getCatalog();
    checkDuplicate(latest.catalog.games, record);
    setStatus(saveStatus, 'Salvo la scheda (PUT /contents/games.json)…');
    await saveRecord(record, latest.sha, latest.catalog);

    entryForm.reset();
    selectedCoverUrl = '';
    selectedCoverTitleId = '';
    clearCoverPreview();
    setStatus(coverSearchStatus, '');
    setStatus(saveStatus, `“${record.title}” è stato aggiunto al catalogo.`, 'success');
  } catch (error) {
    const partial = coverUploaded ? ' La cover è stata caricata, ma la scheda non è stata salvata.' : '';
    setStatus(saveStatus, `${error.message || 'Salvataggio non riuscito.'}${partial}`, 'error');
  } finally {
    uploadButton.disabled = false;
  }
});
