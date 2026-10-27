/* Dominion Lab: sounds + animations driven by what actually happened.
   plan(prev, next, me) compares two DomEngine views (local or an online snapshot) and returns timed steps;
   react(plan, FX, dom) plays them through the shared fx.js (window.FX), which owns every on/off switch.
   Computers move inside the engine, so a whole computer turn arrives at once: the steps space it out. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cards.js'));
  else root.DomFx = factory(root.DomCards);
})(typeof self !== 'undefined' ? self : this, function (Cards) {
  'use strict';
  const { CARDS, is } = Cards;

  // event -> sound (fx.js palette, plus three of our own defined in defineSounds)
  const SOUND = {
    shuffle: 'shuffle', deal: 'cardDeal', play: 'cardFlip', coins: 'coins', buy: 'cardSlide', gain: 'cardSlide',
    province: 'province', move: 'cardFlip', trash: 'trash', attack: 'hit', curse: 'curse', block: 'block',
    steal: 'capture', turn: 'turn', over: null, pileout: 'pileout', endnear: null,
  };
  // ms until the next step (before the Fast factor)
  const GAP = { shuffle: 450, deal: 60, play: 200, coins: 230, buy: 220, gain: 220, province: 320, move: 160,
    trash: 230, attack: 280, curse: 320, block: 260, steal: 240, turn: 0, over: 0, pileout: 320, endnear: 200 };
  const MAX_SPAN = 2600; // a long computer turn is squeezed into this
  const DEAL_MAX = 400; // the hand never waits longer than this to start dealing in

  function defineSounds(FX) {
    // paper crumple: a few low-mid noise crackles
    FX.define('trash', k => { for (let i = 0; i < 6; i++) k.noise({ f: k.rnd(700, 1600), q: 1.5, dur: 0.05, vol: 0.32, at: i * 0.04 + k.rnd(0, 0.015) }); k.noise({ f: 400, filter: 'lowpass', dur: 0.2, vol: 0.2, at: 0.05 }); }, 'moves');
    // curse: a low, slightly sour falling pair
    FX.define('curse', k => { k.tone({ f: 311, f2: 277, dur: 0.32, vol: 0.14, type: 'triangle', lp: 1400 }); k.tone({ f: 220, f2: 185, dur: 0.45, vol: 0.14, type: 'triangle', lp: 1200, at: 0.18 }); k.noise({ f: 300, filter: 'lowpass', dur: 0.5, a: 0.1, vol: 0.12 }); }, 'moves');
    // Moat block: a shield clank
    // Province: a bright rising four-note chime over the card slide (key moment, 2026-10-27)
    FX.define('province', k => { k.noise({ f: 2200, q: 0.8, dur: 0.12, vol: 0.18 }); [523, 659, 784, 1047].forEach((f, i) => k.tone({ f, dur: 0.38 - i * 0.04, vol: 0.12, type: 'triangle', at: 0.06 + i * 0.07 })); }, 'moves');
    // a Supply pile runs out: a low drum thud
    FX.define('pileout', k => { k.tone({ f: 120, f2: 60, dur: 0.35, vol: 0.32 }); k.noise({ f: 500, filter: 'lowpass', dur: 0.2, vol: 0.25 }); }, 'moves');
    FX.define('block', k => { k.tone({ f: 740, f2: 700, dur: 0.25, vol: 0.12, type: 'triangle' }); k.tone({ f: 1910, dur: 0.15, vol: 0.05 }); k.noise({ f: 3000, q: 2, dur: 0.04, vol: 0.3 }); }, 'moves');
  }

  const key = e => e.r + '|' + e.p + '|' + e.text;
  // The log in a view is the last 60 lines: find the lines that are new since `a`.
  function newLog(a, b) {
    a = a || []; b = b || [];
    for (let d = 0; d <= b.length; d++) {
      const n = b.length - d;
      if (n > a.length) continue;
      let ok = true;
      for (let i = 0; i < n; i++) if (key(b[i]) !== key(a[a.length - n + i])) { ok = false; break; }
      if (ok) return b.slice(n);
    }
    return b.slice();
  }
  const splitCards = s => s.split(', ').map(x => x.trim()).filter(Boolean);
  const vpOf = c => (c === 'Curse' ? -1 : CARDS[c] && CARDS[c].vp ? CARDS[c].vp : 0);
  const myTurns = (v, me) => v.turns.filter(t => t.seat === me).length;
  // how many hand cards the screen deals in (same rule as renderGame)
  function dealCount(prev, next, me) {
    if (!next.me) return 0;
    if (!prev || !prev.me || myTurns(prev, me) !== myTurns(next, me)) return next.me.hand.length;
    return Math.max(0, next.me.hand.length - prev.me.hand.length);
  }

  // events in the order they happened
  function events(prev, next, me, o) {
    o = o || {};
    const ev = [];
    if (!next || !next.log || !next.turns) return ev;
    const dealN = o.dealN != null ? o.dealN : dealCount(prev, next, me);
    if (o.fresh || !prev || !prev.turns || next.turns.length < prev.turns.length) {
      if (o.fresh) {
        ev.push({ type: 'shuffle', seat: me });
        if (dealN) ev.push({ type: 'deal', seat: me, n: dealN });
        // a hand with no Actions goes straight to Buy: its Treasures are already in play
        if (next.cur === me && next.phase === 'buy' && next.coins > 0) ev.push({ type: 'coins', seat: me, n: next.coins });
      }
      return ev;
    }
    const lines = newLog(prev.log, next.log);
    const pt = prev.turns, nt = next.turns;
    // turns whose coins/buys can have changed: the last one we knew about and every new one
    const cand = [];
    for (let i = Math.max(0, pt.length - 1); i < nt.length; i++) cand.push(i);
    const used = {};
    const turnDiff = i => {
      const a = pt[i] || { coins: 0, bought: [] }, b = nt[i], out = [];
      if (!(a.coins > 0) && b.coins > 0) out.push({ type: 'coins', seat: b.seat, n: b.coins });
      for (let k = (a.bought || []).length; k < b.bought.length; k++) {
        const c = b.bought[k];
        out.push({ type: c === 'Province' ? 'province' : 'buy', seat: b.seat, card: c });
      }
      used[i] = true;
      return out;
    };
    // who's turn it is, for telling an attacker from its victims
    let actor = null;
    for (let i = (prev.log || []).length - 1; i >= 0; i--) {
      const l = prev.log[i];
      if (l.p >= 0 && /^played /.test(l.text)) { actor = l.p; break; }
      if (l.p >= 0 && /^bought /.test(l.text)) break;
    }
    let dealDue = false;
    const flushDeal = () => { if (dealDue && dealN) ev.push({ type: 'deal', seat: me, n: dealN }); dealDue = false; };
    for (const l of lines) {
      const t = l.text, p = l.p;
      if (dealDue && !(p === me && t === 'shuffled')) flushDeal();
      if (/^Game over/.test(t)) continue;
      if (t === 'shuffled') { ev.push({ type: 'shuffle', seat: p }); if (p === me) flushDeal(); continue; }
      let m;
      if ((m = /^played (.+?)( twice)?$/.exec(t))) {
        actor = p;
        const card = m[1];
        ev.push({ type: 'play', seat: p, card });
        if (CARDS[card] && is(card, 'Attack') && !m[2]) ev.push({ type: 'attack', seat: p, card, onMe: p !== me });
        continue;
      }
      if (/^bought /.test(t)) {
        const i = cand.find(j => !used[j] && nt[j].seat === p);
        if (i != null) ev.push(...turnDiff(i));
        if (p === me) dealDue = true; // my cleanup draws my next hand right after
        actor = null;
        continue;
      }
      const victim = actor != null && p !== actor;
      if (t === 'blocked it with Moat') { ev.push({ type: 'block', seat: p }); continue; }
      if (t === 'gained a Curse') { ev.push({ type: 'curse', seat: p, card: 'Curse' }); continue; }
      if ((m = /^gained (.+?)( onto deck)?$/.exec(t))) { ev.push({ type: 'gain', seat: p, card: m[1] }); continue; }
      if ((m = /^stole (.+)$/.exec(t))) { ev.push({ type: 'steal', seat: p, card: m[1] }); continue; }
      if (t === 'trashed Copper for $3') { ev.push({ type: 'trash', seat: p, n: 1 }, { type: 'coins', seat: p, n: 3, add: true }); continue; }
      if ((m = /^(trashed|lost) (.+)$/.exec(t))) { ev.push({ type: 'trash', seat: p, n: splitCards(m[2]).length }); continue; }
      if (/^discarded and drew/.test(t)) { ev.push({ type: 'move', seat: p }); continue; }
      if (/^(discarded|put |had .+ discarded)/.test(t)) { ev.push({ type: 'move', seat: p, victim }); continue; }
    }
    for (const i of cand) if (!used[i]) ev.push(...turnDiff(i));
    flushDeal();
    // a deal with no log line behind it (Smithy, Moat, Library...) or my new turn online
    if (dealN && !ev.some(e => e.type === 'deal')) ev.push({ type: 'deal', seat: me, n: dealN });
    // key moments: a Supply pile runs out, and the Provinces get down to the last two
    if (prev.supply && next.supply) {
      for (const c of Object.keys(next.supply)) if (prev.supply[c] > 0 && next.supply[c] === 0 && !(c === 'Province' && next.over)) ev.push({ type: 'pileout', card: c });
      if (!next.over && prev.supply.Province > 2 && next.supply.Province <= 2 && next.supply.Province > 0) ev.push({ type: 'endnear', card: 'Province' });
    }
    if (next.over && !prev.over) {
      const w = next.result ? next.result.winners : [];
      ev.push({ type: 'over', kind: w.indexOf(me) >= 0 ? 'win' : 'lose', winners: w });
    } else if (!next.over && next.pending && prev && !prev.pending && next.cur === me &&
      (next.pending.kind === 'action' || next.pending.kind === 'buy')) ev.push({ type: 'turn', seat: me });
    return ev;
  }

  // timed steps; deal steps also tell the screen when to start its deal-in animation
  function plan(prev, next, me, o) {
    o = o || {};
    const sp = o.fast ? 0.55 : 1;
    const ev = events(prev, next, me, o);
    const raw = [];
    let t = 0, dealAt = 0;
    for (const e of ev) {
      if (e.type === 'deal') {
        const at = Math.min(t, DEAL_MAX);
        dealAt = Math.round(at * sp);
        for (let i = 0; i < e.n; i++) raw.push({ at: at + i * GAP.deal, e, sound: SOUND.deal, vol: 0.8 });
        continue;
      }
      const other = e.seat != null && e.seat !== me;
      let vol = other ? 0.75 : 1; // computers and friends: same sounds, never louder than yours
      if (e.type === 'attack') vol = e.onMe ? 1 : 0.55;
      if (e.type === 'move' && !e.victim) vol *= 0.7;
      raw.push({ at: t, e, sound: SOUND[e.type], vol });
      t += GAP[e.type] || 160;
    }
    const span = Math.max(1, ...raw.map(s => s.at));
    const squeeze = span > MAX_SPAN ? MAX_SPAN / span : 1;
    const steps = raw.map(s => Object.assign(s, { at: Math.round((s.e.type === 'deal' ? s.at : s.at * squeeze) * sp) }));
    return { steps, events: ev, dealAt, snap: snap(next) };
  }
  // A view shares its turn records with the live game, which keeps changing: keep a frozen copy as "prev".
  function snap(v) {
    if (!v) return null;
    return {
      log: (v.log || []).slice(), supply: v.supply ? Object.assign({}, v.supply) : null, cur: v.cur, phase: v.phase, coins: v.coins, over: v.over, result: v.result,
      pending: v.pending ? { kind: v.pending.kind } : null,
      turns: (v.turns || []).map(t => ({ seat: t.seat, coins: t.coins, bought: (t.bought || []).slice() })),
      me: v.me ? { hand: v.me.hand.slice() } : null,
    };
  }

  // ---------------------------------------------------------------- run the steps
  let timers = [];
  function react(pl, FX, dom, o) {
    o = o || {};
    if (!pl || !pl.steps.length || !FX) return;
    const later = o.schedule || ((fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); });
    if (!o.schedule) { timers.forEach(clearTimeout); timers = []; }
    const me = o.me || 0;
    for (const s of pl.steps) later(() => { try { run(s, FX, dom || {}, me, o); } catch (e) { /* effects never break the game */ } }, s.at);
  }
  const get = (dom, k, a) => (dom[k] ? dom[k](a) : null);
  function run(s, FX, dom, me, o) {
    const e = s.e;
    if (s.sound) FX.play(s.sound, { vol: s.vol });
    switch (e.type) {
      case 'buy': case 'gain': case 'province': case 'steal': {
        // bought and gained cards land on the discard pile, as on the real table
        const from = get(dom, 'tile', e.card), to = e.seat === me ? (get(dom, 'discard') || get(dom, 'deck')) : (get(dom, 'pile', e.seat) || get(dom, 'chip', e.seat));
        if (from && to && e.type !== 'steal') FX.flyTo(from, to, { fade: true, duration: 460 });
        const d = vpOf(e.card);
        if (d) FX.floatText(get(dom, 'chip', e.seat), (d > 0 ? '+' : '') + d, d > 0 ? 'var(--good)' : 'var(--bad)');
        if (e.type === 'province') {
          if (e.seat === me) FX.celebrate({ kind: 'big', at: from || get(dom, 'chip', me), colors: o.colors });
          else FX.pop(get(dom, 'prov'));
        }
        break;
      }
      case 'coins': if (e.seat === me) { const c = get(dom, 'coins'); if (c) FX.countUp(c, e.add ? Math.max(0, Number(c.textContent) - e.n) : 0, Number(c.textContent) || e.n, { duration: 450 }); } break;
      case 'shuffle': if (e.seat === me) FX.pop(get(dom, 'deck')); break;
      case 'attack':
        if (e.onMe) FX.shake(get(dom, 'hand'));
        else (o.seats || []).filter(x => x !== e.seat).forEach(x => FX.shake(get(dom, 'chip', x)));
        break;
      case 'curse': FX.flash(get(dom, 'chip', e.seat), 'var(--t-curse)'); FX.floatText(get(dom, 'chip', e.seat), '-1', 'var(--bad)'); break;
      case 'block': FX.pop(get(dom, 'chip', e.seat)); break;
      case 'pileout': { const t = get(dom, 'tile', e.card); FX.flash(t, 'var(--bad)'); FX.shake(t); break; }
      case 'endnear': { const pv = get(dom, 'prov'); FX.flash(pv, 'var(--accent-warm)'); FX.pulse(pv); break; }
      case 'turn': FX.flash(get(dom, 'info'), 'var(--accent-warm)'); break;
      case 'over': {
        // VP count-up on every chip, then the win or lose moment
        const ups = (o.seats || []).map(x => { const el = get(dom, 'chipVP', x); return el ? FX.countUp(el, 0, Number(el.textContent) || 0, { duration: 900 }) : null; });
        Promise.all(ups).then(() => FX.celebrate({ kind: e.kind, colors: o.colors }));
        break;
      }
    }
  }

  return { plan, events, react, newLog, dealCount, defineSounds, snap, SOUND };
});
