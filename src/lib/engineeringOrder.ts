/**
 * Bucket-based ordering for dropdowns that mix engineering and
 * non-engineering items. Surfaces what AE engineers reach for most:
 *
 *   1. Aircraft Engineering / AE
 *   2. Custom Engineering Services + STC work
 *   3. Other engineering (Systems Eng, LRU, FDS, GRS, …)
 *   4. Everything else
 *
 * Inside each bucket the items keep alphabetical order so the list is
 * still scannable.
 *
 * Used by AddTimeModal for the Activity and Project dropdowns. Pure
 * functions — no React/DOM dependencies, easy to unit-test.
 */

/** Tier numbers — lower = higher in the dropdown. */
export const TIER_AE = 0;
export const TIER_STC_CUSTOM_ENG = 1;
export const TIER_OTHER_ENG = 2;
export const TIER_REST = 3;

const AE_RX = /(?:^AE\b|aircraft\s+engineering)/i;
const STC_RX = /\bSTCs?\b/i;
const CUSTOM_ENG_RX = /custom\s+engineering\s+services?/i;
const OTHER_ENG_RX = /engineering|^LRU\b|^FDS\b|^GRS\b|system(?:s)?\s+eng/i;

/**
 * Returns the tier (0..3) for an item's display string.
 *
 * Note: the AE bucket has priority over STC/CES — `AE 04.0 New STC` lands
 * in tier AE rather than tier STC, since the user reads it as an AE
 * activity that happens to be about STCs.
 */
export function engineeringTier(label: string): number {
  if (AE_RX.test(label)) return TIER_AE;
  if (STC_RX.test(label) || CUSTOM_ENG_RX.test(label)) return TIER_STC_CUSTOM_ENG;
  if (OTHER_ENG_RX.test(label)) return TIER_OTHER_ENG;
  return TIER_REST;
}

/**
 * Bucket-sorts a list of strings (e.g. time activities) by engineering
 * priority, alphabetical within each bucket. Stable on equal labels.
 */
export function sortByEngineeringPriority(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const ta = engineeringTier(a);
    const tb = engineeringTier(b);
    if (ta !== tb) return ta - tb;
    return a.localeCompare(b);
  });
}

/**
 * Same shape for objects that carry a `name` field (projects, etc.).
 * Returns a new array — caller's input is not mutated.
 */
export function sortObjectsByEngineeringPriority<T extends { name: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    const ta = engineeringTier(a.name);
    const tb = engineeringTier(b.name);
    if (ta !== tb) return ta - tb;
    return a.name.localeCompare(b.name);
  });
}
