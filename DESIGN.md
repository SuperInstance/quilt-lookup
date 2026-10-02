# DESIGN — quilt-lookup (wave-66, lane 66-d)

## Ideation pass (structures considered)

1. **One mega-JSON, hand-written** — rejected: 65KB of prose can't be hand-transcribed
   reliably; a parser is also the *losslessness proof* (census tests).
2. **SQLite database** — rejected for v0: diffability and zero-shot readability of a
   JSON file beat query power at this scale (1027 rows); sqlite can be derived later.
3. **Per-family JSON files** (chosen for the catalog, one file total for simplicity) —
   merged into one document with per-family `source` provenance: the catalog is read
   far more than it is written, and one file makes the "nothing lost" census trivial.

## The parser laws

- **Nothing is dropped.** Entries, family headers, AND unparsed lines are all counted;
  tests assert `entries + headers + unparsed` accounts for every non-blank source line
  (±3 for the title lines). The unparsed 2 lines ARE the title lines.
- **Provenance everywhere.** Every entry carries `source_line` into the original md.
  Families carry `source: 'principal' | 'wave-66-extension'`.
- **Collision suffixing, not renaming.** Cross-family duplicate names ("Adjacency
  table" in GRAPH and TOPOLOGY) get `-2`/`-3` suffixes + a `dup_of` receipt. The id
  space must be globally unique for recipes and classification; history stays readable.

## The recipe contract

Recipes are the bridge between "a type of table" and "a cell that runs". Compatibility
with the arena engine (download/quilt-arena/engine) is by KIND and evaluation semantics:
`lookup` cells are data (tables+default, the engine's value cells), `formula` cells are
tiny expressions evaluated with `new Function` + declared inputs in scope — the same
trust level the upstream engine documents (formula.js: "a tiny sandbox, NOT a security
boundary"). Every recipe carries an `example_input`/`expected_output` pair; the
validator executes all 44 and the pass rate is a committed artifact
(catalog/validation-report.json). Failures are receipted, never hidden.

Choosing catalog refs was a lesson in the catalog's own granularity: some recipe
concepts (gcd, rounding) don't have dedicated entries — they live INSIDE other entries
("Multiplication table mod n", "Fixed point table"). Recipes point at the closest
honest ref and say so in a note. Where the catalog lacked a home entirely (mean,
variance — the catalog has distribution tables but no summary-statistics entry), the
recipe anchors to the neighboring family entries ("Frequency table", "Covariance
matrix"). That gap is a wave-67 catalog extension candidate: a SUMMARY STATISTICS family.

## The classification + the smoke's honest finding

v0 classification is transparent keyword rules (every tag explainable). The typesafe
smoke (receipts/classification-smoke.json, 1 call, 1010+304 tok) asked jev-1.13.0 to
classify 5 entries: it agreed on the extremes (Truth table = pure-lookup, Chit-chat =
greeter-territory) but classified **Sentiment table** and **Confusion matrix** as
pure-lookup where our rules say greeter-territory / lookup-with-weights.

Honest reading: the model is MORE table-happy than the rules. Two hypotheses:
(a) the model over-freezes — it sees the stored representation (a table of scores)
and not the living surface (which message, which moment — the thing the principal
calls understanding the moment as a vector, not a value); (b) our rules over-protect.
This disagreement is exactly the data the freezing test should arbitrate per-deployment:
classify conservatively (dynamic by default), freeze on evidence. v0 keeps the
conservative rules and receipts the disagreement rather than resolving it by fiat.

## What the next wave should consume

- quilt-softjoints: `classification.json` drives `decompose()` directly.
- quilt-runbook: recipe validation failures (if any in future batches) should flow
  through adjustment records — the catalog is itself a quilt that can stop needing
  manual fixes.
- Wave-67: SUMMARY STATISTICS family extension; recipe generation for the 5 new
  extension families beyond the current 6 samples.
