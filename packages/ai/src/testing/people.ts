// A small graph for the answer tests: people who know each other, as a join graph over two tables
// of the test database. Not part of the published build (`vite.config.ts` excludes `src/testing`).

import type { JoinColumnStats, JoinGraph, Relation } from "@kanzo-tech/mosaic";
import type { TestDatabase } from "./duckdb.js";

const counted = (distinctCount: number, more: Partial<JoinColumnStats> = {}): JoinColumnStats => ({
  nullCount: 0,
  distinctCount,
  mostCommonVals: [],
  mostCommonFreqs: [],
  ...more,
});

/** The graph a corpus of these people would be read as: every column described, and counted by its writer. */
export const PEOPLE: JoinGraph = {
  types: [
    {
      name: "Person",
      table: "person",
      key: "dense_id",
      candidateKeys: ["dense_id"],
      columns: [
        { name: "dense_id", type: "INTEGER", role: "address", stats: counted(6, { minValue: "1", maxValue: "6" }) },
        { name: "gender", type: "VARCHAR", stats: counted(2, { minValue: "female", maxValue: "male", mostCommonVals: ["female", "male"], mostCommonFreqs: [0.5, 0.5] }) },
        { name: "age", type: "INTEGER", stats: counted(6, { minValue: "27", maxValue: "61" }) },
        { name: "born", type: "DATE", stats: counted(6, { minValue: "1965-09-15", maxValue: "1999-01-20" }) },
      ],
    },
  ],
  edges: [{ name: "knows", label: "knows", source: "Person", destination: "Person", table: "knows", src: "src", dst: "dst" }],
};

export const PERSON: Relation = { root: "Person", path: [] };
export const KNOWS: Relation = { root: "Person", path: [{ edge: "knows", direction: "out" }] };

/** Six people, three of each gender, and who knows whom. */
export function seedPeople(db: TestDatabase) {
  db.run(`CREATE TABLE person ("dense_id" INTEGER, "gender" VARCHAR, "age" INTEGER, "born" DATE)`);
  db.run(`INSERT INTO person VALUES
    (1, 'female', 31, '1995-03-01'), (2, 'female', 44, '1982-07-11'), (3, 'female', 27, '1999-01-20'),
    (4, 'male', 52, '1974-05-30'), (5, 'male', 38, '1988-12-02'), (6, 'male', 61, '1965-09-15')`);
  db.run(`CREATE TABLE knows ("src" INTEGER, "dst" INTEGER)`);
  db.run(`INSERT INTO knows VALUES (1, 4), (1, 2), (2, 5), (3, 6), (4, 5)`);
  db.run(`CREATE TABLE secret ("x" INTEGER)`);
}
