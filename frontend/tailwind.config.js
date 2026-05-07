/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg:              'var(--color-bg)',
        card:            'var(--color-card)',
        'card-hover':    'var(--color-card-hover)',
        primary:         'var(--color-primary)',
        'primary-light': 'var(--color-primary-light)',
        'primary-pale':  'var(--color-primary-pale)',
        'primary-soft':  'var(--color-primary-soft)',
        secondary:       'var(--color-secondary)',
        dark:            'var(--color-dark)',
        'gray-dark':     'var(--color-gray-dark)',
        muted:           'var(--color-muted)',
        border:          'var(--color-border)',
        'border-dark':   'var(--color-border-dark)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'orange':    '0 4px 24px rgba(253, 114, 3, 0.30)',
        'orange-lg': '0 8px 40px rgba(253, 114, 3, 0.45)',
        'card':      '0 1px 4px rgba(6, 6, 6, 0.06), 0 4px 16px rgba(6, 6, 6, 0.06)',
        'card-hover':'0 2px 8px rgba(6, 6, 6, 0.10), 0 8px 24px rgba(6, 6, 6, 0.08)',
      },
    },
  },
  plugins: [],
}
