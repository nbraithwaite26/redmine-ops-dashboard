/**
 * Entrypoint for the portable Windows .exe (CR #30).
 *
 * The compiled binary runs in a clean process — no `.env.local`, no
 * shell-exported variables — so we set the PORTABLE flag here, before
 * `./index.js` (and `./config.js`) loads and checks env.
 *
 * Centralized dev / production still use `./index.js` directly and
 * leave PORTABLE unset, so this file is touched only by the portable
 * build pipeline (see `scripts/build-portable.mjs`).
 */
process.env.PORTABLE = 'true';
// Portable users default to writable. They can flip the .env-style
// override by launching with REDMINE_READ_ONLY=true if they ever want
// the dashboard locked down on their own machine.
process.env.REDMINE_READ_ONLY ??= 'false';
// Warmer pre-fetches hot keys on startup so the first page load isn't
// waiting on a cold cache. Single-user portable is the ideal case for
// this — there are no other dashboard sessions competing for the
// upstream's quota. Set CACHE_WARM_ENABLED=false at launch to override.
process.env.CACHE_WARM_ENABLED ??= 'true';

await import('./index.js');
