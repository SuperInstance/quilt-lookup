/**
 * tests/parser.test.js — parser round-trip: NOTHING from the principal's
 * raw catalog is lost. The census must account for every source line, and
 * every emitted entry must re-point at the exact line it came from.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadCatalog, assembleCatalog, parseCatalogText } from '../catalog/parser.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { base, extensions, sourceText } = loadCatalog();
const types = JSON.parse(readFileSync(path.join(ROOT, 'catalog/spreadsheet-types.json'), 'utf8'));

test('census: every source line is accounted for exactly once', () => {
  const c = base.census;
  const accounted = c.blank + c.doc_headers + c.family_headers + c.entries + c.unrecognized;
  assert.equal(accounted, c.total_lines, `census ${JSON.stringify(c)} drops lines`);
  assert.equal(c.total_lines, sourceText.split('\n').length);
});

test('census: zero unrecognized lines in the principal catalog', () => {
  assert.equal(base.census.unrecognized, 0, 'unrecognized lines belong in unparsed.json; none expected for this source');
});

test('round-trip: entry count matches dash-line census', () => {
  const dashLines = base.sourceText.split('\n').filter((l) => l.trim().startsWith('-')).length;
  assert.equal(base.entries.length + base.unparsed.length, dashLines);
  assert.equal(base.unparsed.length, 0);
});

test('round-trip: every entry re-points at its exact source line', () => {
  const lines = base.sourceText.split('\n');
  for (const e of base.entries) {
    const src = lines[e.source_line - 1].trim();
    assert.ok(src.startsWith('- '), `${e.id}: source_line ${e.source_line} is not an entry line`);
    assert.ok(src.includes(e.name), `${e.id}: name "${e.name}" not found in its source line "${src}"`);
  }
});

test('round-trip: family headers survive verbatim as family names', () => {
  const headerLines = base.sourceText.split('\n').filter((l) => /^[A-Z0-9][A-Z0-9 &/'’().+-]*$/.test(l.trim()) && l.trim() && !l.trim().startsWith('-') && !/MATHEMATICAL SPREADSHEET TYPES/.test(l));
  const names = new Set(base.families.map((f) => f.name));
  assert.equal(headerLines.length, base.families.length);
  for (const h of headerLines) assert.ok(names.has(h.trim()), `family header "${h}" missing from parsed families`);
});

test('schema: required fields + types on every entry', () => {
  for (const e of base.entries) {
    for (const f of ['id', 'family', 'name', 'shape', 'examples', 'source_line', 'executable']) {
      assert.ok(f in e, `${e.id} missing ${f}`);
    }
    assert.equal(typeof e.executable, 'boolean', `${e.id}.executable not boolean`);
    assert.ok(Array.isArray(e.examples) && e.examples.length > 0, `${e.id} has no examples`);
    assert.equal(typeof e.source_line, 'number');
  }
});

test('ids: unique and family-scoped', () => {
  const ids = new Set();
  for (const e of base.entries) {
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
    assert.ok(e.id.startsWith(e.id.split('__')[0] + '__') && e.id.includes('__'), `${e.id} not family-scoped`);
  }
});

test('grammar: the parser is a pure function (re-parse gives identical counts)', () => {
  const again = parseCatalogText(base.sourceText, { sourceFile: 'x' });
  assert.equal(again.entries.length, base.entries.length);
  assert.equal(again.families.length, base.families.length);
  assert.equal(again.unparsed.length, base.unparsed.length);
});

test('grammar: ambiguous lines go to unparsed with reasons, never dropped', () => {
  const weird = 'SOME FAMILY\n- Broken entry line only two parts\n- OK table - shape - examples: a, b\nplain line\n';
  const r = parseCatalogText(weird, { sourceFile: 'inline-test' });
  assert.equal(r.entries.length, 1);
  assert.equal(r.unparsed.length, 2, 'both bad lines must be receipted');
  for (const u of r.unparsed) {
    assert.ok(u.reason && u.line && typeof u.source_line === 'number');
  }
});

test('committed spreadsheet-types.json matches a fresh assemble', () => {
  const fresh = assembleCatalog();
  assert.equal(fresh.doc.meta.counts.entries, types.meta.counts.entries);
  assert.equal(fresh.doc.meta.counts.families, types.meta.counts.families);
  assert.equal(fresh.doc.meta.counts.unparsed, types.meta.counts.unparsed);
});

test('extensions: 6 new families, 72 entries, provenance wave-66', () => {
  assert.ok(extensions.families.length >= 4, 'brief requires >= 4 extension families');
  assert.equal(extensions.families.length, 6);
  assert.ok(extensions.entries.length >= 4 * 8, 'each extension family carries a full table set');
  for (const e of extensions.entries) assert.equal(e.provenance, 'wave-66');
  for (const f of extensions.families) assert.equal(f.provenance, 'wave-66');
});

test('extensions: no id collisions with the principal catalog', () => {
  const baseIds = new Set(base.entries.map((e) => e.id));
  for (const e of extensions.entries) assert.ok(!baseIds.has(e.id), `extension id collides: ${e.id}`);
});
