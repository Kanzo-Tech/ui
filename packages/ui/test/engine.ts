import { type Coordinator } from "@kanzo-tech/mosaic";
import { internalEngineOver, type Engine } from "@kanzo-tech/mosaic/engine";

const engines = new WeakMap<object, Engine>();

/**
 * **A test's coordinator, as the engine `MosaicProvider` takes** — the same engine for the same
 * coordinator, since a new one is a new page to the provider. The charts read through the
 * coordinator inside it, as they do on a page; `query` asks that coordinator too, so a stub answers
 * both doors, and reads the signal either side. It registers no files.
 */
export function engineOver(coordinator: Coordinator | object): Engine {
  let engine = engines.get(coordinator);
  if (!engine) {
    const asked = coordinator as Coordinator;
    const unused = () => Promise.reject(new Error("a test engine registers no files"));
    engine = internalEngineOver(
      {
        query: async (sql, { signal }) => {
          signal.throwIfAborted();
          const answer = await asked.query(sql);
          signal.throwIfAborted();
          return answer as never;
        },
        registerFiles: unused,
        registerFileBuffer: unused,
        dropFiles: unused,
      },
      asked,
    );
    engines.set(coordinator, engine);
  }
  return engine;
}
