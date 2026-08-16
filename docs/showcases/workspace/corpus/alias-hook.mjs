/**
 * Teach Node the one TypeScript path alias this build crosses.
 *
 * `graph-data.ts` imports the Guild through `@/example/*`, which `docs/tsconfig.json` maps to
 * `./*`. Node strips types natively but knows nothing about `paths`, so importing that module from
 * a script fails to resolve rather than failing to parse.
 *
 * Fifteen lines instead of a dependency, and it is the whole of what the build needs: the benchmark's
 * own corpus script imports a module with no aliases in it and therefore needed none of this.
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import { extname, resolve as resolvePath } from "node:path";
import { existsSync } from "node:fs";

const DOCS = resolvePath(import.meta.dirname, "../../..");

/**
 * Two things TypeScript does that Node does not, and the second is the one that catches people.
 *
 * The **alias** is the obvious half: `@/example/archive` is a `paths` entry and Node knows nothing
 * about `paths`. The **extension** is the other: TypeScript writes extensionless specifiers and
 * resolves them itself, so `./people` from inside `example/archive.ts` is just as unresolvable as
 * the alias was — and it fails second, after the alias looks fixed, which reads as the fix not
 * having worked.
 */
export function resolve(specifier, context, next) {
  const aliased = specifier.startsWith("@/")
    ? pathToFileURL(resolvePath(DOCS, specifier.slice(2))).href
    : specifier;

  const relative = aliased.startsWith("file:") || aliased.startsWith(".");
  if (!relative || extname(aliased)) return next(aliased, context);

  const url = new URL(aliased, context.parentURL);
  return next(existsSync(fileURLToPath(url)) ? aliased : `${aliased}.ts`, context);
}
