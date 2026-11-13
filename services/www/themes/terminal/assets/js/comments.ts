// Remark42 comments: config, lazy embed loader, theme sync
// (docs/adr-003-terminal-theme-remark42-synchronization.md).
// data-host: the Remark42 origin; data-page-title: the post title.

declare global {
  interface Window {
    remark_config: Record<string, unknown>;
    REMARK42?: { changeTheme?: (theme: "light" | "dark") => void };
  }
}

const data = (document.currentScript as HTMLScriptElement | null)?.dataset ?? {};

// Kept referenced so its change listener lives as long as the page.
const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");

// What the page renders: an explicit `light`/`dark` class on <html>, else the OS.
function pageTheme(): "light" | "dark" {
  const classes = document.documentElement.classList;
  if (classes.contains("dark")) return "dark";
  if (classes.contains("light")) return "light";
  return darkScheme.matches ? "dark" : "light";
}

// Idempotent; a no-op until the embed is ready.
function syncRemark42Theme(): void {
  try {
    window.REMARK42?.changeTheme?.(pageTheme());
  } catch {
    // Ignore embed errors.
  }
}

let embedLoaded = false;

// Once; the observer and a permalink both call it.
function loadEmbed(host: string): void {
  if (embedLoaded) return;
  embedLoaded = true;
  window.remark_config.theme = pageTheme();
  // Module build only: browsers without modules can't parse it anyway.
  const script = document.createElement("script");
  script.type = "module";
  script.src = `${host}/web/embed.mjs`;
  document.head.appendChild(script);
}

if (data.host) {
  const host = data.host;

  // Read by the embed.
  window.remark_config = {
    host,
    site_id: "remark",
    components: ["embed"],
    max_shown_comments: 100,
    theme: pageTheme(),
    page_title: data.pageTitle,
    show_email_subscription: true,
    simple_view: false,
    no_footer: true,
    locale: "en",
  };

  // A viewport ahead of the comments; at once for a comment permalink, on load
  // or by a hash change (no reload, nothing to scroll to).
  const isPermalink = (): boolean => window.location.hash.startsWith("#remark42__comment-");
  if (isPermalink()) {
    loadEmbed(host);
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        loadEmbed(host);
      },
      { rootMargin: "0px 0px 100% 0px" },
    );
    // The partial renders it with this script.
    observer.observe(document.getElementById("remark42")!);
  }
  window.addEventListener("hashchange", () => {
    if (isPermalink()) loadEmbed(host);
  });

  // Ready: a change before the embed started. Visible: an OS change missed
  // while hidden or in the back/forward cache.
  window.addEventListener("REMARK42::ready", syncRemark42Theme);
  window.addEventListener("themechange", syncRemark42Theme);
  darkScheme.addEventListener("change", syncRemark42Theme);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncRemark42Theme();
  });
}

export {};
