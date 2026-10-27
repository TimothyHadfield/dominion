// Hard's endgame sense (bots.js smartBuy): node tests/smart.test.js
'use strict';
const assert = require('assert');
const E = require('../js/engine.js');
const S = require('../js/sim.js');
const B = require('../js/bots.js');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FAIL', name, '\n ', e.message); process.exitCode = 1; }
}
const K2 = ['Cellar', 'Market', 'Merchant', 'Militia', 'Mine', 'Moat', 'Remodel', 'Smithy', 'Village', 'Workshop'];
// A mid-game position: seat 0 to buy with `coins`; decks given as card lists (draw piles, VP counted from all zones).
function pos(o) {
  const g = new E.Game({ seed: 3, kingdom: K2, edition: 2, first: 0, players: [{ name: 'A' }, { name: 'B' }] });
  const [a, b] = g.players;
  a.draw = o.a.slice(); a.hand = []; a.discard = []; a.play = [];
  b.draw = o.b.slice(); b.hand = []; b.discard = []; b.play = [];
  a.turns = o.turnsA || 15; b.turns = o.turnsB || 15;
  if (o.supply) Object.assign(g.supply, o.supply);
  g.coins = o.coins;
  return { g, p: a };
}
const deck = (prov, duchy, estate) => Array(prov).fill('Province').concat(Array(duchy).fill('Duchy'), Array(estate).fill('Estate'), Array(7).fill('Copper'), Array(4).fill('Gold'));
const plan = S.bigMoney();
const hard = S.hardFor(plan);

t('hardFor adds the endgame flag and keeps the plan', () => {
  assert.strictEqual(hard.smart, true);
  assert.deepStrictEqual(hard.buy, plan.buy);
  assert.ok(!plan.smart, 'the plain plan is not changed');
});

t('behind by more than 6: does not take the last Province (plain Big Money would, and lose)', () => {
  const { g, p } = pos({ a: deck(3, 0, 3), b: deck(4, 1, 3), supply: { Province: 1 }, coins: 8 });
  assert.strictEqual(B.chooseBuy(plan, g, p), 'Province', 'baseline: plain plan buys it');
  assert.strictEqual(B.endOutcome(g, p, 'Province'), 0);
  const c = B.chooseBuy(hard, g, p);
  assert.notStrictEqual(c, 'Province');
  assert.ok(c === 'Gold' || c === 'Duchy', 'falls back to the next rule: ' + c);
});

t('ahead after the buy: takes the last Province and wins', () => {
  const { g, p } = pos({ a: deck(4, 0, 3), b: deck(3, 1, 3), supply: { Province: 1 }, coins: 8 });
  assert.strictEqual(B.endOutcome(g, p, 'Province'), 1);
  assert.strictEqual(B.chooseBuy(hard, g, p), 'Province');
});

t('two piles empty: a $5 Duchy that empties the third pile and wins is taken over Silver', () => {
  const { g, p } = pos({ a: deck(3, 2, 3), b: deck(3, 2, 3), supply: { Province: 2, Village: 0, Smithy: 0, Duchy: 1 }, coins: 5 });
  assert.ok(B.endsGame(g, 'Duchy'));
  assert.strictEqual(B.chooseBuy(hard, g, p), 'Duchy');
});

t('tie on points with more turns taken counts as a loss (rule: fewer turns wins)', () => {
  const { g, p } = pos({ a: deck(3, 0, 3), b: deck(4, 0, 3), supply: { Province: 1 }, coins: 8, turnsA: 16, turnsB: 15 });
  // after the buy A has 4 Provinces + 3 Estates = B's total, but A took more turns
  assert.strictEqual(B.endOutcome(g, p, 'Province'), 0);
  assert.notStrictEqual(B.chooseBuy(hard, g, p), 'Province');
});

t('not an ending buy: smart plan buys exactly like the plain plan', () => {
  const { g, p } = pos({ a: deck(1, 0, 3), b: deck(1, 0, 3), supply: { Province: 6 }, coins: 8 });
  assert.strictEqual(B.chooseBuy(hard, g, p), B.chooseBuy(plan, g, p));
});

t('the supply is not changed by smartBuy', () => {
  const { g, p } = pos({ a: deck(3, 0, 3), b: deck(4, 1, 3), supply: { Province: 1 }, coins: 8 });
  const before = JSON.stringify(g.supply);
  B.chooseBuy(hard, g, p);
  assert.strictEqual(JSON.stringify(g.supply), before);
});

console.log(passed + ' smart tests passed' + (process.exitCode ? ' (with failures)' : ''));
