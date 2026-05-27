/** Up to two uppercase initials from a display name (e.g. "Nigel Braithwaite" → "NB"). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// A small palette of pleasant gradient stops. Index is chosen deterministically
// from a seed so each engineer keeps a stable hero color across renders.
const GRADIENTS: [string, string][] = [
  ['#0f766e', '#134e4a'], // teal → deep teal
  ['#4f46e5', '#312e81'], // indigo
  ['#0369a1', '#0c4a6e'], // sky → deep blue
  ['#7c3aed', '#4c1d95'], // violet
  ['#b45309', '#78350f'], // amber → brown
  ['#be123c', '#7f1d1d'], // rose → deep red
  ['#15803d', '#14532d'], // green
  ['#475569', '#1e293b'], // slate (the reference's muted green-gray feel)
];

/** Stable CSS linear-gradient for an avatar/hero, derived from a numeric seed. */
export function avatarGradient(seed: number): string {
  const [from, to] = GRADIENTS[Math.abs(seed) % GRADIENTS.length];
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}
