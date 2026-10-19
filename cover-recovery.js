(() => {
  const selectors = '.game-cover, .collection-item img, .recent-game img, .game-dialog-grid > img, .last-cover, .queue-entry img';
  const normalize = value => {
    const source = String(value || '').trim();
    if (!source) return '';
    try {
      const url = new URL(source, document.baseURI);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  };
  const entryFor = image => {
    const games = window.Zer0Dashboard?.state?.games || [];
    const original = image.dataset.coverOriginal || image.src;
    return games.find(game => normalize(game.cover) === original);
  };
  const placeholder = (title, dialog) => {
    const surface = document.createElement('div');
    surface.className = dialog ? 'game-cover-fallback dialog-cover-fallback' : 'game-cover game-cover-fallback';
    surface.setAttribute('role', 'img');
    surface.setAttribute('aria-label', 'Cover non disponibile: ' + title);
    const mark = document.createElement('span');
    mark.className = 'cover-fallback-mark';
    mark.textContent = 'Z0';
    const label = document.createElement('strong');
    label.className = 'cover-fallback-title';
    label.textContent = title;
    const note = document.createElement('small');
    note.className = 'cover-fallback-note';
    note.textContent = 'Artwork unavailable';
    surface.append(mark, label, note);
    return surface;
  };
  document.addEventListener('error', event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.matches(selectors)) return;
    const game = entryFor(image);
    const backups = Array.isArray(game?.coverFallbacks) ? game.coverFallbacks : [game?.coverFallback];
    const nextIndex = Number(image.dataset.coverFallbackIndex || 0);
    for (let index = nextIndex; index < backups.length; index++) {
      const alternative = normalize(backups[index]);
      if (!alternative || alternative === image.src || alternative === normalize(game.cover)) continue;
      image.dataset.coverOriginal = normalize(game.cover);
      image.dataset.coverFallbackIndex = String(index + 1);
      image.referrerPolicy = 'no-referrer';
      image.src = alternative;
      return;
    }
    const isCard = image.classList.contains('game-cover');
    const isDialog = image.matches('.game-dialog-grid > img');
    if (isCard || isDialog) {
      const title = game?.title || image.alt.replace(/\s+cover$/i, '').trim() || 'ZER0GAME';
      image.replaceWith(placeholder(title, isDialog));
      return;
    }
    image.remove();
  }, true);
})();
