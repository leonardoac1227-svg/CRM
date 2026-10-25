import type { Config } from "tailwindcss";

const withVar = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: withVar("--border"),
        input: withVar("--border"),
        ring: withVar("--primary"),
        background: withVar("--background"),
        foreground: withVar("--foreground"),
        primary: { DEFAULT: withVar("--primary"), foreground: "#ffffff" },
        secondary: { DEFAULT: withVar("--secondary"), foreground: "#ffffff" },
        muted: { DEFAULT: withVar("--muted"), foreground: withVar("--muted-foreground") },
        accent: { DEFAULT: withVar("--accent"), foreground: withVar("--foreground") },
        card: { DEFAULT: "#ffffff", foreground: withVar("--foreground") },
        popover: { DEFAULT: "#ffffff", foreground: withVar("--foreground") },
        destructive: { DEFAULT: "#DC2626", foreground: "#ffffff" },
        success: { DEFAULT: "#16A34A", foreground: "#ffffff" },
      },
      borderRadius: { lg: "0.75rem", md: "0.5rem", sm: "0.375rem" },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
      keyframes: {
        "slide-in-right": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "typing": { "0%,80%,100%": { opacity: "0.2" }, "40%": { opacity: "1" } },
      },
      animation: {
        "slide-in-right": "slide-in-right 0.25s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        typing: "typing 1.4s infinite ease-in-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
