/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // brand chrome — spec §3.1
        navy: { DEFAULT: "#080C18", 2: "#131A2B", 3: "#222C41", text: "#96A3B8" },
        // semantic — spec §17.2
        teal: {
          DEFAULT: "#44E5C2",
          hover: "#31D3B0",
          ink: "#04241E",
          wash: "#E2FBF5",
          deep: "#0A7A64",
        },
        green: { DEFAULT: "#34D399", wash: "#E7F8F1", deep: "#0E7A55" },
        amber: { DEFAULT: "#F59E0B", wash: "#FEF4E3", deep: "#9A6209" },
        red: { DEFAULT: "#F87171", wash: "#FDECEC", deep: "#C0392F" },
        grey: { DEFAULT: "#7E8EA4", wash: "#EFF2F6", deep: "#5A6779" },
        blue: { DEFAULT: "#60A5FA", wash: "#E9F1FE", deep: "#2563C4" },
        purple: { DEFAULT: "#C084FC", wash: "#F5ECFE", deep: "#7C3AED" },
        // surfaces
        canvas: "#F6F7F9",
        card: "#FFFFFF",
        line: { DEFAULT: "#E4E8EE", soft: "#EEF1F5" },
        ink: "#0F1626",
        muted: { DEFAULT: "#64748B", 2: "#94A3B8" },
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "9px",
        md: "9px",
        lg: "13px",
        xl: "15px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,22,38,.04), 0 1px 3px rgba(15,22,38,.05)",
        pop: "0 16px 40px -12px rgba(15,22,38,.22), 0 4px 12px rgba(15,22,38,.06)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      maxWidth: {
        shell: "1280px",
      },
      keyframes: {
        "toast-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "modal-in": {
          from: { opacity: "0", transform: "translateY(10px) scale(.985)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "toast-in": "toast-in .22s cubic-bezier(.2,.8,.3,1)",
        "modal-in": "modal-in .18s cubic-bezier(.2,.8,.3,1)",
      },
    },
  },
  plugins: [],
};
