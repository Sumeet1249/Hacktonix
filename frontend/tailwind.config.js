/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0a0c0f",
          secondary: "#111318",
          tertiary: "#181c22",
          card: "#13161c",
        },
        accent: {
          teal: "#00e5a0",
          blue: "#3b82f6",
          amber: "#f59e0b",
          red: "#f43f5e",
        },
        border: {
          dim: "rgba(255,255,255,0.07)",
          muted: "rgba(255,255,255,0.13)",
          bright: "rgba(255,255,255,0.22)",
        },
      },
      fontFamily: {
        mono: ["'IBM Plex Mono'", "monospace"],
        display: ["Syne", "sans-serif"],
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
