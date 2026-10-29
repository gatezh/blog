/**
 * Renders the brand images from their sources with Chromium:
 *
 *   brand/share-image.html  -> assets/brand/share.png            (1200 × 630)
 *   assets/brand/favicon.svg -> assets/brand/favicon-32.png       (32 × 32)
 *                            -> assets/brand/apple-touch-icon.png (180 × 180)
 *                            -> static/favicon.ico                (16, 32, 48)
 *
 * Run `bun run brand` from services/www and commit the outputs. Nothing calls
 * this at build time: Hugo only fingerprints the committed files.
 *
 * Uses @playwright/test, already a root devDependency, for its browser API. In
 * the devcontainer PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH points at the system
 * Chromium; elsewhere it is unset and Playwright uses its own browser.
 */
import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { chromium, type Page } from "@playwright/test";

const root = new URL("../", import.meta.url);
const path = (relative: string) => new URL(relative, root);

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function renderShareImage(page: Page) {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto(path("brand/share-image.html").href);
  // A screenshot taken before the web font loads silently uses the fallback.
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path("assets/brand/share.png").pathname });
}

/**
 * One PNG of the favicon at `size` px. `background` fills the canvas behind
 * the mark's rounded corners; without it the corners stay transparent.
 */
async function renderIcon(page: Page, size: number, background?: string): Promise<Buffer> {
  const svg = await readFile(path("assets/brand/favicon.svg"), "utf8");
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>*{margin:0}body{background:${background ?? "transparent"}}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  return page.screenshot({ omitBackground: !background });
}

/**
 * Packs PNGs into an ICO container. Every browser that requests /favicon.ico
 * reads PNG-encoded entries, so no BMP conversion is needed.
 */
function ico(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size % 256, entry); // 0 means 256
    header.writeUInt8(size % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

await renderShareImage(page);

await writeFile(path("assets/brand/favicon-32.png"), await renderIcon(page, 32));

// iOS draws its own rounded mask and shows transparent pixels as black, so the
// touch icon is a full square of the mark's background colour.
await writeFile(path("assets/brand/apple-touch-icon.png"), await renderIcon(page, 180, "#0d1117"));

const sizes = [16, 32, 48];
const icons = [];
for (const size of sizes) icons.push({ size, png: await renderIcon(page, size) });
await writeFile(path("static/favicon.ico"), ico(icons));

await browser.close();
console.log("Rendered share.png, favicon-32.png, apple-touch-icon.png and favicon.ico");
