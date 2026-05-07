/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg:              'rgb(var(--bg) / <alpha-value>)',
        card:            'rgb(var(--card) / <alpha-value>)',
        'card-hover':    'rgb(var(--card-hover) / <alpha-value>)',
        primary:         'rgb(var(--primary) / <alpha-value>)',
        'primary-light': 'rgb(var(--primary-light) / <alpha-value>)',
        'primary-pale':  'rgb(var(--primary-pale) / <alpha-value>)',
        'primary-soft':  'rgb(var(--primary-soft) / <alpha-value>)',
        secondary:       'rgb(var(--secondary) / <alpha-value>)',
        dark:            'rgb(var(--dark) / <alpha-value>)',
        'gray-dark':     'rgb(var(--gray-dark) / <alpha-value>)',
        muted:           'rgb(var(--muted) / <alpha-value>)',
        border:          'rgb(var(--border) / <alpha-value>)',
        'border-dark':   'rgb(var(--border-dark) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'orange':     '0 4px 24px rgba(253, 114, 3, 0.30)',
        'orange-lg':  '0 8px 40px rgba(253, 114, 3, 0.45)',
        'card':       '0 1px 4px rgba(6, 6, 6, 0.06), 0 4px 16px rgba(6, 6, 6, 0.06)',
        'card-hover': '0 2px 8px rgba(6, 6, 6, 0.10), 0 8px 24px rgba(6, 6, 6, 0.08)',
      },
    },
  },
  plugins: [],
}
