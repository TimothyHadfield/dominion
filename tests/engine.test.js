// Plain node tests: node tests/engine.test.js
'use strict';
const assert = require('assert');
const C = require('../js/cards.js');
const E = require('../js/engine.js');
const S = require('../js/sim.js');
const O = require('../js/odds.js');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FAIL', name, '\n ', e.message); process.exitCode = 1; }
}
const K2 = ['Cellar', 'Market', 'Merchant', 'Militia', 'Mine', 'Moat', 'Remodel', 'Smithy', 'Village', 'Workshop'];
// Two humans; seat 0 starts. Then rig hands/decks and restart the turn.
function rig(kingdom, hand0, opts) {
  opts = opts || {};
  const g = new E.Game({ seed: 1, kingdom, edition: opts.edition || 2, first: 0,
    players: (opts.players || [{ name: 'A' }, { name: 'B' }]) });
  const p = g.players[0];
  p.hand = hand0.slice(); p.play = []; p.turns = 0;
  if (opts.draw) p.draw = opts.draw.slice();
  if (opts.discard) p.discard = opts.discard.slice();
  if (opts.hand1) g.players[1].hand = opts.hand1.slice();
  g.gen = g.main(); g.advance();
  return g;
}
// cards held this turn, counting Treasures already moved into play for the Buy phase
const handN = p => p.hand.length + p.play.filter(c => C.is(c, 'Treasure')).length;
const play = (g, name) => g.answer(g.pending.player, g.players[g.pending.player].hand.indexOf(name));

// ---------------------------------------------------------------- setup
t('supply counts by player count', () => {
  const s2 = E.supplyFor(K2.concat([]), 2), s3 = E.supplyFor(K2, 3), s4 = E.supplyFor(K2, 4);
  assert.deepStrictEqual([s2.Province, s3.Province, s4.Province], [8, 12, 12]);
  assert.deepStrictEqual([s2.Duchy, s2.Estate, s4.Duchy, s4.Estate], [8, 8, 12, 12]);
  assert.deepStrictEqual([s2.Curse, s3.Curse, s4.Curse], [10, 20, 30]);
  assert.deepStrictEqual([s2.Copper, s3.Copper, s4.Copper], [46, 39, 32]);
  assert.deepStrictEqual([s2.Silver, s2.Gold, s2.Smithy], [40, 30, 10]);
  const gk = E.supplyFor(['Gardens'], 2), gk4 = E.supplyFor(['Gardens'], 4);
  assert.deepStrictEqual([gk.Gardens, gk4.Gardens], [8, 12]);
});
t('card pools: 26 second-edition, 25 first-edition kingdom cards', () => {
  assert.strictEqual(C.pool(2).length, 26);
  assert.strictEqual(C.pool(1).length, 25);
  assert.strictEqual(C.pool('mix').length, 32);
  for (const pr of C.PRESETS) assert.strictEqual(new Set(pr.cards).size, 10, pr.name);
});
// Facts copied from docs/rules-check.md (Dominion Strategy wiki "Dominion (Base Set)" and
// "Recommended Kingdoms/Dominion", checked 2026-10-19). If one of these fails, the card data drifted.
t('rules check: costs, edition lists and recommended sets match the sources', () => {
  const cost = {
    Copper: 0, Curse: 0, Estate: 2, Silver: 3, Duchy: 5, Gold: 6, Province: 8,
    Cellar: 2, Chapel: 2, Moat: 2, Harbinger: 3, Merchant: 3, Vassal: 3, Village: 3, Workshop: 3,
    Bureaucrat: 4, Gardens: 4, Militia: 4, Moneylender: 4, Poacher: 4, Remodel: 4, Smithy: 4, 'Throne Room': 4,
    Bandit: 5, 'Council Room': 5, Festival: 5, Laboratory: 5, Library: 5, Market: 5, Mine: 5, Sentry: 5, Witch: 5,
    Artisan: 6, Chancellor: 3, Woodcutter: 3, Feast: 4, Spy: 4, Thief: 4, Adventurer: 6,
  };
  for (const n in cost) assert.strictEqual(C.CARDS[n].cost, cost[n], n);
  assert.strictEqual(Object.keys(C.CARDS).length, Object.keys(cost).length, 'no extra cards');
  const added = ['Artisan', 'Bandit', 'Harbinger', 'Merchant', 'Poacher', 'Sentry', 'Vassal'];
  const removed = ['Adventurer', 'Chancellor', 'Feast', 'Spy', 'Thief', 'Woodcutter'];
  for (const x of added) { assert.ok(C.pool(2).includes(x) && !C.pool(1).includes(x), x); }
  for (const x of removed) { assert.ok(C.pool(1).includes(x) && !C.pool(2).includes(x), x); }
  const sets = {
    'First Game': 'Cellar Market Merchant Militia Mine Moat Remodel Smithy Village Workshop',
    'Size Distortion': 'Artisan Bandit Bureaucrat Chapel Festival Gardens Sentry Throne_Room Witch Workshop',
    'Deck Top': 'Artisan Bureaucrat Council_Room Festival Harbinger Laboratory Moneylender Sentry Vassal Village',
    'Sleight of Hand': 'Cellar Council_Room Festival Gardens Harbinger Library Militia Poacher Smithy Throne_Room',
    'Improvements': 'Artisan Cellar Market Merchant Mine Moat Moneylender Poacher Remodel Witch',
    'Silver & Gold': 'Bandit Bureaucrat Chapel Harbinger Laboratory Merchant Mine Moneylender Throne_Room Vassal',
    'First Game (1st ed.)': 'Cellar Market Militia Mine Moat Remodel Smithy Village Woodcutter Workshop',
    'Big Money': 'Adventurer Bureaucrat Chancellor Chapel Feast Laboratory Market Mine Moneylender Throne_Room',
    'Interaction': 'Bureaucrat Chancellor Council_Room Festival Library Militia Moat Spy Thief Village',
    'Size Distortion (1st ed.)': 'Cellar Chapel Feast Gardens Laboratory Thief Village Witch Woodcutter Workshop',
    'Village Square': 'Bureaucrat Cellar Festival Library Market Remodel Smithy Throne_Room Village Woodcutter',
  };
  assert.strictEqual(C.PRESETS.length, Object.keys(sets).length);
  for (const pr of C.PRESETS) {
    assert.deepStrictEqual(pr.cards.slice().sort(), sets[pr.name].split(' ').map(x => x.replace('_', ' ')).sort(), pr.name);
    for (const c of pr.cards) assert.ok(C.pool(pr.ed).includes(c), pr.name + ': ' + c + ' not in its edition');
  }
  // basic cards in the box: 60 Copper, 40 Silver, 30 Gold, 24 Estate, 12 Duchy, 12 Province, 30 Curse = 208
  const s4 = E.supplyFor(K2, 4);
  assert.strictEqual(s4.Copper + 4 * 7, 60);
  assert.strictEqual(s4.Estate + 4 * 3, 24);
  assert.strictEqual(s4.Copper + 28 + s4.Silver + s4.Gold + s4.Estate + 12 + s4.Duchy + s4.Province + s4.Curse, 208);
});
t('starting deck is 7 Copper + 3 Estate, 5 in hand', () => {
  const g = new E.Game({ seed: 5, kingdom: K2, players: [{}, {}] });
  for (const p of g.players) {
    const all = g.allCards(p);
    assert.strictEqual(all.filter(c => c === 'Copper').length, 7);
    assert.strictEqual(all.filter(c => c === 'Estate').length, 3);
    assert.strictEqual(handN(p), 5);
  }
});

// ---------------------------------------------------------------- cards
t('Village: +1 card +2 actions', () => {
  const g = rig(K2, ['Village', 'Copper', 'Copper', 'Copper', 'Estate']);
  play(g, 'Village');
  assert.strictEqual(g.actions, 2);
  assert.strictEqual(handN(g.players[0]), 5);
});
t('Smithy draws 3; Throne Room + Smithy draws 6', () => {
  let g = rig(K2, ['Smithy', 'Copper', 'Copper', 'Copper', 'Estate']);
  play(g, 'Smithy');
  assert.strictEqual(handN(g.players[0]), 7);
  g = rig(K2.concat(['Throne Room']), ['Throne Room', 'Smithy', 'Copper', 'Copper', 'Estate'], { draw: new Array(8).fill('Copper') });
  play(g, 'Throne Room');
  assert.strictEqual(g.pending.reason, 'throne');
  g.answer(0, [g.players[0].hand.indexOf('Smithy')]);
  assert.strictEqual(handN(g.players[0]), 3 + 6);
  assert.strictEqual(g.actions, 0);
});
t('Market gives card, action, buy, $1; treasures auto-played', () => {
  const g = rig(K2, ['Market', 'Copper', 'Silver', 'Estate', 'Estate'], { draw: ['Gold'] });
  play(g, 'Market');
  assert.strictEqual(g.buys, 2);
  assert.strictEqual(g.pending.kind, 'buy');
  assert.strictEqual(g.coins, 1 + 1 + 2 + 3);
});
t('Merchant: +$1 on the first Silver only, per Merchant', () => {
  const g = rig(K2, ['Merchant', 'Merchant', 'Silver', 'Silver', 'Estate'], { draw: ['Estate', 'Estate'] });
  play(g, 'Merchant'); play(g, 'Merchant');
  assert.strictEqual(g.coins, 2 + 2 + 2);
});
t('Militia: other player discards down to 3', () => {
  const g = rig(K2, ['Militia', 'Copper', 'Copper', 'Copper', 'Estate']);
  play(g, 'Militia');
  assert.strictEqual(g.pending.player, 1);
  assert.strictEqual(g.pending.min, 2);
  assert.throws(() => g.answer(1, [0]));
  g.answer(1, [0, 1]);
  assert.strictEqual(g.players[1].hand.length, 3);
  assert.strictEqual(g.coins, 2 + 3); // Militia + three Coppers
});
t('Moat blocks Witch only when revealed', () => {
  let g = rig(K2.concat(['Witch']), ['Witch', 'Copper', 'Copper', 'Copper', 'Estate'], { hand1: ['Moat', 'Copper', 'Copper', 'Copper', 'Copper'] });
  play(g, 'Witch');
  assert.strictEqual(g.pending.reason, 'moat');
  g.answer(1, true);
  assert.strictEqual(g.allCards(g.players[1]).filter(c => c === 'Curse').length, 0);
  assert.strictEqual(g.supply.Curse, 10);
  g = rig(K2.concat(['Witch']), ['Witch', 'Copper', 'Copper', 'Copper', 'Estate'], { hand1: ['Moat', 'Copper', 'Copper', 'Copper', 'Copper'] });
  play(g, 'Witch');
  g.answer(1, false);
  assert.strictEqual(g.supply.Curse, 9);
});
t('Gardens: 1 point per full 10 cards', () => {
  const g = rig(['Gardens'].concat(K2.slice(0, 9)), ['Copper']);
  const p = g.players[0];
  p.draw = []; p.discard = new Array(37).fill('Copper').concat(['Gardens', 'Gardens']); p.hand = ['Copper']; p.play = [];
  assert.strictEqual(g.allCards(p).length, 40);
  assert.strictEqual(g.vp(p), 8);
  p.discard = new Array(37).fill('Copper').concat(['Gardens']); // 39 cards, one Gardens -> 3
  assert.strictEqual(g.allCards(p).length, 39);
  assert.strictEqual(g.vp(p), 3);
});
t('Library: chosen Actions are set aside, then discarded', () => {
  const g = rig(K2.concat(['Library']), ['Library', 'Copper', 'Copper'], { draw: ['Copper', 'Copper', 'Silver', 'Smithy', 'Gold', 'Estate'] });
  play(g, 'Library');
  // pops from the end: Estate, Gold, then Smithy (asked), Silver, Copper
  assert.strictEqual(g.pending.reason, 'library');
  g.answer(0, true);
  const p = g.players[0];
  assert.strictEqual(handN(p), 7);
  assert.ok(p.discard.indexOf('Smithy') >= 0);
  assert.ok(p.hand.indexOf('Smithy') < 0);
});
t('Remodel: can\'t gain more than cost + 2', () => {
  const g = rig(K2, ['Remodel', 'Estate', 'Copper', 'Copper', 'Copper']);
  play(g, 'Remodel');
  g.answer(0, [g.players[0].hand.indexOf('Estate')]);
  assert.strictEqual(g.pending.kind, 'gain');
  assert.strictEqual(g.pending.maxCost, 4);
  assert.throws(() => g.answer(0, 'Gold'));
  assert.throws(() => g.answer(0, null));
  g.answer(0, 'Smithy');
  assert.ok(g.players[0].discard.indexOf('Smithy') >= 0);
  assert.ok(g.trash.indexOf('Estate') >= 0);
});
t('Bandit trashes a Silver/Gold, never Copper', () => {
  const g = rig(K2.concat(['Bandit']), ['Bandit', 'Copper', 'Copper', 'Copper', 'Estate']);
  g.players[1].draw = ['Estate', 'Copper', 'Silver'];
  play(g, 'Bandit');
  assert.deepStrictEqual(g.trash, ['Silver']);
  assert.ok(g.players[1].discard.indexOf('Copper') >= 0);
  const g2 = rig(K2.concat(['Bandit']), ['Bandit', 'Copper', 'Copper', 'Copper', 'Estate']);
  g2.players[1].draw = ['Estate', 'Copper', 'Copper'];
  play(g2, 'Bandit');
  assert.deepStrictEqual(g2.trash, []);
  assert.strictEqual(g2.players[0].discard.indexOf('Gold') >= 0, true);
});
t('Vassal plays the discarded Action without using an Action', () => {
  const g = rig(K2.concat(['Vassal']), ['Vassal', 'Copper', 'Copper', 'Copper', 'Estate'], { draw: ['Estate', 'Estate', 'Estate', 'Smithy'] });
  play(g, 'Vassal');
  assert.strictEqual(g.pending.reason, 'vassal');
  g.answer(0, true);
  assert.strictEqual(handN(g.players[0]), 4 + 3);
  assert.strictEqual(g.coins, 2 + 3);
});
t('Sentry: trash, discard, and choose the top card', () => {
  const g = rig(K2.concat(['Sentry']), ['Sentry', 'Copper', 'Copper', 'Copper', 'Estate'], { draw: ['Gold', 'Silver', 'Curse', 'Copper'] });
  play(g, 'Sentry'); // draws Copper; looks at Curse, Silver
  assert.deepStrictEqual(g.pending.cards, ['Curse', 'Silver']);
  g.answer(0, [0]);
  g.answer(0, []);
  const p = g.players[0];
  assert.deepStrictEqual(p.draw.slice(-2), ['Gold', 'Silver']);
  assert.deepStrictEqual(g.trash, ['Curse']);
});
t('Throne Room + Feast: Feast trashed once, two gains', () => {
  const g = rig(['Feast', 'Throne Room'].concat(K2.slice(0, 8)), ['Throne Room', 'Feast', 'Copper', 'Copper', 'Copper'], { edition: 1 });
  play(g, 'Throne Room');
  g.answer(0, [g.players[0].hand.indexOf('Feast')]);
  g.answer(0, 'Duchy');
  g.answer(0, 'Duchy');
  assert.deepStrictEqual(g.trash, ['Feast']);
  assert.strictEqual(g.players[0].discard.filter(c => c === 'Duchy').length, 2);
});
t('1st edition Moneylender must trash a Copper; 2nd edition asks', () => {
  let g = rig(K2.concat(['Moneylender']), ['Moneylender', 'Copper', 'Estate', 'Estate', 'Estate'], { edition: 1 });
  play(g, 'Moneylender');
  assert.strictEqual(g.coins, 3);
  g = rig(K2.concat(['Moneylender']), ['Moneylender', 'Copper', 'Estate', 'Estate', 'Estate']);
  play(g, 'Moneylender');
  assert.strictEqual(g.pending.reason, 'moneylender');
});
t('Adventurer finds two Treasures and discards the rest', () => {
  const g = rig(['Adventurer'].concat(K2.slice(0, 9)), ['Adventurer', 'Estate', 'Estate', 'Estate', 'Estate'], { edition: 1, draw: ['Silver', 'Estate', 'Copper', 'Smithy'] });
  play(g, 'Adventurer');
  const p = g.players[0];
  assert.deepStrictEqual(p.play.filter(c => C.is(c, 'Treasure')).sort(), ['Copper', 'Silver']);
  assert.ok(p.discard.indexOf('Smithy') >= 0 && p.discard.indexOf('Estate') >= 0);
});

// ---------------------------------------------------------------- ending + scoring
t('game ends when Provinces run out; tie goes to fewer turns', () => {
  const g = rig(K2, ['Gold', 'Gold', 'Gold', 'Copper', 'Copper']);
  g.supply.Province = 1;
  g.answer(0, 'Province');
  assert.ok(g.over);
  assert.deepStrictEqual(g.result.winners, [0]);
});
t('game ends on three empty piles', () => {
  const g = rig(K2, ['Copper', 'Copper', 'Copper', 'Estate', 'Estate']);
  g.supply.Smithy = 0; g.supply.Village = 0; g.supply.Market = 0;
  g.answer(0, null);
  assert.ok(g.over);
});
t('tie on points: player with fewer turns wins', () => {
  const g = rig(K2, ['Gold', 'Gold', 'Gold', 'Copper', 'Copper']);
  // seat 0 went first: give seat 1 the same points and end on seat 1's turn
  g.supply.Province = 2;
  g.answer(0, 'Province');
  g.players[1].hand = ['Gold', 'Gold', 'Gold', 'Copper', 'Copper']; g.players[1].play = []; g.players[1].turns = 0;
  // rewind seat 1 into a fresh turn with that hand
  g.cur = 1; g.gen = (function* (gg) { yield* gg.turn(gg.players[1]); gg.finish(); })(g); g.advance();
  g.answer(1, 'Province');
  assert.strictEqual(g.result.vp[0], g.result.vp[1]);
  assert.deepStrictEqual(g.result.turns, [1, 1]);
  assert.deepStrictEqual(g.result.winners, [0, 1]);
});

// ---------------------------------------------------------------- pure API
t('apply/view: secrets hidden, bad actions rejected, replay identical', () => {
  const setup = { seed: 77, kingdom: K2, players: [{ name: 'You' }, { name: 'CPU', bot: S.bigMoney() }], first: 0 };
  let st = E.newGame(setup);
  const v0 = E.view(st, 0), v1 = E.view(st, 1);
  assert.strictEqual(v0.me.hand.length + (v0.players[0].play.length), 5);
  assert.ok(!('hand' in v0.players[1]));
  assert.strictEqual(v1.pending, null);
  assert.throws(() => E.apply(st, { seat: 1, answer: null }));
  assert.throws(() => E.apply(st, { seat: 0, answer: 'Province' }));
  for (let i = 0; i < 40 && !E.view(st, 0).over; i++) {
    const v = E.view(st, 0);
    const p = v.pending;
    const want = v.coins >= 8 ? 'Province' : v.coins >= 6 ? 'Gold' : v.coins >= 3 ? 'Silver' : null;
    st = E.apply(st, { seat: 0, answer: p.kind === 'buy' ? (want && v.supply[want] ? want : null) : p.kind === 'action' ? -1 : null });
  }
  const json = JSON.parse(JSON.stringify(st));
  assert.deepStrictEqual(E.view(json, 0), E.view(st, 0));
});

// ---------------------------------------------------------------- invariants over many bot games
t('card conservation + termination over 400 random bot games', () => {
  for (let i = 0; i < 400; i++) {
    const ed = [1, 2, 'mix'][i % 3];
    const pool = C.pool(ed);
    const g0 = E.mulberry32(i + 11);
    const k = pool.slice().sort(() => g0() - 0.5).slice(0, 10);
    const n = 2 + (i % 3);
    const strats = [];
    for (let s = 0; s < n; s++) {
      const x = k[(i + s) % 10];
      strats.push(C.is(x, 'Victory') ? S.bigMoney() : S.withCard(x, 1 + (s % 2)));
    }
    const g = new E.Game({ seed: i + 1, kingdom: k, edition: ed === 'mix' ? 2 : ed, players: strats.map(s => ({ bot: s })) });
    assert.ok(g.over, 'game ' + i + ' did not end');
    const start = E.supplyFor(k, n);
    const totals = {};
    for (const key in start) totals[key] = start[key];
    totals.Copper += 7 * n; totals.Estate += 3 * n;
    const now = Object.assign({}, g.supply);
    for (const p of g.players) for (const c of g.allCards(p)) now[c] = (now[c] || 0) + 1;
    for (const c of g.trash) now[c] = (now[c] || 0) + 1;
    for (const key in totals) assert.strictEqual(now[key] || 0, totals[key], 'game ' + i + ' ' + key);
  }
});

// ---------------------------------------------------------------- odds
function brute(deck, k) {
  const out = []; let tot = 0;
  const n = deck.length;
  (function rec(start, left, sum) {
    if (left === 0) { out[sum] = (out[sum] || 0) + 1; tot++; return; }
    for (let i = start; i <= n - left; i++) rec(i + 1, left - 1, sum + (O.COIN[deck[i]] || 0));
  })(0, k, 0);
  return out.map(x => (x || 0) / tot);
}
t('coinDist matches brute-force enumeration', () => {
  const decks = [
    { Copper: 7, Estate: 3 },
    { Copper: 7, Estate: 3, Silver: 2, Smithy: 1 },
    { Copper: 6, Estate: 3, Silver: 3, Gold: 2, Province: 1, Witch: 1, Curse: 2 },
  ];
  for (const d of decks) {
    const list = [];
    for (const k in d) for (let i = 0; i < d[k]; i++) list.push(k);
    for (const k of [3, 5]) {
      const a = O.coinDist(d, k), b = brute(list, k);
      for (let s = 0; s < Math.max(a.length, b.length); s++) assert.ok(Math.abs((a[s] || 0) - (b[s] || 0)) < 1e-12, 'sum ' + s);
    }
  }
  // known: 5 Coppers from 7 Copper + 3 Estate = C(7,5)/C(10,5) = 21/252
  assert.ok(Math.abs(O.coinDist({ Copper: 7, Estate: 3 }, 5)[5] - 21 / 252) < 1e-12);
});
t('nextHand across a reshuffle', () => {
  // 2 Golds left in the draw pile; the other 3 cards come from 3 Copper + 3 Estate
  const r = O.nextHand({ Gold: 2 }, { Copper: 3, Estate: 3 }, 5);
  assert.ok(r.reshuffle);
  // P(>= $8) = P(at least 2 Coppers in 3 of 6) = (C(3,2)C(3,1)+C(3,3))/C(6,3) = 10/20
  assert.ok(Math.abs(O.atLeast(r.dist, 8) - 0.5) < 1e-12);
  assert.ok(Math.abs(O.atLeast(r.dist, 6) - 1) < 1e-12);
});

console.log(passed + ' passed' + (process.exitCode ? ' (with failures)' : ''));
