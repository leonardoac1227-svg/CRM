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
        primary: { DEFAULT: withVar("--primary"), foreground: withVar("--primary-foreground") },
        secondary: { DEFAULT: withVar("--secondary"), foreground: withVar("--secondary-foreground") },
        muted: { DEFAULT: withVar("--muted"), foreground: withVar("--muted-foreground") },
        accent: { DEFAULT: withVar("--accent"), foreground: withVar("--foreground") },
        card: { DEFAULT: withVar("--card"), foreground: withVar("--foreground") },
        popover: { DEFAULT: withVar("--popover"), foreground: withVar("--foreground") },
        sidebar: {
          DEFAULT: withVar("--sidebar"),
          foreground: withVar("--sidebar-foreground"),
          muted: withVar("--sidebar-muted"),
          border: withVar("--sidebar-border"),
          hover: withVar("--sidebar-hover"),
        },
        gold: withVar("--gold"),
        brand: withVar("--brand"),
        destructive: { DEFAULT: "#DC2626", foreground: "#ffffff" },
        success: { DEFAULT: "#16A34A", foreground: "#ffffff" },
      },
      borderRadius: { xl: "1rem", lg: "0.875rem", md: "0.625rem", sm: "0.45rem" },
      fontFamily: {
        sans: ["var(--font-sans)", "Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Oswald", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "slide-in-right": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "slide-in-left": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "typing": { "0%,80%,100%": { opacity: "0.2" }, "40%": { opacity: "1" } },
        "rise": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "pulse-gold": { "0%,100%": { boxShadow: "0 0 0 0 rgb(var(--primary) / 0.45)" }, "50%": { boxShadow: "0 0 0 6px rgb(var(--primary) / 0)" } },
      },
      animation: {
        "slide-in-right": "slide-in-right 0.25s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        typing: "typing 1.4s infinite ease-in-out",
        rise: "rise 0.35s ease-out both",
        "pulse-gold": "pulse-gold 2s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
