/**
 * @file src/evaluator.js
 * @module quilt-lookup/evaluator
 *
 * =====================================================================
 *  THE TINY EVALUATOR — semantics for lookup tables + sandboxed formulas
 * =====================================================================
 *
 * This is the whole computational contract of quilt-lookup:
 *
 *   lookup table types
 *     map         flat object, key lookup            keys[input]
 *     nested-map  two-level object                   keys[a][b]
 *     matrix      rows[]/cols[]/cells[][]            cells[i][j] by index
 *     piecewise   bounds[]/values[]                  greatest-lower-bound bucket
 *
 *   formula       a JS expression over the recipe's declared inputs
 *
 * The formula sandbox mirrors the arena engine's stance (see
 * download/quilt-arena/engine/cells/formula.js): `new Function` compile,
 * "NOT a security boundary". Differences are deliberate and documented:
 *   - inputs are bound as FUNCTION PARAMETERS (no `with`), so an undeclared
 *     identifier is a ReferenceError rather than a silent undefined;
 *   - a static deny-list rejects effectful/global identifiers outright;
 *   - `Math` is injected ONLY when the recipe declares helpers:["Math"].
 *
 * Number comparison: exact for integers/strings/booleans; floats pass when
 * |got-expected| <= max(1e-9, 1e-6*|expected|) — tight enough to be a real
 * check, loose enough for IEEE-754 dust. Deep for arrays/objects.
 *
 * =====================================================================
 */

/** matrix {rows, cols, cells[][]} -> object-of-objects (arena value-cell payload) */
export function matrixToObj(t) {
  const o = {};
  t.rows.forEach((r, i) => {
    o[r] = {};
    t.cols.forEach((c, j) => { o[r][c] = t.cells[i][j]; });
  });
  return o;
}

/**
 * piecewise table -> arena-compatible ternary chain over `input`.
 * Semantics (matches applyLookup): bounds[i] is the INCLUSIVE lower edge of
 * bucket i paying values[i]; the chain therefore tests bounds[1..] and
 * defaults to the last value. Defined on [bounds[0], +inf).
 */
export function piecewiseExpr(t, input) {
  if (t.bounds.length < 2) throw new Error('piecewise needs >= 2 bounds');
  let expr = `${input} < ${JSON.stringify(t.bounds[1])} ? ${JSON.stringify(t.values[0])}`;
  for (let i = 2; i < t.bounds.length; i++) {
    expr += ` : ${input} < ${JSON.stringify(t.bounds[i])} ? ${JSON.stringify(t.values[i - 1])}`;
  }
  return `${expr} : ${JSON.stringify(t.values[t.values.length - 1])}`;
}

/** arena value-cell payload for a lookup table */
export function tablePayload(t) {
  if (t.type === 'map' || t.type === 'nested-map') return t.keys;
  if (t.type === 'matrix') return matrixToObj(t);
  return null; // piecewise carries no data cell
}

/**
 * Evaluate a lookup table against ordered input values.
 * Returns undefined when the key is out of range (a legitimate miss that
 * validation will report as a failure unless expected_output is null).
 */
export function applyLookup(table, values) {
  switch (table.type) {
    case 'map':
      return table.keys[String(values[0])];
    case 'nested-map': {
      const inner = table.keys[String(values[0])];
      return inner == null ? undefined : inner[String(values[1])];
    }
    case 'matrix': {
      const i = table.rows.indexOf(String(values[0]));
      const j = table.cols.indexOf(String(values[1]));
      if (i < 0 || j < 0) return undefined;
      return table.cells[i][j];
    }
    case 'piecewise': {
      const x = Number(values[0]);
      if (Number.isNaN(x) || x < table.bounds[0]) return undefined;
      let idx = 0;
      for (let k = 0; k < table.bounds.length; k++) if (table.bounds[k] <= x) idx = k;
      return table.values[idx];
    }
    default:
      throw new Error(`unknown lookup table type: ${table.type}`);
  }
}

const BANNED_RE =
  /\b(require|import|process|globalThis|global|Function|eval|fetch|constructor|prototype|__proto__|window|document)\b/;

function denyCheck(body) {
  const m = body.match(BANNED_RE);
  if (m) throw new Error(`formula uses banned identifier: ${m[1]} (sandbox allows declared inputs + declared pure helpers only)`);
}

function mathNames(helpers) {
  return (helpers || []).filter((h) => h === 'Math');
}

/**
 * Evaluate a recipe formula against a plain object of inputs.
 * @param {string} expr     expression (leading '=' tolerated)
 * @param {object} inputs   {name: value} — declared inputs ONLY
 * @param {string[]} helpers allowed pure helpers, currently just "Math"
 */
export function evalFormula(expr, inputs, helpers = []) {
  const body = expr.startsWith('=') ? expr.slice(1) : expr;
  denyCheck(body);
  const names = Object.keys(inputs);
  const mNames = mathNames(helpers);
  // eslint-disable-next-line no-new-func
  const fn = new Function(...names, ...mNames, `"use strict"; return (${body});`);
  return fn(...names.map((n) => inputs[n]), ...mNames.map(() => Math));
}

/**
 * Evaluate an arena-style formula cell body.
 * `cells` is the map of cell values the expression may read via
 * cells["id"] — mirrors @quilt/core's bracket-access rewriting; bare
 * identifiers resolve against the declared inputs (strict params, so an
 * undeclared reference THROWS instead of returning undefined).
 */
export function evalArenaExpr(expr, { inputs = {}, cells = {}, helpers = [] } = {}) {
  const body = expr.startsWith('=') ? expr.slice(1) : expr;
  denyCheck(body);
  const names = Object.keys(inputs);
  const mNames = mathNames(helpers);
  // eslint-disable-next-line no-new-func
  const fn = new Function('cells', ...names, ...mNames, `"use strict"; return (${body});`);
  return fn(cells, ...names.map((n) => inputs[n]), ...mNames.map(() => Math));
}

/** deep compare with float tolerance (see header). Returns null or a reason. */
export function compareValues(got, expected, path = '$') {
  if (typeof expected === 'number' && typeof got === 'number') {
    const tol = Math.max(1e-9, 1e-6 * Math.abs(expected));
    return Math.abs(got - expected) <= tol ? null : `${path}: got ${got}, expected ${expected} (tol ${tol})`;
  }
  if (expected === null) return got === null ? null : `${path}: got ${JSON.stringify(got)}, expected null`;
  if (Array.isArray(expected)) {
    if (!Array.isArray(got)) return `${path}: got ${typeof got}, expected array`;
    if (got.length !== expected.length) return `${path}: array length ${got.length} != ${expected.length}`;
    for (let i = 0; i < expected.length; i++) {
      const r = compareValues(got[i], expected[i], `${path}[${i}]`);
      if (r) return r;
    }
    return null;
  }
  if (typeof expected === 'object') {
    if (got === null || typeof got !== 'object' || Array.isArray(got)) return `${path}: got ${typeof got}, expected object`;
    const ek = Object.keys(expected).sort();
    const gk = Object.keys(got).sort();
    if (JSON.stringify(ek) !== JSON.stringify(gk)) return `${path}: object keys differ`;
    for (const k of ek) {
      const r = compareValues(got[k], expected[k], `${path}.${k}`);
      if (r) return r;
    }
    return null;
  }
  return got === expected ? null : `${path}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`;
}
