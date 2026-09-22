# ZER0GAME

A fast, static PS5 FPKG catalog designed for GitHub Pages.

## Files

- `index.html` — layout
- `styles.css` — visual design
- `app.js` — search, filters, sorting and modal
- `games.json` — catalog data
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

## GitHub Pages

In the repository settings, enable **Pages → Deploy from a branch → main → /(root)**.
