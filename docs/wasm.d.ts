/**
 * A `.wasm` import is a URL here, never a module.
 *
 * `next.config.ts` emits `.wasm` as `asset/resource`, so what an import yields is the emitted
 * file's address — which is exactly what `@fossil-lang/corpus` takes as `wasmUrl`. Declared
 * because TypeScript has no opinion about a file extension a bundler rule invented.
 */
declare module "*.wasm" {
  const url: string;
  export default url;
}
