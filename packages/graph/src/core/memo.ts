/**
 * A value derived from state, computed again only when a part of its `key` changed and the same
 * object until then — what a `useSyncExternalStore` selector needs to not render for nothing.
 */
export function memo<T>(key: () => readonly unknown[], compute: () => T): () => T {
  let last: { key: readonly unknown[]; value: T } | undefined;
  return () => {
    const next = key();
    if (!last || next.some((part, i) => part !== last?.key[i])) last = { key: next, value: compute() };
    return last.value;
  };
}
