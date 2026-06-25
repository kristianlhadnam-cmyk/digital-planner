/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#1a1a2e',
        secondary: '#16213e',
        accent: '#0f3460',
        highlight: '#e94560',
        'text-primary': '#eaeaea',
        'text-secondary': '#a0a0b0',
        background: '#0f0f23',
        card: '#1a1a2e',
        'card-border': '#2a2a4a',
        success: '#4ecca3',
        'canvas-bg': '#fffef9',
        'canvas-line': '#d4d4e8',
      },
    },
  },
  plugins: [],
}
