import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query. Returns the current match state and
 * updates when the viewport crosses the breakpoint.
 *
 * SSR-safe: returns `false` if `window.matchMedia` is unavailable.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => readMatch(query));

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    // Older browsers expose addListener / removeListener instead of
    // addEventListener('change', ...). Cover both.
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}

function readMatch(query: string): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(query).matches;
}
