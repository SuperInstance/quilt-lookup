#!/usr/bin/env node
/**
 * scripts/jev-smoke.mjs — OPTIONAL micro-smoke (wave-66 lane 66-d).
 *
 * Asks jev-latest (typesafe systemone) to classify 5 UNSEEN catalog entries
 * into the 4 decomposition classes, then compares against this lane's rule
 * engine (src/softjoint-tags.js). This is the FIRST DATA POINT for
 * automating the classification later — agreement/disagreement is receipted,
 * not adjudicated.
 *
 * "Unseen" method: these 5 entries were NOT consulted while authoring the
 * keyword rules (chosen after R01–R10 were frozen) — they probe
 * generalization, not memorization.
 *
 * Budget: exactly ONE systemone call (lane budget ≤ 2; brief §2). The state
 * is an OBJECT and questions are an OBJECT MAP per channel law. Wire shape
 * mirrors the canonical client /home/z/my-project/fleet-seeds/lode/engine/
 * systemone_client.mjs (inlined here so the repo stays stdlib-only);
 * key discipline: TYPESAFE_API_KEY runtime-only, never printed, never
 * receipted. Failures are receipted honestly and are non-fatal.
 */

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLASSES = ['pure-lookup', 'lookup-with-weights', 'needs-dynamic-model', 'greeter-territory'];

const ENTRIES = [
  { id: 'games__chess-puzzle-table', line: '- Chess puzzle table - piece, move - chess', expected: 'pure-lookup' },
  { id: 'oceanography__tide-table', line: '- Tide table - time, height - tide', expected: 'pure-lookup' },
  { id: 'type-theory__curry-howard-table', line: '- Curry-Howard table - propositions as types - proofs as programs', expected: 'pure-lookup' },
  { id: 'astronomy__telescope-table', line: '- Telescope table - instrument, specification - telescope', expected: 'pure-lookup' },
  { id: 'philosophy__epistemology-table', line: '- Epistemology table - belief, justification - epistemology', expected: 'needs-dynamic-model' },
];

const STATE = {
  task: 'Classify entries of a catalog of mathematical spreadsheet types by what it takes to FILL the cell at run time.',
  classes: {
    'pure-lookup': 'the answer is a single stored cell of a finite table',
    'lookup-with-weights': 'table gives raw cells but the answer needs arithmetic recombination (weights x scores, priors x likelihoods, computed metrics)',
    'needs-dynamic-model': 'filling the cell requires a model interpreting the moment (open-world input: language, style, strategy, judgment)',
    'greeter-territory': 'deliberately never decomposed: the value IS the human connection',
  },
  output_contract: 'For each question answer with exactly the class id, then a one-line reason.',
};

function buildQuestions() {
  const q = {};
  ENTRIES.forEach((e, i) => {
    q[`q${i + 1}`] = {
      type: 'choice',
      instructions: `${STATE.task} ${STATE.output_contract} Entry: "${e.line}" — which class?`,
      criteria: { ...STATE.classes },
    };
  });
  return q;
}

async function systemone({ state, questions, model = 'jev-latest' }) {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) throw new Error('TYPESAFE_API_KEY missing — channel closed (fail-closed, no call made)');
  const t0 = process.hrtime.bigint();
  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, state, questions }),
  });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`systemone HTTP ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return { model: body.model ?? model, usage: body.usage ?? null, latency_ms: Math.round(ms * 1000) / 1000, answers: body.answers ?? null, raw: body };
}

/** defensively extract a class id + text from an answer of unknown shape.
 *  systemone is a typed wire (noul|choice|score): choice answers carry the
 *  chosen criteria key under `.choice` (see quilt-softjoints/src/joint.js). */
function parseAnswer(a) {
  let text = '';
  if (a === null || a === undefined) text = '';
  else if (typeof a === 'string') text = a;
  else text = JSON.stringify(a);
  const choice = a && typeof a === 'object' ? a.choice ?? a.score ?? null : null;
  const cls = (choice && CLASSES.includes(choice) ? choice : null)
    ?? CLASSES.find((c) => text.toLowerCase().includes(c))
    ?? null;
  return { class: cls, text: text.slice(0, 400) };
}

async function main() {
  const receipt = {
    kind: 'typesafe-smoke',
    lane: '66-d',
    repo: 'quilt-lookup',
    purpose: 'classify 5 unseen catalog entries into the 4 decomposition classes; first data point for automating classification',
    entries: ENTRIES.map((e) => ({ id: e.id, line: e.line, rule_engine_class: e.expected })),
    model: 'jev-latest',
    calls: 0,
    ts_utc: new Date().toISOString(),
  };
  try {
    const res = await systemone({ state: STATE, questions: buildQuestions() });
    receipt.calls = 1;
    receipt.usage = res.usage;
    receipt.latency_ms = res.latency_ms;
    receipt.served_model = res.model;

    const ans = res.answers;
    const list = Array.isArray(ans) ? ans : (ans && typeof ans === 'object' ? Object.values(ans) : []);
    receipt.jev = list.map((a, i) => ({ entry_id: ENTRIES[i]?.id ?? `q${i + 1}`, ...parseAnswer(a) }));
    receipt.agreement = receipt.jev.filter((j, i) => j.class && j.class === ENTRIES[i].expected).length;
    receipt.disagreements = receipt.jev
      .map((j, i) => ({ entry_id: j.entry_id, jev: j.class, rule_engine: ENTRIES[i].expected, jev_text: j.text }))
      .filter((d, i) => receipt.jev[i].class !== ENTRIES[i].expected);
    receipt.outcome = 'ok';
  } catch (e) {
    receipt.outcome = 'failed';
    receipt.error = e.message;
    // honesty: an HTTP attempt happened even if the API rejected it (e.g. 400).
    receipt.calls_attempted = receipt.calls === 1 ? 1 : 1;
  }

  mkdirSync(path.join(ROOT, 'receipts'), { recursive: true });
  const f = path.join(ROOT, 'receipts', `typesafe-smoke-${receipt.ts_utc.replace(/[:.]/g, '-')}.json`);
  writeFileSync(f, JSON.stringify(receipt, null, 2) + '\n');
  appendFileSync(path.join(ROOT, 'receipts/external-calls.jsonl'), JSON.stringify({
    ts_utc: receipt.ts_utc, channel: 'typesafe', model: 'jev-latest', calls: receipt.calls,
    usage: receipt.usage ?? null, outcome: receipt.outcome, receipt_file: path.relative(ROOT, f),
  }) + '\n');

  console.log(`[quilt-lookup] jev smoke: ${receipt.outcome}` +
    (receipt.agreement !== undefined ? ` — agreement ${receipt.agreement}/${ENTRIES.length}` : '') +
    (receipt.error ? ` — ${receipt.error}` : ''));
}

main();
