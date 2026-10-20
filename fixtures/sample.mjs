/**
 * Derive each fixture graph's sample — `graphs/<name>/sample/`, checked in — from the whole dataset
 * its `fetch.sh` writes into `graphs/<name>/data/` (gitignored, fetched). The one step here that
 * needs the network, and it is run by hand: `pnpm --filter @kanzo-tech/fixtures sample [name…]`.
 * `write.mjs` then writes each graph from its sample with fossil, offline.
 *
 * A sample is a subset of the dataset's own rows, byte for byte where the file is text, chosen so
 * that every reference a mapping follows lands on a row that is kept — a graph a test can count by
 * hand, with nothing dropped by the writer. Deterministic: the same data writes the same sample.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const GRAPHS = join(dirname(fileURLToPath(import.meta.url)), "graphs");

/** The fields of one CSV line: RFC 4180 quoting, as OpenFlights writes it. */
function fields(line, delimiter) {
  const out = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) out.push(field), (field = "");
    else field += c;
  }
  out.push(field);
  return out;
}

/** A delimited file as its header, and its rows as the raw line with the fields read from it. */
function table(file, delimiter) {
  const [header, ...lines] = readFileSync(file, "utf8").split("\n").filter(Boolean);
  const names = fields(header, delimiter);
  const rows = lines.map((line) => {
    const values = fields(line, delimiter);
    return { line, get: (name) => values[names.indexOf(name)], at: (i) => values[i] };
  });
  return { header, rows };
}

/** Writes the rows `keep` keeps, header first, as the lines they were. */
function writeRows(file, { header, rows }, keep) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, [header, ...rows.filter(keep).map((r) => r.line)].join("\n") + "\n");
}

const json = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, rows) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(rows)}\n`);
};

const SAMPLES = {
  /**
   * The prizes of 2000 to 2004 — every category, shared prizes and organisations among them — and
   * every laureate, institution and country those awards reach.
   */
  nobel(data, sample) {
    const awards = json(join(data, "awards.json")).filter((a) => a.year >= "2000" && a.year <= "2004");
    const kept = new Set(awards.map((a) => a.id));
    const affiliations = json(join(data, "affiliations.json")).filter((a) => kept.has(a.award));
    const laureateIds = new Set(awards.map((a) => a.laureate));
    const laureates = json(join(data, "laureates.json")).filter((l) => laureateIds.has(l.id));
    const institutionIds = new Set(affiliations.map((a) => a.institution));
    const institutions = json(join(data, "institutions.json")).filter((i) => institutionIds.has(i.id));
    const categoryIds = new Set(awards.map((a) => a.category));
    const categories = json(join(data, "categories.json")).filter((c) => categoryIds.has(c.id));
    const countryIds = new Set([...laureates, ...institutions].map((r) => r.country).filter(Boolean));
    const countries = json(join(data, "countries.json")).filter((c) => countryIds.has(c.id));
    for (const [name, rows] of Object.entries({ laureates, awards, categories, institutions, affiliations, countries })) {
      writeJson(join(sample, `${name}.json`), rows);
    }
  },

  /** The airports of Spain and Portugal, and the direct routes between two of them. */
  openflights(data, sample) {
    const airports = table(join(data, "airports.csv"), ",");
    const iberian = (r) => r.get("country") === "Spain" || r.get("country") === "Portugal";
    const ids = new Set(airports.rows.filter(iberian).map((r) => r.get("id")));
    writeRows(join(sample, "airports.csv"), airports, iberian);
    const routes = table(join(data, "routes.csv"), ",");
    writeRows(join(sample, "routes.csv"), routes, (r) => ids.has(r.get("src")) && ids.has(r.get("dst")));
  },

  /**
   * Twelve people who know one another — the best-connected person and those nearest them, breadth
   * first — what they wrote in their first months, the forums they moderate, and every place, tag
   * class and organisation those reach. Tags are the ones the twelve are interested in.
   */
  snb(data, sample) {
    const at = (path) => join(data, path);
    const out = (path) => join(sample, path);
    const people = table(at("dynamic/person_0_0.csv"), "|");
    const knows = table(at("dynamic/person_knows_person_0_0.csv"), "|");

    const friends = new Map();
    for (const r of knows.rows) {
      for (const [a, b] of [[r.at(0), r.at(1)], [r.at(1), r.at(0)]]) {
        if (!friends.has(a)) friends.set(a, []);
        friends.get(a).push(b);
      }
    }
    const byId = (a, b) => Number(a) - Number(b);
    const [first] = [...friends.keys()].sort((a, b) => friends.get(b).length - friends.get(a).length || byId(a, b));
    const kept = new Set([first]);
    for (const queue = [first]; queue.length && kept.size < 12; ) {
      for (const next of friends.get(queue.shift()).sort(byId)) {
        if (kept.size < 12 && !kept.has(next)) kept.add(next), queue.push(next);
      }
    }
    const person = (id) => kept.has(id);
    writeRows(out("dynamic/person_0_0.csv"), people, (r) => person(r.get("id")));
    writeRows(out("dynamic/person_knows_person_0_0.csv"), knows, (r) => person(r.at(0)) && person(r.at(1)));

    // What they wrote before May 2010, and the replies among it.
    const early = (r) => r.get("creationDate") < "2010-05";
    const posts = table(at("dynamic/post_0_0.csv"), "|");
    const keptPosts = new Set(posts.rows.filter((r) => person(r.get("creator")) && early(r)).map((r) => r.get("id")));
    const comments = table(at("dynamic/comment_0_0.csv"), "|");
    const keptComments = new Set();
    // A reply is written after what it answers, so the file's order by date resolves the chain.
    for (const r of [...comments.rows].sort((a, b) => a.get("creationDate").localeCompare(b.get("creationDate")))) {
      const answers = r.get("replyOfPost") ? keptPosts.has(r.get("replyOfPost")) : keptComments.has(r.get("replyOfComment"));
      if (person(r.get("creator")) && early(r) && answers) keptComments.add(r.get("id"));
    }
    writeRows(out("dynamic/post_0_0.csv"), posts, (r) => keptPosts.has(r.get("id")));
    writeRows(out("dynamic/comment_0_0.csv"), comments, (r) => keptComments.has(r.get("id")));
    const forums = table(at("dynamic/forum_0_0.csv"), "|");
    writeRows(out("dynamic/forum_0_0.csv"), forums, (r) => person(r.get("moderator")) && early(r));

    // Every place a kept row names, and the places those are part of, to the continents.
    const places = table(at("static/place_0_0.csv"), "|");
    const parent = new Map(places.rows.map((r) => [r.get("id"), r.get("isPartOf")]));
    const named = new Set();
    const name = (id) => {
      for (let p = id; p && !named.has(p); p = parent.get(p)) named.add(p);
    };
    for (const r of people.rows) if (person(r.get("id"))) name(r.get("place"));
    for (const r of [...posts.rows.filter((r) => keptPosts.has(r.get("id"))), ...comments.rows.filter((r) => keptComments.has(r.get("id")))]) {
      name(r.get("place"));
    }
    // The organisations in those places: a university is in a city, a company in a country.
    const organisations = table(at("static/organisation_0_0.csv"), "|");
    const placed = new Set(named);
    writeRows(out("static/organisation_0_0.csv"), organisations, (r) => placed.has(r.get("place")));
    writeRows(out("static/place_0_0.csv"), places, (r) => named.has(r.get("id")));

    const interests = table(at("dynamic/person_hasInterest_tag_0_0.csv"), "|");
    const tagIds = new Set(interests.rows.filter((r) => person(r.at(0))).map((r) => r.at(1)));
    const tags = table(at("static/tag_0_0.csv"), "|");
    writeRows(out("static/tag_0_0.csv"), tags, (r) => tagIds.has(r.get("id")));
    const classes = table(at("static/tagclass_0_0.csv"), "|");
    const superclass = new Map(classes.rows.map((r) => [r.get("id"), r.get("isSubclassOf")]));
    const classIds = new Set();
    for (const r of tags.rows) {
      if (!tagIds.has(r.get("id"))) continue;
      for (let c = r.get("hasType"); c && !classIds.has(c); c = superclass.get(c)) classIds.add(c);
    }
    writeRows(out("static/tagclass_0_0.csv"), classes, (r) => classIds.has(r.get("id")));
  },
};

const names = process.argv.slice(2);
for (const name of names.length ? names : readdirSync(GRAPHS)) {
  const dir = join(GRAPHS, name);
  execFileSync("sh", [join(dir, "fetch.sh")], { stdio: "inherit" });
  const sample = join(dir, "sample");
  rmSync(sample, { force: true, recursive: true });
  SAMPLES[name](join(dir, "data"), sample);
  console.log(`  ${name}: sampled into ${sample}`);
}
