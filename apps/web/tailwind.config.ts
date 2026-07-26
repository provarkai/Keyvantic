import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        kv: {
          navy: "#0B1D33",
          navy2: "#122842",
          charcoal: "#1C1F26",
          slate: "#5B6B7C",
          mist: "#F4F6F8",
          gold: "#C9A24B",
          gold2: "#E4C97A",
          border: "#E3E7EC",
          bordark: "#2A3140",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        serif: ["Georgia", "Times New Roman", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,29,51,0.04), 0 1px 8px rgba(11,29,51,0.06)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
