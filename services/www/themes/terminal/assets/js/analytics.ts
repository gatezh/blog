// Google Analytics (gtag.js) configuration: Google's standard snippet, moved
// out of an inline <script>. The measurement ID comes from the data-ga-id
// attribute on this script's tag. gtag.js itself loads from its own tag in
// head.html and drains this queue whichever of the two runs first.

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

// gtag.js reads Arguments objects off the queue, not arrays, so this pushes
// `arguments` exactly as Google's snippet does.
function gtag(..._args: unknown[]): void {
  window.dataLayer.push(arguments);
}

const id = (document.currentScript as HTMLScriptElement | null)?.dataset.gaId;

if (id) {
  window.dataLayer = window.dataLayer || [];
  gtag("js", new Date());
  gtag("config", id);
}

export {};
