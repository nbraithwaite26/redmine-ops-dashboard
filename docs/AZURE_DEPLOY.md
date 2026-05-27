# Azure deployment (single Node.js app)

This branch (`azure-single-node`) packages the app as **one Node.js process**
for **Azure App Service (Linux)**: the Hono backend serves both the built
React frontend and the `/api/*` routes from the same origin. No separate
static host, no CORS between frontend and API.

> The `azure-enterprise-app` branch is kept as a checkpoint **without** the
> single-process change.

## How it runs

- `npm run build` →
  1. `vite build` → static frontend in **`dist/`** (base path `/`,
     `VITE_MOCK_MODE=false`, `VITE_API_BASE=/api/redmine` from `.env.production`)
  2. `npm --workspace server run build` → compiles the server to
     **`server/dist/`** (plain ESM JS via `server/tsconfig.build.json`)
- `npm start` → `node server/dist/index.js`
  - Binds to **`process.env.PORT`** (Azure injects this; falls back to 8787 locally)
  - Serves `dist/assets/*` and falls back to `dist/index.html` (hash routing)
  - Brokers `/api/*` to Redmine / Dataverse server-side

## Azure App Service setup (Linux)

1. **Runtime stack:** Node 20 LTS.
2. **Startup command:** `npm start`
3. **Build during deploy:** set app setting `SCM_DO_BUILD_DURING_DEPLOYMENT=true`
   so Oryx runs `npm install` + `npm run build` on deploy.
4. **Application settings** (Configuration → Application settings) — these
   become `process.env.*` at runtime; do **not** ship `.env.local`:
   - `REDMINE_BASE_URL`, `REDMINE_API_KEY`, `REDMINE_READ_ONLY`
   - `SESSION_SECRET`, `ADMIN_USER`, `ADMIN_PASSWORD_HASH`
   - `ALLOWED_ORIGIN` = the App Service URL (e.g. `https://<app>.azurewebsites.net`)
   - `COOKIE_SECURE=true` (App Service serves HTTPS)
   - `DATAVERSE_URL`, `DATAVERSE_TENANT_ID`, `DATAVERSE_CLIENT_ID`, `DATAVERSE_CLIENT_SECRET`
   - **Do not set `PORT`** — Azure provides it.
   - Optional: `REDIS_URL` (multi-instance), `LOG_LEVEL`.
5. **Deploy** via GitHub Actions, `az webapp up`, or zip deploy.

`VITE_*` values are **baked at build time** (see `.env.production`). To change
the API base or toggle mock mode you must rebuild — they are not runtime env.

## Test the production build locally

```bash
npm run build
npm start            # serves http://localhost:8787 (frontend + /api)
```
