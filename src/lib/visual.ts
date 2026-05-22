/**
 * Visual helpers that return CSS strings or numbers consumed by inline
 * styles. Pure, easy to unit-test, no DOM access.
 */

/**
 * CSS conic-gradient string for a circular progress ring.
 *
 * @param progress 0–100. Values outside the range are clamped.
 * @param color   Hex color used for the filled arc.
 * @param trackColor Background color of the unfilled remainder.
 */
export function donutGradient(
  progress: number,
  color: string,
  trackColor = '#E5E7EB',
): string {
  const clamped = Math.max(0, Math.min(100, progress));
  const degrees = clamped * 3.6; // 100% == 360°
  return `conic-gradient(${color} ${degrees}deg, ${trackColor} ${degrees}deg)`;
}

/**
 * Clamps a 0–100 progress value. Convenience helper for callers that want
 * the same clamp behavior without producing a gradient string.
 */
export function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
