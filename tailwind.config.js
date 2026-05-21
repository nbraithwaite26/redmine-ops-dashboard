/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
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
        ink: {
          DEFAULT: '#111827',
          soft: '#1F2937',
          muted: '#4B5563',
        },
        canvas: '#F5F7FA',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.10)',
        drawer: '-8px 0 24px rgba(16, 24, 40, 0.12)',
      },
    },
  },
  plugins: [],
};
