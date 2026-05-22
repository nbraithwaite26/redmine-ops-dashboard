import { Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import type { EffectiveTheme } from '../hooks/useTheme';

interface Props {
  effectiveTheme: EffectiveTheme;
  onToggle: () => void;
  /** Tailwind class string for the wrapper button. Lets callers fit it into
   *  different surface backgrounds (yellow TopBar vs white Settings card). */
  className?: string;
  /** Override the aria-label / tooltip. */
  label?: string;
}

/**
 * Single-button toggle between light and dark (per CR #12 Q12i option B).
 * The icon shows what mode the click WILL switch *to* so the affordance
 * matches the user's expectation: looking at light mode, you see a moon
 * ("click to go dark"); looking at dark, you see a sun.
 */
export default function ThemeToggle({
  effectiveTheme,
  onToggle,
  className,
  label,
}: Props) {
  const goingTo = effectiveTheme === 'dark' ? 'light' : 'dark';
  const Icon = effectiveTheme === 'dark' ? Sun : Moon;
  const aria = label ?? `Switch to ${goingTo} mode`;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={aria}
      aria-pressed={effectiveTheme === 'dark'}
      title={`${aria} (])`}
      data-testid="theme-toggle"
      data-effective-theme={effectiveTheme}
      className={clsx('rounded transition', className)}
    >
      <Icon size={18} />
    </button>
  );
}
