/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e8f0fe',
          100: '#d2e3fc',
          200: '#a8c7f9',
          300: '#7eabf6',
          400: '#5b8ff3',
          500: '#4285f4',
          600: '#1a73e8',
          700: '#0d62d9',
          800: '#0b56c4',
          900: '#0842a3',
        },
        success: '#2ecc71',
        error: '#e74c3c',
        warning: '#f1c40f',
        glass: {
          light: 'rgba(255, 255, 255, 0.4)',
          dark: 'rgba(255, 255, 255, 0.1)',
          'light-hover': 'rgba(255, 255, 255, 0.5)',
          'dark-hover': 'rgba(255, 255, 255, 0.15)',
          'light-active': 'rgba(255, 255, 255, 0.3)',
          'dark-active': 'rgba(255, 255, 255, 0.08)',
        },
      },
      borderColor: {
        'glass-light': 'rgba(255, 255, 255, 0.5)',
        'glass-dark': 'rgba(255, 255, 255, 0.1)',
      },
      boxShadow: {
        'glass-light': `
          0 25px 50px -12px rgba(70, 72, 212, 0.05),
          inset 0 0.5px 0 rgba(255, 255, 255, 0.3)
        `,
        'glass-hover-light': `
          0 25px 50px -12px rgba(70, 72, 212, 0.08),
          inset 0 0.5px 0 rgba(255, 255, 255, 0.4)
        `,
        'glass-active-light': `
          0 10px 20px -8px rgba(70, 72, 212, 0.04),
          inset 0 0.5px 0 rgba(255, 255, 255, 0.2)
        `,
      },
      backdropBlur: {
        glass: '20px',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
      borderRadius: {
        glass: '8px',
        'glass-lg': '16px',
        'glass-xl': '24px',
      },
    },
  },
  plugins: [],
}
