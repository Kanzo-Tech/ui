// Moved into the library: `@kanzo-tech/ui/analytics` exports these now.
//
// It earned the promotion the way the admission rules ask for — the inline `as { getChild(…) }`
// cast appeared four times here before anyone wrote the function — and it turned out not to be a
// graph concern at all but a `MosaicClient` one: the moment a client implements `queryResult` it
// holds an Arrow table and has no honest way to read a column out of it.
//
// The file stays as the local name its call sites already import.
export { column, numbers } from "@kanzo-tech/ui/analytics";
