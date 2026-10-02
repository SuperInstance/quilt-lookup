/**
 * tests/classification.test.js — softjoint classification totality + laws.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cls = JSON.parse(readFileSync(path.join(ROOT, 'catalog/classification.json'), 'utf8'));
const types = JSON.parse(readFileSync(path.join(ROOT, 'catalog/spreadsheet-types.json'), 'utf8'));

const CLASSES = ['pure-lookup', 'lookup-with-weights', 'needs-dynamic-model', 'greeter-territory'];
const allEntries = [...types.entries, ...types.extensions.entries];

test('totality: every catalog entry has exactly one classification', () => {
  const ids = cls.assignments.map((a) => a.entry_id);
  assert.equal(ids.length, new Set(ids).size, 'duplicate assignments');
  const entryIds = new Set(allEntries.map((e) => e.id));
  assert.equal(ids.length, entryIds.size, `assignments ${ids.length} != entries ${entryIds.size}`);
  for (const id of ids) assert.ok(entryIds.has(id), `assignment for unknown entry ${id}`);
});

test('class vocabulary: only the 4 softjoint classes appear', () => {
  for (const a of cls.assignments) assert.ok(CLASSES.includes(a.decomposition_class), `${a.entry_id} bad class ${a.decomposition_class}`);
});

test('every assignment carries rule_id + non-empty one-line reason', () => {
  for (const a of cls.assignments) {
    assert.match(a.rule_id, /^R\d+-/, `${a.entry_id} missing rule_id`);
    assert.ok(a.reason && a.reason.length > 20 && a.reason.length < 400, `${a.entry_id} reason not a one-liner`);
  }
});

test('all 4 classes are populated (the vocabulary is live, not decorative)', () => {
  const counts = cls.meta.counts;
  for (const c of CLASSES) assert.ok(counts[c] > 0, `class ${c} never used`);
});

test('executable law: pure-lookup/weights => true; dynamic/greeter => false', () => {
  for (const a of cls.assignments) {
    const expected = a.decomposition_class === 'pure-lookup' || a.decomposition_class === 'lookup-with-weights';
    assert.equal(a.executable, expected, `${a.entry_id} executable violates the law`);
  }
});

test('committed catalog executable matches the classifier (hint preserved)', () => {
  const byId = new Map(cls.assignments.map((a) => [a.entry_id, a]));
  for (const e of allEntries) {
    assert.equal(typeof e.executable, 'boolean', `${e.id} executable not boolean`);
    assert.equal(typeof e.executable_hint, 'boolean', `${e.id} executable_hint missing`);
    assert.equal(e.executable, byId.get(e.id).executable, `${e.id} executable != classifier`);
  }
});

test('greeter-territory stays rare (it is the deliberate exception, not a dump bucket)', () => {
  const greeters = cls.assignments.filter((a) => a.decomposition_class === 'greeter-territory');
  assert.ok(greeters.length >= 1 && greeters.length <= 0.05 * cls.assignments.length);
});

test('rule catalog is committed (next lane can audit/automate the rules)', () => {
  assert.ok(cls.meta.rule_catalog.length >= 8);
  for (const r of cls.meta.rule_catalog) assert.ok(r.id && CLASSES.includes(r.class) && r.description);
});
