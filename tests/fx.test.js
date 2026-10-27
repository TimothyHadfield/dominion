// Sounds + animations: node tests/fx.test.js
// Plays real engine games (computers answer for every seat), turns each pair of views into fx steps
// and runs them through the real js/fx.js with a fake AudioContext and fake DOM elements.
'use strict';
const assert = require('assert');

// ---- fake browser bits (before fx.js loads) ----
const counts = { anim: 0, raf: 0 };
const audio = { nodes: 0 };
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
const node = x => { audio.nodes++; return Object.assign({ connect() {}, disconnect() {} }, x); };
class FakeAC {
  constructor() { this.sampleRate = 8000; this.state = 'running'; this.destination = {}; this.t = 0; }
  get currentTime() { return (this.t += 1); } // every play is "1 s later", so the throttle never kicks in
  createGain() { return node({ gain: param() }); }
  createOscillator() { return node({ type: 'sine', frequency: param(), start() {}, stop() {} }); }
  createBufferSource() { return node({ buffer: null, start() {}, stop() {} }); }
  createBiquadFilter() { return node({ type: '', frequency: param(), Q: param() }); }
  createStereoPanner() { return node({ pan: param() }); }
  createDynamicsCompressor() { return node({}); }
  createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
  resume() { return Promise.resolve(); }
}
globalThis.AudioContext = FakeAC;
const mem = new Map();
globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
function el(text) {
  return {
    textContent: text == null ? '5' : String(text), style: { cssText: '' },
    getBoundingClientRect: () => ({ left: 10, top: 10, width: 60, height: 90 }),
    animate() { counts.anim++; const a = {}; setTimeout(() => a.onfinish && a.onfinish(), 0); return a; },
    cloneNode() { return el(); }, remove() {}, removeAttribute() {}, appendChild() {}, setAttribute() {},
  };
}
globalThis.document = { body: el(), head: el(), createElement: () => el(), getElementById: () => null, addEventListener() {}, removeEventListener() {} };
globalThis.requestAnimationFrame = fn => { counts.raf++; return setTimeout(() => fn(performance.now() + 5000), 0); };

require('../js/fx.js');
const FX = globalThis.FX;
const C = require('../js/cards.js');
const E = require('../js/engine.js');
const S = require('../js/sim.js');
const OG = require('../js/online-game.js');
const DomFx = require('../js/dom-fx.js');
DomFx.defineSounds(FX);

let passed = 0;
const tests = [];
const t = (name, fn) => tests.push([name, fn]);

// FX with every call recorded (still runs the real thing)
function spyFX() {
  const rec = { sounds: [], kinds: [], calls: 0 };
  const spy = {};
  for (const k of ['play', 'celebrate', 'pop', 'shake', 'pulse', 'flash', 'flyTo', 'floatText', 'countUp']) {
    spy[k] = function (a, b, c, d) {
      rec.calls++;
      if (k === 'play') rec.sounds.push(a);
      if (k === 'celebrate') rec.kinds.push(a.kind);
      return FX[k](a, b, c, d);
    };
  }
  return { spy, rec };
}
const dom = { tile: () => el(), deck: () => el(), chip: () => el(), chipVP: s => el(10 + s), coins: () => el(6), hand: () => el(), info: () => el(), prov: () => el() };
const sync = (fn) => fn();
const NONE = { id: 'none', label: 'Buys nothing', buy: [] };
const WITCH = { id: 'w', label: 'BM + Witch', buy: [{ card: 'Province' }, { card: 'Gold' }, { card: 'Witch', upTo: 2 }, { card: 'Militia', upTo: 1 }, { card: 'Silver' }] };
const K = ['Cellar', 'Market', 'Merchant', 'Militia', 'Mine', 'Moat', 'Remodel', 'Smithy', 'Village', 'Witch'];

// Play a whole game. Seat 0 is "me" and acts through `act` like the app does (a computer picks my answers);
// seat 1 is a computer inside the engine, or a second human (humans=true) so seat 0 waits between turns.
function playGame(o) {
  const setup = { seed: o.seed, kingdom: K, edition: 2, advisor: o.mine, maxRounds: o.rounds || 30,
    players: [{ name: 'You' }, o.humans ? { name: 'Friend' } : { name: 'Bot', bot: o.theirs }] };
  let state = E.newGame(setup);
  const steps = [];
  let prev = DomFx.plan(null, E.view(state, 0), 0, { fresh: true });
  steps.push(prev); prev = prev.snap;
  for (let n = 0; n < 4000 && !prev.over; n++) {
    const g = E.materialize(state);
    const seat = g.pending.player;
    const strat = seat === 0 ? o.mine : o.theirs;
    const pl = Object.assign({}, g.players[seat], { bot: strat });
    state = E.apply(state, { seat, answer: require('../js/bots.js').decide(g.pending, g, pl) });
    const p = DomFx.plan(prev, E.view(state, 0), 0, {});
    steps.push(p);
    prev = p.snap;
  }
  return { steps, last: prev };
}
function runAll(plans, spy) { for (const p of plans) DomFx.react(p, spy, dom, { schedule: sync, me: 0, seats: [0, 1], colors: ['#f0b354'] }); }
// long enough for fx.js's delayed cheer (250 ms after the win fanfare)
const settle = () => new Promise(r => setTimeout(r, 400));
const freshFX = extra => { mem.clear(); FX.init({ game: 'dominion-test', clicks: false }); FX.unlock(); for (const k in (extra || {})) FX.set(k, extra[k]); };

// ---------------------------------------------------------------- (a) event -> sound map
t('opening deal: shuffle, the hand cards, then the Treasures pay', () => {
  // an opening hand has no Actions, so its Treasures are already in play: hand = the Estates
  const v = E.view(E.newGame({ seed: 3, kingdom: K, edition: 2, players: [{ name: 'You' }, { name: 'B', bot: S.bigMoney() }] }), 0);
  assert.deepStrictEqual(v.me.hand, ['Estate', 'Estate']);
  const p = DomFx.plan(null, v, 0, { fresh: true });
  assert.deepStrictEqual(p.steps.map(s => s.sound), ['shuffle', 'cardDeal', 'cardDeal', 'coins']);
});

t('first turn: buy -> card slide, then my next hand, then the computer pays and buys', () => {
  const setup = { seed: 11, kingdom: K, edition: 2, advisor: S.bigMoney(), players: [{ name: 'You' }, { name: 'B', bot: S.bigMoney() }] };
  let st = E.newGame(setup);
  const v0 = E.view(st, 0), v = DomFx.snap(v0);
  assert.strictEqual(v.cur, 0); assert.strictEqual(v.pending.kind, 'buy');
  st = E.apply(st, { seat: 0, answer: v0.coins >= 3 ? 'Silver' : 'Copper' });
  const after = E.view(st, 0);
  const p = DomFx.plan(v, after, 0, {});
  const snd = p.steps.map(s => s.sound);
  const hand = after.me.hand.length;
  assert.strictEqual(snd[0], 'cardSlide', 'my buy first: ' + snd);
  assert.deepStrictEqual(snd.slice(1, 1 + hand), new Array(hand).fill('cardDeal'), 'then my next hand: ' + snd);
  const rest = snd.slice(1 + hand);
  assert.ok(rest[0] === 'coins' && rest[1] === 'cardSlide', 'then the computer pays and buys: ' + snd);
  assert.strictEqual(rest[rest.length - 1], 'coins', 'my new turn: my Treasures pay: ' + snd);
  assert.ok(p.events.find(e => e.type === 'buy' && e.seat === 1), 'computer buy is an event');
  assert.ok(p.steps.filter(s => s.e.seat === 1).every(s => s.vol <= 1), 'computer never louder than me');
  assert.ok(p.dealAt <= 400, 'hand deals in within 400 ms');
});

t('whole game vs Witch + Militia computer: every event maps to its sound', () => {
  const { steps } = playGame({ seed: 5, mine: S.bigMoney(), theirs: WITCH });
  const all = [].concat(...steps.map(p => p.steps));
  const by = type => all.filter(s => s.e.type === type).map(s => s.sound);
  const want = { shuffle: 'shuffle', deal: 'cardDeal', play: 'cardFlip', coins: 'coins', buy: 'cardSlide', province: 'province', attack: 'hit', curse: 'curse', move: 'cardFlip' };
  for (const k in want) {
    const got = by(k);
    assert.ok(got.length > 0, 'no ' + k + ' events in a whole game');
    assert.ok(got.every(x => x === want[k]), k + ' -> ' + got[0]);
  }
  assert.ok(all.filter(s => s.e.type === 'attack').some(s => s.e.onMe), 'their Witch/Militia hits me');
  assert.ok(all.filter(s => s.e.type === 'curse').some(s => s.e.seat === 0), 'I gained a Curse');
  for (const p of steps) assert.ok(Math.max(0, ...p.steps.map(s => s.at)) <= 2700, 'one reaction lasts at most ~2.6 s');
});

t('key moments: a pile running out and the last two Provinces', () => {
  const base = { log: [], turns: [{ seat: 1, coins: 8, bought: [] }], me: { hand: [] } };
  const prev = Object.assign({}, base, { supply: { Province: 3, Village: 1, Curse: 2 } });
  const next = Object.assign({}, base, { supply: { Province: 2, Village: 0, Curse: 2 } });
  const evs = DomFx.events(prev, next, 0, { dealN: 0 });
  assert.deepStrictEqual(evs.map(e => e.type + ':' + e.card), ['pileout:Village', 'endnear:Province']);
  const p = DomFx.plan(prev, next, 0, { dealN: 0 });
  assert.strictEqual(p.steps.find(s => s.e.type === 'pileout').sound, 'pileout');
  assert.ok(DomFx.snap(Object.assign({ players: [] }, next)).supply.Village === 0, 'snap keeps the supply');
  // the game-ending last Province is the win/lose moment, not a "pile out"
  const over = Object.assign({}, base, { over: true, result: { winners: [1] }, supply: { Province: 0, Village: 1, Curse: 2 } });
  assert.deepStrictEqual(DomFx.events(Object.assign({}, prev, { supply: { Province: 1, Village: 1, Curse: 2 } }), over, 0, { dealN: 0 }).map(e => e.type), ['over']);
});

t('trash: Chapel-like trashing and Remodel produce the crumple', () => {
  const evs = DomFx.events({ log: [{ r: 3, p: 0, text: 'played Remodel' }], turns: [{ seat: 0, coins: 0, bought: [] }], me: { hand: [] } },
    { log: [{ r: 3, p: 0, text: 'played Remodel' }, { r: 3, p: 0, text: 'trashed Estate' }, { r: 3, p: 0, text: 'gained Silver' }], turns: [{ seat: 0, coins: 0, bought: [] }], me: { hand: [] } }, 0, { dealN: 0 });
  assert.deepStrictEqual(evs.map(e => e.type), ['trash', 'gain']);
});

t('your-turn chime only when it becomes your turn after waiting (online-style)', () => {
  const { steps } = playGame({ seed: 7, mine: S.bigMoney(), theirs: S.bigMoney(), humans: true, rounds: 6 });
  const turns = [].concat(...steps.map(p => p.events)).filter(e => e.type === 'turn');
  // seat 0 starts or not; either way one chime per later turn of mine
  assert.ok(turns.length >= 4 && turns.length <= 6, 'chimes: ' + turns.length);
  const local = playGame({ seed: 7, mine: S.bigMoney(), theirs: S.bigMoney(), rounds: 6 });
  assert.strictEqual([].concat(...local.steps.map(p => p.events)).filter(e => e.type === 'turn').length, 0, 'no chime vs instant computers');
});

// ---------------------------------------------------------------- (b) switches
t('sound on: sounds really play through fx.js', async () => {
  freshFX();
  const before = FX.stats.plays;
  const { spy } = spyFX();
  runAll(playGame({ seed: 5, mine: S.bigMoney(), theirs: WITCH }).steps, spy);
  await settle();
  assert.ok(FX.stats.plays - before > 100, 'played ' + (FX.stats.plays - before));
});

t('Sound off: not one sound', async () => {
  freshFX({ sound: false });
  const before = FX.stats.plays, nodes = audio.nodes;
  const { spy, rec } = spyFX();
  runAll(playGame({ seed: 5, mine: S.bigMoney(), theirs: WITCH }).steps, spy);
  await settle();
  assert.ok(rec.sounds.length > 100, 'the game still asked for sounds');
  assert.strictEqual(FX.stats.plays - before, 0);
  assert.strictEqual(audio.nodes - nodes, 0, 'no audio nodes made');
});

t('Game sounds off: no card sounds, the win fanfare still allowed', async () => {
  freshFX({ moves: false });
  const before = FX.stats.plays;
  const { spy, rec } = spyFX();
  runAll(playGame({ seed: 5, mine: WITCH, theirs: NONE, rounds: 30 }).steps, spy);
  await settle();
  const big = rec.kinds.filter(k => k === 'big').length;
  assert.ok(big > 0 && rec.kinds.indexOf('win') >= 0);
  // each Province 'big' moment = 1 ding; the win = fanfare + cheer
  assert.strictEqual(FX.stats.plays - before, big + 2, 'only celebration sounds');
});

t('Animations on: things move; Animations off: nothing moves', async () => {
  freshFX();
  let a0 = counts.anim + counts.raf;
  runAll(playGame({ seed: 5, mine: WITCH, theirs: S.bigMoney() }).steps, spyFX().spy);
  await settle();
  assert.ok(counts.anim + counts.raf - a0 > 20, 'animations ran: ' + (counts.anim + counts.raf - a0));
  freshFX({ animations: false });
  a0 = counts.anim + counts.raf;
  runAll(playGame({ seed: 5, mine: WITCH, theirs: S.bigMoney() }).steps, spyFX().spy);
  await settle();
  assert.strictEqual(counts.anim + counts.raf - a0, 0);
});

t('Fast speed: steps come at 0.55x', () => {
  const v = E.view(E.newGame({ seed: 3, kingdom: K, edition: 2, players: [{ name: 'You' }, { name: 'B', bot: S.bigMoney() }] }), 0);
  const n = DomFx.plan(null, v, 0, { fresh: true }), f = DomFx.plan(null, v, 0, { fresh: true, fast: true });
  assert.strictEqual(f.steps[f.steps.length - 1].at, Math.round(n.steps[n.steps.length - 1].at * 0.55));
});

// ---------------------------------------------------------------- (c) game over
t('game over: I win -> celebrate win', async () => {
  freshFX();
  const { spy, rec } = spyFX();
  const g = playGame({ seed: 9, mine: WITCH, theirs: NONE });
  assert.ok(g.last.over && g.last.result.winners[0] === 0);
  runAll(g.steps, spy);
  await settle();
  assert.strictEqual(rec.kinds.filter(k => k !== 'big').join(), 'win');
  assert.ok(rec.kinds.indexOf('big') >= 0, 'my Province buys are big moments');
});

t('game over: I lose -> celebrate lose', async () => {
  freshFX();
  const { spy, rec } = spyFX();
  const g = playGame({ seed: 9, mine: NONE, theirs: S.bigMoney() });
  assert.ok(g.last.over && g.last.result.winners.indexOf(0) < 0);
  runAll(g.steps, spy);
  await settle();
  assert.deepStrictEqual(rec.kinds, ['lose']);
});

t('Celebrations off: no celebration at all', async () => {
  freshFX({ celebrations: false });
  const before = FX.stats.plays, a0 = counts.anim + counts.raf;
  const { spy } = spyFX();
  const g = playGame({ seed: 9, mine: WITCH, theirs: NONE });
  // only the final step, so nothing else adds sounds or motion
  const over = g.steps.find(p => p.events.some(e => e.type === 'over'));
  DomFx.react({ steps: over.steps.filter(s => s.e.type === 'over'), events: [] }, spy, dom, { schedule: sync, me: 0, seats: [] });
  await settle();
  assert.strictEqual(FX.stats.plays - before, 0);
  assert.strictEqual(counts.anim + counts.raf - a0, 0);
});

(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; } catch (e) { console.error('FAIL', name, '\n ', e.message); process.exitCode = 1; }
  }
  console.log(passed + ' / ' + tests.length + ' fx tests passed');
  process.exit();
})();
