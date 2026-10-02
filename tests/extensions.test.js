/**
 * tests/extensions.test.js — style conformance: the extension families must
 * be written in the principal's EXACT line grammar ("- Name - shape - tail"),
 * so the same parser consumes them with zero unparsed lines.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCatalogText, extensionFiles } from '../catalog/parser.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT_DIR = path.join(ROOT, 'catalog/extensions');
const types = JSON.parse(readFileSync(path.join(ROOT, 'catalog/spreadsheet-types.json'), 'utf8'));

const PRINCIPAL_FAMILIES = new Set(types.families.filter((f) => f.provenance === 'principal').map((f) => f.name));

test('extension files exist and are .md', () => {
  const files = extensionFiles(EXT_DIR);
  assert.ok(files.length >= 4);
  for (const f of files) assert.match(f, /^[A-Z0-9&-]+\.md$/);
});

test('style conformance: every extension line parses under the principal grammar', () => {
  for (const f of readdirSync(EXT_DIR).filter((x) => x.endsWith('.md'))) {
    const text = readFileSync(path.join(EXT_DIR, f), 'utf8');
    const parsed = parseCatalogText(text, { sourceFile: f });
    assert.equal(parsed.unparsed.length, 0, `${f} has ${parsed.unparsed.length} style violations: ${JSON.stringify(parsed.unparsed.map((u) => u.line))}`);
    assert.ok(parsed.families.length === 1, `${f} must declare exactly one family`);
    assert.ok(parsed.entries.length >= 8, `${f} family too thin (${parsed.entries.length} entries)`);
    for (const e of parsed.entries) {
      assert.equal(e.examples_style, 'examples', `${f}: entry "${e.name}" must use the principal's "- examples: a, b" tail style`);
      assert.ok(e.examples.length >= 1);
    }
  }
});

test('extensions are genuinely NEW families (no overlap with principal families)', () => {
  for (const f of types.families.filter((x) => x.provenance === 'wave-66')) {
    assert.ok(!PRINCIPAL_FAMILIES.has(f.name), `${f.name} already exists in the principal catalog`);
  }
});

test('committed JSON carries extensions under "extensions" with wave-66 provenance', () => {
  assert.equal(types.extensions.provenance, 'wave-66');
  assert.ok(Array.isArray(types.extensions.families) && types.extensions.families.length >= 4);
  const famNames = new Set(types.extensions.families.map((f) => f.name));
  for (const e of types.extensions.entries) assert.ok(famNames.has(e.family), `${e.id} family not in extensions.families`);
});

test('extensions keep the catalog honest: counts add up', () => {
  assert.equal(types.entries.length, types.meta.counts.principal_entries);
  assert.equal(types.extensions.entries.length, types.meta.counts.extension_entries);
  assert.equal(
    types.entries.length + types.extensions.entries.length,
    types.meta.counts.entries,
  );
});
