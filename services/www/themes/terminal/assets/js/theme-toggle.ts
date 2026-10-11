// Three-position theme toggle: theme switching, localStorage persistence and
// system preference detection. Dispatches a `themechange` event that Remark42
// (comments.ts) and Turnstile listen for.

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

function updateToggleUI(theme: Theme): void {
  for (const btn of document.querySelectorAll<HTMLElement>(".theme-toggle-btn")) {
    const active = btn.dataset.theme === theme;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", String(active));
  }
}

function setTheme(theme: Theme): void {
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // localStorage unavailable (private browsing, etc.)
  }
  applyTheme(theme);
  updateToggleUI(theme);
}

// Loaded with `defer`, so the buttons are already in the DOM.
updateToggleUI(getStoredTheme());

for (const btn of document.querySelectorAll<HTMLElement>(".theme-toggle-btn")) {
  btn.addEventListener("click", () => setTheme(btn.dataset.theme as Theme));
}

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (getStoredTheme() === "system") applyTheme("system");
});

export {};
