// tests/recipes.test.mjs — executable recipe proof + classification totality.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RECIPES } from '../recipes/recipes.js';
import { evalRecipe, validateAll } from '../src/validate.js';
import { classifyCatalog } from '../src/softjoint-tags.js';

const onDisk = JSON.parse(fs.readFileSync(new URL('../catalog/spreadsheet-types.json', import.meta.url), 'utf8'));

test('recipe count meets the wave bar (>= 40 executable recipes)', () => {
  assert.ok(RECIPES.length >= 40, `only ${RECIPES.length}`);
});

test('>= 90% of recipes pass their own example (honest failures stay receipted)', () => {
  const report = validateAll(RECIPES);
  const rate = report.pass / report.total;
  fs.mkdirSync(new URL('../catalog/', import.meta.url), { recursive: true });
  fs.writeFileSync(new URL('../catalog/validation-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  assert.ok(rate >= 0.9, `pass rate ${rate.toFixed(3)} (${report.fail} fails: ${JSON.stringify(report.failures).slice(0, 300)})`);
});

test('every recipe references a real catalog entry id (merged catalog)', () => {
  const ids = new Set();
  for (const f of onDisk.families) for (const e of f.entries) ids.add(e.id);
  const missing = RECIPES.filter(r => !ids.has(r.catalog_ref));
  assert.deepEqual(missing, [], `recipes with dangling catalog_ref: ${missing.map(r => r.id).join(',')}`);
});

test('recipes are compatible in kind with the arena engine (lookup|formula only)', () => {
  for (const r of RECIPES) assert.ok(['lookup', 'formula'].includes(r.kind), `bad kind ${r.kind} on ${r.id}`);
});

test('recipe ids are unique', () => {
  const seen = new Set();
  for (const r of RECIPES) { assert.ok(!seen.has(r.id), `dup ${r.id}`); seen.add(r.id); }
});

test('lookup evaluation: hit and default paths both behave', () => {
  const r = RECIPES.find(x => x.id === 'biz.refund-window');
  assert.equal(evalRecipe(r, { days_receipt: 'under7_no' }), 'store-credit');
  assert.equal(evalRecipe(r, { days_receipt: 'whenever' }), 'manager');
});

test('classification is total: every catalog entry gets a class', () => {
  const { classification, counts, total } = classifyCatalog(onDisk);
  const diskTotal = onDisk.families.reduce((s, f) => s + f.entries.length, 0);
  assert.equal(total, diskTotal);
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), total);
  fs.writeFileSync(new URL('../catalog/classification.json', import.meta.url), JSON.stringify({ classification, counts }, null, 2) + '\n');
});

test('greeter-territory exists and pure-lookup dominates (the thesis in numbers)', () => {
  const { counts } = classifyCatalog(onDisk);
  assert.ok(counts['greeter-territory'] > 0, 'the catalog must name the surfaces we never freeze');
  assert.ok(counts['pure-lookup'] + counts['lookup-with-weights'] > counts['needs-dynamic-model'] + counts['greeter-territory'],
    'the formulaic bulk should dominate — that IS the decomposition thesis');
});
