// One-off discovery helper for the Dataverse integration (CR #26).
// Reads DATAVERSE_* from .env.local, gets a client-credentials token, and
// searches the table catalog for the TrackOpportunities table so we can learn
// its real EntitySetName + columns before building the UI.
//
//   node server/scripts/dynamics-discover.mjs [searchTerm]
//
import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, '..', '..', '.env.local'), quiet: true });

const RAW_URL = (process.env.DATAVERSE_URL || '').replace(/\/$/, '');
// Normalize to the org origin regardless of whether the env value includes an
// /api/data/... path — the token scope and Web API base both hang off origin.
const URL_BASE = RAW_URL ? new URL(RAW_URL).origin : '';
const TENANT = process.env.DATAVERSE_TENANT_ID;
const CLIENT = process.env.DATAVERSE_CLIENT_ID;
const SECRET = process.env.DATAVERSE_CLIENT_SECRET;
const SEARCH = (process.argv[2] || 'opportun,track,focus').toLowerCase().split(',');

function need(name, val) {
  if (!val) {
    console.error(`Missing ${name} in .env.local`);
    process.exit(1);
  }
}
need('DATAVERSE_URL', URL_BASE);
need('DATAVERSE_TENANT_ID', TENANT);
need('DATAVERSE_CLIENT_ID', CLIENT);
need('DATAVERSE_CLIENT_SECRET', SECRET);

async function getToken() {
  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT,
      client_secret: SECRET,
      scope: `${URL_BASE}/.default`,
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error('Token request failed:', res.status, body.error, body.error_description);
    process.exit(1);
  }
  return body.access_token;
}

async function api(token, path) {
  const res = await fetch(`${URL_BASE}/api/data/v9.2/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

const token = await getToken();
console.log('✓ token acquired\n');

// 1) Find the table in the entity catalog.
const defs = await api(
  token,
  'EntityDefinitions?$select=LogicalName,EntitySetName,DisplayName',
);
if (defs.status !== 200) {
  console.error('EntityDefinitions failed:', defs.status, JSON.stringify(defs.body.error));
  process.exit(1);
}
const label = (d) => d.DisplayName?.UserLocalizedLabel?.Label || '';
const matches = defs.body.value.filter((d) => {
  const hay = `${d.LogicalName} ${d.EntitySetName} ${label(d)}`.toLowerCase();
  return SEARCH.some((s) => hay.includes(s.trim()));
});
console.log(`Tables matching [${SEARCH.join(', ')}]:`);
for (const d of matches) {
  console.log(`  • logical=${d.LogicalName}  set=${d.EntitySetName}  label="${label(d)}"`);
}
if (matches.length === 0) {
  console.log('  (none — try a different search term as argv[2])');
  process.exit(0);
}

// 2) For the first match, list columns + one sample row.
const target = matches[0];
console.log(`\nColumns for ${target.LogicalName}:`);
const attrs = await api(
  token,
  `EntityDefinitions(LogicalName='${target.LogicalName}')/Attributes?$select=LogicalName,AttributeType,DisplayName`,
);
if (attrs.status === 200) {
  for (const a of attrs.body.value) {
    console.log(`  - ${a.LogicalName} (${a.AttributeType}) "${label(a)}"`);
  }
}
console.log(`\nSample row from ${target.EntitySetName}:`);
const sample = await api(token, `${target.EntitySetName}?$top=1`);
console.log(sample.status, JSON.stringify(sample.body.value?.[0] ?? sample.body, null, 2));
