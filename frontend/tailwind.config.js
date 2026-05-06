/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#10101A',
        card: '#16162A',
        'card-hover': '#1E1E35',
        primary: '#00FF41',
        secondary: '#FF5E3F',
        muted: '#A0A0AB',
        border: '#2A2A40',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-green': '0 0 40px rgba(0, 255, 65, 0.4)',
        'neon-green-lg': '0 0 80px rgba(0, 255, 65, 0.6)',
      },
    },
  },
  plugins: [],
}
