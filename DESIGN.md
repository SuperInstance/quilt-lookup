# DESIGN — quilt-lookup (wave-66, lane 66-d)

## Ideation pass (structures considered)

1. **One mega-JSON, hand-written** — rejected: 65KB of prose can't be hand-transcribed
   reliably; a parser is also the *losslessness proof* (census tests).
2. **SQLite database** — rejected for v0: diffability and zero-shot readability of a
   JSON file beat query power at this scale (1040 rows); sqlite can be derived later.
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
- The wave-66 queue said: "SUMMARY STATISTICS family extension; recipe generation for
  the 5 new extension families" — wave-67 (lane 67-b) consumed both; see the section below.

## Wave-67 extension (lane 67-b) — SUMMARY STATISTICS + the recipe gap closed

**What Round 71's queue named and wave-66's recipes proved:** the 5 extension families had
only 6 of 44 recipes anchored to their entries (39 entries, mostly recipe-orphan), and the
catalog had no SUMMARY STATISTICS family at all — mean/median/quartiles/EWMA are the most
requested spreadsheet surfaces on earth and the catalog (whose filename says "not complete")
lacked them.

**Ideation pass (how to add a family, three ways):**
1. **A second extensions file** (`extensions-wave67.json`) — rejected: two files invites
   divergent merge invocations and wave-blind tooling; one extensions file with per-family
   `wave` provenance keeps a single source of extension truth.
2. **A separate catalog repo per wave** — rejected: consumers would need N checkouts to
   read one catalog; the merged single-file contract is what other lanes consume.
3. **Append to `catalog/extensions/extensions.json` with a `wave` field per family**
   (chosen) — append-only (existing families untouched), provenance survives the merge
   (`source: "wave-67-extension"`), and tests can pin it.

**Merge idempotence (the in-place rebuild law):** the canonical invocation
`node src/merge-extensions.js catalog/spreadsheet-types.json catalog/extensions/extensions.json catalog/spreadsheet-types.json`
merges the catalog with ITSELF as output. v0 of the merger would have re-appended the
wave-66 families on every run (duplicate-everything). Wave-67 fixed it: the merger now
strips any base family whose source is an extension source (`wave-*-extension`) and
re-supplies them from the extensions file — extension truth lives in extensions/*.json,
never in the merged artifact. Verified by running the merge twice and diffing the full id
list (all 1027 wave-66-era ids preserved, identical census both runs). The CLI also now
accepts multiple extension files (first arg base, LAST arg out, middle = extension files).

**Recipes added (27, all machine-checked in `catalog/validation-report.json`):**
15 anchored to wave-66 extension entries (typewriter confusion, KL drift, mutual
information, Nash check, saddle check, 2-player Shapley, phase-margin bands, Bode corner,
state-space tick, logistic fixed point, basin, Lyapunov class, degree, knot crossings,
Betti→χ) + 13 SUMMARY STATISTICS (pooled mean, 3-value median, mode count, quartile band,
IQR outlier fences, midrange, range, percentile bands, Pearson skewness, kurtosis class,
3-point moving average, EWMA tick, coefficient of variation). 44 → 73 recipes; 21 now
anchor extension entries. Test bar raised 40 → 58 with a new ≥14-extension-anchor test.

**Two honest findings while extending:**
1. `classifyCatalog` passed the family OBJECT to `ruleReason` instead of its name, so
   every reason line silently degraded to the default text — classes were right,
   explainability was broken (wave-66 latent bug). Fixed; reasons now name the law.
2. `scripts/emit-recipes.mjs` is a stale incarnation artifact: it reads a
   `types.entries`/`types.extensions` catalog shape that the sealed parser never produced,
   so it cannot run against the committed catalog. The per-recipe JSON files under
   `recipes/*.json` + `index.json` (56 recipes) are its dormant output, superseded by
   `recipes/recipes.js` (73 recipes) which the tests execute. Left untouched (never-delete
   law) and receipted here; the next lane should either port the emitter to the
   `families[]` shape or retire it to an attic directory.

**Classification note:** SUMMARY STATISTICS joins PURE_FAMILIES (deterministic arithmetic),
with a guard rule — "five-number summary" contains "summar", a text-summarization keyword,
which would misfire into needs-dynamic-model; the family outranks the keyword.
