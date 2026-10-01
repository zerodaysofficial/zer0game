# ZER0GAME

A fast, static PS5 FPKG catalog designed for GitHub Pages.

## Files

- `index.html` — layout
- `styles.css` — visual design
- `app.js` — search, filters, sorting and modal
- `games.json` — catalog data
- `admin.html`, `admin.js`, `admin.css`, `admin-core.mjs` — owner upload and edit panel
- `tests/admin-core.test.mjs` — record validation, metadata retention and catalog update tests
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

## Owner upload and edit panel

Open `/admin.html` on the published site. Sign in with a fine-grained GitHub personal access token restricted to this repository and with **Contents: Read and write**. The page checks that the token belongs to the repository owner before revealing the editor, keeps the token in page memory for the current tab, and clears it when you sign out or reload. It uploads the cover and adds the entry to `games.json` on `main`. The HTTPS LINK is saved to the existing game download action and appears through the site's current **DOWNLOAD GAME** button. Add a link to an authorized download or store page.

Search the existing catalog by title or PPSA, then select **Modifica** to open a prefilled form. **Salva modifiche** updates that same entry, preserving its original date, languages, credits and other metadata outside the form. Keep the current cover, upload a replacement or look one up through PPSA. The optional **LINK DLC** controls the separate **DOWNLOAD DLC** action. An existing entry can keep an empty LINK.

**+ Nuova scheda** switches back to upload mode; **Annulla modifica** discards the edit form. **Ricarica elenco** fetches the latest catalog. If someone changed or removed the selected entry after you opened it, saving stops and asks you to reload the entry instead of overwriting their work.

GitHub Pages serves this static page publicly. It is not linked in site navigation and uses `noindex`, but those are not access controls. GitHub repository write permissions remain the security boundary; keep Contents write access limited to the intended accounts.

## GitHub Pages

In the repository settings, enable **Pages → Deploy from a branch → main → /(root)**.
