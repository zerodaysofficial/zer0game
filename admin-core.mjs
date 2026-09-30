export const REPOSITORY_OWNER = 'zerodaysofficial';
export const REPOSITORY_NAME = 'zer0game';

const MAX_TEXT_LENGTH = 8000;

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
  if (!/^covers\/[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp)$/i.test(path)) {
    throw new Error('Upload a PNG, JPEG or WebP cover.');
  }
  return path;
}

export function buildGameRecord(input, date = new Date().toISOString().slice(0, 10)) {
  const title = cleanText(input?.title, 'Title', true);
  const status = String(input?.status ?? 'soon').trim().toLowerCase();
  if (!['soon', 'released'].includes(status)) throw new Error('Choose Soon or Released.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date must use YYYY-MM-DD.');

  const genres = cleanText(input?.genres, 'Genres')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const technicalInfo = cleanText(input?.technicalInfo, 'Technical information');
  const credit = cleanText(input?.credit, 'Credits');
  const notes = [
    technicalInfo,
    credit ? 'Catalog credits: ' + credit : ''
  ].filter(Boolean).join('\n');

  return {
    title,
    titleId: cleanText(input?.titleId, 'Title ID'),
    version: cleanText(input?.version, 'Version'),
    firmware: cleanText(input?.firmware, 'Firmware'),
    size: cleanText(input?.size, 'Size'),
    status,
    date,
    cover: cleanCoverPath(input?.cover),
    languages: { text: [], audio: [] },
    notes,
    directUrl: cleanLink(input?.link),
    dlcAvailable: false,
    languageSource: '',
    genres,
    ps5Frame: true,
    coverSource: 'Owner-uploaded cover',
    coverFit: 'cover'
  };
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
