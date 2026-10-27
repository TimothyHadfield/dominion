// Dominion's part of My stats (js/domprofile.js): node tests/profile.test.js
'use strict';
const assert = require('assert');
const C = require('../js/cards.js');
const E = require('../js/engine.js');
const S = require('../js/sim.js');
const DP = require('../js/domprofile.js');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FAIL', name, '\n ', e.message); process.exitCode = 1; }
}
const K2 = ['Cellar', 'Market', 'Merchant', 'Militia', 'Mine', 'Moat', 'Remodel', 'Smithy', 'Village', 'Workshop'];
// Seat 0 plays money (Province at 8, Gold at 6, Silver at 3) against a bot, for `moves` answers or to the end.
function game(seed, bot, moves) {
  let st = E.newGame({ seed, kingdom: K2, players: [{ name: 'You' }, { name: 'CPU', bot }], first: 0 });
  for (let i = 0; i < (moves || 1e4) && !E.view(st, 0).over; i++) {
    const v = E.view(st, 0), p = v.pending;
    const want = v.coins >= 8 ? 'Province' : v.coins >= 6 ? 'Gold' : v.coins >= 3 ? 'Silver' : null;
    st = E.apply(st, { seat: 0, answer: p.kind === 'buy' ? (want && v.supply[want] ? want : null) : p.kind === 'action' ? -1 : null });
  }
  return E.view(st, 0);
}

t('finished game vs computer: rated result with the right winner and score', () => {
  let wins = 0, losses = 0;
  for (let s = 1; s <= 12; s++) {
    const v = game(s, S.bigMoney());
    assert.ok(v.over);
    const r = DP.result({ v, me: 0, level: 'easy', helped: false });
    assert.strictEqual(r.mode, 'computer');
    assert.strictEqual(r.level, 'easy');
    assert.strictEqual(r.score, v.players[0].vp);
    const solo = v.result.winners.length === 1;
    assert.strictEqual(r.won, solo && v.result.winners[0] === 0);
    assert.strictEqual(r.draw, !solo && v.result.winners.indexOf(0) >= 0);
    assert.ok(!r.extra.quit);
    assert.strictEqual(r.extra.margin, v.players[0].vp - v.players[1].vp);
    if (r.won) wins++; else if (!r.draw) losses++;
  }
  assert.ok(wins > 0 && losses > 0, 'both outcomes seen: ' + wins + '/' + losses);
});

t('quitting mid-game is a loss', () => {
  const v = game(4, S.bigMoney(), 10);
  assert.ok(!v.over);
  const r = DP.result({ v, me: 0, level: 'hard', helped: false });
  assert.strictEqual(r.won, false);
  assert.strictEqual(r.draw, false);
  assert.strictEqual(r.extra.quit, true);
  assert.strictEqual(r.level, 'hard');
});

t('a game with Undo is "with help" and unrated', () => {
  const v = game(2, S.bigMoney());
  const r = DP.result({ v, me: 0, level: 'hard', helped: true });
  assert.strictEqual(r.mode, 'help');
  assert.strictEqual(r.level, null);
});

t('Daily kingdom: same 10 cards for the same day, different on another day, all from the pool', () => {
  const pool = C.pool(2);
  const rng = seed => E.mulberry32(seed);
  const a = DP.dailyKingdom(pool, rng(20261027)), b = DP.dailyKingdom(pool.slice().reverse(), rng(20261027));
  const c = DP.dailyKingdom(pool, rng(20261028));
  assert.strictEqual(a.length, 10);
  assert.strictEqual(new Set(a).size, 10);
  assert.ok(a.every(x => pool.indexOf(x) >= 0));
  assert.deepStrictEqual(a, b, 'pool order does not matter');
  assert.notDeepStrictEqual(a, c);
});

t('achievements read the game summary', () => {
  const ach = id => DP.ACH.find(a => a.id === id);
  const c = { stats: { wins: 1, bestStreak: 1 }, daily: { streak: 0 },
    last: { won: true, level: 'hard', extra: { opps: 3, bestTurn: 2, provinces: 6, margin: 25, gardens: 0 } } };
  ['first', 'medium', 'hard', 'table', 'double', 'six', 'landslide'].forEach(id => assert.ok(ach(id).test(c), id));
  ['gardens', 'streak', 'daily'].forEach(id => assert.ok(!ach(id).test(c), id));
  c.last.won = false; c.last.level = 'easy';
  assert.ok(!ach('hard').test(c) && !ach('medium').test(c) && !ach('landslide').test(c));
});

t('levels are ordered Easy < Medium < Hard', () => {
  const r = DP.LEVELS.map(l => l.rating);
  assert.ok(r[0] < r[1] && r[1] < r[2]);
});

console.log(passed + ' profile tests passed' + (process.exitCode ? ' (with failures)' : ''));
