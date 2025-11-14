/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './content/**/*.{html,md}',
    './layouts/**/*.html',
    './themes/**/layouts/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        // PaperMod theme colors - these will adapt based on light/dark mode
        primary: 'var(--primary)',
        secondary: 'var(--secondary)',
        tertiary: 'var(--tertiary)',
        border: 'var(--border)',
        entry: 'var(--entry)',
        theme: 'var(--theme)',
      },
    },
  },
  plugins: [],
  // Enable dark mode support
  darkMode: 'class',
}
