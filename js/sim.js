/* Simulator: strategy library, whole-game runner and the "best simple plan" finder.
   Same method as the classic Dominion simulators (Geronimoo's, Dominiate): buy-rule bots
   play thousands of games head to head and we count wins (ties count half). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./cards.js'), require('./engine.js'), require('./bots.js'),
      (function () { try { return require('./strength-data.js'); } catch (e) { return null; } })());
  } else root.DomSim = factory(root.DomCards, root.DomEngine, root.DomBots, root.DomStrength || null);
})(typeof self !== 'undefined' ? self : this, function (Cards, Engine, Bots, Strength) {
  'use strict';
  const { CARDS, is } = Cards;

  const END = [{ card: 'Province' }, { card: 'Duchy', prov: 4 }, { card: 'Estate', prov: 2 }];
  // Hard's tuned endgame: no Province until the deck holds $16 of Treasure (measured +2.7% vs untuned, 4000 games)
  const END_T = [{ card: 'Province', minMoney: 16 }, { card: 'Province', prov: 4 }, { card: 'Duchy', prov: 4 }, { card: 'Estate', prov: 2 }];
  const plural = x => (/y$/.test(x) ? x.slice(0, -1) + 'ies' : /(ch|sh|s)$/.test(x) ? x + 'es' : x + 's');
  function bigMoney() {
    return { id: 'bm', label: 'Big Money', buy: END.concat([{ card: 'Gold' }, { card: 'Duchy', prov: 6 }, { card: 'Silver' }]) };
  }
  // Big Money plus one kingdom card. Terminals (no +Action) are capped so they don't collide.
  function withCard(x, k, tuned) {
    const nonTerm = Bots.NON_TERMINAL.has(x);
    const rules = [];
    // cheap cantrips would crowd out Silver, so they're capped at 2
    if (nonTerm) rules.push({ card: x, upTo: CARDS[x].cost >= 5 ? 8 : 2 });
    else {
      rules.push({ card: x, upTo: 1 });
      if (k >= 2) rules.push({ card: x, upTo: 2, minDeck: 16 });
      if (k >= 3) rules.push({ card: x, upTo: 3, minDeck: 24 });
    }
    const pre = CARDS[x].cost >= 6 ? rules : [];
    const post = CARDS[x].cost >= 6 ? [] : rules;
    const label = nonTerm ? 'Big Money + ' + plural(x) : 'Big Money + ' + (k > 1 ? k + ' ' + plural(x) : x);
    return {
      id: 'bm+' + x + (nonTerm ? '' : ':' + k) + (tuned ? '+t' : ''), label, ppr: !!tuned, key: x,
      buy: (tuned ? END_T : END).concat(pre, [{ card: 'Gold' }, { card: 'Duchy', prov: 6 }], post, [{ card: 'Silver' }]),
    };
  }
  function twoCards(x, y) {
    return {
      id: 'bm+' + x + '+' + y, label: 'Big Money + ' + x + ' + ' + y, ppr: true,
      buy: END_T.concat([{ card: 'Gold' }, { card: 'Duchy', prov: 6 }, { card: x, upTo: 1 }, { card: y, upTo: 1 }, { card: x, upTo: 2, minDeck: 18 }, { card: 'Silver' }]),
    };
  }
  function villageDraw(v, d) {
    return {
      id: 'eng:' + v + '+' + d, label: d + ' + ' + v + ' engine', ppr: true,
      buy: END_T.concat([{ card: 'Gold' }, { card: 'Duchy', prov: 6 }, { card: v, lessThan: d }, { card: d, upTo: 4 }, { card: 'Silver' }]),
    };
  }
  function gardens(g) {
    return {
      id: 'gardens:' + g, label: g + ' / Gardens rush', ppr: true,
      // gainers first, then Gardens (Gardens-first measured 1% vs Big Money, this order 90%; 600 games, 2026-10-19)
      buy: [{ card: 'Province' }, { card: g, upTo: 8 }, { card: 'Gardens' }, { card: 'Duchy', pileLE: ['Gardens', 0] }, { card: g, upTo: 10 },
        { card: 'Estate', pileLE: ['Gardens', 2] }, { card: 'Silver', upTo: 1 }, { card: 'Copper' }],
    };
  }

  // Hard's candidate plans (all with the tuned endgame).
  function candidates(kingdom) {
    const out = [Object.assign(bigMoney(), { id: 'bm+t', ppr: true, buy: END_T.concat([{ card: 'Gold' }, { card: 'Duchy', prov: 6 }, { card: 'Silver' }]) })];
    for (const x of kingdom) {
      if (is(x, 'Victory')) continue;
      if (Bots.NON_TERMINAL.has(x)) out.push(withCard(x, 1, true));
      else { out.push(withCard(x, 1, true)); out.push(withCard(x, 2, true)); }
    }
    // two different terminals: the three best singles by the measured table, paired
    const tab = Strength && Strength.byCard;
    if (tab) {
      const top = kingdom.filter(x => !is(x, 'Victory') && !Bots.NON_TERMINAL.has(x) && tab[x]).sort((a, b) => tab[b].win - tab[a].win).slice(0, 3);
      for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) out.push(twoCards(top[i], top[j]));
    }
    if (kingdom.indexOf('Gardens') >= 0) {
      for (const g of ['Workshop', 'Woodcutter']) if (kingdom.indexOf(g) >= 0) out.push(gardens(g));
    }
    const villages = kingdom.filter(x => x === 'Village' || x === 'Festival');
    const draws = kingdom.filter(x => ['Smithy', 'Council Room', 'Library', 'Witch', 'Moat'].indexOf(x) >= 0);
    for (const v of villages) for (const d of draws) out.push(villageDraw(v, d));
    return out;
  }

  function playGame(kingdom, strats, seed, opts) {
    opts = opts || {};
    const g = new Engine.Game({
      seed, kingdom, edition: opts.edition || 2, quiet: true, maxRounds: opts.maxRounds || 60, first: opts.first,
      players: strats.map((s, i) => ({ name: 'P' + i, bot: s })),
    });
    return g.result;
  }
  // Win share of strategy a vs b over n games (2 players, first seat alternates via the seed).
  function versus(kingdom, a, b, n, seed0, opts) {
    let a1 = 0;
    for (let i = 0; i < n; i++) {
      const swap = i % 2 === 1;
      const r = playGame(kingdom, swap ? [b, a] : [a, b], (seed0 + i * 7919) >>> 0, Object.assign({ first: 0 }, opts));
      const aSeat = swap ? 1 : 0;
      if (r.winners.indexOf(aSeat) >= 0) a1 += 1 / r.winners.length;
    }
    return a1 / n;
  }

  function hashKingdom(k) {
    let h = 2166136261;
    for (const c of k.slice().sort().join('|')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // Best simple plan for a kingdom. Stage 1: every candidate vs Big Money (singles use the
  // measured table when present). Stage 2: the top few play a round robin; best average wins.
  function findBest(kingdom, opts) {
    opts = opts || {};
    const n1 = opts.n1 || 60, n2 = opts.n2 || 120, top = opts.top || 4;
    const seed = hashKingdom(kingdom);
    const bm = bigMoney();
    const cands = candidates(kingdom);
    const table = opts.table === undefined ? (Strength && Strength.byId) : opts.table;
    const scored = [];
    let done = 0;
    for (const c of cands) {
      let w;
      if (c.id === 'bm' || c.id === 'bm+t') w = 0.5;
      else if (table && table[c.id.replace(/\+t$/, '')] != null) w = table[c.id.replace(/\+t$/, '')];
      else w = versus(kingdom, c, bm, n1, seed + done, opts);
      scored.push({ strat: c, vsBM: w });
      done++;
      if (opts.onProgress) opts.onProgress(done / (cands.length + top * (top - 1) / 2));
    }
    scored.sort((a, b) => b.vsBM - a.vsBM);
    const short = scored.slice(0, top);
    const tot = short.map(() => 0);
    let pairs = 0;
    for (let i = 0; i < short.length; i++) {
      for (let j = i + 1; j < short.length; j++) {
        const w = versus(kingdom, short[i].strat, short[j].strat, n2, seed + 1000 + pairs * 31, opts);
        tot[i] += w; tot[j] += 1 - w;
        pairs++;
        if (opts.onProgress) opts.onProgress((cands.length + pairs) / (cands.length + top * (top - 1) / 2));
      }
    }
    short.forEach((s, i) => { s.rr = short.length > 1 ? tot[i] / (short.length - 1) : 1; });
    short.sort((a, b) => b.rr - a.rr);
    return { ranked: short, all: scored };
  }

  // Instant stand-in for Hard while the simulation runs: the best tuned single card by the table.
  function quickPlan(kingdom) {
    const tab = Strength && Strength.byId;
    let best = candidates(kingdom)[0], bw = 0.5;
    for (const c of candidates(kingdom)) {
      const w = tab ? tab[c.id.replace(/\+t$/, '')] : null;
      if (w != null && w > bw) { bw = w; best = c; }
    }
    return best;
  }

  // Medium computer: Big Money + one copy of the kingdom card that measured best on its own.
  function mediumFor(kingdom) {
    let best = null, bw = -1;
    for (const x of kingdom) {
      if (is(x, 'Victory')) continue;
      for (const k of [1]) {
        const s = withCard(x, k);
        const w = Strength && Strength.byId && Strength.byId[s.id] != null ? Strength.byId[s.id] : 0.5;
        if (w > bw) { bw = w; best = s; }
      }
    }
    if (!best || bw <= 0.5) return bigMoney();
    return best;
  }

  // The Hard computer: its plan for this kingdom, plus endgame sense (never ends the game on a losing buy,
  // takes a winning game-ending buy). Old saved games keep their plain plan, so they replay the same.
  const HARD = { smart: true };
  function hardFor(plan) { return Object.assign({}, plan, HARD); }

  // What a plan buys on its first two turns, for the two possible opening splits ($4/$3 and $5/$2).
  function opening(strat, kingdom) {
    const supply = Engine.supplyFor(kingdom, 2);
    const out = {};
    for (const split of [[4, 3], [5, 2]]) {
      const counts = { Copper: 7, Estate: 3, __total: 10 };
      out[split.join('/')] = split.map(coins => {
        const c = Bots.ruleCard(strat, { coins, counts, supply, provScale: 1, g: null });
        if (c) { counts[c] = (counts[c] || 0) + 1; counts.__total++; }
        return c || null;
      });
    }
    return out;
  }

  return { opening, hardFor, HARD, bigMoney, withCard, twoCards, villageDraw, gardens, candidates, playGame, versus, findBest, quickPlan, mediumFor, hashKingdom };
});
