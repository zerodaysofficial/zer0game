import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGameRecord, coverFilePath, isOwnerLogin } from '../admin-core.mjs';

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
