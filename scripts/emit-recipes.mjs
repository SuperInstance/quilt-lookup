#!/usr/bin/env node
/**
 * scripts/emit-recipes.mjs — author + emit the quilt cell recipes.
 *
 * WHY A SINGLE EMITTER: each recipe is hand-authored data (tables, formulas,
 * machine-checkable examples) but shares one skeleton; emitting one JSON file
 * per recipe (plus index.json) keeps the per-cell consumption story clean for
 * other lanes while keeping authorship reviewable in one diff.
 *
 * COMPATIBILITY CONTRACT (see DESIGN.md §4): every recipe carries an `arena`
 * fragment shaped for @quilt/core CellDefs (types.d.ts of the quilt-arena
 * engine): kind is only ever 'value' or 'formula'; retrieval over a lookup
 * table is expressed as an arena formula cell over a value cell that holds the
 * table — so a recipe drops into an arena sheet as plain cells.
 *
 * Run: node scripts/emit-recipes.mjs   (build.js step 2)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matrixToObj, piecewiseExpr } from '../src/evaluator.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES_PATH = path.join(ROOT, 'catalog/spreadsheet-types.json');
const OUT_DIR = path.join(ROOT, 'recipes');

// ---------------------------------------------------------------- helpers

const cellId = (entryId) => `quilt.lookup.${entryId}`;
const dataId = (entryId) => `quilt.lookup.${entryId}.data`;

// ---------------------------------------------------------------- recipes

const R = [];
const def = (r) => R.push(r);

// ---- SET THEORY ---------------------------------------------------------
def({
  catalog_entry: 'set-theory__set-membership-table',
  kind: 'lookup',
  title: 'Access-control membership: (element, set) -> 1/0',
  inputs: ['element', 'setName'],
  table: { type: 'matrix', rows: ['alice', 'bob', 'carol', 'dave'], cols: ['read', 'write', 'admin'],
    cells: [[1, 1, 0], [1, 0, 0], [1, 1, 1], [0, 0, 0]] },
  example_input: { element: 'carol', setName: 'write' },
  expected_output: 1,
  notes: 'classic skills/ACL matrix; pure row/column read',
});
def({
  catalog_entry: 'set-theory__power-set-table',
  kind: 'lookup',
  title: 'Power set inclusion for {p, q}: (subset, element) -> 1/0',
  inputs: ['subset', 'element'],
  table: { type: 'matrix', rows: ['none', 'p', 'q', 'pq'], cols: ['p', 'q'],
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  example_input: { subset: 'pq', element: 'q' },
  expected_output: 1,
});
def({
  catalog_entry: 'set-theory__venn-region-table',
  kind: 'lookup',
  title: 'Two-set Venn region counts |A|=30 |B|=25 |A∩B|=10 universe=80',
  inputs: ['region'],
  table: { type: 'map', keys: { A: 20, B: 15, AB: 10, neither: 35 } },
  example_input: { region: 'AB' },
  expected_output: 10,
  notes: 'region counts precomputed by inclusion-exclusion; the sheet reads cells',
});
def({
  catalog_entry: 'set-theory__equivalence-class-table',
  kind: 'lookup',
  title: 'Equivalence classes of 0..9 under mod 3',
  inputs: ['n'],
  table: { type: 'map', keys: { 0: 0, 1: 1, 2: 2, 3: 0, 4: 1, 5: 2, 6: 0, 7: 1, 8: 2, 9: 0 } },
  example_input: { n: '7' },
  expected_output: 1,
});

// ---- RELATIONS & FUNCTIONS ----------------------------------------------
def({
  catalog_entry: 'relations-functions__function-table',
  kind: 'lookup',
  title: 'Flat-rate tax bracket function (piecewise, not marginal)',
  inputs: ['income'],
  table: { type: 'piecewise', bounds: [0, 10000, 40000, 85000], values: [0, 0.1, 0.22, 0.32] },
  example_input: { income: 50000 },
  expected_output: 0.22,
  notes: 'piecewise semantics: value of the greatest lower bound bucket',
});
def({
  catalog_entry: 'relations-functions__transitive-closure-table',
  kind: 'lookup',
  title: 'Transitive closure of a->b->c (precomputed reachability)',
  inputs: ['node'],
  table: { type: 'map', keys: { a: ['b', 'c'], b: ['c'], c: [] } },
  example_input: { node: 'a' },
  expected_output: ['b', 'c'],
});
def({
  catalog_entry: 'relations-functions__binary-relation-matrix',
  kind: 'lookup',
  title: 'Service ownership relation (domain x codomain 1/0)',
  inputs: ['service', 'owner'],
  table: { type: 'matrix', rows: ['api', 'ui', 'db'], cols: ['team-a', 'team-b'],
    cells: [[1, 0], [0, 1], [1, 1]] },
  example_input: { service: 'api', owner: 'team-b' },
  expected_output: 0,
});

// ---- LOGIC --------------------------------------------------------------
def({
  catalog_entry: 'logic__truth-table',
  kind: 'lookup',
  title: 'Two-input logic gates: (A,B) -> AND/OR/XOR/IMPLIES',
  inputs: ['ab', 'gate'],
  table: { type: 'matrix', rows: ['TT', 'TF', 'FT', 'FF'], cols: ['AND', 'OR', 'XOR', 'IMP'],
    cells: [[1, 1, 0, 1], [0, 1, 1, 1], [0, 1, 1, 0], [0, 0, 0, 1]] },
  example_input: { ab: 'TF', gate: 'XOR' },
  expected_output: 1,
});
def({
  catalog_entry: 'logic__decision-table',
  kind: 'lookup',
  title: 'Loan eligibility decision table (income x score)',
  inputs: ['profile'],
  table: { type: 'map', keys: { 'high/high': 'approve', 'high/low': 'review', 'low/high': 'review', 'low/low': 'decline' } },
  example_input: { profile: 'high/low' },
  expected_output: 'review',
});
def({
  catalog_entry: 'logic__state-transition-table',
  kind: 'lookup',
  title: 'Turnstile FSM: (state, event) -> next state',
  inputs: ['state', 'event'],
  table: { type: 'nested-map', keys: { locked: { coin: 'unlocked', push: 'locked' }, unlocked: { coin: 'unlocked', push: 'locked' } } },
  example_input: { state: 'locked', event: 'coin' },
  expected_output: 'unlocked',
});
def({
  catalog_entry: 'logic__karnaugh-map',
  kind: 'lookup',
  title: 'K-map cell read for f = x XOR y (Gray-ordered)',
  inputs: ['x', 'y'],
  table: { type: 'matrix', rows: ['0', '1'], cols: ['0', '1'], cells: [[0, 1], [1, 0]] },
  example_input: { x: '1', y: '0' },
  expected_output: 1,
});

// ---- LINEAR ALGEBRA -----------------------------------------------------
def({
  catalog_entry: 'linear-algebra__transition-matrix',
  kind: 'lookup',
  title: 'Weather Markov transition cell P(tomorrow|today)',
  inputs: ['today', 'tomorrow'],
  table: { type: 'matrix', rows: ['sunny', 'rainy'], cols: ['sunny', 'rainy'],
    cells: [[0.9, 0.1], [0.5, 0.5]] },
  example_input: { today: 'sunny', tomorrow: 'rainy' },
  expected_output: 0.1,
});
def({
  catalog_entry: 'linear-algebra__confusion-matrix',
  kind: 'lookup',
  title: 'Confusion matrix cell: (predicted, actual) -> count',
  inputs: ['predicted', 'actual'],
  table: { type: 'matrix', rows: ['pred-pos', 'pred-neg'], cols: ['actual-pos', 'actual-neg'],
    cells: [[45, 5], [10, 40]] },
  example_input: { predicted: 'pred-neg', actual: 'actual-pos' },
  expected_output: 10,
});

// ---- PROBABILITY & STATISTICS -------------------------------------------
def({
  catalog_entry: 'probability-statistics__z-table',
  kind: 'lookup',
  title: 'Standard normal CDF table Phi(z), 4dp, z in 0.5 steps',
  inputs: ['z'],
  table: { type: 'map', keys: { '0.0': 0.5, '0.5': 0.6915, '1.0': 0.8413, '1.5': 0.9332, '2.0': 0.9772, '2.5': 0.9938, '3.0': 0.9987 } },
  example_input: { z: '1.0' },
  expected_output: 0.8413,
});
def({
  catalog_entry: 'probability-statistics__t-table',
  kind: 'lookup',
  title: 't critical values (two-tailed alpha=0.05) by df',
  inputs: ['df'],
  table: { type: 'map', keys: { 1: 12.706, 2: 4.303, 3: 3.182, 5: 2.571, 10: 2.228, 30: 2.042 } },
  example_input: { df: '3' },
  expected_output: 3.182,
});
def({
  catalog_entry: 'probability-statistics__chi-square-table',
  kind: 'lookup',
  title: 'Chi-square critical values (alpha=0.05) by df',
  inputs: ['df'],
  table: { type: 'map', keys: { 1: 3.841, 2: 5.991, 3: 7.815, 4: 9.488, 5: 11.07, 10: 18.307 } },
  example_input: { df: '5' },
  expected_output: 11.07,
});
def({
  catalog_entry: 'probability-statistics__conditional-probability-table',
  kind: 'lookup',
  title: 'Disease x test outcome counts: (status, test) -> count',
  inputs: ['status', 'test'],
  table: { type: 'matrix', rows: ['diseased', 'healthy'], cols: ['test-positive', 'test-negative'],
    cells: [[90, 10], [180, 720]] },
  example_input: { status: 'diseased', test: 'test-positive' },
  expected_output: 90,
});
def({
  catalog_entry: 'probability-statistics__bayes-table',
  kind: 'formula',
  title: 'Posterior P(disease | test+) = TP / (TP + FP)',
  inputs: ['tp', 'fp'],
  formula: 'tp / (tp + fp)',
  example_input: { tp: 90, fp: 180 },
  expected_output: 0.3333333333333333,
  notes: 'the Bayes sheet: prior/likelihood cells feed this posterior formula cell',
});
def({
  catalog_entry: 'probability-statistics__frequency-table',
  kind: 'lookup',
  title: 'Tally by category: color -> count',
  inputs: ['color'],
  table: { type: 'map', keys: { red: 12, blue: 7, green: 5 } },
  example_input: { color: 'blue' },
  expected_output: 7,
});
def({
  catalog_entry: 'probability-statistics__relative-frequency-table',
  kind: 'formula',
  title: 'Relative frequency = count / total',
  inputs: ['count', 'total'],
  formula: 'count / total',
  example_input: { count: 7, total: 24 },
  expected_output: 0.2916666666666667,
});

// ---- NUMBER THEORY & COMBINATORICS --------------------------------------
def({
  catalog_entry: 'number-theory-combinatorics__pascal-s-triangle',
  kind: 'lookup',
  title: 'Binomial coefficients C(n,k), n in 0..8, k in 0..4',
  inputs: ['n', 'k'],
  table: { type: 'matrix', rows: ['0', '1', '2', '3', '4', '5', '6', '7', '8'], cols: ['0', '1', '2', '3', '4'],
    cells: [
      [1, 0, 0, 0, 0],
      [1, 1, 0, 0, 0],
      [1, 2, 1, 0, 0],
      [1, 3, 3, 1, 0],
      [1, 4, 6, 4, 1],
      [1, 5, 10, 10, 5],
      [1, 6, 15, 20, 15],
      [1, 7, 21, 35, 35],
      [1, 8, 28, 56, 70],
    ] },
  example_input: { n: '8', k: '4' },
  expected_output: 70,
  notes: 'k>n reads 0 by construction; extend rows by Pascal recurrence',
});
def({
  catalog_entry: 'number-theory-combinatorics__prime-table',
  kind: 'lookup',
  title: 'nth prime, ranks 1..10',
  inputs: ['rank'],
  table: { type: 'map', keys: { 1: 2, 2: 3, 3: 5, 4: 7, 5: 11, 6: 13, 7: 17, 8: 19, 9: 23, 10: 29 } },
  example_input: { rank: '10' },
  expected_output: 29,
});
def({
  catalog_entry: 'number-theory-combinatorics__multiplication-table-mod-n',
  kind: 'lookup',
  title: 'Multiplication mod 5: (a,b) -> (a*b) mod 5',
  inputs: ['a', 'b'],
  table: { type: 'matrix', rows: ['0', '1', '2', '3', '4'], cols: ['0', '1', '2', '3', '4'],
    cells: [
      [0, 0, 0, 0, 0],
      [0, 1, 2, 3, 4],
      [0, 2, 4, 1, 3],
      [0, 3, 1, 4, 2],
      [0, 4, 3, 2, 1],
    ] },
  example_input: { a: '3', b: '4' },
  expected_output: 2,
});

// ---- ALGEBRA ------------------------------------------------------------
def({
  catalog_entry: 'algebra__cayley-table',
  kind: 'lookup',
  title: 'Cayley table of (Z/4, +)',
  inputs: ['a', 'b'],
  table: { type: 'matrix', rows: ['0', '1', '2', '3'], cols: ['0', '1', '2', '3'],
    cells: [
      [0, 1, 2, 3],
      [1, 2, 3, 0],
      [2, 3, 0, 1],
      [3, 0, 1, 2],
    ] },
  example_input: { a: '2', b: '3' },
  expected_output: 1,
});
def({
  catalog_entry: 'algebra__boolean-algebra-table',
  kind: 'lookup',
  title: 'Boolean AND table',
  inputs: ['a', 'b'],
  table: { type: 'matrix', rows: ['0', '1'], cols: ['0', '1'], cells: [[0, 0], [0, 1]] },
  example_input: { a: '1', b: '0' },
  expected_output: 0,
});

// ---- CS & DISCRETE TABLES -----------------------------------------------
def({
  catalog_entry: 'cs-discrete-tables__hash-table',
  kind: 'lookup',
  title: 'Consistent-hash shard map: key -> shard',
  inputs: ['key'],
  table: { type: 'map', keys: { 'user:42': 'shard-3', 'user:17': 'shard-0', 'session:abc': 'shard-1', 'cart:9f2': 'shard-2' } },
  example_input: { key: 'session:abc' },
  expected_output: 'shard-1',
});
def({
  catalog_entry: 'cs-discrete-tables__routing-table',
  kind: 'lookup',
  title: 'Routing table: destination prefix -> next hop',
  inputs: ['destination'],
  table: { type: 'map', keys: { '10.0.1.0/24': 'router-a', '10.0.2.0/24': 'router-b', default: 'gateway-x' } },
  example_input: { destination: '10.0.2.0/24' },
  expected_output: 'router-b',
});

// ---- GEOMETRY & TRIG ----------------------------------------------------
def({
  catalog_entry: 'geometry-trig__unit-circle-table',
  kind: 'lookup',
  title: 'Unit circle: degrees -> [sin, cos] for special angles',
  inputs: ['degrees'],
  table: { type: 'map', keys: {
    0: [0, 1],
    30: [0.5, 0.8660254037844386],
    45: [0.7071067811865476, 0.7071067811865476],
    60: [0.8660254037844386, 0.5],
    90: [1, 0],
  } },
  example_input: { degrees: '30' },
  expected_output: [0.5, 0.8660254037844386],
});
def({
  catalog_entry: 'geometry-trig__trig-table',
  kind: 'formula',
  title: 'sin(x) for any x (radians) — the continuous completion of the printed table',
  inputs: ['x'],
  formula: 'Math.sin(x)',
  helpers: ['Math'],
  example_input: { x: 1 },
  expected_output: 0.8414709848078965,
  arena_compat_note: 'arena formula helpers are abs/min/max/clamp; Math is needed here — flagged for engine parity',
});

// ---- CALCULUS & ANALYSIS ------------------------------------------------
def({
  catalog_entry: 'calculus-analysis__taylor-table',
  kind: 'lookup',
  title: 'Derivative reference: elementary function -> derivative',
  inputs: ['fn'],
  table: { type: 'map', keys: { sin: 'cos', cos: '-sin', exp: 'exp', ln: '1/x' } },
  example_input: { fn: 'sin' },
  expected_output: 'cos',
});

// ---- INFORMATION THEORY -------------------------------------------------
def({
  catalog_entry: 'information-theory__entropy-table',
  kind: 'formula',
  title: 'Surprisal of an outcome: -log2(p)',
  inputs: ['p'],
  formula: '-Math.log2(p)',
  helpers: ['Math'],
  example_input: { p: 0.25 },
  expected_output: 2,
  arena_compat_note: 'arena formula helpers are abs/min/max/clamp; Math is needed here — flagged for engine parity',
});
def({
  catalog_entry: 'information-theory__huffman-code-table',
  kind: 'lookup',
  title: 'Optimal prefix code for freqs a=8 b=4 c=2 d=1',
  inputs: ['symbol'],
  table: { type: 'map', keys: { a: '0', b: '10', c: '110', d: '111' } },
  example_input: { symbol: 'd' },
  expected_output: '111',
});

// ---- CODING THEORY ------------------------------------------------------
def({
  catalog_entry: 'coding-theory__hamming-code-table',
  kind: 'formula',
  title: 'Single parity bit over 3 data bits',
  inputs: ['d1', 'd2', 'd3'],
  formula: '(d1 + d2 + d3) % 2',
  example_input: { d1: 1, d2: 0, d3: 1 },
  expected_output: 0,
});

// ---- CRYPTOGRAPHY -------------------------------------------------------
def({
  catalog_entry: 'cryptography__s-box-table',
  kind: 'lookup',
  title: 'AES S-box, first row (0x00..0x0f) as decimal',
  inputs: ['byte'],
  table: { type: 'map', keys: {
    '0x00': 99, '0x01': 124, '0x02': 119, '0x03': 123,
    '0x04': 242, '0x05': 107, '0x06': 111, '0x07': 197,
    '0x08': 48, '0x09': 1, '0x0a': 103, '0x0b': 43,
    '0x0c': 254, '0x0d': 215, '0x0e': 171, '0x0f': 118,
  } },
  example_input: { byte: '0x0f' },
  expected_output: 118,
});

// ---- NUMERICAL ANALYSIS -------------------------------------------------
def({
  catalog_entry: 'numerical-analysis__convergence-table',
  kind: 'lookup',
  title: 'Root-finder order of convergence',
  inputs: ['method'],
  table: { type: 'map', keys: { bisection: 1, newton: 2, secant: 1.618, 'fixed-point': 1 } },
  example_input: { method: 'secant' },
  expected_output: 1.618,
});

// ---- DYNAMICAL SYSTEMS --------------------------------------------------
def({
  catalog_entry: 'dynamical-systems__fixed-point-table',
  kind: 'lookup',
  title: 'Logistic map x(n+1)=2x(1-x): fixed points and stability',
  inputs: ['point'],
  table: { type: 'map', keys: { 0: 'unstable', 0.5: 'stable' } },
  example_input: { point: '0.5' },
  expected_output: 'stable',
  notes: 'multiplier |f\'|: 2 at x=0 (unstable), 0 at x=1/2 (stable) at r=2',
});

// ---- CELLULAR AUTOMATA --------------------------------------------------
def({
  catalog_entry: 'cellular-automata__rule-table',
  kind: 'lookup',
  title: 'Wolfram rule 110 neighborhood table',
  inputs: ['neighborhood'],
  table: { type: 'map', keys: { '111': '0', '110': '1', '101': '1', '100': '0', '011': '1', '010': '1', '001': '1', '000': '0' } },
  example_input: { neighborhood: '110' },
  expected_output: '1',
});

// ---- GAME THEORY --------------------------------------------------------
def({
  catalog_entry: 'game-theory__normal-form-table',
  kind: 'lookup',
  title: "Prisoner's dilemma, row player's payoff (R=3 S=0 T=5 P=1)",
  inputs: ['row', 'col'],
  table: { type: 'matrix', rows: ['cooperate', 'defect'], cols: ['cooperate', 'defect'],
    cells: [[3, 0], [5, 1]] },
  example_input: { row: 'cooperate', col: 'defect' },
  expected_output: 0,
});

// ---- SOCIAL CHOICE ------------------------------------------------------
def({
  catalog_entry: 'social-choice__borda-count-table',
  kind: 'lookup',
  title: 'Ballot aggregation: (candidate, position) -> number of ballots',
  inputs: ['candidate', 'position'],
  table: { type: 'matrix', rows: ['ana', 'bob', 'cat'], cols: ['first', 'second', 'third'],
    cells: [[12, 5, 3], [4, 10, 6], [4, 5, 11]] },
  example_input: { candidate: 'ana', position: 'first' },
  expected_output: 12,
});
def({
  catalog_entry: 'social-choice__borda-count-table',
  kind: 'formula',
  title: 'Borda score with weights 2/1/0 for 3 candidates',
  inputs: ['first', 'second', 'third'],
  formula: '2 * first + second',
  example_input: { first: 12, second: 5, third: 3 },
  expected_output: 29,
  notes: 'the weighted recombination layer of the same borda-count-table sheet (two recipes, one entry: matrix cell + score formula)',
});

// ---- REINFORCEMENT LEARNING ---------------------------------------------
def({
  catalog_entry: 'reinforcement-learning__q-table',
  kind: 'lookup',
  title: 'Q-table read: (state, action) -> value',
  inputs: ['state', 'action'],
  table: { type: 'matrix', rows: ['s1', 's2'], cols: ['left', 'right'], cells: [[0, 10], [2, 3]] },
  example_input: { state: 's1', action: 'right' },
  expected_output: 10,
});

// ---- FINANCE ------------------------------------------------------------
def({
  catalog_entry: 'finance__time-value-of-money-table',
  kind: 'formula',
  title: 'Future value FV = PV(1+r)^n',
  inputs: ['pv', 'r', 'n'],
  formula: 'pv * Math.pow(1 + r, n)',
  helpers: ['Math'],
  example_input: { pv: 1000, r: 0.05, n: 10 },
  expected_output: 1628.8946267774414,
  arena_compat_note: 'arena formula helpers are abs/min/max/clamp; Math is needed here — flagged for engine parity',
});

// ---- EPIDEMIOLOGY -------------------------------------------------------
def({
  catalog_entry: 'epidemiology__r0-table',
  kind: 'lookup',
  title: 'Published R0 ballpark by disease',
  inputs: ['disease'],
  table: { type: 'map', keys: { measles: 15, smallpox: 5, influenza: 1.3, ebola: 2, 'sars-cov-1': 3 } },
  example_input: { disease: 'measles' },
  expected_output: 15,
  notes: 'teaching-grade approximations from the literature; ranges exist',
});

// ---- CONTROL THEORY -----------------------------------------------------
def({
  catalog_entry: 'control-theory__pid-table',
  kind: 'formula',
  title: 'PID law with frozen integral/derivative state: u = Kp*e + Ki*I + Kd*D',
  inputs: ['kp', 'ki', 'kd', 'e', 'integral', 'deriv'],
  formula: 'kp * e + ki * integral + kd * deriv',
  example_input: { kp: 2, ki: 0.5, kd: 0.1, e: 4, integral: 3, deriv: -2 },
  expected_output: 9.3,
});

// ---- MACHINE LEARNING ---------------------------------------------------
def({
  catalog_entry: 'machine-learning__roc-curve-table',
  kind: 'lookup',
  title: 'ROC operating points: threshold -> [TPR, FPR]',
  inputs: ['threshold'],
  table: { type: 'map', keys: { 0.9: [0.1, 0], 0.7: [0.5, 0.05], 0.5: [0.8, 0.2], 0.3: [0.95, 0.5] } },
  example_input: { threshold: '0.5' },
  expected_output: [0.8, 0.2],
});

// ---- EXTENSIONS (provenance wave-66) ------------------------------------
def({
  catalog_entry: 'queueing-theory__m-m-1-table',
  kind: 'formula',
  title: 'M/M/1 utilization rho = lambda / mu',
  inputs: ['lambda', 'mu'],
  formula: 'lambda / mu',
  example_input: { lambda: 8, mu: 10 },
  expected_output: 0.8,
});
def({
  catalog_entry: 'queueing-theory__kendall-notation-table',
  kind: 'lookup',
  title: 'Kendall notation decoder',
  inputs: ['code'],
  table: { type: 'map', keys: {
    'M/M/1': 'poisson-arrivals/exponential-service/1-server',
    'M/M/c': 'poisson-arrivals/exponential-service/c-servers',
    'G/G/1': 'general-arrivals/general-service/1-server',
  } },
  example_input: { code: 'M/M/1' },
  expected_output: 'poisson-arrivals/exponential-service/1-server',
});
def({
  catalog_entry: 'measure-theory__density-table',
  kind: 'lookup',
  title: 'Standard normal density phi(z), 4dp',
  inputs: ['z'],
  table: { type: 'map', keys: { '0.0': 0.3989, '0.5': 0.3521, '1.0': 0.242, '1.5': 0.1295, '2.0': 0.054 } },
  example_input: { z: '1.0' },
  expected_output: 0.242,
});
def({
  catalog_entry: 'quantum-computing__gate-matrix-table',
  kind: 'lookup',
  title: 'Gate -> unitary matrix (X, Z, H)',
  inputs: ['gate'],
  table: { type: 'map', keys: {
    X: [[0, 1], [1, 0]],
    Z: [[1, 0], [0, -1]],
    H: [[0.7071067811865476, 0.7071067811865476], [0.7071067811865476, -0.7071067811865476]],
  } },
  example_input: { gate: 'Z' },
  expected_output: [[1, 0], [0, -1]],
});
def({
  catalog_entry: 'quantum-computing__measurement-table',
  kind: 'formula',
  title: "Born rule for |0>: P(0) = |a|^2",
  inputs: ['a', 'b'],
  formula: 'a * a',
  example_input: { a: 0.7071067811865476, b: 0.7071067811865476 },
  expected_output: 0.5,
  notes: 'b (|1> amplitude) is declared but unused by this outcome cell',
});
def({
  catalog_entry: 'reliability-maintenance__series-reliability-table',
  kind: 'formula',
  title: 'Two-component series reliability R = R1 * R2',
  inputs: ['r1', 'r2'],
  formula: 'r1 * r2',
  example_input: { r1: 0.9, r2: 0.8 },
  expected_output: 0.72,
});
def({
  catalog_entry: 'reliability-maintenance__availability-table',
  kind: 'formula',
  title: 'Steady-state availability A = MTBF / (MTBF + MTTR)',
  inputs: ['mtbf', 'mttr'],
  formula: 'mtbf / (mtbf + mttr)',
  example_input: { mtbf: 1000, mttr: 10 },
  expected_output: 0.9900990099009901,
});
def({
  catalog_entry: 'spreadsheet-engine-internals__dependency-graph-table',
  kind: 'lookup',
  title: 'Cell precedents map (the recalc planner\u2019s view)',
  inputs: ['cell'],
  table: { type: 'map', keys: {
    'sheet1!d1': ['sheet1!a1', 'sheet1!b2'],
    'sheet1!d2': ['sheet1!d1'],
    'sheet1!a1': [],
  } },
  example_input: { cell: 'sheet1!d2' },
  expected_output: ['sheet1!d1'],
});
def({
  catalog_entry: 'spreadsheet-engine-internals__cell-kind-table',
  kind: 'lookup',
  title: 'Arena cell kind -> purity class (from @quilt/core types.d.ts)',
  inputs: ['kind'],
  table: { type: 'map', keys: {
    value: 'pure', formula: 'pure', api: 'effectful-network', program: 'effectful',
    sensor: 'push', listener: 'effectful-action', router: 'delegate', io: 'bidirectional',
  } },
  example_input: { kind: 'router' },
  expected_output: 'delegate',
});
def({
  catalog_entry: 'computational-geometry__orientation-table',
  kind: 'formula',
  title: 'Orientation sign of ordered triple (a,b,c): sign((b-a) x (c-a))',
  inputs: ['ax', 'ay', 'bx', 'by', 'cx', 'cy'],
  formula: '((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) > 0) ? 1 : (((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) < 0) ? -1 : 0)',
  example_input: { ax: 0, ay: 0, bx: 1, by: 0, cx: 1, cy: 1 },
  expected_output: 1,
});
def({
  catalog_entry: 'computational-geometry__point-in-polygon-table',
  kind: 'lookup',
  title: 'Even-odd rule: crossing parity -> in/out',
  inputs: ['crossings'],
  table: { type: 'map', keys: { even: 'outside', odd: 'inside' } },
  example_input: { crossings: 'odd' },
  expected_output: 'inside',
});

// ---------------------------------------------------------------- emission

function buildRecipe(r, catalogEntry) {
  const id = `recipe.${r.catalog_entry}`;
  const base = {
    id,
    title: r.title,
    catalog_entry: r.catalog_entry,
    family: catalogEntry.family,
    catalog_name: catalogEntry.name,
    kind: r.kind,
    inputs: r.inputs,
    example_input: r.example_input,
    expected_output: r.expected_output,
    source: 'wave-66 lane 66-d (hand-authored; example machine-checked by src/validate.js)',
    notes: r.notes || null,
  };

  if (r.kind === 'lookup') {
    base.table_or_formula = r.table;
    const arenaCells = [];
    let expr;
    if (r.table.type === 'map') {
      arenaCells.push({ id: dataId(r.catalog_entry), kind: 'value', value: r.table.keys });
      expr = `=cells["${dataId(r.catalog_entry)}"][${r.inputs[0]}]`;
    } else if (r.table.type === 'nested-map') {
      arenaCells.push({ id: dataId(r.catalog_entry), kind: 'value', value: r.table.keys });
      expr = `=cells["${dataId(r.catalog_entry)}"][${r.inputs[0]}][${r.inputs[1]}]`;
    } else if (r.table.type === 'matrix') {
      arenaCells.push({ id: dataId(r.catalog_entry), kind: 'value', value: matrixToObj(r.table) });
      expr = `=cells["${dataId(r.catalog_entry)}"][${r.inputs[0]}][${r.inputs[1]}]`;
    } else if (r.table.type === 'piecewise') {
      expr = `=${piecewiseExpr(r.table, r.inputs[0])}`;
    } else {
      throw new Error(`unknown lookup table type ${r.table.type}`);
    }
    arenaCells.push({
      id: cellId(r.catalog_entry), kind: 'formula', expr,
      deps: r.table.type === 'piecewise' ? [] : [dataId(r.catalog_entry)],
      inputType: 'recipe inputs (see inputs[])', outputType: 'expected_output shape',
    });
    base.arena = {
      note: 'CellDef fragments compatible with @quilt/core types.d.ts; bare input identifiers are cells supplied by the hosting sheet',
      cells: arenaCells,
    };
  } else if (r.kind === 'formula') {
    base.table_or_formula = { type: 'expr', expr: r.formula };
    if (r.helpers) base.helpers = r.helpers;
    if (r.arena_compat_note) base.arena_compat_note = r.arena_compat_note;
    base.arena = {
      note: 'CellDef fragments compatible with @quilt/core types.d.ts; bare input identifiers are cells supplied by the hosting sheet',
      cells: [{
        id: cellId(r.catalog_entry), kind: 'formula', expr: `=${r.formula}`,
        deps: [], inputType: 'recipe inputs (see inputs[])', outputType: 'expected_output shape',
      }],
    };
  } else {
    throw new Error(`unknown recipe kind ${r.kind}`);
  }
  return base;
}

export function emitRecipes() {
  if (!existsSync(TYPES_PATH)) throw new Error('catalog/spreadsheet-types.json missing — run the parser first');
  const types = JSON.parse(readFileSync(TYPES_PATH, 'utf8'));
  const byId = new Map([...types.entries, ...types.extensions.entries].map((e) => [e.id, e]));

  const out = [];
  for (const r of R) {
    const entry = byId.get(r.catalog_entry);
    if (!entry) throw new Error(`recipe references unknown catalog entry: ${r.catalog_entry}`);
    out.push(buildRecipe(r, entry));
  }

  // never-delete-data friendly: recipe_ref back-filled into the committed catalog
  // (when an entry has 2 recipes — matrix cell + weighted formula — the lookup is primary)
  const refs = new Map();
  for (const x of out) {
    if (!refs.has(x.catalog_entry) || (refs.get(x.catalog_entry).kind !== 'lookup' && x.kind === 'lookup')) {
      refs.set(x.catalog_entry, x.id);
    }
  }
  for (const list of [types.entries, types.extensions.entries]) {
    for (const e of list) e.recipe_ref = refs.get(e.id) ?? null;
  }
  types.meta.generated_utc = new Date().toISOString();
  writeFileSync(TYPES_PATH, JSON.stringify(types, null, 2) + '\n');

  mkdirSync(OUT_DIR, { recursive: true });
  for (const recipe of out) {
    const f = path.join(OUT_DIR, `${recipe.id.replace(/^recipe\./, '')}.json`);
    writeFileSync(f, JSON.stringify(recipe, null, 2) + '\n');
  }
  const index = {
    meta: {
      generator: 'scripts/emit-recipes.mjs',
      generated_utc: new Date().toISOString(),
      count: out.length,
      by_kind: out.reduce((m, x) => { m[x.kind] = (m[x.kind] || 0) + 1; return m; }, {}),
      shape: '{id, title, catalog_entry, family, kind: lookup|formula, inputs, table_or_formula, example_input, expected_output, arena{cells: CellDef[]}, source, notes}',
      compat: 'arena fragments use only kind value|formula per @quilt/core types.d.ts; retrieval is a formula cell over a value cell holding the table',
    },
    recipes: out.map((x) => ({ id: x.id, catalog_entry: x.catalog_entry, family: x.family, kind: x.kind, file: `${x.id.replace(/^recipe\./, '')}.json` })),
  };
  writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  return { count: out.length, by_kind: index.meta.by_kind };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const res = emitRecipes();
  console.log(`[quilt-lookup] emitted ${res.count} recipes ->`, JSON.stringify(res.by_kind));
}
