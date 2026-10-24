/**
 * Runs every source, tolerating individual failures, and writes
 * data/private/raw/_summary.json with counts per source and errors.
 * Usage: npm run ingest            (all sources)
 *        npm run ingest -- meetup  (only the named sources)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { RAW_DIR, writeRaw } from "./lib.mjs";

const SOURCES = ["municipal", "press", "entradauno", "alpogo", "eventbrite", "meetup", "luma"];
const wanted = process.argv.slice(2).filter((s) => SOURCES.includes(s));
const sources = wanted.length ? wanted : SOURCES;

const summary = { ranAt: new Date().toISOString(), counts: {}, errors: {} };
const startedAt = Date.now();

// Sources hit different hosts, so they run concurrently; each one throttles its own host.
await Promise.all(sources.map(async (name) => {
  try {
    const { run } = await import(`./${name}.mjs`);
    const events = await run();
    writeRaw(name, events);
    summary.counts[name] = events.length;
  } catch (e) {
    summary.counts[name] = 0;
    summary.errors[name] = /** @type {Error} */ (e).message;
    console.error(`${name}: FAILED: ${/** @type {Error} */ (e).message}`);
  }
}));

summary.total = Object.values(summary.counts).reduce((a, b) => a + b, 0);
summary.durationSec = Math.round((Date.now() - startedAt) / 1000);
mkdirSync(RAW_DIR, { recursive: true });
writeFileSync(join(RAW_DIR, "_summary.json"), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
