// Permet a `node --test` de charger :
//  - les modules partages ecrits pour Deno : les specificateurs
//    « npm:paquet@version » sont resolus vers node_modules, et le SDK Base44
//    (inutile hors de Deno Deploy) vers un stub minimal ;
//  - les modules du frontend ecrits pour Vite : alias « @/ » -> src/, et
//    imports sans extension (« ./kpiRegistry ») completes en .js / .jsx.
// Usage : node --import ./tests/register-npm.mjs --test tests/*.test.js
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const SRC = pathToFileURL(path.resolve("src") + path.sep).href;

register("data:text/javascript," + encodeURIComponent(`
  const SRC = ${JSON.stringify(SRC)};
  export async function resolve(specifier, context, next) {
    if (specifier.startsWith("npm:@base44/sdk")) {
      return { url: "data:text/javascript,export const createClient = () => ({});", shortCircuit: true };
    }
    if (specifier.startsWith("npm:")) {
      return next(specifier.slice(4).replace(/@[^@/]+$/, ""), context);
    }
    if (specifier.startsWith("@/")) specifier = new URL(specifier.slice(2), SRC).href;
    const relatif = specifier.startsWith(".") || specifier.startsWith("file:");
    if (relatif && !/\\.[cm]?[jt]sx?$/.test(specifier)) {
      for (const ext of [".js", ".jsx", "/index.js"]) {
        try { return await next(specifier + ext, context); } catch { /* extension suivante */ }
      }
    }
    return next(specifier, context);
  }
`), import.meta.url);
