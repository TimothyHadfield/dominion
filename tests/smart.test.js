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

// ---- endgame look-ahead (rollouts) ----
// Both decks are all Gold ($8+ every turn). 2 Provinces left, B leads by 2.
// Province now: A +4, B takes the last one and wins. Duchy now: A +1, B takes one (1 left), A ends it on the last and wins.
const golds = (prov, estate) => Array(prov).fill('Province').concat(Array(estate).fill('Estate'), Array(12).fill('Gold'));
const race = () => {
  const r = pos({ a: golds(3, 0), b: golds(3, 2), supply: { Province: 2 }, coins: 8 });
  const b = r.g.players[1];
  b.hand = b.draw.splice(-5); // B holds its next hand, as in a real game
  return r;
};

t('look-ahead: does not take the second-last Province when that hands the rival the win', () => {
  const { g, p } = race();
  assert.strictEqual(B.chooseBuy(plan, g, p), 'Province', 'baseline: the plain plan takes it');
  assert.strictEqual(B.chooseBuy(hard, g, p), 'Duchy');
});

t('look-ahead: same position, same choice (replays agree), and the game is not touched', () => {
  const a = race(), b = race();
  const snap = x => JSON.stringify([x.g.supply, x.g.players.map(o => [o.draw, o.hand, o.discard, o.play, o.turns]), x.g.coins, x.g.buys]);
  const before = snap(a), r0 = a.g.rand();
  const a2 = race(); // a's generator after one draw from rand, for comparison
  const c1 = B.chooseBuy(hard, a2.g, a2.p);
  assert.strictEqual(snap(a2), before, 'game state unchanged');
  assert.strictEqual(a2.g.rand(), r0, 'the game\'s own shuffle stream is not used');
  assert.strictEqual(B.chooseBuy(hard, b.g, b.p), c1);
});

t('games saved before the look-ahead (smart flag only) replay exactly as before', () => {
  const { g, p } = race();
  const old = Object.assign({}, plan, { smart: true });
  assert.strictEqual(B.chooseBuy(old, g, p), 'Province');
});

t('a whole game with Hard replays to the same result, quickly the second time, and its choices can be saved', () => {
  const k = ['Cellar', 'Market', 'Militia', 'Mine', 'Moat', 'Remodel', 'Smithy', 'Village', 'Witch', 'Gardens'];
  const setup = { seed: 9091, kingdom: k, edition: 2, first: 0, players: [{ name: 'H', bot: S.hardFor(S.withCard('Witch', 2, true, true)) }, { name: 'M', bot: S.mediumFor(k) }] };
  let t = Date.now();
  const a = E.materialize(E.newGame(setup)); const t1 = Date.now() - t;
  t = Date.now();
  const b = E.materialize({ v: 1, setup: JSON.parse(JSON.stringify(setup)), actions: [] }); const t2 = Date.now() - t;
  assert.deepStrictEqual(b.result, a.result);
  const saved = B.lookSave(9091);
  assert.ok(Object.keys(saved).length > 0, 'the look-ahead ran and its choices are listed');
  for (const v of Object.values(saved)) assert.ok(v === null || typeof v === 'string');
  assert.ok(t2 * 2 < t1 + 20, 'replay ' + t2 + ' ms vs first play ' + t1 + ' ms');
  B.lookLoad(9091, { bogus: 'Not a card', other: 'Province' }); // junk in a saved game is ignored or checked before use
  const c = E.materialize({ v: 1, setup: JSON.parse(JSON.stringify(setup)), actions: [] });
  assert.deepStrictEqual(c.result, a.result);
});

t('look-ahead stays off for plain (Easy/Medium) plans and early in the game', () => {
  const { g, p } = pos({ a: golds(0, 3), b: golds(0, 3), supply: { Province: 8 }, coins: 8 });
  assert.strictEqual(B.chooseBuy(hard, g, p), B.chooseBuy(plan, g, p));
});

console.log(passed + ' smart tests passed' + (process.exitCode ? ' (with failures)' : ''));
