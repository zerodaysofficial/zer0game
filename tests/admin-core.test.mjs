import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../admin-core.mjs';
import {
  buildGameRecord,
  buildPsStoreCoverSearchUrls,
  coverFilePath,
  extractPsStoreCover,
  formatGithubError,
  isOwnerLogin
} from '../admin-core.mjs';

test('buildGameRecord maps LINK to the existing game download action', () => {
  const record = buildGameRecord({
    title: 'Example Game',
    titleId: 'PPSA00001',
    version: 'v01.008.001',
    status: 'soon',
    link: 'https://www.amazon.it/dp/example',
    cover: 'covers/example-game-123.png',
    technicalInfo: 'Platform: PS5',
    credit: 'Community',
    directUrl: 'https://example.invalid/ignored.pkg',
    infoUrl: 'https://example.invalid/ignored-info',
    dlcDirectUrl: 'https://example.invalid/ignored-dlc.pkg'
  }, '2026-09-30');

  assert.equal(record.title, 'Example Game');
  assert.equal(record.titleId, 'PPSA00001');
  assert.equal(record.directUrl, 'https://www.amazon.it/dp/example');
  assert.equal(record.infoUrl, undefined);
  assert.equal(record.cover, 'covers/example-game-123.png');
  assert.equal(record.notes, 'Platform: PS5\nCatalog credits: Community');
  assert.equal(record.status, 'soon');
  assert.equal(record.date, '2026-09-30');
  assert.equal(Object.hasOwn(record, 'releaseUrl'), false);
  assert.equal(Object.hasOwn(record, 'buyUrl'), false);
  assert.equal(Object.hasOwn(record, 'dlcDirectUrl'), false);
});

test('buildGameRecord accepts generic HTTPS links and rejects unsafe URLs', () => {
  assert.throws(() => buildGameRecord({
    title: '  ',
    link: 'https://www.g2a.com/game-example',
    cover: 'covers/example.png'
  }), /title/i);

  assert.throws(() => buildGameRecord({
    title: 'Example Game',
    link: 'javascript:alert(1)',
    cover: 'covers/example.png'
  }), /https/i);

  assert.throws(() => buildGameRecord({
    title: 'Example Game',
    link: 'http://www.amazon.it/game-example',
    cover: 'covers/example.png'
  }), /HTTPS/i);

  assert.throws(() => buildGameRecord({
    title: 'Example Game',
    link: 'https://user:password@example.com/game',
    cover: 'covers/example.png'
  }), /HTTPS/i);
});

test('buildGameRecord accepts trusted PlayStation cover URLs and rejects other remote covers', () => {
  const record = buildGameRecord({
    title: 'Example Game',
    link: 'https://store.example.com/game',
    cover: 'https://image.api.playstation.com/cdn/cover.jpg'
  }, '2026-09-30');

  assert.equal(record.cover, 'https://image.api.playstation.com/cdn/cover.jpg');
  assert.equal(record.coverSource, 'PlayStation Store');
  assert.throws(() => buildGameRecord({
    title: 'Example Game',
    link: 'https://store.example.com/game',
    cover: 'https://example.com/cover.jpg'
  }), /cover/i);
});

test('coverFilePath creates a safe image path from the title and filename', () => {
  assert.equal(
    coverFilePath('God of War: Sons of Sparta', 'cover.PNG', '20260930-1121'),
    'covers/god-of-war-sons-of-sparta-20260930-1121.png'
  );
  assert.throws(() => coverFilePath('Example', 'cover.exe', '20260930-1121'), /image/i);
});

test('only the configured GitHub owner passes the admin identity check', () => {
  assert.equal(isOwnerLogin('zerodaysofficial'), true);
  assert.equal(isOwnerLogin('someone-else'), false);
  assert.equal(isOwnerLogin('ZERODAYSOFFICIAL'), false);
});

test('PPSA lookup builds a direct catalog URL and a Store search fallback', () => {
  assert.equal(
    JSON.stringify(buildPsStoreCoverSearchUrls('ppsa28997_00')),
    JSON.stringify([
      'https://store.playstation.com/store/api/chihiro/00_09_000/container/us/en/999/PPSA28997_00?size=999',
      'https://store.playstation.com/store/api/chihiro/00_09_000/tumbler/us/en/999/PPSA28997?size=10&gkb=1&start=0&mode=game'
    ])
  );
  assert.throws(() => buildPsStoreCoverSearchUrls('CUSA12345'), /PPSA/i);
});

test('PlayStation search picks a safe cover URL and ignores non-PlayStation URLs', () => {
  const result = extractPsStoreCover({
    links: [
      {
        name: 'Example PS5 Game',
        images: [
          { type: 'MASTER', url: 'https://example.com/unsafe.jpg' },
          { type: 'MASTER', url: 'https://image.api.playstation.com/cover.jpg' }
        ]
      }
    ]
  });

  assert.deepEqual(result, {
    title: 'Example PS5 Game',
    imageUrl: 'https://image.api.playstation.com/cover.jpg'
  });
  assert.equal(extractPsStoreCover({ links: [] }), null);
});

test('GitHub 403 permission errors identify the failed request and required token access', () => {
  const message = formatGithubError(
    403,
    'PUT',
    '/repos/zerodaysofficial/zer0game/contents/games.json',
    'Resource not accessible by personal access token'
  );

  assert.match(message, /PUT \/repos\/zerodaysofficial\/zer0game\/contents\/games\.json/);
  assert.match(message, /Contents.*Read and write/i);
  assert.match(message, /zer0game/i);
});

const existingGame = {
  title: 'Existing Game',
  titleId: 'PPSA00001',
  version: '01.000',
  firmware: '4.xx+',
  size: '10 GB',
  status: 'released',
  date: '2026-09-22',
  cover: 'https://library.example.com/exFAT/existing.webp',
  directUrl: 'https://example.com/game',
  dlcDirectUrl: 'https://example.com/dlc',
  dlcAvailable: true,
  infoUrl: 'https://example.com/info',
  releaseUrl: '',
  languages: { text: ['ENG', 'ITA'], audio: ['ENG'] },
  languageSource: 'Store metadata',
  notes: 'Platform: PS5. Catalog credits: Community.',
  creditsBackport: 'Backport Author',
  genres: ['Action', 'Adventure'],
  ps5Frame: false,
  coverSource: 'Existing library',
  coverFit: 'contain',
  compatibilityNote: 'Compatibility information'
};

function existingForm(overrides = {}) {
  return {
    title: 'Existing Game', titleId: 'PPSA00001', version: '01.000',
    firmware: '4.xx+', size: '10 GB', status: 'released',
    cover: 'https://library.example.com/exFAT/existing.webp',
    link: 'https://example.com/game', dlcLink: 'https://example.com/dlc',
    technicalInfo: 'Platform: PS5.', credit: 'Community.',
    genres: 'Action, Adventure', ...overrides
  };
}

test('editing keeps the existing cover and every unedited catalog field', () => {
  let record;
  assert.doesNotThrow(() => {
    record = buildGameRecord(existingForm(), '2026-10-01', existingGame);
  });
  assert.deepEqual(record, existingGame);
});

test('editing changes the requested values without clearing languages or DLC', () => {
  const record = buildGameRecord(existingForm({
    title: 'Renamed Game', link: 'https://example.com/new-game',
    cover: 'covers/new-cover.jpg', credit: 'New Author', technicalInfo: 'Updated details'
  }), '2026-10-01', existingGame);
  assert.equal(record.title, 'Renamed Game');
  assert.equal(record.directUrl, 'https://example.com/new-game');
  assert.equal(record.cover, 'covers/new-cover.jpg');
  assert.equal(record.ps5Frame, true);
  assert.equal(record.coverSource, 'Owner-uploaded cover');
  assert.equal(record.coverFit, 'cover');
  assert.equal(record.notes, 'Updated details\nCatalog credits: New Author');
  assert.equal(record.date, '2026-09-22');
  assert.deepEqual(record.languages, { text: ['ENG', 'ITA'], audio: ['ENG'] });
  assert.equal(record.dlcDirectUrl, 'https://example.com/dlc');
  assert.equal(record.infoUrl, 'https://example.com/info');
  assert.equal(record.creditsBackport, 'Backport Author');
});

test('an existing Soon record can be edited without adding a download link', () => {
  const original = { ...existingGame, status: 'soon' };
  delete original.directUrl;
  const record = buildGameRecord(existingForm({
    status: 'soon', link: '', cover: 'covers/new-cover.jpg'
  }), '2026-10-01', original);
  assert.equal(Object.hasOwn(record, 'directUrl'), false);
  assert.equal(record.status, 'soon');
  assert.equal(record.date, '2026-09-22');
});

test('editing can clear a link and rejects unsafe replacement cover URLs', () => {
  const record = buildGameRecord(existingForm({ link: '', cover: 'covers/new-cover.jpg' }), '2026-10-01', existingGame);
  assert.equal(record.directUrl, '');
  assert.throws(() => buildGameRecord(existingForm({ cover: 'javascript:alert(1)' }), '2026-10-01', existingGame), /cover/i);
  assert.throws(() => buildGameRecord(existingForm({ cover: 'https://unknown.example/new.jpg' }), '2026-10-01', existingGame), /cover/i);
});

test('the optional DLC link updates only the separate DLC action', () => {
  const record = buildGameRecord(existingForm({
    dlcLink: 'https://example.com/new-dlc', cover: 'covers/new-cover.jpg'
  }), '2026-10-01', existingGame);
  assert.equal(record.dlcDirectUrl, 'https://example.com/new-dlc');
  assert.equal(record.directUrl, 'https://example.com/game');
  assert.throws(() => buildGameRecord(existingForm({
    dlcLink: 'http://example.com/dlc', cover: 'covers/new-cover.jpg'
  }), '2026-10-01', existingGame), /https/i);
});

test('the editor prefills notes, credits and separate links without losing text', () => {
  assert.equal(typeof core.gameFormValues, 'function', 'The editor must provide existing form values');
  const values = core.gameFormValues(existingGame);
  assert.equal(values.technicalInfo, 'Platform: PS5.');
  assert.equal(values.credit, 'Community.');
  assert.equal(values.link, 'https://example.com/game');
  assert.equal(values.dlcLink, 'https://example.com/dlc');
  assert.equal(values.genres, 'Action, Adventure');
  const multiline = core.gameFormValues({ notes: 'First line\nSecond line\nCatalog credits: Author' });
  assert.equal(multiline.technicalInfo, 'First line\nSecond line');
  assert.equal(multiline.credit, 'Author');
});

test('saving an edit replaces the chosen game in place even after catalog reordering', () => {
  assert.equal(typeof core.createCatalogUpdate, 'function', 'The catalog must support replacement');
  const other = { title: 'Other Game', titleId: 'PPSA00002', version: '01.000' };
  const catalog = { updated: '2026-09-22', source: 'Keep me', games: [other, existingGame] };
  const record = { ...existingGame, title: 'Renamed Game', directUrl: 'https://example.com/new' };
  const next = core.createCatalogUpdate(catalog, record, existingGame, '2026-10-01');
  assert.equal(next.games.length, 2);
  assert.deepEqual(next.games[0], other);
  assert.equal(next.games[1].title, 'Renamed Game');
  assert.equal(next.updated, '2026-10-01');
  assert.equal(next.source, 'Keep me');
  assert.equal(catalog.games[1].title, 'Existing Game');
});

test('an edit allows an unchanged shared PPSA but blocks new title or PPSA collisions', () => {
  assert.equal(typeof core.createCatalogUpdate, 'function', 'The catalog must support replacement');
  const shared = { ...existingGame, title: 'Other Edition' };
  const other = { title: 'Other Game', titleId: 'PPSA00002' };
  const catalog = { games: [existingGame, shared, other] };
  assert.doesNotThrow(() => core.createCatalogUpdate(catalog, { ...existingGame, size: '11 GB' }, existingGame, '2026-10-01'));
  assert.throws(() => core.createCatalogUpdate(catalog, { ...existingGame, title: 'other game' }, existingGame, '2026-10-01'), /esiste già/i);
  assert.throws(() => core.createCatalogUpdate(catalog, { ...existingGame, titleId: 'ppsa00002' }, existingGame, '2026-10-01'), /esiste già/i);
});

test('an edit refuses to overwrite a game changed or removed by another writer', () => {
  assert.equal(typeof core.createCatalogUpdate, 'function', 'The catalog must support replacement');
  const edited = { ...existingGame, version: '02.000' };
  assert.throws(() => core.createCatalogUpdate({ games: [edited] }, existingGame, existingGame, '2026-10-01'), /modificata nel frattempo/i);
  assert.throws(() => core.createCatalogUpdate({ games: [] }, existingGame, existingGame, '2026-10-01'), /non è più/i);
  assert.throws(() => core.createCatalogUpdate({ games: [existingGame, existingGame] }, existingGame, existingGame, '2026-10-01'), /univoc/i);
});

test('new uploads still append and reject duplicate title or PPSA', () => {
  assert.equal(typeof core.createCatalogUpdate, 'function', 'The catalog must support replacement');
  const catalog = { updated: '2026-09-22', games: [existingGame] };
  const record = { title: 'New Game', titleId: 'PPSA00002' };
  const next = core.createCatalogUpdate(catalog, record, null, '2026-10-01');
  assert.deepEqual(next.games, [existingGame, record]);
  assert.throws(() => core.createCatalogUpdate(catalog, { title: 'existing game' }, null, '2026-10-01'), /esiste già/i);
  assert.throws(() => core.createCatalogUpdate(catalog, { title: 'New Game', titleId: 'ppsa00001' }, null, '2026-10-01'), /esiste già/i);
});
