// recipes/recipes.js — executable lookup/formula cell fragments from the catalog.
//
// COMPATIBILITY CONTRACT (with the arena engine, /home/z/my-project/download/quilt-arena/engine):
//   kind 'lookup'  → a value/lookup cell: { table: {input: output}, default } — the
//                    engine's value cells hold data; tables are the formulaic bulk.
//   kind 'formula' → the engine's formula cell: `expr` is a tiny DSL evaluated with
//                    `new Function` + declared input names in scope (NOT a security
//                    boundary — same trust level as the upstream engine's formula.js).
// Every recipe carries example_input + expected_output so src/validate.js can prove
// it executable. catalog_ref points back at the spreadsheet-types entry it came from.

export const RECIPES = [
  // ---- SET THEORY ----
  { id: 'set.membership', kind: 'lookup', family: 'set-theory', catalog_ref: 'set-membership-table',
    inputs: ['element_set'], table: { 'alice:read': 1, 'alice:write': 1, 'bob:read': 1, 'bob:write': 0 }, default: 0,
    example_input: { element_set: 'alice:write' }, expected_output: 1,
    note: 'skills/access matrix: rows=elements, cols=sets' },
  { id: 'set.inclusion-exclusion', kind: 'formula', family: 'set-theory', catalog_ref: 'inclusion-exclusion-table',
    inputs: ['a', 'b', 'ab'], expr: 'a + b - ab',
    example_input: { a: 40, b: 30, ab: 10 }, expected_output: 60 },
  { id: 'set.cardinality', kind: 'formula', family: 'set-theory', catalog_ref: 'cardinality-table',
    inputs: ['items'], expr: 'items.length',
    example_input: { items: ['x', 'y', 'z'] }, expected_output: 3 },
  { id: 'set.partition', kind: 'lookup', family: 'set-theory', catalog_ref: 'partition-table',
    inputs: ['customer_spend'], table: { low: 'starter', mid: 'regular', high: 'vip' }, default: 'starter',
    example_input: { customer_spend: 'mid' }, expected_output: 'regular' },

  // ---- RELATIONS & FUNCTIONS ----
  { id: 'rel.function-table', kind: 'lookup', family: 'relations-functions', catalog_ref: 'function-table',
    inputs: ['taxable_income_bracket'], table: { b1: 0.10, b2: 0.22, b3: 0.32 }, default: 0.32,
    example_input: { taxable_income_bracket: 'b2' }, expected_output: 0.22,
    note: 'the canonical lookup: tax brackets' },
  { id: 'rel.composition', kind: 'lookup', family: 'relations-functions', catalog_ref: 'composition-table',
    inputs: ['via'], table: { a: 'b', b: 'c', c: 'd' }, default: null,
    example_input: { via: 'a' }, expected_output: 'b' },
  { id: 'rel.transitive-closure', kind: 'formula', family: 'relations-functions', catalog_ref: 'transitive-closure-table',
    inputs: ['hops', 'max'], expr: 'hops <= max ? "reachable" : "unreachable"',
    example_input: { hops: 3, max: 3 }, expected_output: 'reachable' },

  // ---- LOGIC ----
  { id: 'logic.and', kind: 'lookup', family: 'logic', catalog_ref: 'truth-table',
    inputs: ['a_b'], table: { '00': 0, '01': 0, '10': 0, '11': 1 }, default: 0,
    example_input: { a_b: '11' }, expected_output: 1 },
  { id: 'logic.or', kind: 'lookup', family: 'logic', catalog_ref: 'truth-table',
    inputs: ['a_b'], table: { '00': 0, '01': 1, '10': 1, '11': 1 }, default: 1,
    example_input: { a_b: '01' }, expected_output: 1 },
  { id: 'logic.xor', kind: 'lookup', family: 'logic', catalog_ref: 'truth-table',
    inputs: ['a_b'], table: { '00': 0, '01': 1, '10': 1, '11': 0 }, default: 0,
    example_input: { a_b: '10' }, expected_output: 1 },
  { id: 'logic.implies', kind: 'lookup', family: 'logic', catalog_ref: 'truth-table',
    inputs: ['a_b'], table: { '00': 1, '01': 1, '10': 0, '11': 1 }, default: 1,
    example_input: { a_b: '10' }, expected_output: 0 },
  { id: 'logic.decision-table', kind: 'lookup', family: 'logic', catalog_ref: 'decision-table',
    inputs: ['member_cart_total'], table: { 'yes_0': 'no-action', 'yes_50': 'member-discount', 'no_50': 'upsell-membership' }, default: 'no-action',
    example_input: { member_cart_total: 'yes_50' }, expected_output: 'member-discount' },

  // ---- LINEAR ALGEBRA ----
  { id: 'la.dot2', kind: 'formula', family: 'linear-algebra', catalog_ref: 'gram-matrix',
    inputs: ['a1', 'a2', 'b1', 'b2'], expr: 'a1*b1 + a2*b2',
    example_input: { a1: 1, a2: 2, b1: 3, b2: 4 }, expected_output: 11,
    note: 'Gram matrix entry: the inner product of two 2-vectors' },
  { id: 'la.det2', kind: 'formula', family: 'linear-algebra', catalog_ref: 'matrix-table',
    inputs: ['a', 'b', 'c', 'd'], expr: 'a*d - b*c',
    example_input: { a: 1, b: 2, c: 3, d: 4 }, expected_output: -2 },
  { id: 'la.transpose-lookup', kind: 'lookup', family: 'linear-algebra', catalog_ref: 'sparse-matrix-table',
    inputs: ['cell'], table: { 'r1c2': 'c1r2', 'r2c3': 'c2r3', 'r3c1': 'c3r1' }, default: null,
    example_input: { cell: 'r2c3' }, expected_output: 'c2r3',
    note: 'sparse coordinate storage: (row,col) -> (col,row) transpose' },
  { id: 'la.trace', kind: 'formula', family: 'linear-algebra', catalog_ref: 'matrix-table',
    inputs: ['a11', 'a22'], expr: 'a11 + a22',
    example_input: { a11: 5, a22: 7 }, expected_output: 12 },

  // ---- PROBABILITY & STATISTICS ----
  { id: 'stat.mean', kind: 'formula', family: 'probability-statistics', catalog_ref: 'frequency-table',
    inputs: ['xs'], expr: 'xs.reduce((s, x) => s + x, 0) / xs.length',
    example_input: { xs: [2, 4, 6] }, expected_output: 4,
    note: 'the tally that summarizes a tally' },
  { id: 'stat.variance', kind: 'formula', family: 'probability-statistics', catalog_ref: 'covariance-matrix',
    inputs: ['xs', 'mu'], expr: 'xs.reduce((s, x) => s + (x - mu) * (x - mu), 0) / xs.length',
    example_input: { xs: [2, 4, 6], mu: 4 }, expected_output: 2.6666666666666665,
    note: 'diagonal covariance entry for one variable' },
  { id: 'stat.zscore', kind: 'formula', family: 'probability-statistics', catalog_ref: 'z-table',
    inputs: ['x', 'mu', 'sd'], expr: '(x - mu) / sd',
    example_input: { x: 10, mu: 8, sd: 2 }, expected_output: 1,
    note: 'standardization: the input the z-table consumes' },
  { id: 'prob.coin-entropy', kind: 'formula', family: 'probability-statistics', catalog_ref: 'entropy-table',
    inputs: ['p'], expr: 'p <= 0 || p >= 1 ? 0 : -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p))',
    example_input: { p: 0.5 }, expected_output: 1 },
  { id: 'prob.expected-value', kind: 'formula', family: 'probability-statistics', catalog_ref: 'probability-distribution-table',
    inputs: ['px', 'vx', 'py', 'vy'], expr: 'px * vx + py * vy',
    example_input: { px: 0.5, vx: 10, py: 0.5, vy: -2 }, expected_output: 4 },

  // ---- OPTIMIZATION / OR ----
  { id: 'opt.linear-interp', kind: 'formula', family: 'optimization-or', catalog_ref: 'interpolation-table',
    inputs: ['x', 'x0', 'y0', 'x1', 'y1'], expr: 'x1 === x0 ? y0 : y0 + (y1 - y0) * (x - x0) / (x1 - x0)',
    example_input: { x: 15, x0: 10, y0: 100, x1: 20, y1: 200 }, expected_output: 150 },
  { id: 'opt.knapsack-yes', kind: 'lookup', family: 'optimization-or', catalog_ref: 'decision-table',
    inputs: ['weight_budget'], table: { '5': 'fits', '8': 'fits', '9': 'over' }, default: 'over',
    example_input: { weight_budget: '8' }, expected_output: 'fits' },

  // ---- GRAPH & NETWORK ----
  { id: 'graph.degree', kind: 'lookup', family: 'graph-network', catalog_ref: 'degree-table',
    inputs: ['vertex'], table: { a: 3, b: 2, c: 1 }, default: 0,
    example_input: { vertex: 'a' }, expected_output: 3 },
  { id: 'graph.reachable-1hop', kind: 'lookup', family: 'graph-network', catalog_ref: 'adjacency-table',
    inputs: ['from'], table: { a: 'b,c', b: 'c', c: '' }, default: '',
    example_input: { from: 'b' }, expected_output: 'c' },
  { id: 'graph.edge-exists', kind: 'lookup', family: 'graph-network', catalog_ref: 'adjacency-matrix',
    inputs: ['pair'], table: { 'a-b': 1, 'b-c': 1, 'c-a': 0 }, default: 0,
    example_input: { pair: 'b-c' }, expected_output: 1 },

  // ---- NUMBER THEORY & COMBINATORICS ----
  { id: 'nt.gcd-pair', kind: 'lookup', family: 'number-theory-combinatorics', catalog_ref: 'multiplication-table-mod-n',
    note2: 'gcd via modular arithmetic family; precomputed pairs',
    inputs: ['pair'], table: { '8-12': 4, '7-13': 1, '9-27': 9 }, default: 1,
    example_input: { pair: '9-27' }, expected_output: 9,
    note: 'precomputed gcd pairs; the algorithmic cell generalizes' },
  { id: 'nt.mod-class', kind: 'formula', family: 'number-theory-combinatorics', catalog_ref: 'equivalence-class-table',
    inputs: ['n'], expr: 'n % 3',
    example_input: { n: 10 }, expected_output: 1 },
  { id: 'nt.comb-choose2', kind: 'formula', family: 'number-theory-combinatorics', catalog_ref: 'binomial-table',
    inputs: ['n'], expr: 'n * (n - 1) / 2',
    example_input: { n: 5 }, expected_output: 10 },

  // ---- CS & DISCRETE ----
  { id: 'cs.bit-pair', kind: 'lookup', family: 'cs-discrete-tables', catalog_ref: 'truth-table',
    inputs: ['op_ab'], table: { 'and_00': 0, 'and_11': 1, 'or_01': 1, 'xor_10': 1 }, default: 0,
    example_input: { op_ab: 'xor_10' }, expected_output: 1 },
  { id: 'cs.round-half', kind: 'formula', family: 'cs-discrete-tables', catalog_ref: 'fixed-point-table',
    inputs: ['x'], expr: 'Math.round(x)',
    example_input: { x: 2.5 }, expected_output: 3,
    note: 'rounding mode: half-up as a table of one rule' },

  // ---- INFORMATION THEORY (extension family) ----
  { id: 'it.huffman-bias', kind: 'lookup', family: 'information-theory', catalog_ref: 'codebook-table',
    inputs: ['symbol'], table: { e: '0', t: '10', a: '110', rare: '1110' }, default: '1111',
    example_input: { symbol: 't' }, expected_output: '10' },
  { id: 'it.redundancy-parity', kind: 'formula', family: 'information-theory', catalog_ref: 'redundancy-table',
    inputs: ['bits'], expr: 'bits.length % 2',
    example_input: { bits: [1, 0, 1] }, expected_output: 1 },

  // ---- GAME THEORY (extension family) ----
  { id: 'gt.payoff', kind: 'lookup', family: 'game-theory', catalog_ref: 'payoff-matrix',
    inputs: ['cell'], table: { 'cooperate-cooperate': 3, 'cooperate-defect': 0, 'defect-cooperate': 5, 'defect-defect': 1 }, default: 1,
    example_input: { cell: 'defect-cooperate' }, expected_output: 5,
    note: "prisoner's dilemma: rows=own action, cols=other's" },
  { id: 'gt.best-response', kind: 'lookup', family: 'game-theory', catalog_ref: 'best-response-table',
    inputs: ['opp'], table: { rock: 'paper', paper: 'scissors', scissors: 'rock' }, default: 'rock',
    example_input: { opp: 'paper' }, expected_output: 'scissors' },

  // ---- CONTROL THEORY (extension family) ----
  { id: 'ctl.setpoint', kind: 'lookup', family: 'control-theory', catalog_ref: 'setpoint-table',
    inputs: ['mode'], table: { eco: 18, comfort: 21, boost: 24 }, default: 21,
    example_input: { mode: 'comfort' }, expected_output: 21,
    note: 'thermostat operating points' },
  { id: 'ctl.deadband', kind: 'formula', family: 'control-theory', catalog_ref: 'gain-margin-table',
    inputs: ['err', 'band'], expr: 'Math.abs(err) < band ? 0 : err',
    example_input: { err: 0.2, band: 0.5 }, expected_output: 0 },

  // ---- DYNAMICAL SYSTEMS (extension family) ----
  { id: 'dyn.logistic-step', kind: 'formula', family: 'dynamical-systems', catalog_ref: 'bifurcation-table',
    inputs: ['x', 'r'], expr: 'r * x * (1 - x)',
    example_input: { x: 0.5, r: 3.2 }, expected_output: 0.8 },
  { id: 'dyn.ca-rule110', kind: 'lookup', family: 'dynamical-systems', catalog_ref: 'cellular-automaton-table',
    inputs: ['triplet'], table: { '111': 0, '110': 1, '101': 1, '100': 0, '011': 1, '010': 1, '001': 1, '000': 0 }, default: 0,
    example_input: { triplet: '110' }, expected_output: 1,
    note: "wolfram rule 110: the lookup that's Turing-complete" },

  // ---- TOPOLOGY & STRUCTURE (extension family) ----
  { id: 'topo.euler', kind: 'formula', family: 'topology-structure', catalog_ref: 'euler-characteristic-table',
    inputs: ['v', 'e', 'f'], expr: 'v - e + f',
    example_input: { v: 8, e: 12, f: 6 }, expected_output: 2,
    note: 'cube: χ = 2' },
  { id: 'topo.incidence', kind: 'lookup', family: 'topology-structure', catalog_ref: 'incidence-table',
    inputs: ['ve'], table: { 'v1-e1': 1, 'v2-e1': -1, 'v2-e2': 1, 'v3-e2': -1 }, default: 0,
    example_input: { ve: 'v2-e1' }, expected_output: -1 },

  // ---- GENETICS ----
  { id: 'gen.punnett', kind: 'lookup', family: 'genetics', catalog_ref: 'punnett-square-table',
    inputs: ['cross'], table: { 'AA-AA': 'AA', 'AA-Aa': 'Aa', 'Aa-Aa': 'AA,Aa,aa', 'Aa-aa': 'Aa,aa' }, default: 'Aa',
    example_input: { cross: 'AA-Aa' }, expected_output: 'Aa' },
  { id: 'gen.hardy-weinberg', kind: 'formula', family: 'genetics', catalog_ref: 'hardy-weinberg-table',
    inputs: ['q'], expr: '2 * (1 - q) * q',
    example_input: { q: 0.2 }, expected_output: 0.32 },

  // ---- FINANCE / BUSINESS (the domain the store lives in) ----
  { id: 'biz.shipping-tier', kind: 'lookup', family: 'relations-functions', catalog_ref: 'function-table',
    inputs: ['order_total_band'], table: { '0-20': 5, '20-50': 3, '50+': 0 }, default: 5,
    example_input: { order_total_band: '20-50' }, expected_output: 3 },
  { id: 'biz.refund-window', kind: 'lookup', family: 'logic', catalog_ref: 'decision-table',
    inputs: ['days_receipt'], table: { 'under7_yes': 'full-refund', 'under7_no': 'store-credit', 'over7_yes': 'manager', 'over7_no': 'manager' }, default: 'manager',
    example_input: { days_receipt: 'under7_no' }, expected_output: 'store-credit' },
];

export default RECIPES;
