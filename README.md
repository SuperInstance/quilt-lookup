# quilt-lookup

The principal's catalog — **MATHEMATICAL SPREADSHEET TYPES** (`spreadsheettypesnotcomplete.md`,
988 entries, 98 families) — as a machine-usable library, plus the fleet's extensions and
the executable cell recipes that make the catalog *run*.

**The filename says "not complete". We keep answering.** Wave-66 added 5 families
(39 entries): INFORMATION THEORY, GAME THEORY, CONTROL THEORY, DYNAMICAL SYSTEMS,
TOPOLOGY & STRUCTURE. Wave-67 added SUMMARY STATISTICS (13 entries) — the gap wave-66's
own recipes exposed. Merged catalog: **1040 entries, 104 families**, every id globally
unique (collisions suffixed `-N` with a `dup_of` receipt — nothing deleted).

## What's in it

| artifact | what it is |
|----------|------------|
| `catalog/spreadsheet-types.json` | the full merged catalog (provenance per family: `principal`, `wave-66-extension`, or `wave-67-extension`; `source_line` points back into the md) |
| `catalog/unparsed.json` | the 2 lines that aren't entries (the title lines) — preserved with reasons |
| `catalog/extensions/extensions.json` | the extension families, raw, in the principal's style (per-family `wave` provenance) |
| `recipes/recipes.js` | **73 executable cell recipes** (lookup tables + formula fragments) with machine-checkable examples, each referencing its catalog entry — 21 anchored to wave-66 extension entries (was 6), 13 to the wave-67 SUMMARY STATISTICS family |
| `catalog/validation-report.json` | live proof: every recipe executed against its own example |
| `catalog/classification.json` | every entry tagged into the soft-joint classes |
| `src/` | parser, extension merger, validator, classifier |

## The soft-joint classification

Every catalog entry is annotated (see `src/softjoint-tags.js`):

- **pure-lookup** — the table IS the answer (SET THEORY, LOGIC, LINEAR ALGEBRA, …)
- **lookup-with-weights** — tabular but rows carry tunable scores
- **needs-dynamic-model** — the moment genuinely varies; a small model reading a
  vector adds real value
- **greeter-territory** — surfaces where scripting makes things robotic; keep dynamic
  BY DESIGN (chit-chat, greeting, rapport…)

This feeds `quilt-softjoints`' decomposer directly: pure-lookup families become lookup
cells; needs-dynamic-model entries are soft-joint candidates; greeter-territory is law.

## Quickstart

```bash
npm test          # 17 tests: parser losslessness, recipe execution, classification totality, wave-67 family proof
node smoke.mjs    # optional: 1 typesafe call cross-checks 5 classifications with jev
```

```js
import { RECIPES } from './recipes/recipes.js';
import { evalRecipe } from './src/validate.js';
evalRecipe(RECIPES.find(r => r.id === 'biz.refund-window'), { days_receipt: 'under7_no' });
// → 'store-credit'
```

## License

MIT
