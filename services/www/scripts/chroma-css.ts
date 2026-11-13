// Generates themes/terminal/assets/css/chroma.css: Chroma's syntax-highlighting
// classes (markup.highlight.noClasses: false) with one light-dark() colour per
// token, so code follows the theme switcher like every other colour.
//
//   bun run chroma
//
// Light is Chroma's `github` style, dark is `github-dark`. Their backgrounds
// are dropped (code keeps --color-terminal-code-bg), and any colour under
// WCAG AA (4.5:1) against the background it is drawn on is darkened (light)
// or lightened (dark) until it passes. Backgrounds and the default text
// colour are read from main.css, so the checks follow the theme's tokens.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const LIGHT = "github";
const DARK = "github-dark";
const AA = 4.5;

const css = (name: string) =>
  fileURLToPath(new URL(`../themes/terminal/assets/css/${name}`, import.meta.url));
const mainCss = readFileSync(css("main.css"), "utf8");
const out = css("chroma.css");

type Pair = [light: string, dark: string];

function token(name: string): Pair {
  const match = mainCss.match(
    new RegExp(
      `--color-terminal-${name}:\\s*light-dark\\((#[0-9a-f]{6}),\\s*(#[0-9a-f]{6})\\)`,
      "i",
    ),
  );
  if (!match) throw new Error(`--color-terminal-${name} not found in main.css`);
  return [match[1].toLowerCase(), match[2].toLowerCase()];
}

const codeBg = token("code-bg");
const fg = token("fg");

/** selector → property → value, in the order Chroma writes them. */
type Rules = Map<string, Map<string, string>>;

function chroma(style: string): Rules {
  const generated = execFileSync("hugo", ["gen", "chromastyles", `--style=${style}`], {
    encoding: "utf8",
  });
  const rules: Rules = new Map();
  for (const line of generated.split("\n")) {
    const match = line.match(/^\/\* \w+ \*\/ (.+?) \{ ?(.*?) ?\}$/);
    if (!match) continue;
    const decls = new Map<string, string>();
    for (const decl of match[2].split(";")) {
      const at = decl.indexOf(":");
      if (at > 0) decls.set(decl.slice(0, at).trim(), decl.slice(at + 1).trim());
    }
    rules.set(match[1], decls);
  }
  if (rules.size === 0) throw new Error(`hugo gen chromastyles --style=${style} printed no rules`);
  return rules;
}

function hex(color: string): string {
  const short = color.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  return (
    short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : color
  ).toLowerCase();
}

function rgb(color: string): number[] {
  const value = hex(color);
  return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
}

function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Moves `color` toward `target` (black or white) until it reaches AA on `bg`. */
function legible(color: string, bg: string, target: string): string {
  const from = rgb(color);
  const to = rgb(target);
  for (let step = 0; step <= 100; step++) {
    const t = step / 100;
    const mixed = `#${from
      .map((v, i) =>
        Math.round(v + (to[i] - v) * t)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
    if (contrast(mixed, bg) >= AA) return mixed;
  }
  return target;
}

const light = chroma(LIGHT);
const dark = chroma(DARK);
const adjusted: string[] = [];

/** Merges one property of both styles into a single value, or drops it. */
function merge(selector: string, prop: string): string | null {
  const l = light.get(selector)?.get(prop);
  const d = dark.get(selector)?.get(prop);
  const wrapper = selector === ".bg" || selector === ".chroma";

  if (prop === "background-color") {
    // The pre keeps the theme's code background.
    if (wrapper || (!l && !d)) return null;
    return `light-dark(${hex(l ?? codeBg[0])}, ${hex(d ?? codeBg[1])})`;
  }

  if (prop === "color") {
    // The wrapper's text stays the theme's; so does a token one style leaves plain.
    if (wrapper) return null;
    // A keyword such as `inherit` is not a colour to check.
    if (![l, d].every((c) => c === undefined || c.startsWith("#"))) return l ?? d ?? null;
    const pair: Pair = [hex(l ?? fg[0]), hex(d ?? fg[1])];
    const onto: Pair = [
      hex(light.get(selector)?.get("background-color") ?? codeBg[0]),
      hex(dark.get(selector)?.get("background-color") ?? codeBg[1]),
    ];
    const fixed: Pair = [
      legible(pair[0], onto[0], "#000000"),
      legible(pair[1], onto[1], "#ffffff"),
    ];
    fixed.forEach((c, i) => {
      if (c !== pair[i]) {
        const scheme = i ? "dark " : "light";
        const was = contrast(pair[i], onto[i]).toFixed(2);
        const now = contrast(c, onto[i]).toFixed(2);
        adjusted.push(`${selector.padEnd(12)} ${scheme} ${pair[i]} ${was}:1 -> ${c} ${now}:1`);
      }
    });
    return `light-dark(${fixed[0]}, ${fixed[1]})`;
  }

  // Layout and font properties: the light style's, else the dark one's.
  return l ?? d ?? null;
}

const body: string[] = [];
for (const selector of new Set([...light.keys(), ...dark.keys()])) {
  const props = new Set([
    ...(light.get(selector)?.keys() ?? []),
    ...(dark.get(selector)?.keys() ?? []),
  ]);
  const decls = [...props].flatMap((prop) => {
    const value = merge(selector, prop);
    return value ? [`${prop}: ${value}`] : [];
  });
  if (decls.length) body.push(`${selector} { ${decls.join("; ")}; }`);
}

writeFileSync(
  out,
  `/* GENERATED by services/www/scripts/chroma-css.ts (\`bun run chroma\`) from
   Chroma's ${LIGHT} (light) and ${DARK} (dark) styles. Do not edit by hand.
   Every text colour reaches ${AA}:1 on the background it is drawn on. */

${body.join("\n")}
`,
);

console.log(`Wrote ${out}: ${body.length} rules.`);
for (const line of adjusted) console.log(`  adjusted ${line}`);
