import { BarChart3, ExternalLink } from 'lucide-react';

/**
 * `/reports/power-bi` — embeds a Power BI report inside the dashboard
 * via PBI's **Secure embed** flow (`File → Embed report → Website or
 * portal` in PBI Service). The iframe loads the report directly; PBI
 * handles auth via the viewer's existing session cookie. If the viewer
 * isn't signed into Power BI in their browser yet, PBI's own sign-in
 * page renders inside the iframe and hands them back when done.
 *
 * Configure via `VITE_PBI_EMBED_URL` (set in `.env.local` for dev or
 * baked into the portable .exe at build time). Falls back to the
 * "CRM Open Opportunities" report so the page renders out of the box.
 */

// The src URL from PBI's secure-embed dialog. Stripping any stray
// trailing `%22` (a `"`) that PBI's copy-paste sometimes leaves
// stuck on the end of the URL.
const DEFAULT_EMBED_URL =
  'https://app.powerbi.com/reportEmbed?reportId=7eb465ac-883d-49f5-b3ca-17392d641302&autoAuth=true&ctid=83531264-2270-406c-a223-6f240151d473';

const REPORT_TITLE = 'CRM Open Opportunities';

function readEmbedUrl(): string {
  const raw = (import.meta.env.VITE_PBI_EMBED_URL ?? DEFAULT_EMBED_URL).toString().trim();
  // Some sources URL-encode a stray closing quote (`%22`); strip it.
  return raw.replace(/%22$/i, '').replace(/"$/, '');
}

export default function PowerBiReport() {
  const embedUrl = readEmbedUrl();
  const openExternal = embedUrl.replace('/reportEmbed', '/groups/me/reports'); // best-effort

  if (!embedUrl) {
    return <NotConfigured />;
  }

  return (
    <main className="p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-ink-muted" />
            <h1 className="text-2xl font-semibold">{REPORT_TITLE}</h1>
          </div>
          <p className="text-sm text-ink-muted">
            Live Power BI report. If the frame is blank, sign into Power BI in
            another tab and refresh.
          </p>
        </div>
        <a
          href={openExternal}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-border-default px-2 py-1 text-xs text-ink-muted hover:bg-canvas"
          data-testid="powerbi-open-external"
        >
          Open in Power BI <ExternalLink size={12} />
        </a>
      </header>

      <div
        className="overflow-hidden rounded-lg border border-border-default bg-surface"
        style={{ height: '78vh' }}
        data-testid="powerbi-frame"
      >
        <iframe
          title={REPORT_TITLE}
          src={embedUrl}
          className="h-full w-full"
          frameBorder={0}
          allowFullScreen
        />
      </div>
    </main>
  );
}

function NotConfigured() {
  return (
    <main className="p-6">
      <div className="flex items-center gap-2">
        <BarChart3 size={18} className="text-ink-muted" />
        <h1 className="text-2xl font-semibold">Power BI</h1>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Embed URL not configured. Set <code>VITE_PBI_EMBED_URL</code> in
        <code className="ml-1">.env.local</code> and restart, or pass it at
        build time for the portable .exe.
      </p>
    </main>
  );
}
