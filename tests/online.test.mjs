// The Dominion engine behind the shared online module's game interface (_online/README.md §2, §6).
// Run: node tests/online.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createLocal } from '../js/online.js';
const require = createRequire(import.meta.url);
const { game, viewFromSnap } = require('../js/online-game.js');
const Engine = require('../js/engine.js');
const Sim = require('../js/sim.js');

let pass = 0;
const ok = label => { pass++; console.log('  PASS  ' + label); };
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const KINGDOMS = [
  ['Cellar', 'Market', 'Merchant', 'Militia', 'Mine', 'Moat', 'Remodel', 'Smithy', 'Village', 'Workshop'],
  ['Artisan', 'Bandit', 'Bureaucrat', 'Chapel', 'Festival', 'Gardens', 'Sentry', 'Throne Room', 'Witch', 'Workshop'],
  ['Harbinger', 'Laboratory', 'Library', 'Moneylender', 'Poacher', 'Vassal', 'Council Room', 'Witch', 'Moat', 'Gardens'],
  ['Adventurer', 'Chancellor', 'Feast', 'Spy', 'Thief', 'Woodcutter', 'Throne Room', 'Militia', 'Library', 'Moneylender'],
];
const humans = n => Array.from({ length: n }, (_, i) => ({ kind: 'human', name: 'P' + (i + 1) }));
const clone = x => JSON.parse(JSON.stringify(x));

// 1. Every seat "human", every move made by game.bot through JSON copies (the online path),
//    so apply, toAct, bot and the JSON round trip are all exercised.
{
  let games = 0, moves = 0;
  for (let g = 0; g < 24; g++) {
    const rng = mulberry(g + 11);
    const n = 2 + (g % 3);
    const k = KINGDOMS[g % 4];
    let s = game.setup(n, { kingdom: k, edition: g % 4 === 3 ? 1 : 2, level: 'hard' }, rng, humans(n));
    assert.equal(JSON.stringify(clone(s)), JSON.stringify(s), 'state survives JSON');
    while (!game.isOver(s)) {
      const toAct = game.toAct(s);
      assert.equal(toAct.length, 1, 'exactly one seat to act before the end');
      const seat = toAct[0];
      const ctx = { pub: game.publicView(s), mine: game.privateView(s, seat), state: s };
      assert.ok(ctx.mine.pending && ctx.mine.pending.player === seat, 'the acting seat sees its decision');
      s = game.apply(clone(s), seat, clone(game.bot(ctx, seat, rng)));
      moves++;
      assert.ok(moves < 200000, 'runaway');
    }
    assert.deepEqual(game.toAct(s), []);
    const pub = game.publicView(s);
    assert.ok(pub.over && pub.result && pub.result.winners.length >= 1);
    // replaying from the setup alone gives the same result (no hidden randomness)
    const replay = Engine.view(clone(s), 0);
    assert.deepEqual(replay.result, pub.result);
    games++;
  }
  ok(games + ' online-path games (2-4 seats, both editions) end cleanly; ' + moves + ' moves, never an illegal bot move');
}

// 2. Illegal moves throw (online.js drops them).
{
  const s = game.setup(2, { kingdom: KINGDOMS[0] }, mulberry(3), humans(2));
  const seat = game.toAct(s)[0];
  const other = 1 - seat;
  assert.throws(() => game.apply(clone(s), other, { answer: -1 }), /Not your decision/);
  assert.throws(() => game.apply(clone(s), seat, { answer: 99 }));
  assert.throws(() => game.apply(clone(s), seat, {}), /Bad move/);
  assert.throws(() => game.apply(clone(s), seat, null), /Bad move/);
  ok('moves out of turn, bad picks and malformed moves throw');
}

// 3. Secrecy: the public view has no seed, no hand, no draw order; a private view is one seat's own cards.
{
  for (let g = 0; g < 6; g++) {
    const rng = mulberry(100 + g);
    let s = game.setup(3, { kingdom: KINGDOMS[g % 4] }, rng, humans(3));
    for (let step = 0; step < 40 * (g + 1) && !game.isOver(s); step++) {
      const seat = game.toAct(s)[0];
      s = game.apply(clone(s), seat, game.bot({ pub: game.publicView(s), mine: game.privateView(s, seat), state: s }, seat, rng));
    }
    const pubJ = JSON.stringify(game.publicView(s));
    assert.ok(!/"seed"|"actions":\[|"hand"|"draw"|"drawCounts"|"setup"|"players":\[\{"name"/.test(pubJ.replace(/"handSize"|"drawSize"|"handMoney"/g, '')), 'public view leaks nothing hidden');
    assert.ok(!pubJ.includes(String(s.setup.seed)) || String(s.setup.seed).length < 4, 'seed not in public view');
    const full = Engine.materialize(s);
    for (let j = 0; j < 3; j++) {
      const pv = game.privateView(s, j);
      assert.deepEqual(Object.keys(pv).sort(), ['me', 'pending']);
      assert.deepEqual(pv.me.hand, full.players[j].hand, 'own hand only');
      if (pv.pending) assert.equal(pv.pending.player, j, 'only my own decision');
      assert.ok(!('draw' in pv.me), 'not even my own draw order');
    }
  }
  ok('public view: no seed, hands or draw order; private view: own hand and own decision only');
}

// 4. The screens' view shape matches DomEngine.view for the same seat.
{
  const rng = mulberry(5);
  let s = game.setup(2, { kingdom: KINGDOMS[1] }, rng, humans(2));
  for (let i = 0; i < 25; i++) { const seat = game.toAct(s)[0]; s = game.apply(clone(s), seat, game.bot({ state: s }, seat, rng)); }
  for (const seat of [0, 1]) {
    const v = viewFromSnap({ pub: game.publicView(s), mine: game.privateView(s, seat), mySeat: seat });
    assert.deepEqual(clone(v), clone(Engine.view(s, seat)));
  }
  ok('snapshot view equals the local engine view seat for seat');
}

// 5. Computers picked before the start are played inside the engine: only humans ever appear in toAct.
{
  const rng = mulberry(9);
  let s = game.setup(4, { kingdom: KINGDOMS[2], level: 'medium' }, rng,
    [{ kind: 'human', name: 'A' }, { kind: 'computer', name: 'C2' }, { kind: 'human', name: 'B' }, { kind: 'computer', name: 'C4' }]);
  while (!game.isOver(s)) {
    const seat = game.toAct(s)[0];
    assert.ok(seat === 0 || seat === 2, 'computer seat asked to move: ' + seat);
    s = game.apply(clone(s), seat, game.bot({ state: s }, seat, rng));
  }
  assert.equal(s.setup.players[1].bot.id, Sim.mediumFor(KINGDOMS[2]).id, 'medium level used for computers');
  ok('pre-chosen computers never wait on the network; level option respected');
}

// 6. A local room (createLocal) plays a human + computer game to "finished".
{
  const room = createLocal({ game, seats: ['human', 'computer'], options: { kingdom: KINGDOMS[0] }, botDelayMs: 0, rng: mulberry(21) });
  let last = null;
  room.on('change', snap => { last = snap; });
  room.on('error', e => { throw e; });
  room.start();
  let guard = 0;
  while (last.status !== 'finished') {
    const r = room.act(game.bot({ state: room.state }, last.mySeat, Math.random));
    assert.ok(r.ok, r.message);
    assert.ok(++guard < 5000);
  }
  assert.ok(last.pub.over);
  ok('createLocal room plays to finished (' + guard + ' human moves)');
}

// 7. Bad options fall back to safe defaults.
{
  const s = game.setup(2, { kingdom: ['Copper', 'Nope'], plan: { buy: [{ card: 'Nope' }] }, edition: 7 }, mulberry(1), humans(2));
  assert.equal(s.setup.kingdom.length, 10);
  assert.equal(s.setup.edition, 2);
  assert.ok(s.setup.advisor.buy.every(r => r.card !== 'Nope'));
  ok('junk options give a valid preset game');
}

console.log(pass + ' passed');
