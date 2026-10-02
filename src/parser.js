// src/parser.js — the principal's raw catalog -> machine-usable JSON.
//
// LAWS:
//   - NEVER drop an entry. Lines that don't parse go to unparsed.json with the
//     reason — the principal's data is sacred; "cleanup" is data loss.
//   - Provenance on every entry: source_line points back into the md file.
//
// Source format (spreadsheettypesnotcomplete.md):
//   FAMILY NAME            <- ALL CAPS header (>=2 letters, may contain & ' - /)
//   - Name - shape - examples: a, b     <- entry (examples segment optional)

import fs from 'node:fs';

const FAMILY_RE = /^[A-Z][A-Z0-9 &''\/\-\(\)\.]{1,60}$/;

export function parseCatalog(mdText) {
  const lines = mdText.split(/\r?\n/);
  const families = [];
  const unparsed = [];
  let current = null;
  let entries = 0;

  lines.forEach((line, i) => {
    const raw = line.trimEnd();
    const t = raw.trim();
    if (!t) return;

    if (FAMILY_RE.test(t) && !t.startsWith('- ')) {
      // skip the document title itself
      if (/^MATHEMATICAL SPREADSHEET TYPES/.test(t)) { unparsed.push({ line: i + 1, text: t, reason: 'document title' }); return; }
      current = { name: t, source_line: i + 1, entries: [] };
      families.push(current);
      return;
    }

    if (t.startsWith('- ')) {
      if (!current) { unparsed.push({ line: i + 1, text: t, reason: 'entry before any family header' }); return; }
      const segs = t.slice(2).split(' - ').map(s => s.trim());
      const name = segs.shift();
      let examples = [];
      const rest = [];
      for (const s of segs) {
        const m = s.match(/^(?:examples?|use cases?):\s*(.+)$/i);
        if (m) examples.push(...m[1].split(/,\s*/));
        else rest.push(s);
      }
      current.entries.push({
        id: slug(name),
        name,
        shape: rest.join(' — ') || null,
        examples,
        source_line: i + 1,
      });
      entries += 1;
      return;
    }

    unparsed.push({ line: i + 1, text: t, reason: current ? 'unrecognized line inside family' : 'line before any family header' });
  });

  return { families, unparsed, census: { source_lines: lines.length, families: families.length, entries } };
}

export function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72);
}

// Cross-family name collisions are natural in the catalog ("Adjacency table" exists
// in both GRAPH and TOPOLOGY families). IDs must be globally unique for recipes and
// classification, so later duplicates get -N suffixes and keep a dup_of receipt —
// nothing is deleted, every rename is traceable.
export function dedupeIds(catalog) {
  const seen = new Map();
  for (const fam of catalog.families) {
    for (const e of fam.entries) {
      const base = e.id;
      if (!seen.has(base)) { seen.set(base, 1); continue; }
      const n = seen.get(base) + 1;
      seen.set(base, n);
      e.dup_of = base;
      e.id = `${base}-${n}`;
    }
  }
  return catalog;
}

// CLI: node src/parser.js <in.md> <out.json> <unparsed.json>
if (import.meta.url === `file://${process.argv[1]}`) {
  const [inp, outp, unp] = process.argv.slice(2);
  const md = fs.readFileSync(inp, 'utf8');
  const parsed = dedupeIds(parseCatalog(md));
  fs.writeFileSync(outp, JSON.stringify(parsed, null, 2) + '\n');
  fs.writeFileSync(unp, JSON.stringify({ unparsed: parsed.unparsed }, null, 2) + '\n');
  console.log(`parsed ${parsed.census.entries} entries across ${parsed.census.families} families; ${parsed.unparsed.length} unparsed (preserved)`);
}
