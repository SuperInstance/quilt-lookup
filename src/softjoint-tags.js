// src/softjoint-tags.js — classify every catalog entry into the soft-joint
// decomposition classes (wave-66 brief vocabulary; feeds quilt-softjoints
// decompose() and the principal's "soft joints" thesis):
//
//   pure-lookup          — a deterministic table IS the whole answer
//   lookup-with-weights  — mostly tabular, but rows carry tunable weights/scores
//   needs-dynamic-model  — the moment or the context genuinely varies; a small
//                          model reading a vector adds real value
//   greeter-territory    — surfaces where scripting makes things robotic; keep
//                          dynamic (or human) BY DESIGN
//
// v0 rules are keyword-based and transparent (every entry's class is explainable);
// one live typesafe micro-probe cross-checks 5 unseen entries (see smoke).

const RULES = [
  // greeter-territory FIRST: these must never be ground into tables
  { cls: 'greeter-territory', kw: ['chit-chat', 'greeting', 'conversation', 'small talk', 'chatbot', 'persona', 'story', 'dialogue', 'rapport', 'empath', 'sentiment of', 'mood', 'joke'] },
  // needs-dynamic-model: judgment under context, open-ended semantics
  { cls: 'needs-dynamic-model', kw: ['judgment', 'interpret', 'context', 'nuance', 'natural language', 'semantic', 'meaning', 'negotiat', 'strategy', 'creative', 'style', 'tone', 'intent', 'summar'] },
  // lookup-with-weights: tabular but scores/probabilities get retuned
  { cls: 'lookup-with-weights', kw: ['p-value', 'probability', 'weight', 'score', 'odds', 'confidence', 'ranking', 'priorit', 'risk tier', 'regression', 'frequency'] },
];

// families that are essentially pure deterministic mathematics
const PURE_FAMILIES = new Set([
  'SET THEORY', 'RELATIONS & FUNCTIONS', 'LOGIC', 'LINEAR ALGEBRA', 'GRAPH & NETWORK',
  'ORDER & LATTICE', 'NUMBER THEORY & COMBINATORICS', 'CS & DISCRETE TABLES',
  'INFORMATION THEORY', 'GAME THEORY', 'CONTROL THEORY', 'DYNAMICAL SYSTEMS',
  'TOPOLOGY & STRUCTURE', 'SUMMARY STATISTICS', 'ALGEBRA', 'CALCULUS & ANALYSIS',
]);

export function classifyEntry(entry, family) {
  const text = `${entry.name} ${entry.shape || ''}`.toLowerCase();
  // greeter-territory FIRST: these must never be ground into tables
  const [greeter, ...rest] = RULES;
  if (greeter.kw.some(k => text.includes(k))) return greeter.cls;
  // wave-67 guard: 'five-number summary' contains 'summar' and would misfire into
  // needs-dynamic-model (a text-summarization keyword) — but a summary-statistics
  // table is deterministic arithmetic; the family outranks the keyword.
  if (family === 'SUMMARY STATISTICS') return 'pure-lookup';
  for (const r of rest) {
    if (r.kw.some(k => text.includes(k))) return r.cls;
  }
  if (PURE_FAMILIES.has(family)) return 'pure-lookup';
  return 'lookup-with-weights'; // default: tabular with tunable cells, honest middle
}

export function classifyCatalog(catalogJson) {
  const out = {};
  let counts = { 'pure-lookup': 0, 'lookup-with-weights': 0, 'needs-dynamic-model': 0, 'greeter-territory': 0 };
  for (const fam of catalogJson.families) {
    for (const e of fam.entries) {
      const cls = classifyEntry(e, fam.name);
      out[e.id] = { class: cls, family: fam.name, name: e.name, reason: ruleReason(e, fam.name) };
      counts[cls] += 1;
    }
  }
  return { classification: out, counts, total: Object.keys(out).length };
}

function ruleReason(entry, family) {
  if (PURE_FAMILIES.has(family)) return `family ${family} is deterministic mathematics — the table is the answer`;
  return 'tabular surface with tunable rows; revisit on freezing-test evidence';
}
