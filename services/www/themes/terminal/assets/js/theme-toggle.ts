// Theme switcher (light, dark, system): theme switching and localStorage
// persistence. Dispatches a `themechange` event that the Remark42 embed
// (comments.ts) listens for.

type Theme = "light" | "dark" | "system";

function getStoredTheme(): Theme {
  try {
    return (localStorage.getItem("theme") as Theme | null) || "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme: Theme): void {
  // The classes set color-scheme (main.css), as theme-init.ts does on load;
  // "system" sets neither and the stylesheet follows the OS on its own.
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");

  // Listeners read the classes.
  window.dispatchEvent(new Event("themechange"));
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

// No listener for OS theme changes: in "system" mode the stylesheet follows
// the OS itself, and comments.ts tells Remark42.

export {};
