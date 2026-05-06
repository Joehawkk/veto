/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:           '#F8F8F8',
        card:         '#FFFFFF',
        'card-hover': '#F5F5F5',
        primary:      '#FD7203',
        'primary-light': '#FF9E30',
        'primary-pale':  '#FFDE8A',
        'primary-soft':  '#FFB27A',
        secondary:    '#D4350E',
        dark:         '#060606',
        'gray-dark':  '#2C2C2C',
        muted:        '#8A8A8A',
        border:       '#D9D9D9',
        'border-dark':'#BDBDBD',
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
