import {
  buildGameRecord,
  coverFilePath,
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
const coverInput = byId('coverFile');
const coverPreview = byId('coverPreview');

let tokenInMemory = '';
let previewUrl = '';

function setStatus(element, message, kind = '') {
  element.textContent = message;
  if (kind) element.dataset.kind = kind;
  else delete element.dataset.kind;
}

function apiUrl(path) {
  return API_ROOT + path;
}

async function githubRequest(path, options = {}) {
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
    const detail = payload.message || `GitHub returned HTTP ${response.status}.`;
    throw new Error(detail);
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
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = '';
  coverPreview.removeAttribute('src');
  coverPreview.hidden = true;
  setStatus(saveStatus, '');
});

coverInput.addEventListener('change', () => {
  const file = coverInput.files?.[0];
  if (!file) return;
  try {
    validateCover(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    coverPreview.src = previewUrl;
    coverPreview.hidden = false;
    setStatus(saveStatus, '');
  } catch (error) {
    coverInput.value = '';
    coverPreview.hidden = true;
    setStatus(saveStatus, error.message, 'error');
  }
});

entryForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!tokenInMemory) {
    setStatus(saveStatus, 'Accedi di nuovo per continuare.', 'error');
    return;
  }

  const cover = coverInput.files?.[0];
  let coverUploaded = false;
  uploadButton.disabled = true;
  setStatus(saveStatus, 'Controllo i dati…');

  try {
    validateCover(cover);
    const ext = MIME_EXTENSIONS[cover.type];
    const coverPath = coverFilePath(byId('title').value, `cover.${ext}`, String(Date.now()));
    const record = readFormRecord(coverPath);
    const beforeUpload = await getCatalog();
    checkDuplicate(beforeUpload.catalog.games, record);

    setStatus(saveStatus, 'Carico la cover…');
    await uploadCover(cover, coverPath, record.title);
    coverUploaded = true;

    setStatus(saveStatus, 'Salvo la scheda…');
    const latest = await getCatalog();
    checkDuplicate(latest.catalog.games, record);
    await saveRecord(record, latest.sha, latest.catalog);

    entryForm.reset();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    coverPreview.removeAttribute('src');
    coverPreview.hidden = true;
    setStatus(saveStatus, `“${record.title}” è stato aggiunto al catalogo.`, 'success');
  } catch (error) {
    const partial = coverUploaded ? ' La cover è stata caricata, ma la scheda non è stata salvata.' : '';
    setStatus(saveStatus, `${error.message || 'Salvataggio non riuscito.'}${partial}`, 'error');
  } finally {
    uploadButton.disabled = false;
  }
});
