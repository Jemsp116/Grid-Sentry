/** @type {import('tailwindcss').Config} */
// Grid Sentry design system — tokens from the Frontend Specification are the
// single source of truth for color. Use `bg-severity-critical`, `text-primary`,
// `border-default`, etc. throughout the app rather than raw hex values.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-base': '#0B0F14',
        'bg-surface': '#131A22',
        'bg-surface-raised': '#1A2330',
        'border-default': '#232E3B',
        'text-primary': '#E7ECF1',
        'text-secondary': '#8C9AAB',
        'text-disabled': '#54606E',
        'accent-primary': '#3DA9FC',
        severity: {
          critical: '#E5484D',
          high: '#F2994A',
          medium: '#F2C94C',
          low: '#5B8DEF',
          resolved: '#27AE60',
        },
      },
      fontFamily: {
        // UI face: Plex Sans. Data/evidence face: Plex Mono.
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        card: '8px',
        modal: '12px',
      },
    },
  },
  plugins: [],
};
