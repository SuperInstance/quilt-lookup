// smoke.mjs — typesafe micro-probe: ask jev-latest to classify 5 catalog entries
// into the 4 decomposition classes; compare with our keyword rules. Budget: 2 calls.
import fs from 'node:fs';
const env = Object.fromEntries(
  fs.readFileSync('/home/z/my-project/.env.keys', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);
fs.mkdirSync('receipts', { recursive: true });

const samples = [
  'Sentiment table - rows=messages, cols=scores - examples: reviews, tone',
  'Confusion matrix - predicted vs actual - examples: classification, diagnostics',
  'Payoff matrix - rows=player A actions, cols=player B actions, utilities - examples: prisoner\'s dilemma',
  'Truth table - all input combos and outputs - examples: logic gates, rule engines',
  'Chit-chat table - conversation starters - examples: greeters, rapport',
];
const classes = 'pure-lookup | lookup-with-weights | needs-dynamic-model | greeter-territory';

const r = await fetch('https://api.typesafe.ai/v1/systemone', {
  method: 'POST',
  headers: { Authorization: `Bearer ${env.TYPESAFE_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'jev-latest',
    state: { battery: 'quilt-lookup-w66-smoke', task: 'classify spreadsheet table types into decomposition classes for a soft-joint quilt runtime', classes, samples },
    questions: Object.fromEntries(samples.map((s, i) => [
      `e${i}`, { type: 'choice', instructions: `Which class is "${s}"?`, criteria: Object.fromEntries(classes.split(' | ').map(c => [c, c])) },
    ])),
  }),
});
const body = await r.json().catch(() => ({}));
const receipt = {
  kind: 'classification-smoke', at_utc: new Date().toISOString(), http: r.status,
  usage: body.usage || null,
  answers: body.answers ? Object.fromEntries(Object.entries(body.answers).map(([k, v]) => [k, v?.choice ?? v])) : null,
};
fs.writeFileSync('receipts/classification-smoke.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt).slice(0, 600));
