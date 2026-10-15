import { describe, expect, it } from "vitest";
import { isSecret, redact } from "./redact.js";

describe("redact", () => {
  it("replaces strings, numbers and the lists of them, and keeps the statement's shape", () => {
    expect(redact("SELECT a FROM t WHERE id IN (1, 2, 3) AND name = 'Ada ''Lovelace''' AND x > 4.5e3")).toBe(
      "SELECT a FROM t WHERE id IN (?) AND name = ? AND x > ?",
    );
  });

  it("keeps quoted identifiers, and the digits inside a name", () => {
    expect(redact('SELECT "a\'b", col1, t2.x FROM "My Table" WHERE "a\'b" = \'v\'')).toBe(
      'SELECT "a\'b", col1, t2.x FROM "My Table" WHERE "a\'b" = ?',
    );
  });

  it("replaces dollar-quoted strings and drops comments, which can hold a literal", () => {
    expect(redact("SELECT $$secret text$$ || $tag$ it's $tag$ -- note 'x'\nFROM t /* 'y' */")).toBe("SELECT ? || ?  \nFROM t  ");
  });

  it("redacts from an unterminated quote to the end, rather than leak what follows it", () => {
    expect(redact("SELECT 'oops, 42 FROM t")).toBe("SELECT ?");
  });

  it("redacts the values in DuckDB's own wording of a failure", () => {
    expect(redact("Conversion Error: Could not convert string 'abc' to INT32\nLINE 1: SELECT 'abc'::INT")).toBe(
      "Conversion Error: Could not convert string ? to INT32\nLINE ?: SELECT ?::INT",
    );
  });

  it("recognises CREATE SECRET however it is spelled, and nothing else", () => {
    expect(isSecret("CREATE SECRET s (TYPE s3, KEY_ID 'k', SECRET 'v')")).toBe(true);
    expect(isSecret("  -- why\n create or replace persistent secret s (TYPE s3)")).toBe(true);
    expect(isSecret("SELECT secret FROM keys")).toBe(false);
    expect(isSecret("DROP SECRET s")).toBe(false);
  });
});
