// Remark42 comments: configuration, the embed loader, and theme
// synchronization (docs/adr-003-terminal-theme-remark42-synchronization.md).
//
// Values come from data-* attributes on this script's tag: data-host (the
// Remark42 origin, params.remark42Host) and data-page-title.

declare global {
  interface Window {
    remark_config: Record<string, unknown>;
    REMARK42?: { changeTheme?: (theme: "light" | "dark") => void };
  }
}

const data = (document.currentScript as HTMLScriptElement | null)?.dataset ?? {};

function storedTheme(): string {
  try {
    return localStorage.getItem("theme") || "system";
  } catch {
    return "system";
  }
}

function initialTheme(): "light" | "dark" {
  const theme = storedTheme();
  if (theme === "dark" || theme === "light") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

if (data.host) {
  // The embed script reads its configuration from this global.
  window.remark_config = {
    host: data.host,
    site_id: "remark",
    components: ["embed"],
    max_shown_comments: 100,
    theme: initialTheme(),
    page_title: data.pageTitle,
    show_email_subscription: false,
    simple_view: false,
    no_footer: true,
    locale: "en",
  };

  // Remark42's documented loader: the ES module build where supported.
  const supportsModules = "noModule" in HTMLScriptElement.prototype;
  for (const component of ["embed"]) {
    const script = document.createElement("script");
    let ext = ".js";
    if (supportsModules) {
      script.type = "module";
      ext = ".mjs";
    } else {
      script.async = true;
    }
    script.defer = true;
    script.src = `${data.host}/web/${component}${ext}`;
    (document.head || document.body).appendChild(script);
  }

  function syncRemark42Theme(isDark: boolean): void {
    try {
      window.REMARK42?.changeTheme?.(isDark ? "dark" : "light");
    } catch {
      // Silently fail if Remark42 theme change fails
    }
  }

  // Theme toggle changes (dispatched by theme-toggle.ts)
  window.addEventListener("themechange", (event) => {
    syncRemark42Theme((event as CustomEvent<{ isDark: boolean }>).detail.isDark);
  });

  // System preference changes, when the theme is set to 'system'
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    if (storedTheme() === "system") syncRemark42Theme(event.matches);
  });
}

export {};
