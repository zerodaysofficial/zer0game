import test from 'node:test';
import assert from 'node:assert/strict';
import {
  counterKey,
  counterUrl,
  formatDownloadCount,
  classifyDownloadTarget
} from '../download-counters.mjs';

test('uses title id as stable key and keeps game/cheat counters separate', () => {
  assert.equal(counterKey({ titleId: 'PPSA03671', title: 'Marvel Wolverine' }, 'game'), 'ppsa03671-game');
  assert.equal(counterKey({ titleId: 'PPSA03671', title: 'Marvel Wolverine' }, 'cheat'), 'ppsa03671-cheat');
});

test('falls back to a sanitized title when title id is unavailable', () => {
  assert.equal(counterKey({ titleId: '', title: "Marvel's Wolverine™" }, 'game'), 'marvel-s-wolverine-game');
});

test('builds CountAPI get and hit URLs in the zer0game namespace', () => {
  assert.equal(counterUrl('get', 'ppsa03671-game'), 'https://api.countapi.xyz/get/zer0game.github.io/ppsa03671-game');
  assert.equal(counterUrl('hit', 'ppsa03671-cheat'), 'https://api.countapi.xyz/hit/zer0game.github.io/ppsa03671-cheat');
});

test('formats download totals for the UI', () => {
  assert.equal(formatDownloadCount(0), '0 downloads');
  assert.equal(formatDownloadCount(1), '1 download');
  assert.equal(formatDownloadCount(1284), '1,284 downloads');
});

test('classifies only game and cheat download controls', () => {
  assert.equal(classifyDownloadTarget(['game-download']), 'game');
  assert.equal(classifyDownloadTarget(['quick-download', 'quick-cheat']), 'cheat');
  assert.equal(classifyDownloadTarget(['quick-download', 'quick-akia']), 'game');
  assert.equal(classifyDownloadTarget(['dlc-download']), null);
});
