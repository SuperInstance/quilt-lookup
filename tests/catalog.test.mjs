// tests/catalog.test.mjs — parser losslessness + extension conformance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseCatalog } from '../src/parser.js';

const MD = fs.readFileSync('/home/z/my-project/upload/spreadsheettypesnotcomplete.md', 'utf8');
const parsed = parseCatalog(MD);
const onDisk = JSON.parse(fs.readFileSync(new URL('../catalog/spreadsheet-types.json', import.meta.url), 'utf8'));
const unparsed = JSON.parse(fs.readFileSync(new URL('../catalog/unparsed.json', import.meta.url), 'utf8'));

test('parser preserves every entry: re-parse census accounts for all entries', () => {
  const diskEntries = onDisk.families.reduce((s, f) => s + f.entries.length, 0);
  // disk catalog = principal parse + wave-66 extensions (census.receipted below)
  assert.equal(diskEntries, parsed.census.entries + (onDisk.census.extension_entries || 0));
  assert.ok(diskEntries > 900, `expected the big catalog, got ${diskEntries}`);
});

test('entries + unparsed + headers account for every non-blank source line', () => {
  const nonBlank = MD.split(/\r?\n/).filter(l => l.trim()).length;
  const entries = parsed.census.entries;
  const famHeaders = parsed.census.families;
  const up = parsed.unparsed.length;
  assert.ok(entries + famHeaders + up <= nonBlank, 'nothing invented');
  assert.ok(nonBlank - (entries + famHeaders + up) <= 3, `only the title lines may be unaccounted; gap=${nonBlank - (entries + famHeaders + up)}`);
});

test('every entry has id + name + source_line provenance', () => {
  for (const f of onDisk.families) {
    for (const e of f.entries) {
      assert.ok(e.id && e.name && e.source_line > 0, `bad entry in ${f.name}: ${JSON.stringify(e).slice(0, 80)}`);
    }
  }
});

test('slugs are unique within the whole catalog', () => {
  const ids = new Set();
  for (const f of onDisk.families) for (const e of f.entries) {
    assert.ok(!ids.has(e.id), `duplicate slug ${e.id}`);
    ids.add(e.id);
  }
});

test('unparsed lines are preserved with reasons (never-delete-data law)', () => {
  assert.ok(unparsed.unparsed.length >= 2);
  for (const u of unparsed.unparsed) assert.ok(u.reason && u.text);
});

test('extensions follow the principal\'s style: name + shape segments, examples allowed', () => {
  const ext = JSON.parse(fs.readFileSync(new URL('../catalog/extensions/extensions.json', import.meta.url), 'utf8'));
  assert.ok(ext.families.length >= 4);
  for (const fam of ext.families) {
    assert.match(fam.name, /^[A-Z]/);
    for (const e of fam.entries) {
      assert.ok(e.startsWith('- ') && e.includes(' - '), `entry not in principal's style: ${e.slice(0, 60)}`);
    }
  }
});

test('wave-67: SUMMARY STATISTICS family exists with >= 10 entries and wave-67 provenance', () => {
  const fam = onDisk.families.find(f => f.name === 'SUMMARY STATISTICS');
  assert.ok(fam, 'SUMMARY STATISTICS family missing from the merged catalog');
  assert.ok(fam.entries.length >= 10, `only ${fam.entries.length} entries`);
  assert.equal(fam.source, 'wave-67-extension', 'provenance must say wave-67, not wave-66');
  // principal's style holds for the new family too
  for (const e of fam.entries) assert.ok(e.id && e.name && e.source_line > 0);
});

test('extension entries merged with provenance; ids globally unique after suffixing', () => {
  const extFams = onDisk.families.filter(f => f.source === 'wave-66-extension');
  assert.ok(extFams.length >= 4);
  const ids = onDisk.families.flatMap(f => f.entries.map(e => e.id));
  assert.equal(new Set(ids).size, ids.length, 'suffix dedupe must make ids unique');
  // every renamed duplicate keeps a dup_of receipt (never-delete-data law)
  for (const f of onDisk.families) for (const e of f.entries) {
    if (/-\d+$/.test(e.id) && !e.dup_of) {
      // ids that naturally end in -N (rare) are acceptable; true renames must have dup_of
      assert.ok(!onDisk.families.some(g => g.entries.some(x => x.id === e.id.replace(/-\d+$/, ''))), `unreceipted rename: ${e.id}`);
    }
  }
});
