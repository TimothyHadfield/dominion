// Weird and rare situations (edge pass 2026-10-20): node tests/edge.test.js
'use strict';
const assert = require('assert');
const C = require('../js/cards.js');
const E = require('../js/engine.js');
const S = require('../js/sim.js');
const OG = require('../js/online-game.js');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FAIL', name, '\n ', e.message); process.exitCode = 1; }
}
const K2 = ['Cellar', 'Market', 'Merchant', 'Militia', 'Mine', 'Moat', 'Remodel', 'Smithy', 'Village', 'Workshop'];
const K1 = ['Bandit', 'Chapel', 'Library', 'Poacher', 'Sentry', 'Spy', 'Throne Room', 'Vassal', 'Witch', 'Feast'];
// Two humans; seat 0 starts. Rig hands/decks, then restart the turn.
function rig(kingdom, hand0, o) {
  o = o || {};
  const g = new E.Game({ seed: 1, kingdom, edition: o.edition || 2, first: 0, players: [{ name: 'A' }, { name: 'B' }] });
  const p = g.players[0];
  p.hand = hand0.slice(); p.play = []; p.turns = 0;
  if (o.draw) p.draw = o.draw.slice();
  if (o.discard) p.discard = o.discard.slice();
  if (o.hand1) g.players[1].hand = o.hand1.slice();
  if (o.draw1) g.players[1].draw = o.draw1.slice();
  if (o.discard1) g.players[1].discard = o.discard1.slice();
  if (o.supply) Object.assign(g.supply, o.supply);
  g.gen = g.main(); g.advance();
  return g;
}
const play = (g, name) => g.answer(g.pending.player, g.players[g.pending.player].hand.indexOf(name));
const pass = g => g.answer(g.pending.player, null);
const total = g => g.players.reduce((a, p) => a + g.allCards(p).length, 0) + g.trash.length + Object.values(g.supply).reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------- endings
t('R1 tie on points: fewer turns wins alone, and the result says so', () => {
  const g = rig(K2, ['Copper']);
  g.players[0].turns = 10; g.players[1].turns = 9;
  for (const p of g.players) { p.draw = ['Province']; p.hand = []; p.discard = []; p.play = []; }
  g.supply.Province = 0; g.finish();
  assert.deepStrictEqual(g.result.winners, [1]);
  assert.strictEqual(g.result.tiebreak, true);
  assert.strictEqual(g.result.reason, 'provinces');
});
t('R2 tie on points and turns: shared win, no tiebreak flag', () => {
  const g = rig(K2, ['Copper']);
  g.players[0].turns = 9; g.players[1].turns = 9;
  for (const p of g.players) { p.draw = ['Duchy']; p.hand = []; p.discard = []; p.play = []; }
  g.supply.Smithy = 0; g.supply.Village = 0; g.supply.Curse = 0; g.finish();
  assert.deepStrictEqual(g.result.winners, [0, 1]);
  assert.ok(!g.result.tiebreak);
  assert.strictEqual(g.result.reason, 'piles');
});
t('R4 safety round limit ends the game and says why', () => {
  const g = new E.Game({ seed: 7, kingdom: K2, edition: 2, maxRounds: 2, players: [{ name: 'A', bot: S.bigMoney() }, { name: 'B', bot: S.bigMoney() }] });
  assert.ok(g.over);
  assert.strictEqual(g.result.reason, 'rounds');
  assert.ok(g.log.slice(-2).some(l => /^Round 2 reached/.test(l.text)), JSON.stringify(g.log.slice(-2)));
});
t('R5 three empty piles counting the Curse pile end the game', () => {
  const g = rig(K2, ['Copper', 'Copper', 'Copper'], { supply: { Curse: 0, Smithy: 0, Village: 0 } });
  pass(g); // buy nothing
  assert.ok(g.over);
  assert.strictEqual(g.result.reason, 'piles');
});

// ---------------------------------------------------------------- empty decks
t('R7 a player with no cards at all keeps taking turns', () => {
  const g = rig(K1, ['Chapel', 'Copper', 'Copper', 'Copper', 'Copper'], { draw: [], discard: [] });
  play(g, 'Chapel');
  g.answer(0, [0, 1, 2, 3]);
  assert.strictEqual(g.pending.kind, 'buy');
  pass(g);
  pass(g); // B: action or buy
  if (g.pending && g.pending.player === 1) pass(g);
  // only the Chapel is left: it comes back as the whole hand
  assert.strictEqual(g.cur, 0);
  assert.deepStrictEqual(g.players[0].hand, ['Chapel']);
  play(g, 'Chapel'); // nothing else in hand: no question
  assert.strictEqual(g.pending.kind, 'buy');
  assert.strictEqual(g.coins, 0);
  pass(g);
});
t('R8 Bandit, Spy and Vassal against empty decks', () => {
  const g = rig(['Bandit', 'Spy', 'Vassal', 'Village', 'Smithy', 'Moat', 'Cellar', 'Chapel', 'Market', 'Witch'],
    ['Village', 'Bandit', 'Spy', 'Vassal', 'Copper'], { draw: [], discard: [], draw1: [], discard1: [], hand1: ['Copper'], edition: 2 });
  const before = total(g);
  play(g, 'Village');
  play(g, 'Vassal'); // nothing to discard
  play(g, 'Spy'); // nobody has a top card
  assert.strictEqual(g.pending.kind, 'action');
  play(g, 'Bandit');
  assert.strictEqual(g.players[1].discard.length + g.players[1].draw.length, 0);
  assert.strictEqual(total(g), before);
});
t('R10 Witch with the Curse pile empty gives nothing', () => {
  const g = rig(K1, ['Witch'], { supply: { Curse: 0 }, hand1: ['Copper'] });
  play(g, 'Witch');
  assert.ok(g.players[1].discard.indexOf('Curse') < 0);
});

// ---------------------------------------------------------------- odd card combos
t('R11 Throne Room on Throne Room plays two Actions twice each', () => {
  const g = rig(K1.concat(['Smithy', 'Village']), ['Throne Room', 'Throne Room', 'Smithy', 'Village', 'Copper'],
    { draw: new Array(20).fill('Copper') });
  play(g, 'Throne Room');
  g.answer(0, [g.players[0].hand.indexOf('Throne Room')]);
  g.answer(0, [g.players[0].hand.indexOf('Smithy')]);
  g.answer(0, [g.players[0].hand.indexOf('Village')]);
  // Smithy x2 (+6) and Village x2 (+2, +4 Actions): 9 Coppers, all paid in the Buy phase
  assert.strictEqual(g.actions, 4);
  assert.strictEqual(g.coins, 9);
});
t('R12 Mine on Gold with no Gold left must gain a cheaper Treasure', () => {
  const g = rig(K2, ['Mine', 'Gold', 'Estate'], { supply: { Gold: 0 } });
  play(g, 'Mine');
  g.answer(0, [g.players[0].hand.indexOf('Gold')]);
  assert.strictEqual(g.pending.kind, 'gain');
  assert.throws(() => g.answer(0, null), /must gain/);
  assert.throws(() => g.answer(0, 'Gold'));
  g.answer(0, 'Silver');
  assert.ok(g.players[0].play.indexOf('Silver') >= 0 || g.players[0].hand.indexOf('Silver') >= 0);
});
t('R13 Workshop with nothing gainable skips the gain', () => {
  const none = { Copper: 0, Curse: 0, Estate: 0, Silver: 0, Cellar: 0, Moat: 0, Merchant: 0, Militia: 0, Remodel: 0, Smithy: 0, Village: 0, Workshop: 0 };
  const g = rig(K2, ['Workshop', 'Copper'], { supply: none });
  play(g, 'Workshop');
  assert.strictEqual(g.pending.kind, 'buy');
});
t('R14 Poacher with more empty piles than cards discards the whole hand', () => {
  const g = rig(K1, ['Poacher'], { draw: ['Estate'], supply: { Witch: 0, Spy: 0 } });
  play(g, 'Poacher');
  assert.strictEqual(g.pending.kind, 'pickHand');
  assert.strictEqual(g.pending.min, 1);
  g.answer(0, [0]);
  assert.strictEqual(g.players[0].hand.length, 0);
});
t('R15 Militia vs 3 cards asks nothing', () => {
  const g = rig(K2, ['Militia'], { hand1: ['Copper', 'Copper', 'Estate'] });
  play(g, 'Militia');
  assert.strictEqual(g.pending.player, 0);
  assert.strictEqual(g.players[1].hand.length, 3);
});
t('R16 Merchant: a Silver gained by Mine into hand is the first Silver', () => {
  const g = rig(K2, ['Merchant', 'Mine', 'Copper', 'Estate', 'Estate'], { draw: ['Estate'] });
  play(g, 'Merchant');
  play(g, 'Mine');
  g.answer(0, [g.players[0].hand.indexOf('Copper')]);
  g.answer(0, 'Silver');
  assert.strictEqual(g.pending.kind, 'buy');
  assert.strictEqual(g.coins, 3);
});
t('R17 buying from an empty pile or above your money is refused', () => {
  const g = rig(K2, ['Gold', 'Gold'], { supply: { Smithy: 0 } });
  assert.strictEqual(g.pending.kind, 'buy');
  assert.throws(() => g.answer(0, 'Smithy'));
  assert.throws(() => g.answer(0, 'Colony'));
  assert.throws(() => g.answer(1, 'Silver'), /Not your/);
  g.answer(0, 'Gold');
});

// ---------------------------------------------------------------- online names
t('P1/P2 online: computers named like local ones, same names told apart, blank names filled', () => {
  let i = 0; const rng = () => ((i++ * 0.37) % 1);
  const st = OG.game.setup(4, { kingdom: K2, level: 'medium' }, rng,
    [{ kind: 'human', name: 'Sam' }, { kind: 'human', name: 'sam' }, { kind: 'computer' }, { kind: 'human', name: '   ' }]);
  const names = st.setup.players.map(p => p.name);
  assert.deepStrictEqual(names, ['Sam', 'sam 2', 'Medium', 'Player 4']);
  const st2 = OG.game.setup(3, { kingdom: K2 }, rng, [{ kind: 'human', name: 'Ann' }, { kind: 'computer' }, { kind: 'computer' }]);
  assert.deepStrictEqual(st2.setup.players.map(p => p.name), ['Ann', 'Hard 1', 'Hard 2']);
});

console.log(passed + ' passed');
