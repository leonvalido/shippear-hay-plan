/**
 * Access to pages saved by the coordinator from a residential connection under
 * data/private/html/<site>/ (index.json + <n>.html / api-<n>.json). The folder lives in
 * the main checkout; from a worktree it is found three levels up. HAYPLAN_HTML_DIR overrides.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ROOT } from "./lib.mjs";

const CANDIDATES = [
  process.env.HAYPLAN_HTML_DIR,
  join(ROOT, "data", "private", "html"),
  resolve(ROOT, "..", "..", "..", "data", "private", "html"), // ROOT is <main>/.claude/worktrees/<name>
].filter(Boolean);

export function savedDir(site) {
  for (const base of CANDIDATES) {
    const dir = join(base, site);
    if (existsSync(join(dir, "index.json"))) return dir;
  }
  return null;
}

/**
 * @param {string} site
 * @returns {Array<{ url: string, status: number, file: string, text: string }> | null} null when nothing was saved
 */
export function savedPages(site) {
  const dir = savedDir(site);
  if (!dir) return null;
  const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
  return index
    .filter((e) => e.status === 200 && existsSync(join(dir, e.file)))
    .map((e) => ({ url: e.url, status: e.status, file: e.file, text: readFileSync(join(dir, e.file), "utf8") }));
}

/** All schema.org *Event objects from a page's JSON-LD blocks. */
export function jsonLdEvents(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      for (const item of [].concat(j)) {
        if (typeof item?.["@type"] === "string" && /Event$/.test(item["@type"])) out.push(item);
      }
    } catch { /* not JSON */ }
  }
  return out;
}
