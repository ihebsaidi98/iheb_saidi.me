import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/sections/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      sm: "375px",
      md: "768px",
      lg: "1200px",
    },
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        md: "2rem",
      },
    },
    extend: {
      fontSize: {
        "2xs": ["0.75rem", { lineHeight: "1rem" }],
      },
      colors: {
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "text-disabled": "var(--text-disabled)",
        "bg-root": "var(--background)",
        "bg-surface": "rgb(var(--surface-rgb) / <alpha-value>)",
        "bg-elevated": "var(--surface-elevated)",
        "border-subtle": "var(--border-subtle)",
        "border-strong": "var(--border-hover)",
        surface: {
          subtle: "var(--surface-subtle)",
          card: "var(--surface-card)",
          elevated: "var(--surface-elevated)",
          hover: "rgba(255, 255, 255, 0.075)",
        },
        border: {
          default: "var(--border-default)",
          accent: "var(--border-accent)",
        },
        brand: {
          emerald: "var(--emerald)",
          cyan: "var(--cyan)",
        },
      },
      transitionTimingFunction: {
        "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)",
      },
      transitionDuration: {
        fast: "150ms",
        base: "250ms",
        slow: "400ms",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        serif: "var(--font-serif)",
        display: "var(--font-serif)",
      },
      animation: {
        "ping-large": "ping-large 1s ease-in-out infinite",
        "move-left": "move-left 1s linear infinite",
        "move-right": "move-right 1s linear infinite",
        "slide-up": "slide-up 300ms cubic-bezier(0.25, 1, 0.5, 1) both",
        "fade-up": "fade-up 400ms cubic-bezier(0.25, 1, 0.5, 1) both",
      },

      keyframes: {
        "ping-large": {
          "75%, 100%": {
            transform: "scale(3)",
            opacity: "0",
          },
        },
        "move-left": {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "move-right": {
          "0%": { transform: "translateX(-50%)" },
          "100%": { transform: "translateX(0%)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
