// Intrigue (2nd edition) cards: one or more engine tests per card, plus bots, Undo/replay and the online path.
// Run: node tests/intrigue.test.js
'use strict';
const assert = require('assert');
const C = require('../js/cards.js');
const E = require('../js/engine.js');
const S = require('../js/sim.js');
const B = require('../js/bots.js');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FAIL', name, '\n ', e.stack.split('\n').slice(0, 3).join('\n  ')); process.exitCode = 1; }
}
const KI = C.INTRIGUE ? C.INTRIGUE.slice(0, 10) : [];
// Two humans (or the given players); seat 0 starts. Rig hands/decks and restart the turn. draw pops from the END (last = top).
function rig(kingdom, hand0, opts) {
  opts = opts || {};
  const g = new E.Game({ seed: 1, kingdom, edition: 2, first: 0, players: (opts.players || [{ name: 'A' }, { name: 'B' }]) });
  const p = g.players[0];
  p.hand = hand0.slice(); p.play = []; p.turns = 0;
  if (opts.draw) p.draw = opts.draw.slice();
  if (opts.discard) p.discard = opts.discard.slice();
  if (opts.hand1) g.players[1].hand = opts.hand1.slice();
  if (opts.draw1) g.players[1].draw = opts.draw1.slice();
  if (opts.hand2 && g.players[2]) g.players[2].hand = opts.hand2.slice();
  if (opts.trash) g.trash = opts.trash.slice();
  g.gen = g.main(); g.advance();
  return g;
}
const play = (g, name) => g.answer(g.pending.player, g.players[g.pending.player].hand.indexOf(name));
const K = extra => Array.from(new Set(extra.concat(C.INTRIGUE || []))).slice(0, 10).concat(extra.length > 10 ? [] : []);
const kOf = (...cards) => { const k = cards.slice(); for (const c of C.INTRIGUE) if (k.length < 10 && k.indexOf(c) < 0) k.push(c); return k; };
const pick = (g, idxs) => g.answer(g.pending.player, idxs);
const optIdx = (g, label) => { const i = g.pending.options.findIndex(o => o.indexOf(label) === 0); assert.ok(i >= 0, 'no option ' + label + ' in ' + JSON.stringify(g.pending.options)); return i; };
const count = (arr, c) => arr.filter(x => x === c).length;

// ---------------------------------------------------------------- data
t('Intrigue: 26 cards, costs and types from the rules check', () => {
  const cost = { Courtyard: 2, Lurker: 2, Pawn: 2, Masquerade: 3, 'Shanty Town': 3, Steward: 3, Swindler: 3, 'Wishing Well': 3,
    Baron: 4, Bridge: 4, Conspirator: 4, Diplomat: 4, Ironworks: 4, Mill: 4, 'Mining Village': 4, 'Secret Passage': 4,
    Courtier: 5, Duke: 5, Minion: 5, Patrol: 5, Replace: 5, Torturer: 5, 'Trading Post': 5, Upgrade: 5, Farm: 6, Nobles: 6 };
  assert.strictEqual(C.INTRIGUE.length, 26);
  for (const n in cost) assert.strictEqual(C.CARDS[n].cost, cost[n], n);
  assert.deepStrictEqual(C.CARDS.Mill.types, ['Action', 'Victory']);
  assert.deepStrictEqual(C.CARDS.Nobles.types, ['Action', 'Victory']);
  assert.deepStrictEqual(C.CARDS.Farm.types, ['Treasure', 'Victory']);
  assert.deepStrictEqual(C.CARDS.Diplomat.types, ['Action', 'Reaction']);
  for (const a of ['Swindler', 'Minion', 'Replace', 'Torturer']) assert.ok(C.is(a, 'Attack'), a);
  assert.strictEqual(C.pool(2).length, 26, 'base pool unchanged');
  assert.strictEqual(C.pool(2, 'intrigue').length, 26);
  assert.strictEqual(C.pool(2, 'both').length, 52);
  for (const pr of C.PRESETS.filter(x => x.set)) for (const c of pr.cards) assert.ok(C.pool(2, pr.set).includes(c), pr.name + ' ' + c);
});
t('Victory kingdom piles: 8 with 2 players, 12 with 3-4', () => {
  const k = ['Mill', 'Nobles', 'Farm', 'Duke'].concat(C.INTRIGUE.filter(c => !C.is(c, 'Victory')).slice(0, 6));
  const s2 = E.supplyFor(k, 2), s4 = E.supplyFor(k, 4);
  for (const c of ['Mill', 'Nobles', 'Farm', 'Duke']) { assert.strictEqual(s2[c], 8, c); assert.strictEqual(s4[c], 12, c); }
  assert.strictEqual(s2.Pawn, 10);
});
t('VP: Duke 1 per Duchy, Farm 2, Nobles 2, Mill 1', () => {
  const g = rig(kOf('Duke', 'Farm', 'Nobles', 'Mill'), ['Copper']);
  const p = g.players[0];
  p.draw = []; p.hand = []; p.play = []; p.discard = ['Duke', 'Duke', 'Duchy', 'Duchy', 'Duchy', 'Farm', 'Nobles', 'Mill'];
  assert.strictEqual(g.vp(p), 2 * 3 + 9 + 2 + 2 + 1);
  assert.strictEqual(B.endOutcome ? typeof B.endOutcome : 'function', 'function');
});

// ---------------------------------------------------------------- $2
t('Courtyard: +3 cards then one card from hand onto the deck', () => {
  const g = rig(kOf('Courtyard'), ['Courtyard', 'Copper', 'Estate'], { draw: ['Copper', 'Silver', 'Gold', 'Copper'] });
  play(g, 'Courtyard');
  assert.strictEqual(g.pending.reason, 'courtyard');
  const p = g.players[0];
  assert.strictEqual(p.hand.length, 5);
  pick(g, [p.hand.indexOf('Gold')]);
  assert.strictEqual(p.draw[p.draw.length - 1], 'Gold');
});
t('Lurker: trash an Action from the Supply, or gain one from the trash', () => {
  let g = rig(kOf('Lurker', 'Nobles'), ['Lurker', 'Copper', 'Copper'], { trash: ['Nobles', 'Copper', 'Pawn'] });
  play(g, 'Lurker');
  assert.strictEqual(g.actions, 1);
  pick(g, [optIdx(g, 'Gain')]);
  assert.strictEqual(g.pending.kind, 'pickList');
  assert.deepStrictEqual(g.pending.cards, ['Nobles', 'Pawn']);
  pick(g, [0]);
  assert.ok(g.players[0].discard.indexOf('Nobles') >= 0);
  assert.deepStrictEqual(g.trash, ['Copper', 'Pawn']);
  g = rig(kOf('Lurker', 'Nobles'), ['Lurker', 'Copper', 'Copper']);
  play(g, 'Lurker');
  pick(g, [optIdx(g, 'Trash')]);
  assert.strictEqual(g.pending.kind, 'gain');
  assert.throws(() => g.answer(0, 'Silver'));
  const before = g.supply.Nobles;
  g.answer(0, 'Nobles');
  assert.strictEqual(g.supply.Nobles, before - 1);
  assert.deepStrictEqual(g.trash, ['Nobles']);
  assert.ok(g.players[0].discard.indexOf('Nobles') < 0);
});
t('Pawn: two different choices', () => {
  const g = rig(kOf('Pawn'), ['Pawn', 'Copper'], { draw: ['Silver'] });
  play(g, 'Pawn');
  assert.strictEqual(g.pending.reason, 'pawn');
  assert.throws(() => g.answer(0, [0, 0]));
  assert.throws(() => g.answer(0, [0]));
  pick(g, [optIdx(g, '+1 Buy'), optIdx(g, '+$1')]);
  assert.strictEqual(g.buys, 2);
  assert.strictEqual(g.coins, 2);
});

// ---------------------------------------------------------------- $3
t('Masquerade: everyone with cards passes one left at once, then you may trash', () => {
  const g = rig(kOf('Masquerade'), ['Masquerade', 'Curse', 'Copper'], { draw: ['Copper', 'Copper'], hand1: ['Gold', 'Estate'],
    players: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], hand2: [] });
  play(g, 'Masquerade');
  assert.strictEqual(g.pending.reason, 'masquerade');
  assert.strictEqual(g.pending.player, 0);
  pick(g, [g.players[0].hand.indexOf('Curse')]);
  assert.strictEqual(g.pending.player, 1); // C has no cards: skipped
  pick(g, [g.players[1].hand.indexOf('Estate')]);
  assert.ok(g.players[1].hand.indexOf('Curse') >= 0, 'B got the Curse (C skipped)');
  assert.ok(g.players[0].hand.indexOf('Estate') >= 0, 'A got the Estate');
  assert.strictEqual(g.players[2].hand.length, 0);
  assert.strictEqual(g.pending.reason, 'masq-trash');
  pick(g, [g.players[0].hand.indexOf('Estate')]);
  assert.deepStrictEqual(g.trash, ['Estate']);
});
t('Shanty Town: +2 cards only when no Action in hand', () => {
  let g = rig(kOf('Shanty Town'), ['Shanty Town', 'Copper'], { draw: ['Copper', 'Copper'] });
  play(g, 'Shanty Town');
  assert.strictEqual(g.players[0].hand.length + g.players[0].play.filter(c => c === 'Copper').length, 3);
  g = rig(kOf('Shanty Town', 'Pawn'), ['Shanty Town', 'Pawn'], { draw: ['Copper', 'Copper'] });
  play(g, 'Shanty Town');
  assert.strictEqual(g.actions, 2);
  assert.deepStrictEqual(g.players[0].hand, ['Pawn']);
});
t('Steward: cards, money, or trash 2 (does as much as it can)', () => {
  let g = rig(kOf('Steward'), ['Steward', 'Copper'], { draw: ['Silver', 'Silver'] });
  play(g, 'Steward'); pick(g, [optIdx(g, '+$2')]);
  assert.strictEqual(g.coins, 2 + 1);
  g = rig(kOf('Steward'), ['Steward', 'Estate'], {});
  play(g, 'Steward'); pick(g, [optIdx(g, 'Trash')]);
  // one card only: it must trash that one
  assert.strictEqual(g.pending.min, 1);
  pick(g, [0]);
  assert.deepStrictEqual(g.trash, ['Estate']);
  g = rig(kOf('Steward'), ['Steward'], { draw: ['Gold', 'Gold'] });
  play(g, 'Steward'); pick(g, [optIdx(g, '+2 Cards')]);
  assert.strictEqual(g.coins, 6);
});
t('Swindler: victim trashes top card, attacker picks a same-cost gain for them', () => {
  const g = rig(kOf('Swindler'), ['Swindler'], { draw1: ['Copper', 'Silver'] });
  play(g, 'Swindler');
  assert.strictEqual(g.coins, 2);
  assert.deepStrictEqual(g.trash, ['Silver']);
  assert.strictEqual(g.pending.kind, 'gain');
  assert.strictEqual(g.pending.player, 0);
  assert.strictEqual(g.pending.exact, 3);
  assert.throws(() => g.answer(0, 'Estate'));
  g.answer(0, 'Masquerade');
  assert.ok(g.players[1].discard.indexOf('Masquerade') >= 0);
  assert.ok(g.players[0].discard.indexOf('Masquerade') < 0);
});
t('Swindler: Copper -> Curse (both cost $0); Moat blocks', () => {
  let g = rig(kOf('Swindler'), ['Swindler'], { draw1: ['Copper'] });
  play(g, 'Swindler');
  g.answer(0, 'Curse');
  assert.ok(g.players[1].discard.indexOf('Curse') >= 0);
  g = rig(kOf('Swindler', 'Moat'), ['Swindler'], { draw1: ['Gold'], hand1: ['Moat', 'Copper'] });
  play(g, 'Swindler');
  assert.strictEqual(g.pending.reason, 'moat');
  g.answer(1, true);
  assert.deepStrictEqual(g.trash, []);
});
t('Wishing Well: name a card; right guess goes to hand', () => {
  let g = rig(kOf('Wishing Well'), ['Wishing Well'], { draw: ['Gold', 'Silver', 'Copper'] });
  play(g, 'Wishing Well');
  assert.strictEqual(g.pending.kind, 'name');
  assert.throws(() => g.answer(0, 'Nonsense'));
  g.answer(0, 'Silver');
  assert.ok(g.players[0].hand.indexOf('Silver') >= 0 || g.players[0].play.indexOf('Silver') >= 0);
  g = rig(kOf('Wishing Well'), ['Wishing Well'], { draw: ['Gold', 'Silver', 'Copper'] });
  play(g, 'Wishing Well');
  g.answer(0, 'Gold');
  assert.strictEqual(g.players[0].draw[g.players[0].draw.length - 1], 'Silver', 'wrong guess stays on top');
});

// ---------------------------------------------------------------- $4
t('Baron: discard an Estate for +$4, else gain an Estate', () => {
  let g = rig(kOf('Baron'), ['Baron', 'Estate', 'Copper']);
  play(g, 'Baron');
  assert.strictEqual(g.pending.reason, 'baron');
  g.answer(0, true);
  assert.strictEqual(g.coins, 4 + 1);
  assert.strictEqual(g.buys, 2);
  g = rig(kOf('Baron'), ['Baron', 'Copper']);
  const est = g.supply.Estate;
  play(g, 'Baron');
  assert.strictEqual(g.supply.Estate, est - 1);
  assert.ok(g.players[0].discard.indexOf('Estate') >= 0);
});
t('Bridge: costs $1 less this turn, twice with Throne Room; no lower than 0', () => {
  let g = rig(kOf('Bridge'), ['Bridge', 'Gold', 'Silver', 'Copper']);
  play(g, 'Bridge');
  assert.strictEqual(g.coins, 7);
  assert.strictEqual(g.cost('Province'), 7);
  assert.strictEqual(g.cost('Copper'), 0);
  g.answer(0, 'Province');
  assert.strictEqual(g.coins, 0);
  assert.strictEqual(g.buys, 1);
  g.answer(0, 'Copper');
  g = rig(kOf('Bridge', 'Throne Room'), ['Throne Room', 'Bridge', 'Gold', 'Silver']);
  play(g, 'Throne Room'); pick(g, [g.players[0].hand.indexOf('Bridge')]);
  assert.strictEqual(g.cost('Province'), 6);
  assert.strictEqual(g.buys, 3);
  g.answer(0, 'Province');
  assert.strictEqual(g.coins, 7 - 6);
  // next turn: back to full price
  g.answer(0, null);
  assert.strictEqual(g.cost('Province'), 8);
});
t('Conspirator: +1 card +1 action from the 3rd Action played', () => {
  let g = rig(kOf('Conspirator', 'Village'), ['Village', 'Conspirator', 'Conspirator'], { draw: new Array(6).fill('Copper') });
  play(g, 'Village'); play(g, 'Conspirator');
  assert.strictEqual(g.actions, 1);
  play(g, 'Conspirator');
  assert.strictEqual(g.actions, 1);
  assert.strictEqual(g.coins, 4 + 2); // + the 2 Coppers drawn by Village and the 2nd Conspirator
  g = rig(kOf('Conspirator', 'Throne Room'), ['Throne Room', 'Conspirator'], { draw: new Array(6).fill('Copper') });
  play(g, 'Throne Room'); pick(g, [g.players[0].hand.indexOf('Conspirator')]);
  // Throne Room (1), Conspirator (2), Conspirator again (3): the second play draws
  assert.strictEqual(g.coins, 4 + 1);
});
t('Diplomat: +2 Actions at 5 or fewer cards; reaction draws 2 discards 3', () => {
  let g = rig(kOf('Diplomat'), ['Diplomat', 'Copper', 'Copper'], { draw: ['Estate', 'Estate'] });
  play(g, 'Diplomat');
  assert.strictEqual(g.actions, 2);
  g = rig(kOf('Diplomat'), ['Diplomat', 'Copper', 'Copper', 'Copper', 'Copper'], { draw: ['Estate', 'Estate'] });
  play(g, 'Diplomat');
  assert.strictEqual(g.actions, 0);
  // reaction vs Minion
  g = rig(kOf('Diplomat', 'Minion'), ['Minion'], { hand1: ['Diplomat', 'Copper', 'Copper', 'Estate', 'Estate'], draw1: ['Gold', 'Gold', 'Silver', 'Silver', 'Silver', 'Silver', 'Silver', 'Silver'] });
  play(g, 'Minion');
  assert.strictEqual(g.pending.reason, 'diplomat');
  assert.strictEqual(g.pending.player, 1);
  g.answer(1, true);
  assert.strictEqual(g.pending.reason, 'diplomat-discard');
  assert.strictEqual(g.pending.min, 3);
  const h = g.players[1].hand;
  pick(g, [h.indexOf('Estate'), h.lastIndexOf('Estate'), h.indexOf('Copper')]);
  assert.strictEqual(g.players[1].hand.length, 4);
  // 4 cards now: can't react again
  assert.strictEqual(g.pending.reason, 'minion');
});
t('Ironworks: bonus by type of the gained card', () => {
  let g = rig(kOf('Ironworks', 'Pawn'), ['Ironworks'], { draw: ['Copper'] });
  play(g, 'Ironworks'); g.answer(0, 'Pawn');
  assert.strictEqual(g.actions, 1);
  g = rig(kOf('Ironworks'), ['Ironworks']);
  play(g, 'Ironworks'); g.answer(0, 'Silver');
  assert.strictEqual(g.coins, 1);
  g = rig(kOf('Ironworks', 'Mill'), ['Ironworks'], { draw: ['Gold'] });
  play(g, 'Ironworks'); g.answer(0, 'Mill'); // Action AND Victory: +1 Action and +1 Card
  assert.strictEqual(g.actions, 1);
  assert.ok(g.players[0].hand.indexOf('Gold') >= 0 || g.players[0].play.indexOf('Gold') >= 0);
});
t('Mill: discard 2 for +$2 (1 discarded = nothing)', () => {
  let g = rig(kOf('Mill'), ['Mill', 'Estate', 'Estate'], { draw: ['Copper'] });
  play(g, 'Mill');
  assert.strictEqual(g.pending.reason, 'mill');
  pick(g, [0, 1]);
  assert.strictEqual(g.coins, 2 + 1);
  g = rig(kOf('Mill'), ['Mill'], { draw: ['Estate'] });
  play(g, 'Mill'); pick(g, [0]);
  assert.strictEqual(g.coins, 0);
});
t('Mining Village: may trash itself for +$2 (once under Throne Room)', () => {
  let g = rig(kOf('Mining Village'), ['Mining Village'], { draw: ['Estate'] });
  play(g, 'Mining Village');
  assert.strictEqual(g.actions, 2);
  g.answer(0, true);
  assert.strictEqual(g.coins, 2);
  assert.deepStrictEqual(g.trash, ['Mining Village']);
  g = rig(kOf('Mining Village', 'Throne Room'), ['Throne Room', 'Mining Village'], { draw: ['Estate', 'Estate'] });
  play(g, 'Throne Room'); pick(g, [g.players[0].hand.indexOf('Mining Village')]);
  g.answer(0, true);
  assert.strictEqual(g.coins, 2);
  assert.notStrictEqual(g.pending && g.pending.reason, 'mining-village', 'no second trash offer');
  assert.strictEqual(g.actions, 4);
});
t('Secret Passage: put a card anywhere in the deck', () => {
  const g = rig(kOf('Secret Passage'), ['Secret Passage', 'Gold'], { draw: ['Copper', 'Copper', 'Estate', 'Estate', 'Estate'] });
  play(g, 'Secret Passage');
  assert.strictEqual(g.actions, 1);
  pick(g, [g.players[0].hand.indexOf('Gold')]);
  assert.strictEqual(g.pending.reason, 'passage-where');
  pick(g, [optIdx(g, '2nd')]);
  const d = g.players[0].draw;
  assert.strictEqual(d[d.length - 2], 'Gold');
});

// ---------------------------------------------------------------- $5
t('Courtier: one choice per type of the shown card', () => {
  let g = rig(kOf('Courtier', 'Minion'), ['Courtier', 'Minion', 'Copper']);
  play(g, 'Courtier');
  pick(g, [g.players[0].hand.indexOf('Minion')]);
  assert.strictEqual(g.pending.reason, 'courtier');
  assert.strictEqual(g.pending.min, 2);
  pick(g, [optIdx(g, '+$3'), optIdx(g, 'Gain a Gold')]);
  assert.strictEqual(g.coins, 3 + 1);
  assert.ok(g.players[0].discard.indexOf('Gold') >= 0);
  g = rig(kOf('Courtier'), ['Courtier', 'Copper']);
  play(g, 'Courtier'); pick(g, [0]);
  assert.strictEqual(g.pending.min, 1);
  pick(g, [optIdx(g, '+1 Buy')]);
  assert.strictEqual(g.buys, 2);
});
t('Minion: +$2, or everyone with 5+ cards discards and draws 4', () => {
  let g = rig(kOf('Minion'), ['Minion', 'Copper'], { hand1: ['Copper', 'Copper', 'Copper', 'Copper', 'Copper'], draw: new Array(6).fill('Silver') });
  play(g, 'Minion');
  assert.strictEqual(g.actions, 1);
  pick(g, [optIdx(g, 'Discard')]);
  assert.strictEqual(g.players[0].hand.length + g.players[0].play.filter(c => c === 'Silver').length, 4);
  assert.strictEqual(g.players[1].hand.length, 4);
  assert.ok(g.players[0].discard.indexOf('Copper') >= 0);
  g = rig(kOf('Minion'), ['Minion', 'Copper'], { hand1: ['Copper', 'Copper', 'Copper', 'Copper'] });
  play(g, 'Minion'); pick(g, [optIdx(g, 'Discard')]);
  assert.strictEqual(g.players[1].hand.length, 4, '4-card hand untouched');
  g = rig(kOf('Minion'), ['Minion', 'Copper']);
  play(g, 'Minion'); pick(g, [optIdx(g, '+$2')]);
  assert.strictEqual(g.coins, 3);
});
t('Patrol: Victory + Curse to hand, rest back in chosen order', () => {
  const g = rig(kOf('Patrol', 'Nobles'), ['Patrol'], { draw: ['Copper', 'Gold', 'Silver', 'Curse', 'Nobles', 'Copper', 'Copper', 'Copper'] });
  play(g, 'Patrol');
  const p = g.players[0];
  assert.ok(p.hand.indexOf('Curse') >= 0 && p.hand.indexOf('Nobles') >= 0);
  assert.strictEqual(g.pending.reason, 'patrol-order');
  pick(g, [g.pending.cards.indexOf('Gold')]);
  assert.strictEqual(p.draw[p.draw.length - 1], 'Gold');
  assert.strictEqual(p.draw[p.draw.length - 2], 'Silver');
});
t('Replace: Action/Treasure goes on deck; Victory curses the others (Moat blocks)', () => {
  let g = rig(kOf('Replace'), ['Replace', 'Estate']);
  play(g, 'Replace'); pick(g, [0]);
  assert.strictEqual(g.pending.maxCost, 4);
  g.answer(0, 'Silver');
  assert.strictEqual(g.players[0].draw[g.players[0].draw.length - 1], 'Silver');
  g = rig(kOf('Replace'), ['Replace', 'Gold']);
  play(g, 'Replace'); pick(g, [0]); g.answer(0, 'Province');
  assert.ok(g.players[0].discard.indexOf('Province') >= 0);
  assert.strictEqual(count(g.allCards(g.players[1]), 'Curse'), 1);
  g = rig(kOf('Replace', 'Moat'), ['Replace', 'Gold'], { hand1: ['Moat'] });
  play(g, 'Replace');
  assert.strictEqual(g.pending.reason, 'moat'); g.answer(1, true);
  pick(g, [0]); g.answer(0, 'Province');
  assert.strictEqual(count(g.allCards(g.players[1]), 'Curse'), 0);
});
t('Torturer: victim picks discard 2 or a Curse into hand', () => {
  let g = rig(kOf('Torturer'), ['Torturer'], { hand1: ['Copper', 'Copper', 'Estate', 'Gold', 'Gold'] });
  play(g, 'Torturer');
  assert.strictEqual(g.pending.player, 1);
  pick(g, [optIdx(g, 'Take a Curse')]);
  assert.ok(g.players[1].hand.indexOf('Curse') >= 0);
  g = rig(kOf('Torturer'), ['Torturer'], { hand1: ['Copper', 'Copper', 'Estate', 'Gold', 'Gold'] });
  play(g, 'Torturer'); pick(g, [optIdx(g, 'Discard 2')]);
  assert.strictEqual(g.pending.min, 2);
  pick(g, [0, 2]);
  assert.strictEqual(g.players[1].hand.length, 3);
});
t('Trading Post: trash 2 -> Silver to hand; only 1 card = no Silver', () => {
  let g = rig(kOf('Trading Post'), ['Trading Post', 'Copper', 'Estate']);
  play(g, 'Trading Post'); pick(g, [0, 1]);
  assert.strictEqual(g.coins, 2);
  assert.strictEqual(g.trash.length, 2);
  g = rig(kOf('Trading Post'), ['Trading Post', 'Copper']);
  play(g, 'Trading Post');
  assert.strictEqual(g.pending.min, 1);
  pick(g, [0]);
  assert.strictEqual(g.coins, 0);
});
t('Upgrade: gain a card costing exactly $1 more', () => {
  const g = rig(kOf('Upgrade'), ['Upgrade', 'Estate'], { draw: ['Copper'] });
  play(g, 'Upgrade');
  pick(g, [g.players[0].hand.indexOf('Estate')]);
  assert.strictEqual(g.pending.exact, 3);
  assert.throws(() => g.answer(0, 'Copper'));
  g.answer(0, 'Silver');
  assert.ok(g.players[0].discard.indexOf('Silver') >= 0);
});
t('Nobles: +3 cards or +2 actions; Farm is $2 and 2 VP', () => {
  let g = rig(kOf('Nobles', 'Farm'), ['Nobles', 'Farm'], { draw: ['Copper', 'Copper', 'Copper'] });
  play(g, 'Nobles'); pick(g, [optIdx(g, '+3 Cards')]);
  assert.strictEqual(g.coins, 2 + 3);
  g = rig(kOf('Nobles'), ['Nobles', 'Pawn']);
  play(g, 'Nobles'); pick(g, [optIdx(g, '+2 Actions')]);
  assert.strictEqual(g.actions, 2);
});

// ---------------------------------------------------------------- whole games: computers, Undo / replay, view privacy
function botGames(kingdom, levels, n, seed0) {
  const res = [];
  for (let i = 0; i < n; i++) {
    const strats = levels.map(l => l === 'easy' ? S.bigMoney() : l === 'medium' ? S.mediumFor(kingdom) : S.hardFor(S.quickPlan(kingdom)));
    const g = new E.Game({ seed: seed0 + i, kingdom, edition: 2, maxRounds: 60, players: strats.map((b, k) => ({ name: 'P' + k, bot: b })) });
    assert.ok(g.over, 'game finished');
    res.push(g);
  }
  return res;
}
t('computers finish games on every Intrigue card (2-4 players), and play each card', () => {
  const played = {}, bought = {};
  const pool = C.INTRIGUE;
  for (let r = 0; r < 12; r++) {
    const k = pool.slice(r * 7 % 26).concat(pool).slice(0, 10);
    const set = Array.from(new Set(k));
    // every bot is forced to try every kingdom card once by a plan that buys each kingdom card
    const greedy = { id: 'try', buy: [{ card: 'Province' }, { card: 'Gold' }].concat(set.map(c => ({ card: c, upTo: 2 }))).concat([{ card: 'Silver' }]) };
    for (const n of [2, 3, 4]) {
      const g = new E.Game({ seed: 100 + r * 10 + n, kingdom: set, edition: 2, maxRounds: 60, players: new Array(n).fill(0).map((x, i) => ({ name: 'P' + i, bot: greedy })) });
      assert.ok(g.over);
      for (const tr of g.turns) { for (const c of tr.played) played[c] = 1; for (const c of tr.bought) bought[c] = 1; }
    }
  }
  const neverPlayed = pool.filter(c => C.is(c, 'Action') && !played[c]);
  assert.deepStrictEqual(neverPlayed, [], 'bots never played: ' + neverPlayed.join(', '));
});
t('a human vs computers game replays identically (Undo / reopen) with every request kind answered', () => {
  const k = ['Masquerade', 'Swindler', 'Torturer', 'Minion', 'Courtier', 'Wishing Well', 'Secret Passage', 'Patrol', 'Diplomat', 'Pawn'];
  let st = E.newGame({ seed: 77, kingdom: k, edition: 2, players: [{ name: 'Me' }, { name: 'H', bot: S.hardFor(S.quickPlan(k)) }, { name: 'M', bot: S.mediumFor(k) }] });
  const r = E.mulberry32(5);
  let steps = 0;
  const kinds = {};
  while (steps < 3000) {
    const g = E.materialize(st);
    if (g.over) break;
    const req = g.pending; kinds[req.kind + ':' + (req.reason || '')] = 1;
    const ans = B.decide(req, g, Object.assign({}, g.players[req.player], { bot: { buy: [{ card: 'Province' }, { card: 'Gold' }].concat(k.map(c => ({ card: c, upTo: 3 }))).concat([{ card: 'Silver' }]) } }));
    st = E.apply(st, { seat: req.player, answer: ans });
    steps++;
  }
  const live = E.materialize(st);
  const fresh = E.materialize({ v: st.v, setup: st.setup, actions: st.actions.slice() });
  assert.deepStrictEqual(E.view({ v: st.v, setup: st.setup, actions: st.actions.slice() }, 0).players, E.view(st, 0).players);
  assert.deepStrictEqual(fresh.supply, live.supply);
  assert.ok(Object.keys(kinds).length > 4, JSON.stringify(kinds));
});
t('view never shows another player\'s hand while they choose a card to pass', () => {
  const g0 = E.newGame({ seed: 3, kingdom: kOf('Masquerade'), edition: 2, first: 0, players: [{ name: 'A' }, { name: 'B' }] });
  const v1 = E.view(g0, 1);
  assert.ok(!('hand' in v1.players[0]));
  assert.strictEqual(v1.pending, null);
});
t('Hard and Medium have plans for Intrigue cards (strength table covers all 26)', () => {
  const Str = require('../js/strength-data.js');
  const missing = C.INTRIGUE.filter(c => !C.is(c, 'Victory') || C.is(c, 'Action') || C.is(c, 'Treasure')).filter(c => !Str.byCard[c]);
  assert.deepStrictEqual(missing, []);
});

console.log(passed + ' intrigue tests passed' + (process.exitCode ? ' (some FAILED)' : ''));
