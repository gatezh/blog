/** Paths of every `<loc>` in a sitemap. */
export function sitemapPaths(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
}
