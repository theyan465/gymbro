# e2e tests

Real headless Chromium against the static site, in local mode (no Supabase). 16 tests: boot, quick entry, new product,
picker tabs (Products / Dishes), dish builder + barcode button, rename sync, template editor layout (340–900 px),
superset + video links, URL sanitising, localization (en/uk/pl), PWA assets.

```
npm install
npx playwright install chromium
npm run test:e2e
```
