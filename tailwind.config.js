/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#121212',
        surfaceHighlight: '#1e1e1e',
        border: '#2e2e2e',
        primary: {
          DEFAULT: '#3b82f6', // blue-500
          hover: '#2563eb',   // blue-600
        },
        accent: {
          DEFAULT: '#10b981', // emerald-500
          hover: '#059669',   // emerald-600
        },
        danger: '#ef4444',    // red-500
        success: '#22c55e',   // green-500
        warning: '#f59e0b',   // amber-500
        text: {
          primary: '#f3f4f6', // gray-100
          secondary: '#9ca3af', // gray-400
          muted: '#6b7280',     // gray-500
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
