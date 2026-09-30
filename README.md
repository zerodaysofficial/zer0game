# ZER0GAME

A fast, static PS5 FPKG catalog designed for GitHub Pages.

## Files

- `index.html` — layout
- `styles.css` — visual design
- `app.js` — search, filters, sorting and modal
- `games.json` — catalog data
- `admin.html`, `admin.js`, `admin.css`, `admin-core.mjs` — owner upload panel
- `tests/admin-core.test.mjs` — record and link validation tests
- `.nojekyll` — serve the site as plain static files

## Add a game

Edit `games.json` and add an object with:

- title
- titleId
- version
- firmware
- size
- status: `released` or `soon`
- date: `YYYY-MM-DD`
- cover
- text/audio languages
- notes
- releaseUrl / infoUrl

Use release links only for content you are authorized to distribute.

## Owner upload panel

Open `/admin.html` on the published site. Sign in with a fine-grained GitHub personal access token restricted to this repository and with **Contents: Read and write**. The panel accepts edits only from the repository owner, keeps the token in page memory for the current tab, and clears it when you sign out or reload. It uploads the cover and adds the entry to `games.json` on `main`. The HTTPS LINK is saved to the existing game download action and appears through the site's current **DOWNLOAD GAME** button. Add a link to an authorized download or store page.

## GitHub Pages

In the repository settings, enable **Pages → Deploy from a branch → main → /(root)**.
