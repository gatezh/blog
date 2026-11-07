// Applies an explicit theme choice before first paint, to prevent a flash of
// the wrong theme. Loaded render-blocking from <head> (no defer or async) for
// that reason. `light` or `dark` on <html> sets color-scheme (main.css); with
// neither, the default "system" theme follows the OS in CSS alone.

let stored: string | null;
try {
  stored = localStorage.getItem("theme");
} catch {
  stored = null;
}

if (stored === "light" || stored === "dark") document.documentElement.classList.add(stored);

export {};
