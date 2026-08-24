/**
 * The example world's two drawn assets, addressed so they survive a `basePath`.
 *
 * `public/example/` holds a surveyor's map and a sheet of sighting slips. They are reached as plain
 * strings — an `<img src>`, a `fetch` — and a plain string is the one kind of URL Next does not
 * rewrite: `Link` and `next/image` pick up `basePath` on their own, nothing else does. On the
 * published site, which lives at `kanzo-tech.github.io/ui`, a bare `/example/guild-map.svg` points
 * at the organisation's root and is a 404, with no error anywhere — a broken image and an extractor
 * that finds nothing.
 *
 * One function rather than the prefix written four times, because four spellings of one idea is
 * what this repository collapses on sight, and because the next asset should not have to rediscover
 * this. `NEXT_PUBLIC_BASE_PATH` is the same variable `next.config.ts` sets, and it is empty
 * everywhere except the export.
 */
export const asset = (name: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/example/${name}`;
