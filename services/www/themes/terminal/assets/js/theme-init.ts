// Applies the stored theme before first paint, to prevent a flash of the wrong
// theme. Loaded render-blocking from <head> (no defer or async) for that reason.
//
// Three theme modes:
// - light: Always light theme
// - dark: Always dark theme
// - system: Follow system preference (default)

let stored: string | null;
try {
  stored = localStorage.getItem("theme");
} catch {
  stored = null;
}
const theme = stored || "system";

const isDark =
  theme === "system" ? window.matchMedia("(prefers-color-scheme: dark)").matches : theme === "dark";

if (isDark) document.documentElement.classList.add("dark");

export {};
