// Cloudflare Turnstile, lazy-loaded when the contact section approaches the
// viewport. Explicit render mode, so the widget can be re-rendered with the
// matching theme whenever the site theme changes.
//
// The site key comes from the data-site-key attribute on this script's tag.

interface TurnstileApi {
  render(container: HTMLElement, options: { sitekey: string; theme: "light" | "dark" }): string;
  remove(widgetId: string): void;
  reset(widgetId?: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    onTurnstileLoad?: () => void;
  }
}

const siteKey = (document.currentScript as HTMLScriptElement | null)?.dataset.siteKey;

let loaded = false;
let widgetId: string | null = null;

// Dark if <html> has the .dark class
function getCurrentTheme(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function render(): void {
  const container = document.getElementById("turnstile-container");
  if (container && window.turnstile && siteKey) {
    widgetId = window.turnstile.render(container, { sitekey: siteKey, theme: getCurrentTheme() });
  }
}

function loadTurnstile(): void {
  if (loaded) return;
  loaded = true;
  const s = document.createElement("script");
  s.src =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";
  s.async = true;
  document.head.appendChild(s);
}

if (siteKey) {
  // Called by api.js once it has loaded (the onload= parameter above).
  window.onTurnstileLoad = render;

  // Re-render Turnstile when the theme changes
  window.addEventListener("themechange", () => {
    if (window.turnstile && widgetId !== null) {
      window.turnstile.remove(widgetId);
      render();
    }
  });

  // Loaded with `defer`, so #contact is already in the DOM. Load when it is
  // 500px from the viewport.
  const contact = document.getElementById("contact");
  if (contact) {
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            loadTurnstile();
            observer.disconnect();
          }
        },
        { rootMargin: "500px" },
      );
      observer.observe(contact);
    } else {
      loadTurnstile();
    }
  }
}

export {};
