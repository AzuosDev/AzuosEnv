import type { Config } from 'tailwindcss';

/** Every color comes from a token of the Azuos Dev globals.css (RGB triplets). */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: token('paper'),
        'paper-2': token('paper-2'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        line: token('line'),
        ink: token('ink'),
        body: token('body'),
        muted: token('muted'),
        accent: token('accent'),
        signal: token('signal'),
        'signal-2': token('signal-2'),
        'on-signal': token('on-signal'),
        scene: token('scene'),
        'scene-line': token('scene-line'),
        dot: token('dot'),
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
        info: token('info'),
      },
      fontFamily: {
        sans: ['var(--font-display)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: { base: ['14px', '1.5'] },
      borderRadius: { xl: '12px', '2xl': '16px' },
      screens: { xs: '360px' },
    },
  },
  plugins: [],
} satisfies Config;
