import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // UDGOK Bold palette — see styles/globals.css for the CSS variable source of truth
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
        },
        orange: {
          DEFAULT: 'var(--orange)',
          dark: 'var(--orange-d)',
          light: 'var(--orange-l)',
        },
        cream: {
          DEFAULT: 'var(--cream)',
          2: 'var(--cream-2)',
        },
        paper: 'var(--paper)',
        success: 'var(--success)',
        warn: 'var(--warn)',
        error: 'var(--error)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
        serif: ['var(--font-dm-serif)', 'Georgia', 'serif'],
      },
      fontSize: {
        // Display sizes — Inter Black 900, very tight letter spacing
        'display-xl': ['clamp(56px, 7vw, 112px)', { lineHeight: '0.9', letterSpacing: '-0.045em', fontWeight: '900' }],
        'display-lg': ['clamp(40px, 5vw, 72px)', { lineHeight: '0.95', letterSpacing: '-0.035em', fontWeight: '900' }],
        'display-md': ['clamp(32px, 4vw, 56px)', { lineHeight: '1', letterSpacing: '-0.025em', fontWeight: '900' }],
      },
      letterSpacing: {
        'label': '0.12em',
        'label-wide': '0.2em',
      },
      borderWidth: {
        '3': '3px',
      },
      borderRadius: {
        'sharp': '0',
        'soft': '4px',
        'pill': '12px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-up': {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'slide-in-left': 'slide-in-left 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 200ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
