#!/usr/bin/env node
/**
 * scripts/build.js — the full deterministic build of quilt-lookup.
 *
 *   1. parse      catalog/parser.js        -> catalog/spreadsheet-types.json + unparsed.json
 *   2. recipes    scripts/emit-recipes.mjs -> recipes/*.json + index.json (+ recipe_ref back-fill)
 *   3. classify   src/softjoint-tags.js    -> catalog/classification.json (+ executable back-fill)
 *   4. validate   src/validate.js          -> catalog/validation-report.json
 *
 * Run before committing artifact changes: `npm run build` (or node scripts/build.js).
 * Exit 1 if validation pass rate < threshold.
 */

import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function run(rel, label) {
  const mod = await import(pathToFileURL(path.join(ROOT, rel)).href);
  const fn = mod.writeArtifacts ?? mod.emitRecipes ?? mod.writeClassification ?? mod.runValidation;
  const res = fn();
  console.log(`[build] ${label} ok`);
  return res;
}

const threshold = process.argv.includes('--threshold') ? Number(process.argv[process.argv.indexOf('--threshold') + 1]) : 0.9;

const parsed = await run('catalog/parser.js', 'parse (spreadsheet-types.json + unparsed.json)');
console.log(`        families=${parsed.counts.families} entries=${parsed.counts.entries} unparsed=${parsed.counts.unparsed}`);

const recipes = await run('scripts/emit-recipes.mjs', 'recipes (recipes/*.json + index.json)');
console.log(`        recipes=${recipes.count} by_kind=${JSON.stringify(recipes.by_kind)}`);

const cls = await run('src/softjoint-tags.js', 'classify (classification.json)');
console.log(`        classes=${JSON.stringify(cls.counts)}`);

const { runValidation } = await import(pathToFileURL(path.join(ROOT, 'src/validate.js')).href);
const report = runValidation({ threshold });
console.log(`[build] validate ok  pass=${report.meta.pass}/${report.meta.total} rate=${(report.meta.pass_rate * 100).toFixed(2)}% threshold=${threshold} -> ${report.meta.meets_threshold ? 'MEET' : 'MISS'}`);
for (const f of report.failures) console.log(`        FAIL ${f.id} [${f.stage}] ${f.reason}`);

if (!report.meta.meets_threshold) {
  console.error('[build] validation below threshold — NOT ok to push');
  process.exit(1);
}
console.log('[build] done');
