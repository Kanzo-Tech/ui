// `node --import ./register.mjs build-corpus.mjs` — the loader has to be registered from a module
// that runs before the entry point, which is what this exists to be.
import { register } from "node:module";
register("./alias-hook.mjs", import.meta.url);
