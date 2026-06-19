#!/usr/bin/env node
/**
 * CR #30 — build the portable Windows .exe and a versioned update zip.
 *
 * What this script does (in order):
 *   1. Verifies `bun` is on PATH. If not, prints the install link and exits.
 *   2. Reads the version from package.json.
 *   3. Builds the SPA with VITE_BASE=/ and a portable-tuned pagination
 *      concurrency (`VITE_PAGINATE_CONCURRENCY=6`).
 *   4. Copies dist/ next to the .exe so the Hono server can serve it.
 *   5. Compiles the .exe with Bun. The app version is baked into the
 *      binary via `--define __APP_VERSION__='"x.y.z"'` so the topbar
 *      version chip and /api/redmine/health both report the right build.
 *   6. Zips the folder to `build/redmine-ops-dashboard-v{X.Y.Z}.zip` so
 *      you can share a single artifact named after its version.
 *
 * Output:
 *   build/redmine-ops-dashboard/             — folder you can run locally
 *   build/redmine-ops-dashboard-v0.2.0.zip   — versioned update bundle
 *
 * Usage:
 *   npm run build:portable
 *
 * Re-running is idempotent; the build/ folder is cleaned each time.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  cpSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const OUT_BUILD = resolve(REPO_ROOT, 'build');
const OUT_DIR = resolve(OUT_BUILD, 'redmine-ops-dashboard');
const OUT_EXE = resolve(OUT_DIR, 'redmine-ops-dashboard.exe');
const OUT_DIST = resolve(OUT_DIR, 'dist');
const SPA_DIST = resolve(REPO_ROOT, 'dist');
const SERVER_ENTRY = resolve(REPO_ROOT, 'server', 'src', 'portable-main.ts');
const PKG_PATH = resolve(REPO_ROOT, 'package.json');

function die(msg) {
  console.error(`\n[build-portable] ${msg}\n`);
  process.exit(1);
}

function readVersion() {
  try {
    const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8'));
    if (typeof pkg.version === 'string' && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch (err) {
    die(`Could not read package.json: ${err.message}`);
  }
  die('package.json is missing a `version` field.');
}

function ensureBunInstalled() {
  const probe = spawnSync('bun', ['--version'], { stdio: 'pipe', shell: true });
  if (probe.status !== 0) {
    console.error('');
    console.error('[build-portable] Bun is required but was not found on PATH.');
    console.error('');
    console.error('  Install on Windows (PowerShell):');
    console.error('    powershell -c "irm bun.sh/install.ps1 | iex"');
    console.error('');
    console.error('  Then restart your terminal and re-run `npm run build:portable`.');
    console.error('');
    process.exit(2);
  }
  const version = (probe.stdout?.toString() ?? '').trim();
  console.log(`[build-portable] bun ${version} detected.`);
}

function buildSpa() {
  console.log('[build-portable] building SPA (VITE_BASE=/, paginate concurrency=6)…');
  const res = spawnSync('npm', ['run', 'build'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_BASE: '/',
      // Portable single-user: no other dashboard sessions are competing
      // for the upstream Redmine connection pool, so we can fan out more
      // paginated reads in parallel. See realRedmineApi.ts.
      VITE_PAGINATE_CONCURRENCY: '6',
    },
    shell: true,
  });
  if (res.status !== 0) die('SPA build failed.');
  if (!existsSync(SPA_DIST)) die(`Expected ${SPA_DIST} after build, but it does not exist.`);
}

function copyDist() {
  console.log(`[build-portable] copying SPA into ${OUT_DIST}…`);
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  cpSync(SPA_DIST, OUT_DIST, { recursive: true });
}

function compileExe(version) {
  console.log(`[build-portable] compiling .exe with Bun (version ${version})…`);
  // --compile               → standalone binary
  // --target=bun-windows-x64 → cross-compile from any host
  // --windows-hide-console  → no terminal window on double-click
  const args = [
    'build',
    '--compile',
    '--target=bun-windows-x64',
    '--windows-hide-console',
    '--outfile',
    OUT_EXE,
    SERVER_ENTRY,
  ];
  const res = spawnSync('bun', args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env, PORTABLE: 'true' },
    shell: true,
  });
  if (res.status !== 0) die('bun build failed.');
}

/**
 * Write a tiny `package.json` next to the .exe so the running binary
 * can report its version via /api/redmine/health → topbar version chip.
 * Bun's `--define` would have been cleaner but doesn't survive Windows
 * shell-quoting in spawnSync. Reading a sibling file at startup works
 * across both centralized and portable deployments.
 */
function writeVersionMarker(version) {
  const path = resolve(OUT_DIR, 'package.json');
  writeFileSync(path, JSON.stringify({ name: 'redmine-ops-dashboard', version }, null, 2));
  console.log(`[build-portable] wrote version marker → ${path}`);
}

/**
 * Zip the OUT_DIR folder using Node's built-in `zlib` plus a tiny ZIP
 * writer. To avoid a new npm dependency we shell out to PowerShell's
 * `Compress-Archive`, which ships with every supported Windows. On
 * non-Windows hosts we fall back to `zip` if available; otherwise we
 * skip the zip step with a warning.
 */
function zipFolder(version) {
  const zipName = `redmine-ops-dashboard-v${version}.zip`;
  const zipPath = resolve(OUT_BUILD, zipName);
  console.log(`[build-portable] zipping → ${zipPath}…`);
  // Delete any prior zip for this version so Compress-Archive doesn't
  // error on existing destination.
  if (existsSync(zipPath)) rmSync(zipPath);

  if (process.platform === 'win32') {
    const ps = [
      `$ProgressPreference = 'SilentlyContinue';`,
      `Compress-Archive -Path '${OUT_DIR}\\*' -DestinationPath '${zipPath}' -CompressionLevel Optimal -Force`,
    ].join(' ');
    const res = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      stdio: 'inherit',
    });
    if (res.status !== 0) die('PowerShell Compress-Archive failed.');
  } else {
    const probe = spawnSync('zip', ['-v'], { stdio: 'pipe' });
    if (probe.status !== 0) {
      console.warn(
        `[build-portable] no zip tool available — skipping zip. Folder is ready at ${OUT_DIR}.`,
      );
      return null;
    }
    const res = spawnSync('zip', ['-r', zipPath, '.'], {
      cwd: OUT_DIR,
      stdio: 'inherit',
    });
    if (res.status !== 0) die('zip failed.');
  }

  const size = (statSync(zipPath).size / (1024 * 1024)).toFixed(1);
  console.log(`[build-portable] zip ready (${size} MB).`);
  return zipPath;
}

function finalReport(version, zipPath) {
  console.log('');
  console.log(`[build-portable] done (v${version}).`);
  console.log(`  Folder: ${OUT_DIR}`);
  if (zipPath) console.log(`  Update zip: ${zipPath}`);
  console.log('  Share the zip with teammates; they unzip + double-click the .exe.');
  console.log('');
}

const version = readVersion();
ensureBunInstalled();
buildSpa();
copyDist();
compileExe(version);
writeVersionMarker(version);
const zipPath = zipFolder(version);
finalReport(version, zipPath);
