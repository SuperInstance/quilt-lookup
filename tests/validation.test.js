/**
 * tests/validation.test.js — re-run the validator in-process and assert the
 * committed report is fresh and above the threshold. Also proves the report
 * receipts failures honestly when a recipe is deliberately corrupted (on a
 * temp copy of the recipe data, never touching committed artifacts).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, cpSync, rmSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const report = JSON.parse(readFileSync(path.join(ROOT, 'catalog/validation-report.json'), 'utf8'));

test('committed report: pass rate >= 0.9 (brief §4 law)', () => {
  assert.equal(report.meta.total, report.meta.pass + report.meta.fail);
  assert.ok(report.meta.pass_rate >= report.meta.threshold, `pass_rate ${report.meta.pass_rate} < threshold ${report.meta.threshold}`);
  assert.ok(report.meta.meets_threshold);
});

test('committed report: failures are receipted honestly (no silent drops)', () => {
  assert.equal(report.failures.length, report.meta.fail);
  for (const f of report.failures) assert.ok(f.stage && (f.reason || f.pass));
  // every recipe in index.json has a result row
  const index = JSON.parse(readFileSync(path.join(ROOT, 'recipes/index.json'), 'utf8'));
  const resultIds = new Set(report.results.map((r) => r.id));
  for (const item of index.recipes) assert.ok(resultIds.has(item.id), `no validation row for ${item.id}`);
});

test('validator is honest: corrupting one recipe drops exactly one pass (sandboxed temp copy)', async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'quilt-lookup-val-'));
  try {
    cpSync(ROOT, tmp, { recursive: true });
    // tamper: expected_output no longer matches the table
    const f = path.join(tmp, 'recipes/logic__truth-table.json');
    const r = JSON.parse(readFileSync(f, 'utf8'));
    r.expected_output = 999;
    writeFileSync(f, JSON.stringify(r, null, 2) + '\n');
    // tamper: a formula recipe hits the deny-list
    const f2 = path.join(tmp, 'recipes/coding-theory__hamming-code-table.json');
    const r2 = JSON.parse(readFileSync(f2, 'utf8'));
    r2.table_or_formula.expr = 'process.exit(0)';
    writeFileSync(f2, JSON.stringify(r2, null, 2) + '\n');

    // import the validator FROM THE TEMP COPY so committed artifacts are untouched
    const mod = await import(path.join(tmp, 'src/validate.js'));
    const rep = mod.runValidation({ threshold: 0.9, reportPath: path.join(tmp, 'catalog/validation-report.json') });
    assert.equal(rep.meta.total, report.meta.total);
    assert.equal(rep.meta.fail, 2, 'expected exactly 2 tampered failures');
    const byId = new Map(rep.results.map((x) => [x.id, x]));
    assert.equal(byId.get('recipe.logic__truth-table').pass, false);
    assert.equal(byId.get('recipe.coding-theory__hamming-code-table').pass, false);
    assert.ok(!byId.get('recipe.logic__truth-table').reason.includes('undefined'), 'failure must carry a real reason');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
