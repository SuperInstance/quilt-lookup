// src/validate.js — prove every recipe executable: run example_input through the
// recipe and assert expected_output. Honest failures stay in the report.
//
// Evaluation semantics (the compatibility contract, see recipes/recipes.js header):
//   lookup:  table[example_input[inputs[0]]] ?? default
//   formula: new Function(...inputNames, 'return (' + expr + ')')(...values)
//            — same trust level as the arena engine's formula cells (documented,
//            not a security boundary). Inputs are shadowed into scope by NAME.

export function evalRecipe(recipe, input) {
  if (recipe.kind === 'lookup') {
    const keyName = recipe.inputs[0];
    const key = input[keyName];
    if (key === undefined) throw new Error(`lookup input ${keyName} missing`);
    return Object.prototype.hasOwnProperty.call(recipe.table, key) ? recipe.table[key] : recipe.default;
  }
  if (recipe.kind === 'formula') {
    const names = recipe.inputs;
    const vals = names.map(n => {
      if (!(n in input)) throw new Error(`formula input ${n} missing`);
      return input[n];
    });
    // fn may declare nothing; inputs are positional. Guard length mismatch.
    const fn = new Function(...names, `"use strict"; return (${recipe.expr});`);
    return fn(...vals.slice(0, names.length));
  }
  throw new Error(`unknown recipe kind ${recipe.kind}`);
}

export function validateAll(recipes) {
  const report = { total: recipes.length, pass: 0, fail: 0, failures: [] };
  for (const r of recipes) {
    try {
      const out = evalRecipe(r, r.example_input);
      const ok = JSON.stringify(out) === JSON.stringify(r.expected_output)
        || (typeof out === 'number' && typeof r.expected_output === 'number' && Math.abs(out - r.expected_output) < 1e-9);
      if (ok) report.pass += 1;
      else {
        report.fail += 1;
        report.failures.push({ id: r.id, got: out, expected: r.expected_output });
      }
    } catch (e) {
      report.fail += 1;
      report.failures.push({ id: r.id, error: String(e.message || e).slice(0, 160) });
    }
  }
  return report;
}
