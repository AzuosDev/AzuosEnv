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
        'tone-1': token('tone-1'),
        'tone-2': token('tone-2'),
        'tone-3': token('tone-3'),
        'tone-4': token('tone-4'),
        'tone-5': token('tone-5'),
        'tone-6': token('tone-6'),
        /* Exceção dos tokens: paleta do módulo WhatsApp, só dentro dele. */
        wa: {
          bg: 'var(--wa-bg)',
          panel: 'var(--wa-panel)',
          header: 'var(--wa-header)',
          chat: 'var(--wa-chat)',
          out: 'var(--wa-out)',
          in: 'var(--wa-in)',
          accent: 'var(--wa-accent)',
          brand: 'var(--wa-brand)',
          text: 'var(--wa-text)',
          muted: 'var(--wa-muted)',
          line: 'var(--wa-line)',
          read: 'var(--wa-read)',
          'quote-in': 'var(--wa-quote-in)',
          'quote-out': 'var(--wa-quote-out)',
        },
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
