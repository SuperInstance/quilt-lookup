// src/merge-extensions.js — merge catalog/extensions/extensions.json into the main
// catalog with provenance source='wave-66-extension', then re-dedupe ids. One
// catalog file, two sources, zero deletions.
//
// CLI: node src/merge-extensions.js <base.json> <extensions.json> <out.json>
import fs from 'node:fs';
import { parseCatalog, dedupeIds, slug } from './parser.js';

const [baseFile, extFile, outFile] = process.argv.slice(2);
const base = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
const ext = JSON.parse(fs.readFileSync(extFile, 'utf8'));

// extension entries are raw lines in the principal's style — parse them with the
// same entry grammar by building a synthetic md document.
const synthetic = ext.families.map(fam =>
  `${fam.name}\n${fam.entries.join('\n')}`
).join('\n\n');
const parsedExt = parseCatalog(synthetic);

const merged = {
  ...base,
  families: [
    ...base.families.map(f => ({ ...f, source: 'principal' })),
    ...parsedExt.families.map(f => ({ ...f, source: 'wave-66-extension' })),
  ],
  unparsed: base.unparsed,
  census: {
    source_lines: base.census.source_lines,
    families: merged0 => merged0, // replaced below
    entries: 0,
  },
};
merged.census = {
  families: merged.families.length,
  entries: merged.families.reduce((s, f) => s + f.entries.length, 0),
  base_entries: base.census.entries,
  extension_entries: parsedExt.census.entries,
};
dedupeIds(merged);

fs.writeFileSync(outFile, JSON.stringify(merged, null, 2) + '\n');
console.log(`merged: ${merged.census.entries} entries (${merged.census.base_entries} principal + ${merged.census.extension_entries} wave-66) across ${merged.census.families} families`);
