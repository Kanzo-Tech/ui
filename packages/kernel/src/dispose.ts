/**
 * The symbol a native runtime has, else the registered one, so a handle written today is disposed
 * by `using` the day the runtime has it. Resolved, never installed: nothing is written to a global.
 */
export function resolveSymbol(name: "dispose" | "asyncDispose", host: object = Symbol): symbol {
  return (host as Record<string, unknown>)[name] as symbol ?? Symbol.for(`Symbol.${name}`);
}

/** The key of a synchronous release: `[dispose]() {}`. */
export const dispose: typeof Symbol.dispose = resolveSymbol("dispose") as typeof Symbol.dispose;
/** The key of an asynchronous release: `async [asyncDispose]() {}`. */
export const asyncDispose: typeof Symbol.asyncDispose = resolveSymbol("asyncDispose") as typeof Symbol.asyncDispose;
