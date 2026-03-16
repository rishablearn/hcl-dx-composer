/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Bharat Petroleum Official Brand Colors
        primary: {
          50: '#FFF9E6',
          100: '#FFF3CC',
          200: '#FFE799',
          300: '#FFDB66',
          400: '#FFCF33',
          500: '#FFD100', // BPCL Golden Yellow - Primary Brand Color
          600: '#E6BC00',
          700: '#CCA700',
          800: '#B39200',
          900: '#997D00',
        },
        secondary: {
          50: '#E6F2E9',
          100: '#CCE5D3',
          200: '#99CBA7',
          300: '#66B17B',
          400: '#33974F',
          500: '#006B3F', // BPCL Green - Secondary Brand Color
          600: '#005F38',
          700: '#005330',
          800: '#004728',
          900: '#003B20',
        },
        bpcl: {
          green: '#006B3F',      // Primary Green
          yellow: '#FFD100',     // Primary Yellow/Gold
          red: '#E31837',        // Flame Red
          orange: '#FF6B00',     // Flame Orange
          darkGreen: '#004D2C',  // Dark Green
          lightGreen: '#7AB547', // Light Green accent
        },
        navy: {
          50: '#E8ECF0',
          100: '#D1D9E1',
          200: '#A3B3C3',
          300: '#758DA5',
          400: '#476787',
          500: '#1A4169',
          600: '#163757',
          700: '#122D46',
          800: '#102439', // Dark Navy / Firefly
          900: '#0A1824',
        },
        neutral: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          150: '#F3F4F6', // App background
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
        // Status colors
        success: {
          50: '#ECFDF5',
          500: '#10B981',
          600: '#059669',
        },
        warning: {
          50: '#FFFBEB',
          500: '#F59E0B',
          600: '#D97706',
        },
        error: {
          50: '#FEF2F2',
          500: '#EF4444',
          600: '#DC2626',
        },
        info: {
          50: '#EFF6FF',
          500: '#3B82F6',
          600: '#2563EB',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        'glass-sm': '0 4px 16px 0 rgba(31, 38, 135, 0.1)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 10px 40px -10px rgba(0, 0, 0, 0.15)',
      },
      backdropBlur: {
        'glass': '16px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
