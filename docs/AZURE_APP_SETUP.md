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

## Not part of this request
- **Hosting** the app on Azure is a separate resource (an **App Service**,
  Linux / Node 20) — see [`AZURE_DEPLOY.md`](./AZURE_DEPLOY.md).
- A **redirect URI** would only be needed later if per-user **SSO** sign-in is
  added (roadmap Phase A), e.g. `https://<app>.azurewebsites.net/auth/callback`.
  Not needed for the CRM data connection.
