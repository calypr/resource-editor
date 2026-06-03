# GitHub Pages Deployment Guide

This guide documents the exact setup for deploying this Vite React app to GitHub Pages, including:

- Build output and publish flow
- Vite base path configuration
- SPA routing options (HashRouter vs BrowserRouter fallback)
- A ready-to-use GitHub Actions workflow

## 1. Decide Routing Strategy

GitHub Pages serves static files only and does not provide server-side SPA fallback.

Choose one strategy:

1. HashRouter (recommended for Pages simplicity)
- Route URLs look like `/#/resource/new`
- No custom 404 fallback needed
- Most reliable on static hosts

2. BrowserRouter with fallback
- Route URLs look like `/resource/new`
- Requires explicit 404 fallback handling to avoid deep-link 404s
- More setup and moving pieces

## 2. Configure Vite Base Path

For project pages (`https://<owner>.github.io/<repo>/`), Vite must build assets with the repo base.

Update [vite.config.ts](../vite.config.ts):

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const isGhPagesBuild = process.env.GITHUB_ACTIONS === 'true' && repo.length > 0;

export default defineConfig({
  base: isGhPagesBuild ? `/${repo}/` : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/fhir-proxy': {
        target: 'https://google-fhir.fhir-aggregator.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fhir-proxy/, ''),
      },
      '/schema-proxy': {
        target: 'https://hl7.org/fhir',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/schema-proxy/, ''),
      },
    },
  },
});
```

Notes:

- Dev remains `/`.
- CI build on GitHub Actions automatically uses `/<repo>/`.

## 3. Routing Setup

### Option A: HashRouter (recommended)

Update [src/main.tsx](../src/main.tsx):

```tsx
import { HashRouter } from 'react-router-dom';

// replace <BrowserRouter> with <HashRouter>
<HashRouter>
  {/* providers and app */}
</HashRouter>
```

No additional Pages fallback files are required.

### Option B: BrowserRouter with static fallback

Keep BrowserRouter, and add a 404 fallback file so deep links redirect to the app entry point.

Create [public/404.html](../public/404.html):

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=./index.html" />
    <script>
      const path = window.location.pathname + window.location.search + window.location.hash;
      sessionStorage.setItem('redirect_path', path);
      window.location.replace('./index.html');
    </script>
  </head>
  <body></body>
</html>
```

Then, in [src/main.tsx](../src/main.tsx), restore the route after app boot:

```tsx
const redirectPath = sessionStorage.getItem('redirect_path');
if (redirectPath) {
  sessionStorage.removeItem('redirect_path');
  window.history.replaceState(null, '', redirectPath);
}
```

## 4. GitHub Actions Workflow

Create [.github/workflows/deploy-pages.yml](../.github/workflows/deploy-pages.yml):

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install
        run: npm ci

      - name: Build
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## 5. Repository Settings

In GitHub repository settings:

1. Open Settings -> Pages.
2. Source: GitHub Actions.
3. Ensure default branch is the one used by the workflow trigger.

## 6. Validate Deployment

After deployment:

1. Open `https://<owner>.github.io/<repo>/`.
2. Verify app shell loads with CSS and JS assets.
3. Verify route navigation:
- HashRouter: direct link with `/#/...`
- BrowserRouter fallback: direct `/resource/...` deep link reload
4. Verify schema and terminology requests in browser devtools.

## 7. Important Differences from Local Dev

In local dev, Vite provides `/fhir-proxy` and `/schema-proxy`.
On GitHub Pages, those dev proxies do not exist.

For GitHub Pages runtime, every API/schema URL must be directly browser-accessible with valid CORS, or replaced by a real backend/edge proxy outside Pages.

## 8. POC Recommendation

For the fastest and most stable GitHub Pages publish:

1. Use HashRouter.
2. Use CI-driven base path (`/<repo>/`).
3. Treat Pages as demo-only when relying on external schema/terminology services.
