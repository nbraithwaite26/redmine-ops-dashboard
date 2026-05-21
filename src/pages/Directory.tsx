import { ExternalLink, FolderKanban } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getDirectoryLinks } from '../services/redmineApi';
import type { DirectoryLink } from '../types/redmine';

export default function Directory() {
  const [links, setLinks] = useState<DirectoryLink[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => setLinks(await getDirectoryLinks()))();
  }, []);

  const grouped = useMemo(() => {
    const filtered = query
      ? links.filter((l) => l.label.toLowerCase().includes(query.toLowerCase()))
      : links;
    const map = new Map<string, DirectoryLink[]>();
    filtered.forEach((l) => {
      if (!map.has(l.group)) map.set(l.group, []);
      map.get(l.group)!.push(l);
    });
    return Array.from(map.entries());
  }, [links, query]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Directory</h1>
          <div className="text-sm text-ink-muted">
            Grouped internal links and Redmine project navigation
          </div>
        </div>
        <input
          className="border border-gray-200 bg-white rounded px-3 py-1.5 text-sm w-64"
          placeholder="Filter directory…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {grouped.map(([group, items]) => (
          <section key={group} className="card p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <FolderKanban size={16} className="text-ink-muted" />
              {group}
            </h2>
            <ul className="text-sm space-y-1">
              {items.map((l) => (
                <li key={l.id}>
                  <a
                    className="link inline-flex items-center gap-1"
                    href={l.url}
                    target={l.type === 'external' ? '_blank' : undefined}
                    rel={l.type === 'external' ? 'noreferrer' : undefined}
                  >
                    {l.label}
                    {l.type === 'external' && <ExternalLink size={12} />}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
