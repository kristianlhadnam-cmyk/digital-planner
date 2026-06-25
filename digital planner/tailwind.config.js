/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#1e293b',
        secondary: '#0f172a',
        accent: '#2563eb',
        highlight: '#3b82f6',
        'text-primary': '#f1f5f9',
        'text-secondary': '#94a3b8',
        background: '#0b1120',
        card: '#1e293b',
        'card-border': '#334155',
        success: '#22c55e',
        'canvas-bg': '#f8fafc',
        'canvas-line': '#cbd5e1',
      },
    },
  },
  plugins: [],
}
