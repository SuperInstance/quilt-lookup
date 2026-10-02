/**
 * @file catalog/parser.js
 * @module quilt-lookup/parser
 *
 * =====================================================================
 *  THE CATALOG PARSER — principal's raw catalog → machine-usable JSON
 * =====================================================================
 *
 * Input:  the principal's raw catalog `MATHEMATICAL SPREADSHEET TYPES
 *         (copy-paste friendly)` — verbatim copy at
 *         catalog/source/spreadsheettypesnotcomplete.md (the filename's
 *         "not complete" is an instruction: we EXTEND, see catalog/extensions/).
 *
 * Output: catalog/spreadsheet-types.json  (every entry, nothing dropped)
 *         catalog/unparsed.json           (unrecognized lines + reasons)
 *
 * THE GRAMMAR (reverse-engineered from the raw file, two styles):
 *
 *   FAMILY HEADER   ALL-CAPS line, e.g. `SET THEORY`, `CS & DISCRETE TABLES`
 *   ENTRY (style A) `- <Name> - <shape> - examples: <e1>, <e2>, ...`
 *   ENTRY (style B) `- <Name> - <shape> - <terse note>`
 *   DOC HEADER      `MATHEMATICAL SPREADSHEET TYPES (copy-paste friendly)`
 *                   and its `CONTINUED: ...` twin (document banners, not families)
 *
 * Split rule for entries: strict split on the ` - ` separator into EXACTLY
 * 3 parts. Anything that starts with `- ` but does not split cleanly is
 * NEVER dropped — it lands in unparsed.json with a reason.
 *
 * NEVER-DELETE-DATA LAW: every non-blank source line is accounted for in
 * exactly one of {families, doc-headers, entries, unparsed}. The census
 * proves it (see tests/parser.test.js).
 *
 * `executable` is a documented HEURISTIC hint (see NON_COMPUTATIONAL_SHAPE_RE):
 * true when the entry's shape reads like a deterministic finite mapping,
 * false when the semantics are inherently subjective/interpretive.
 * src/softjoint-tags.js is the authoritative classifier and overrides this
 * hint in the final build (scripts/build.js) — the hint survives in
 * `executable_hint` for auditability.
 *
 * =====================================================================
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_MD = path.join(ROOT, 'catalog/source/spreadsheettypesnotcomplete.md');
const EXTENSIONS_DIR = path.join(ROOT, 'catalog/extensions');

/** Document banners (not families, not entries). */
const DOC_HEADER_RE = /^(CONTINUED:\s*)?MATHEMATICAL SPREADSHEET TYPES\b/;

/**
 * Family header = fully uppercase-ish line (letters, digits, spaces, and the
 * punctuation the principal actually uses: & - / ' . ( )). Must contain ≥2
 * letters so a stray "42" is not a family.
 */
const FAMILY_HEADER_RE = /^[A-Z0-9][A-Z0-9 &/'’().+-]*$/;
const hasEnoughLetters = (s) => (s.match(/[A-Z]/g) || []).length >= 2;

/**
 * Shape-keyword heuristic for the `executable` hint. An entry whose SHAPE
 * talks about interpretation/meaning/subjective judgment is marked
 * executable=false (the answer cannot be a deterministic cell read);
 * everything else defaults to true (the dominant case in the catalog).
 */
const NON_COMPUTATIONAL_SHAPE_RE =
  /(interpretation|meaning|opinion|beauty|aesthetic|style|consciousness|justification|belief|essence|critique|performance|illusion|mentalism|sleight|exegesis|wisdom|feeling|emotion|intuition|storytelling|charisma|greeting|presence|taste|tone)/i;

/** slug("Set membership table") -> "set-membership-table" */
export function slug(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse one catalog text into entries/families/unparsed plus a full census.
 * @param {string} text    raw catalog text
 * @param {object} opts    { sourceFile, provenance }
 */
export function parseCatalogText(text, { sourceFile = '(inline)', provenance = 'principal' } = {}) {
  const lines = text.split(/\r?\n/);
  const families = [];
  const entries = [];
  const unparsed = [];
  const census = {
    total_lines: lines.length,
    blank: 0,
    doc_headers: 0,
    family_headers: 0,
    entries: 0,
    unrecognized: 0,
  };
  const seenIds = new Set();
  let currentFamily = null;

  lines.forEach((rawLine, i) => {
    const lineNo = i + 1;
    const line = rawLine.trim();
    if (line === '') { census.blank += 1; return; }

    if (DOC_HEADER_RE.test(line)) { census.doc_headers += 1; return; }

    if (FAMILY_HEADER_RE.test(line) && hasEnoughLetters(line) && !line.startsWith('-')) {
      const id = slug(line);
      currentFamily = {
        id,
        name: line,
        entry_count: 0,
        provenance,
        source_file: sourceFile,
        source_line: lineNo,
      };
      families.push(currentFamily);
      census.family_headers += 1;
      return;
    }

    if (line.startsWith('-')) {
      const body = line.replace(/^-\s+/, '');
      const parts = body.split(' - ').map((p) => p.trim());
      if (parts.length !== 3 || parts.some((p) => p === '')) {
        unparsed.push({
          source_file: sourceFile,
          source_line: lineNo,
          line,
          reason:
            parts.length !== 3
              ? `entry grammar expects exactly 3 dash-separated parts (name - shape - examples/note); got ${parts.length}`
              : 'entry grammar has an empty part (name/shape/examples must all be non-empty)',
          family_so_far: currentFamily ? currentFamily.name : null,
        });
        census.unrecognized += 1;
        return;
      }
      const [name, shape, tail] = parts;
      const style = /^examples:\s*/.test(tail) ? 'examples' : 'note';
      const examples =
        style === 'examples'
          ? tail.replace(/^examples:\s*/, '').split(',').map((s) => s.trim()).filter(Boolean)
          : [tail];
      const familyId = currentFamily ? currentFamily.id : '(orphan)';
      let id = `${familyId}__${slug(name)}`;
      let dup = 2;
      while (seenIds.has(id)) id = `${familyId}__${slug(name)}-${dup++}`;
      seenIds.add(id);
      if (currentFamily) currentFamily.entry_count += 1;
      entries.push({
        id,
        family: currentFamily ? currentFamily.name : '(orphan)',
        name,
        shape,
        examples,
        examples_style: style,
        source_file: sourceFile,
        source_line: lineNo,
        provenance,
        executable_hint: !NON_COMPUTATIONAL_SHAPE_RE.test(shape) && !NON_COMPUTATIONAL_SHAPE_RE.test(name),
        recipe_ref: null,
      });
      census.entries += 1;
      return;
    }

    // Any other non-blank line: preserved, with a reason. Never dropped.
    unparsed.push({
      source_file: sourceFile,
      source_line: lineNo,
      line,
      reason: 'unrecognized line: not blank, not a family header, not an entry (does not start with "- ")',
      family_so_far: currentFamily ? currentFamily.name : null,
    });
    census.unrecognized += 1;
  });

  return { families, entries, unparsed, census };
}

/** List extension family files (catalog/extensions/*.md), sorted. */
export function extensionFiles(dir = EXTENSIONS_DIR) {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  } catch {
    return [];
  }
}

/**
 * Full catalog load: the principal's source + every extension family file,
 * merged into the committed schema (§5 discipline: one shared shape).
 * Extension entries carry provenance 'wave-66'.
 */
export function loadCatalog({
  sourcePath = SOURCE_MD,
  extensionsDir = EXTENSIONS_DIR,
} = {}) {
  const sourceText = readFileSync(sourcePath, 'utf8');
  const base = parseCatalogText(sourceText, {
    sourceFile: 'catalog/source/spreadsheettypesnotcomplete.md',
    provenance: 'principal',
  });

  const extFamilies = [];
  const extEntries = [];
  const extUnparsed = [];
  const extCensus = { files: 0, total_lines: 0, blank: 0, doc_headers: 0, family_headers: 0, entries: 0, unrecognized: 0 };
  for (const f of extensionFiles(extensionsDir)) {
    const filePath = path.join(extensionsDir, f);
    const parsed = parseCatalogText(readFileSync(filePath, 'utf8'), {
      sourceFile: `catalog/extensions/${f}`,
      provenance: 'wave-66',
    });
    extFamilies.push(...parsed.families);
    extEntries.push(...parsed.entries);
    extUnparsed.push(...parsed.unparsed);
    for (const k of Object.keys(extCensus)) {
      if (k !== 'files' && typeof parsed.census[k] === 'number') extCensus[k] += parsed.census[k];
    }
    extCensus.files += 1;
  }

  const sourceSha256 = createHash('sha256').update(sourceText).digest('hex');
  return {
    base,
    extensions: { families: extFamilies, entries: extEntries, unparsed: extUnparsed, census: extCensus },
    sourceSha256,
    sourceText,
  };
}

/**
 * Assemble the committed JSON shape.
 */
export function assembleCatalog({ sourcePath, extensionsDir } = {}) {
  const { base, extensions, sourceSha256 } = loadCatalog({ sourcePath, extensionsDir });
  const allFamilies = [...base.families, ...extensions.families];
  const allEntries = [...base.entries, ...extensions.entries];
  return {
    doc: {
      meta: {
        generator: 'catalog/parser.js (quilt-lookup)',
        generated_utc: new Date().toISOString(),
        source: 'catalog/source/spreadsheettypesnotcomplete.md',
        source_sha256: sourceSha256,
        source_note:
          "verbatim copy of the principal's upload/spreadsheettypesnotcomplete.md; the filename says 'not complete' — extensions/ families carry provenance wave-66",
        extension_provenance: 'wave-66 (lane 66-d)',
        id_scheme: '<family-slug>__<name-slug>; family-scoped because names repeat across families in the principal data',
        executable_note:
          'executable is the classifier-refined hint (see src/softjoint-tags.js); parser heuristic preserved as executable_hint',
        counts: {
          families: allFamilies.length,
          principal_families: base.families.length,
          extension_families: extensions.families.length,
          entries: allEntries.length,
          principal_entries: base.entries.length,
          extension_entries: extensions.entries.length,
          unparsed: base.unparsed.length + extensions.unparsed.length,
        },
      },
      families: allFamilies,
      entries: base.entries,
      extensions: {
        provenance: 'wave-66',
        families: extensions.families,
        entries: extensions.entries,
      },
    },
    unparsed: {
      meta: {
        generator: 'catalog/parser.js (quilt-lookup)',
        note: 'lines the grammar could not classify. NEVER deleted — every source line is receipted here (never-delete-data law).',
        counts: { principal: base.unparsed.length, extensions: extensions.unparsed.length },
      },
      principal: base.unparsed,
      extensions: extensions.unparsed,
    },
    census: { base: base.census, extensions: extensions.census },
  };
}

/** CLI: node catalog/parser.js → writes the committed JSON artifacts. */
export function writeArtifacts({ outDir = path.join(ROOT, 'catalog') } = {}) {
  const { doc, unparsed } = assembleCatalog();
  const typesPath = path.join(outDir, 'spreadsheet-types.json');
  const unparsedPath = path.join(outDir, 'unparsed.json');
  writeFileSync(typesPath, JSON.stringify(doc, null, 2) + '\n');
  writeFileSync(unparsedPath, JSON.stringify(unparsed, null, 2) + '\n');
  return { typesPath, unparsedPath, counts: doc.meta.counts, census: assembleCatalog().census };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { counts } = writeArtifacts();
  console.log('[quilt-lookup] wrote catalog/spreadsheet-types.json + catalog/unparsed.json');
  console.log(JSON.stringify(counts, null, 2));
}
