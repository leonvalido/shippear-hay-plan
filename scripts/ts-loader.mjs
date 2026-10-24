// Lets plain `node` run the project's TypeScript (Node >= 22.18 strips types natively):
//   node --import ./scripts/ts-loader.mjs scripts/build-events.ts
// Resolves the `@/` alias, adds `.ts` to extension-less relative imports and
// marks `.json` imports so they load without `with { type: "json" }`.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC = pathToFileURL(path.join(process.cwd(), "src") + "/").href;

registerHooks({
  resolve(specifier, context, next) {
    let spec = specifier;
    if (spec.startsWith("@/")) spec = new URL(spec.slice(2), SRC).href;
    if (spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("file:")) {
      const base = spec.startsWith("file:") ? spec : new URL(spec, context.parentURL).href;
      const file = fileURLToPath(base);
      if (!path.extname(file) && existsSync(file + ".ts")) spec = base + ".ts";
      else if (!path.extname(file) && existsSync(path.join(file, "index.ts"))) spec = base + "/index.ts";
      else spec = base;
      if (spec.endsWith(".json")) return { ...next(spec, context), importAttributes: { type: "json" } };
    }
    return next(spec, context);
  },
});
