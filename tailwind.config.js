/** @type {import('tailwindcss').Config} */
export default {
  // Use class strategy so :root.dark drives dark mode (we toggle the class
  // ourselves in useTheme). The CSS variables in index.css do the actual
  // recoloring; this just enables the `dark:` variant if any class ever
  // needs it.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand stays constant in both themes (CR #12 Q12e).
        brand: {
          DEFAULT: '#FEDF00',
          50: '#FFFCE0',
          100: '#FFF8B8',
          200: '#FFF180',
          300: '#FFE847',
          400: '#FEDF00',
          500: '#E8CB00',
          600: '#C2A900',
          700: '#9C8700',
        },
        // Theme-aware tokens — driven by CSS variables in :root and :root.dark.
        ink: {
          DEFAULT: 'var(--text-ink)',
          soft: 'var(--text-ink-soft)',
          muted: 'var(--text-ink-muted)',
        },
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-card)',
        elevated: 'var(--bg-elevated)',
        subtle: 'var(--bg-subtle)',
        'border-default': 'var(--border-default)',
        'border-muted': 'var(--border-muted)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        drawer: '-8px 0 24px rgba(0, 0, 0, 0.30)',
      },
    },
  },
  plugins: [],
};
