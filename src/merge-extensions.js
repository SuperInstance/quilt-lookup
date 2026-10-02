// src/merge-extensions.js — merge catalog/extensions/*.json extension families into
// the main catalog with per-family provenance, then re-dedupe ids. One catalog file,
// two+ sources, zero deletions.
//
// IDEMPOTENCE LAW (wave-67): the canonical invocation merges the base catalog with
// ITSELF as output (base == out), so the merge MUST be safe to re-run:
//   - any base family whose source is an extension source (starts with 'wave-') is
//     DROPPED from the base and re-supplied from the extension file(s) — extension
//     truth lives in extensions/*.json, never in the merged file;
//   - principal families (source 'principal' or untagged) pass through untouched.
//
// PROVENANCE (wave-67): each extension family object may carry `"wave": "wave-N"`;
// merged families get source = `${wave}-extension`. Families without a wave field
// default to 'wave-66-extension' (the original extension batch, left untouched).
//
// CLI: node src/merge-extensions.js <base.json> <extensions.json> [more.json ...] <out.json>
//      (first arg = base, LAST arg = out, everything in between = extension files)
import fs from 'node:fs';
import { parseCatalog, dedupeIds } from './parser.js';

const argv = process.argv.slice(2);
if (argv.length < 3) {
  console.error('usage: node src/merge-extensions.js <base.json> <extensions.json> [more.json ...] <out.json>');
  process.exit(2);
}
const baseFile = argv[0];
const extFiles = argv.slice(1, -1);
const outFile = argv[argv.length - 1];

const base = JSON.parse(fs.readFileSync(baseFile, 'utf8'));

// --- idempotence: strip extension families from the base (they are re-merged below)
const isExtensionSource = (s) => typeof s === 'string' && s.startsWith('wave-') && s.endsWith('-extension');
const principalFamilies = base.families.filter(f => !isExtensionSource(f.source));
const strippedCount = base.families.length - principalFamilies.length;
const baseEntries = principalFamilies.reduce((s, f) => s + f.entries.length, 0);

// --- extension families are raw lines in the principal's style — parse them with
// the same entry grammar by building a synthetic md document per file.
const parsedExtFamilies = [];
for (const ef of extFiles) {
  const ext = JSON.parse(fs.readFileSync(ef, 'utf8'));
  const synthetic = ext.families.map(fam =>
    `${fam.name}\n${fam.entries.join('\n')}`
  ).join('\n\n');
  const parsed = parseCatalog(synthetic);
  // family-level provenance: the json family object order matches parse order
  ext.families.forEach((fam, i) => {
    const wave = fam.wave || 'wave-66';
    parsedExtFamilies.push({ ...parsed.families[i], source: `${wave}-extension` });
  });
}

const merged = {
  ...base,
  families: [
    ...principalFamilies.map(f => ({ ...f, source: 'principal' })),
    ...parsedExtFamilies,
  ],
  unparsed: base.unparsed,
};

const extEntries = parsedExtFamilies.reduce((s, f) => s + f.entries.length, 0);
merged.census = {
  source_lines: base.census.source_lines,
  families: merged.families.length,
  entries: merged.families.reduce((s, f) => s + f.entries.length, 0),
  base_entries: baseEntries,
  extension_entries: extEntries,
  extension_entries_by_wave: parsedExtFamilies.reduce((m, f) => {
    m[f.source] = (m[f.source] || 0) + f.entries.length;
    return m;
  }, {}),
  idempotent_strip: strippedCount,
};
dedupeIds(merged);

fs.writeFileSync(outFile, JSON.stringify(merged, null, 2) + '\n');
const byWave = Object.entries(merged.census.extension_entries_by_wave)
  .map(([w, n]) => `${n} ${w}`).join(' + ');
console.log(`merged: ${merged.census.entries} entries (${merged.census.base_entries} principal + ${byWave}) across ${merged.census.families} families (stripped ${strippedCount} previously-merged extension families from base — idempotent re-run)`);
