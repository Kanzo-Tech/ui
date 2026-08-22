/**
 * Replaying a stream, for the examples that demonstrate one.
 *
 * A model emits tokens and tokens cut words in half, so a canned replay that advanced by character
 * would animate half a word in and the other half a frame later — which reads as a glitch rather
 * than as writing. These count and cut by WORD, and the whitespace travels with the word before it
 * so a partial answer never ends mid-space either.
 *
 * Here rather than in each example because two of them do it — `conversation` and `reasoning` — and
 * a helper copied into both is a helper that drifts.
 */
const WORD = /\S+\s*/g;

/** How many words the whole text holds. */
export const wordsIn = (text: string): number => [...text.matchAll(WORD)].length;

/** The first `count` words of `text`, whitespace included. */
export const upTo = (text: string, count: number): string =>
  [...text.matchAll(WORD)]
    .slice(0, count)
    .map((match) => match[0])
    .join("");
