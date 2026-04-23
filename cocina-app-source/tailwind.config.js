/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Albert Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        cream: {
          50: '#FDFBF7',
          100: '#FAF6F0',
          200: '#F2EADB',
          300: '#E8DFD0',
          400: '#D9CDB8',
        },
        terracotta: {
          50: '#FBF1EC',
          100: '#F4DBCD',
          300: '#E1A486',
          500: '#C65D3E',
          600: '#A94A2F',
          700: '#8A3B25',
        },
        sage: {
          100: '#E8EDE3',
          300: '#B5C4A8',
          500: '#7D9168',
          700: '#4E5E3D',
        },
        ink: {
          500: '#5C5248',
          700: '#3D362D',
          900: '#2B2620',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(43, 38, 32, 0.04), 0 4px 12px rgba(43, 38, 32, 0.06)',
        'card-lg': '0 2px 4px rgba(43, 38, 32, 0.05), 0 12px 32px rgba(43, 38, 32, 0.08)',
      },
    },
  },
  plugins: [],
}
