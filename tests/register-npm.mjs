// Permet a `node --test` de charger les modules partages ecrits pour Deno :
// les specificateurs « npm:paquet@version » sont resolus vers node_modules, et
// le SDK Base44 (inutile hors de Deno Deploy) vers un stub minimal.
// Usage : node --import ./tests/register-npm.mjs --test tests/*.test.js
import { register } from "node:module";

register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    if (specifier.startsWith("npm:@base44/sdk")) {
      return { url: "data:text/javascript,export const createClient = () => ({});", shortCircuit: true };
    }
    if (specifier.startsWith("npm:")) {
      const nom = specifier.slice(4).replace(/@[^@/]+$/, "");
      return next(nom, context);
    }
    return next(specifier, context);
  }
`), import.meta.url);
