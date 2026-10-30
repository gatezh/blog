// Theme switcher (light, dark, system): theme switching, localStorage
// persistence and system preference detection. Dispatches a `themechange` event that the
// Remark42 embed (comments.ts) listens for.

type Theme = "light" | "dark" | "system";

function getStoredTheme(): Theme {
  try {
    return (localStorage.getItem("theme") as Theme | null) || "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function isDarkMode(theme: Theme): boolean {
  return theme === "system" ? systemPrefersDark() : theme === "dark";
}

function applyTheme(theme: Theme): void {
  const isDark = isDarkMode(theme);
  document.documentElement.classList.toggle("dark", isDark);

  // For other components (e.g., Remark42)
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme, isDark } }));
}

const inputs = document.querySelectorAll<HTMLInputElement>(".theme-toggle-input");

function setTheme(theme: Theme): void {
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // localStorage unavailable (private browsing, etc.)
  }
  applyTheme(theme);
}

// Loaded with `defer`, so the inputs are already in the DOM. Checking one
// fires no change event, so this only reflects the stored choice.
const stored = getStoredTheme();
for (const input of inputs) {
  input.checked = input.value === stored;
  input.addEventListener("change", () => setTheme(input.value as Theme));
}

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (getStoredTheme() === "system") applyTheme("system");
});

export {};
