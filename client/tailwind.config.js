/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // every color is a CSS variable so the admin can recolor live
        bg: "var(--bg)",
        elev: "var(--bg-elev)",
        sidebar: "var(--sidebar)",
        "sidebar-fg": "var(--sidebar-fg)",
        "sidebar-active": "var(--sidebar-active)",
        fg: "var(--fg)",
        muted: "var(--fg-muted)",
        border: "var(--border)",
        accent: "var(--accent)",
        "accent-fg": "var(--accent-fg)",
        danger: "var(--danger)",
        success: "var(--success)",
        mention: "var(--mention)",
      },
      borderRadius: {
        theme: "var(--radius)",
      },
    },
  },
  plugins: [],
};
