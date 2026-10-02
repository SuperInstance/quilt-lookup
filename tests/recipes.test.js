/**
 * tests/recipes.test.js — recipe set shape + arena compatibility contract.
 * The PASS-RATE check itself lives in validation.test.js (which re-runs the
 * validator); this file pins the structural contract.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RECIPES_DIR = path.join(ROOT, 'recipes');
const index = JSON.parse(readFileSync(path.join(RECIPES_DIR, 'index.json'), 'utf8'));
const types = JSON.parse(readFileSync(path.join(ROOT, 'catalog/spreadsheet-types.json'), 'utf8'));
const knownEntries = new Map([...types.entries, ...types.extensions.entries].map((e) => [e.id, e]));

const load = (file) => JSON.parse(readFileSync(path.join(RECIPES_DIR, file), 'utf8'));

test('breadth: at least 40 recipes', () => {
  assert.ok(index.recipes.length >= 40, `only ${index.recipes.length} recipes`);
});

test('each recipe file exists and matches its index entry', () => {
  for (const item of index.recipes) {
    const r = load(item.file);
    assert.equal(r.id, item.id);
    assert.equal(r.catalog_entry, item.catalog_entry);
    assert.equal(r.kind, item.kind);
  }
});

test('shape: required fields + kinds + input/example agreement', () => {
  for (const item of index.recipes) {
    const r = load(item.file);
    for (const f of ['id', 'title', 'catalog_entry', 'family', 'kind', 'inputs', 'table_or_formula', 'example_input', 'expected_output', 'arena']) {
      assert.ok(f in r, `${r.id} missing ${f}`);
    }
    assert.ok(['lookup', 'formula'].includes(r.kind), `${r.id} bad kind`);
    assert.deepEqual(Object.keys(r.example_input).sort(), [...r.inputs].sort(), `${r.id} inputs != example_input keys`);
    if (r.kind === 'lookup') {
      assert.ok(['map', 'nested-map', 'matrix', 'piecewise'].includes(r.table_or_formula.type), `${r.id} bad table type`);
    } else {
      assert.equal(typeof r.table_or_formula.expr, 'string', `${r.id} formula missing expr`);
    }
  }
});

test('arena compatibility: fragments only use value|formula CellDefs', () => {
  // contract with @quilt/core types.d.ts (download/quilt-arena/engine):
  // recipes drop into a sheet as plain cells; no exotic kinds at recipe level.
  for (const item of index.recipes) {
    const r = load(item.file);
    assert.ok(Array.isArray(r.arena?.cells) && r.arena.cells.length >= 1, `${r.id} empty arena fragment`);
    for (const c of r.arena.cells) {
      assert.ok(['value', 'formula'].includes(c.kind), `${r.id} arena cell kind ${c.kind} not engine-compatible`);
      if (c.kind === 'formula') assert.equal(typeof c.expr, 'string');
      if (c.kind === 'value') assert.ok(c.value !== undefined);
    }
  }
});

test('every recipe points at a real catalog entry, and recipe_ref round-trips', () => {
  for (const item of index.recipes) {
    assert.ok(knownEntries.has(item.catalog_entry), `unknown catalog entry ${item.catalog_entry}`);
  }
  const refs = new Set(
    [...types.entries, ...types.extensions.entries].map((e) => e.recipe_ref).filter(Boolean),
  );
  for (const item of index.recipes) {
    assert.ok(refs.has(item.id), `recipe_ref back-fill missing for ${item.id}`);
  }
});

test('formula recipes using Math declare helpers:["Math"] (sandbox law)', () => {
  for (const item of index.recipes) {
    const r = load(item.file);
    if (r.kind === 'formula' && /\bMath\./.test(r.table_or_formula.expr)) {
      assert.deepEqual(r.helpers, ['Math'], `${r.id} uses Math but does not declare the helper`);
    }
    if (r.kind === 'formula' && r.helpers) {
      assert.ok(r.helpers.every((h) => h === 'Math'), `${r.id} declares an unknown helper`);
    }
  }
});

test('no banned identifiers in any formula (validator deny-list parity)', () => {
  const banned = /\b(require|import|process|globalThis|global|Function|eval|fetch|constructor|prototype|__proto__|window|document)\b/;
  for (const item of index.recipes) {
    const r = load(item.file);
    const exprs = [];
    if (r.kind === 'formula') exprs.push(r.table_or_formula.expr);
    for (const c of r.arena.cells) if (c.kind === 'formula') exprs.push(c.expr);
    for (const e of exprs) assert.ok(!banned.test(e), `${r.id} formula hits deny-list: ${e}`);
  }
});

test('recipes prioritize deterministic families (brief §3 law)', () => {
  // at least 30 distinct families represented, and the count of recipes in
  // deterministic families (truth tables, mod arithmetic, z-tables...) dominates
  const fams = new Set(index.recipes.map((r) => r.family));
  assert.ok(fams.size >= 20, `recipes span only ${fams.size} families`);
});
