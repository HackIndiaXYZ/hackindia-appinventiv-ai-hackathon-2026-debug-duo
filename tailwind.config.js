/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0B192C',
          darkBlue: '#1E3E62',
          mediumBlue: '#1F4068',
          accentGreen: '#10B981',  // emerald-500
          accentGreenDark: '#047857', // emerald-700
          lightBg: '#F8FAFC',
          borderGray: '#E2E8F0',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
