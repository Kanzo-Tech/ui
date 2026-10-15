/**
 * The symbol a native runtime has, else `Symbol.for("Symbol.dispose")`, so a handle written today is
 * disposed by `using` the day the runtime has it. Resolved, never installed: nothing is written to a
 * global. TypeScript's own downlevel `using` (`__addDisposableResource`) has no fallback and throws
 * "Symbol.dispose is not defined", and its documented polyfill is a private `Symbol("Symbol.dispose")`;
 * the registered symbol is this package's choice, and a host that polyfills must use the same one,
 * `Symbol.dispose ??= Symbol.for("Symbol.dispose")`, before or after this module loads. The types need
 * TypeScript 5.2 and `lib: ["esnext.disposable"]`.
 */
export function resolveSymbol(name: "dispose" | "asyncDispose", host: object = Symbol): symbol {
  return (host as Record<string, unknown>)[name] as symbol ?? Symbol.for(`Symbol.${name}`);
}

/** The key of a synchronous release: `[dispose]() {}`. */
export const dispose: typeof Symbol.dispose = resolveSymbol("dispose") as typeof Symbol.dispose;
/** The key of an asynchronous release: `async [asyncDispose]() {}`. */
export const asyncDispose: typeof Symbol.asyncDispose = resolveSymbol("asyncDispose") as typeof Symbol.asyncDispose;
