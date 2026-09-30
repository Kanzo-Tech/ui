import { TAGS } from "./world";

/**
 * A stand-in for a search endpoint: a short wait, then the tags that contain the query.
 * It rejects with an `AbortError` when the signal fires, like `fetch` does, so an example built on
 * it shows what a real request would do when the user keeps typing.
 */
export function searchTags(query: string, signal?: AbortSignal): Promise<{ label: string; value: string }[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const needle = query.trim().toLowerCase();
      resolve(
        TAGS.filter((tag) => tag.includes(needle)).map((tag) => ({ label: tag, value: tag }))
      );
    }, 400);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}
