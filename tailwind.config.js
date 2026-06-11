/** @type {import("tailwindcss").Config} */
const config = {
  theme: {
    extend: {
      colors: {
        bolao: {
          bg: "#020617",
          surface: "#0b1220",
          surfaceElevated: "#111827",
          border: "#ffffff14",
          muted: "#8da2c0",
          foreground: "#f8fafc",
          accent: "#10b981",
          accentStrong: "#059669",
          accentSoft: "#34d399",
          zero: "#64748b",
        },
      },
      boxShadow: {
        premium:
          "0 24px 80px rgba(2, 6, 23, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
};

module.exports = config;
