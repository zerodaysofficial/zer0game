import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../admin-core.mjs';

const storeCover = 'https://vulcan.dl.playstation.net/ap/rnd/202602/0519/7260437aae9056d5bd34225e4fce98ca8bb0ef1cd8e6471f.png';
const libraryCover = 'https://pub-ce6b40c14d144a128552570bcf6bb628.r2.dev/exFAT/God_of_War_Sons_of_Sparta.avif';
const storePayload = {
  links: [{
    name: 'God of War Sons of Sparta',
    gameContentTypesList: [{ name: 'Full Game', key: 'FULL_GAME' }],
    images: [{ type: 10, url: storeCover }]
  }]
};
const libraryPayload = [{
  title: 'God of War Sons of Sparta',
  image: libraryCover,
  tags: ['PPSA28997', 'v01.008.001', 'USA', '4.xx BackPort']
}];

test('the real PlayStation Store CDN image survives extraction', () => {
  assert.deepEqual(core.extractPsStoreCover(storePayload), {
    title: 'God of War Sons of Sparta', imageUrl: storeCover
  });
});

test('a found PlayStation CDN cover can be saved in a game record', () => {
  const record = core.buildGameRecord({
    title: 'God of War Sons of Sparta', titleId: 'PPSA28997',
    link: 'https://store.playstation.com/', cover: storeCover
  }, '2026-10-01');
  assert.equal(record.cover, storeCover);
  assert.equal(record.coverSource, 'PlayStation Store');
  assert.equal(record.ps5Frame, true);
});

test('Store extraction prefers the base game over DLC and refuses DLC-only results', () => {
  const dlc = {
    name: 'RESIDENT EVIL 3 - Classic Costume Pack',
    gameContentTypesList: [{ name: 'Costume', key: 'COSTUME' }],
    images: [{ type: 10, url: 'https://vulcan.dl.playstation.net/costume.png' }]
  };
  const game = {
    name: 'RESIDENT EVIL 3',
    gameContentTypesList: [{ name: 'Full Game', key: 'FULL_GAME' }],
    images: [{ type: 10, url: 'https://vulcan.dl.playstation.net/game.png' }]
  };
  assert.deepEqual(core.extractPsStoreCover({ links: [dlc, game] }), {
    title: 'RESIDENT EVIL 3', imageUrl: 'https://vulcan.dl.playstation.net/game.png'
  });
  assert.equal(core.extractPsStoreCover({ links: [dlc] }), null);
});

test('library lookup matches the exact PPSA in tags and normalizes the input', () => {
  assert.equal(typeof core.extractLibraryCover, 'function');
  const misleading = { ...libraryPayload[0], title: 'Wrong Game', tags: ['PPSA289970'] };
  assert.deepEqual(core.extractLibraryCover([misleading, ...libraryPayload], 'ppsa28997_00'), {
    title: 'God of War Sons of Sparta', imageUrl: libraryCover
  });
  assert.equal(core.extractLibraryCover(libraryPayload, 'PPSA00001'), null);
});

test('trusted library AVIF covers are saved with the existing library framing', () => {
  const record = core.buildGameRecord({
    title: 'God of War Sons of Sparta', titleId: 'PPSA28997',
    link: 'https://store.playstation.com/', cover: libraryCover
  }, '2026-10-01');
  assert.equal(record.cover, libraryCover);
  assert.equal(record.coverSource, 'Pippo Library');
  assert.equal(record.ps5Frame, true);
  assert.equal(record.coverFit, 'contain');
});

test('cover lookup and saving reject lookalike CDN hosts and credential URLs', () => {
  for (const cover of [
    'https://vulcan.dl.playstation.net.example.com/cover.png',
    'https://user:password@vulcan.dl.playstation.net/cover.png',
    'http://vulcan.dl.playstation.net/cover.png',
    'https://other-bucket.r2.dev/exFAT/cover.avif',
    'https://pub-ce6b40c14d144a128552570bcf6bb628.r2.dev/other/cover.avif'
  ]) {
    assert.throws(() => core.buildGameRecord({
      title: 'Example Game', link: 'https://store.playstation.com/', cover
    }), /cover/i);
    assert.equal(core.extractPsStoreCover({ images: [{ url: cover }] }), null);
    assert.equal(typeof core.extractLibraryCover, 'function');
    assert.equal(core.extractLibraryCover([{ ...libraryPayload[0], image: cover }], 'PPSA28997'), null);
  }
});

test('the search returns a matching library cover without a Store dependency or GitHub token', async () => {
  assert.equal(typeof core.searchCoverByPpsa, 'function');
  const result = await core.searchCoverByPpsa('PPSA28997', {
    fetchImpl: async (url, options) => {
      assert.equal(options.credentials, 'omit');
      assert.equal(options.headers.Authorization, undefined);
      assert.equal(options.headers.authorization, undefined);
      if (url === 'https://pippo26442999.github.io/.exFAT/exFAT.json') {
        return Response.json(libraryPayload);
      }
      throw new Error('The Store is offline');
    }
  });
  assert.deepEqual(result, { title: 'God of War Sons of Sparta', imageUrl: libraryCover });
});

test('the search falls back to the Store when the library is unavailable', async () => {
  assert.equal(typeof core.searchCoverByPpsa, 'function');
  const result = await core.searchCoverByPpsa('PPSA28997', {
    fetchImpl: async url => {
      if (url === 'https://store.playstation.com/store/api/chihiro/00_09_000/container/us/en/999/PPSA28997_00?size=999') {
        return Response.json(storePayload);
      }
      throw new TypeError('Network error');
    }
  });
  assert.deepEqual(result, { title: 'God of War Sons of Sparta', imageUrl: storeCover });
});

test('an image that cannot load is skipped so another source can supply the cover', async () => {
  assert.equal(typeof core.searchCoverByPpsa, 'function');
  const result = await core.searchCoverByPpsa('PPSA28997', {
    fetchImpl: async url => Response.json(url.includes('/store/api/') ? storePayload : libraryPayload),
    verifyImage: async url => url === storeCover
  });
  assert.deepEqual(result, { title: 'God of War Sons of Sparta', imageUrl: storeCover });
});

test('missing covers and unreachable sources produce distinct outcomes', async () => {
  assert.equal(typeof core.searchCoverByPpsa, 'function');
  assert.equal(await core.searchCoverByPpsa('PPSA00001', {
    fetchImpl: async url => Response.json(url.includes('/store/api/') ? { links: [] } : [])
  }), null);
  await assert.rejects(core.searchCoverByPpsa('PPSA00001', {
    fetchImpl: async () => { throw new TypeError('Network error'); }
  }), /raggiungere/i);
  await assert.rejects(core.searchCoverByPpsa('CUSA12345'), /PPSA/i);
});
