import { avatarGradient } from './avatar';

/**
 * Site-wide project color coding. Keyword-matched against the project name so
 * the same project type reads the same color in every surface that shows
 * project cards (Kanban hero, project detail hero, AllProjects edge stripe).
 *
 * Matching order matters — "Continuous Improvement" is checked before single
 * letters so a project named "STC Continuous Improvement Notes" lands on the
 * blue STC track, not amber CI. Adjust by changing the order or refining
 * the patterns if real project names start colliding.
 */
export type ProjectTone = 'stc' | 'ddp' | 'ci' | 'default';

export interface ProjectColor {
  /** Tailwind-safe solid hex for stripes, dots, badges. */
  hex: string;
  /** CSS gradient string for hero backgrounds. */
  gradient: string;
  /** Which color family matched, or 'default'. */
  tone: ProjectTone;
  /** Human-readable label for hover tooltips / aria. */
  label: string;
}

const STC = { hex: '#2563eb', from: '#3b82f6', to: '#1d4ed8' }; // blue-600 / 500 / 700
const DDP = { hex: '#16a34a', from: '#22c55e', to: '#15803d' }; // green-600 / 500 / 700
const CI = { hex: '#d97706', from: '#f59e0b', to: '#b45309' }; // amber-600 / 500 / 700

/**
 * Map a project name to its color profile. Pure — same input, same output.
 *
 * `projectId` is used for the deterministic fallback gradient when no keyword
 * matches; pass 0 if you don't have one and want the same gradient every time.
 */
export function projectColor(name: string, projectId: number = 0): ProjectColor {
  const n = name.toLowerCase();

  // Continuous Improvement before "ci" / single-letter checks would matter
  // if we ever added those; today it's a phrase match so order is forgiving.
  if (/\bcontinuous improvement\b/.test(n)) {
    return {
      hex: CI.hex,
      gradient: `linear-gradient(135deg, ${CI.from} 0%, ${CI.to} 100%)`,
      tone: 'ci',
      label: 'Continuous Improvement',
    };
  }

  // \b word boundary so "STC" matches as a token, not inside other words.
  if (/\bstc(s)?\b/.test(n)) {
    return {
      hex: STC.hex,
      gradient: `linear-gradient(135deg, ${STC.from} 0%, ${STC.to} 100%)`,
      tone: 'stc',
      label: 'STC',
    };
  }

  if (/\bddp(s)?\b/.test(n)) {
    return {
      hex: DDP.hex,
      gradient: `linear-gradient(135deg, ${DDP.from} 0%, ${DDP.to} 100%)`,
      tone: 'ddp',
      label: 'DDP',
    };
  }

  return {
    hex: '#64748b', // slate-500 — neutral stripe for "other"
    gradient: avatarGradient(projectId),
    tone: 'default',
    label: 'Other',
  };
}
