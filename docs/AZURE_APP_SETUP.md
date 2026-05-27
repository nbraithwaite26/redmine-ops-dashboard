# Azure app registration — IT handoff (Dynamics/Dataverse service account)

Instructions to forward to IT to set up the **service principal** the dashboard
uses to read Dynamics/Dataverse. Creating the app registration automatically
creates the matching **Enterprise Application** (service principal) — same
object, two blades; nothing extra to create there.

**Purpose:** a **read-only, app-only** service account so the dashboard backend
can pull opportunity data from Dataverse. **Server-to-server (client
credentials)** — no user sign-in, no redirect URIs, no admin consent.

**Environment:** `org25097510` — `https://org25097510.crm.dynamics.com` (tenant: *Avionica*).

## 1. App registration (Microsoft Entra ID)
- **Name:** `Redmine-Ops-Dashboard-Dataverse` (or per your naming standard)
- **Supported account types:** *Accounts in this organizational directory only* (single tenant)
- **Redirect URI:** **leave blank** — this is client-credentials / S2S, not interactive login
- Record the **Application (client) ID** and **Directory (tenant) ID** from Overview.
- *(An app registration already exists with client ID
  `be036e54-3f7b-4df1-b9d3-49ebaed29969` — reuse it if that's the intended one.)*

## 2. Client secret
- **Certificates & secrets → New client secret** → set an expiry (e.g. 24 months)
  → copy the **Value** (shown once) and deliver it securely. Set a rotation
  reminder before it expires.

## 3. API permissions
- **None required, no admin consent needed.** App-only Dataverse access is
  authorized by the Application User + security role below, not by Entra API
  permissions.

## 4. Dataverse Application User + role  ← currently the blocking step
- **Power Platform admin center** → **Environments** → **org25097510** →
  **Settings → Users + permissions → Application users → + New app user**
- Add the app registration (search by its **client ID**)
- **Business unit:** default/root
- **Security role:** grant **Read** on the **`TrackOpportunities`** table (plus
  Read on any related lookup tables the card displays — e.g. Account/Customer —
  if those come from linked records). Least-privilege: a custom role with only
  Read on those tables.
- Save.

## Ticket summary
- **Who needs access:** the dashboard backend (one service principal), used only
  by the CRM "Track Opportunities" card. Nothing else in the app touches Azure.
- **Access level:** **read-only** on `TrackOpportunities` (+ related lookups). No
  create/update/delete.
- **Auth:** OAuth2 client-credentials; secret stored server-side only.

## Microsoft sign-in (MSAL) — separate app registration (CR #28)

The dashboard's **Microsoft sign-in** uses a *different* app registration than
the Dataverse one above (an interactive web app, not app-only).

- **App (client) ID:** `6ae74c8d-fe2f-4fec-8196-d6f73b977497` · **Tenant:** `83531264-2270-406c-a223-6f240151d473`
- **Platform → Web → Redirect URIs:** add the dashboard callback(s):
  - Dev: `http://localhost:5173/api/auth/ms/redirect`
  - Prod: `https://<your-app>.azurewebsites.net/api/auth/ms/redirect`
- **Post-logout redirect URI:** the app origin (e.g. `http://localhost:5173/`).
- **Client secret:** stored in `MSAL_CLIENT_SECRET` (server-side); rotate before expiry.
- **API permissions:** just the default OIDC scopes (openid/profile) — no admin
  consent needed for sign-in.

The callback uses **query** response mode, so it's a standard Web redirect URI
(no SPA/implicit settings). Once the redirect URI is registered, set
`MS_AUTH_ENABLED=true` to turn the sign-in gate on.

## Not part of this request
- **Hosting** the app on Azure is a separate resource (an **App Service**,
  Linux / Node 20) — see [`AZURE_DEPLOY.md`](./AZURE_DEPLOY.md).
