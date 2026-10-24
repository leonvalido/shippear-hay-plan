// Lets plain `node` run the project's TypeScript (Node >= 22.18 strips types natively):
//   node --import ./scripts/ts-loader.mjs scripts/build-events.ts
// Resolves the `@/` alias, adds `.ts` to extension-less relative imports and
// marks `.json` imports so they load without `with { type: "json" }`.
// Only touches imports made from project files (never from node_modules).
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = pathToFileURL(process.cwd() + "/").href;
const SRC = ROOT + "src/";

function fromProject(parentURL) {
  return typeof parentURL === "string" && parentURL.startsWith("file:") && !parentURL.includes("/node_modules/");
}

registerHooks({
  resolve(specifier, context, next) {
    if (!fromProject(context.parentURL)) return next(specifier, context);
    let spec = specifier;
    if (spec.startsWith("@/")) spec = new URL(spec.slice(2), SRC).href;
    else if (spec.startsWith("./") || spec.startsWith("../")) spec = new URL(spec, context.parentURL).href;
    else return next(specifier, context);

    const file = fileURLToPath(spec);
    if (!path.extname(file)) {
      if (existsSync(file + ".ts")) spec += ".ts";
      else if (existsSync(path.join(file, "index.ts"))) spec += "/index.ts";
    }
    const result = next(spec, context);
    return spec.endsWith(".json") ? { ...result, importAttributes: { type: "json" } } : result;
  },
});
