/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a5f',
        },
      },
      keyframes: {
        'fade-slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-slide-right': {
          from: { opacity: '0', transform: 'translateX(-10px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'zoom-in': {
          from: { opacity: '0', transform: 'scale(0.94)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'ping-slow': {
          '0%':   { transform: 'scale(1)',   opacity: '0.7' },
          '80%':  { transform: 'scale(2.6)', opacity: '0' },
          '100%': { transform: 'scale(2.6)', opacity: '0' },
        },
        'sweep-x': {
          from: { transform: 'translateX(-100%)' },
          to:   { transform: 'translateX(200%)' },
        },
        'dash-flow': {
          to: { strokeDashoffset: '-16' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-slide-up': 'fade-slide-up 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-slide-right': 'fade-slide-right 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        'zoom-in': 'zoom-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
        'ping-slow': 'ping-slow 1.8s cubic-bezier(0, 0, 0.2, 1) infinite',
        'sweep-x': 'sweep-x 2.2s ease-in-out infinite',
        'dash-flow': 'dash-flow 0.6s linear infinite',
        'spin-slow': 'spin-slow 0.8s linear infinite',
      },
    },
  },
  plugins: [],
}
