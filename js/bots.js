/* Computer players. A strategy is plain JSON (so it can be saved and sent online):
     { id, label, ppr, buy: [ rule, ... ] }
   A rule buys `card` when it is affordable and in the Supply, and every condition holds:
     prov: n       only when Provinces left <= n (scaled for 3-4 players' 12 Provinces)
     upTo: n       only while you own fewer than n
     minDeck: n    only once your deck has at least n cards
     lessThan: X   only while you own fewer of this card than of card X
     pileLE: [X,n] only when pile X has n or fewer left
   The first rule that passes is bought (the classic "buy rules" bot from the Dominion simulators).
   Play decisions are shared by every strategy: a fixed play order plus a sensible answer per card. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cards.js'));
  else root.DomBots = factory(root.DomCards);
})(typeof self !== 'undefined' ? self : this, function (Cards) {
  'use strict';
  const { CARDS, is } = Cards;

  const PLAY_ORDER = ['Throne Room', 'Festival', 'Village', 'Laboratory', 'Market', 'Merchant', 'Poacher', 'Sentry',
    'Spy', 'Harbinger', 'Cellar', 'Witch', 'Council Room', 'Library', 'Smithy', 'Adventurer', 'Bandit', 'Militia',
    'Thief', 'Moneylender', 'Mine', 'Artisan', 'Remodel', 'Bureaucrat', 'Feast', 'Workshop', 'Woodcutter',
    'Chancellor', 'Vassal', 'Moat', 'Chapel'];
  const NON_TERMINAL = new Set(['Cellar', 'Harbinger', 'Merchant', 'Village', 'Poacher', 'Festival', 'Laboratory',
    'Market', 'Sentry', 'Spy', 'Throne Room']);

  function countOf(p, name) {
    let k = 0;
    for (const a of [p.draw, p.hand, p.discard, p.play]) for (const c of a) if (c === name) k++;
    return k;
  }
  function deckCounts(p) {
    const m = {}; let n = 0;
    for (const a of [p.draw, p.hand, p.discard, p.play]) for (const c of a) { m[c] = (m[c] || 0) + 1; n++; }
    m.__total = n;
    return m;
  }
  function vpFromCounts(m) {
    let v = 0;
    for (const k in m) {
      if (k === '__total') continue;
      if (k === 'Gardens') v += m[k] * Math.floor(m.__total / 10);
      else if (CARDS[k].vp) v += CARDS[k].vp * m[k];
    }
    return v;
  }

  // total Treasure money in a deck (minMoney rule: don't start greening a thin deck)
  function money(m) { return (m.Copper || 0) + 2 * (m.Silver || 0) + 3 * (m.Gold || 0); }
  // ctx: { coins, counts, supply, provScale, g, p, filter }
  function ruleCard(strat, ctx) {
    const prov = ctx.supply.Province;
    for (const r of strat.buy) {
      const c = CARDS[r.card];
      if (!c || c.cost > ctx.coins || !(ctx.supply[r.card] > 0)) continue;
      if (ctx.filter && !is(r.card, ctx.filter)) continue;
      if (r.prov != null && prov > Math.round(r.prov * ctx.provScale)) continue;
      const have = ctx.counts[r.card] || 0;
      if (r.upTo != null && have >= r.upTo) continue;
      if (r.minDeck != null && ctx.counts.__total < r.minDeck) continue;
      if (r.lessThan && have >= (ctx.counts[r.lessThan] || 0)) continue;
      if (r.pileLE && (ctx.supply[r.pileLE[0]] || 0) > r.pileLE[1]) continue;
      if (r.minMoney != null && money(ctx.counts) < r.minMoney) continue;
      if (strat.ppr && r.card === 'Province' && ctx.g && !pprOk(ctx)) continue;
      return r.card;
    }
    return null;
  }
  // Last-Province rule: never end the game on a Province buy you'd still lose.
  function pprOk(ctx) {
    const { g, p } = ctx;
    const mine = vpFromCounts(ctx.counts);
    let opp = -Infinity;
    for (const o of g.players) if (o !== p) opp = Math.max(opp, g.vp(o));
    // (A "don't take the second-last while behind" rule measured worse: 42% vs plain Big Money.)
    if (ctx.supply.Province === 1) return mine + 6 > opp;
    return true;
  }
  function ctxFor(g, p, coins) {
    return { coins, counts: deckCounts(p), supply: g.supply, provScale: g.startProvinces / 8, g, p };
  }
  function chooseBuy(strat, g, p) {
    const ctx = ctxFor(g, p, g.coins);
    return strat.smart ? smartBuy(strat, ctx) : ruleCard(strat, ctx);
  }

  // ---- Hard's endgame sense (strategies with smart: true) ----
  // Score race if the game ended right after this player gains `card` (null = gains nothing):
  // 1 = win, 0.5 = shared win, 0 = loss. Ties go to the player with fewer turns (the real rule).
  function endOutcome(g, p, card) {
    const m = deckCounts(p);
    if (card) { m[card] = (m[card] || 0) + 1; m.__total++; }
    const mine = vpFromCounts(m);
    let res = 1;
    for (const o of g.players) {
      if (o === p) continue;
      const v = g.vp(o);
      if (v > mine) return 0;
      if (v === mine) {
        if (o.turns < p.turns) return 0;
        if (o.turns === p.turns) res = 0.5;
      }
    }
    return res;
  }
  function endsGame(g, card) {
    const s = g.supply;
    if (card === 'Province' && s.Province === 1) return true;
    let empty = 0;
    for (const k in s) if (s[k] === 0 || (k === card && s[k] === 1)) empty++;
    return empty >= (g.n >= 5 ? 4 : 3);
  }
  function affordable(g, coins) {
    return Object.keys(g.supply).filter(n => g.supply[n] > 0 && CARDS[n].cost <= coins);
  }
  function smartBuy(strat, ctx) {
    const { g, p } = ctx;
    const opts = affordable(g, ctx.coins);
    // 1. Take a game-ending gain that wins (most points first).
    let best = null, bv = -1;
    for (const c of opts) {
      if (!endsGame(g, c)) continue;
      const o = endOutcome(g, p, c);
      const v = o * 100 + (CARDS[c].vp || 0);
      if (o === 1 && v > bv) { bv = v; best = c; }
    }
    if (best) return best;
    // 2. Never end the game on a buy we'd lose; walk down the plan instead.
    const banned = new Set(opts.filter(c => endsGame(g, c) && endOutcome(g, p, c) < 0.5));
    const sub = Object.assign({}, ctx, { supply: Object.assign({}, ctx.supply) });
    for (const c of banned) sub.supply[c] = 0;
    return ruleCard(strat, sub);
  }

  // The whole buy phase this strategy would make with `coins` and `buys` (used for hints and study).
  function planBuys(strat, g, p, coins, buys) {
    const ctx = ctxFor(g, p, coins);
    ctx.supply = Object.assign({}, g.supply);
    ctx.g = null; // PPR uses live scores; keep the plan simple
    const out = [];
    for (let b = 0; b < buys; b++) {
      const c = ruleCard(strat, ctx);
      if (!c) break;
      out.push(c);
      ctx.coins -= CARDS[c].cost;
      ctx.supply[c]--;
      ctx.counts[c] = (ctx.counts[c] || 0) + 1;
      ctx.counts.__total++;
    }
    if (strat.ppr && out[0] === 'Province') {
      const live = ruleCard(strat, ctxFor(g, p, coins));
      if (live !== 'Province') out[0] = live;
    }
    return out.filter(Boolean);
  }

  // How much a card is worth keeping in hand right now (higher = keep).
  function keepValue(c, g) {
    if (c === 'Curse') return -3;
    if (is(c, 'Victory') && !is(c, 'Action')) return -2;
    if (c === 'Copper') return 1;
    if (c === 'Silver') return 3;
    if (c === 'Gold') return 6;
    return Math.min(5, CARDS[c].cost) + (NON_TERMINAL.has(c) ? 0.5 : 0);
  }
  function lowestIdx(hand, k, g) {
    return hand.map((c, i) => [keepValue(c, g), i]).sort((a, b) => a[0] - b[0]).slice(0, k).map(x => x[1]);
  }
  function lateGame(g) { return g.supply.Province <= Math.round(3 * g.startProvinces / 8); }

  function chooseAction(g, p) {
    const hand = p.hand;
    const acts = hand.filter(c => is(c, 'Action'));
    const terminals = acts.filter(c => !NON_TERMINAL.has(c));
    for (const name of PLAY_ORDER) {
      const i = hand.indexOf(name);
      if (i < 0) continue;
      if (name === 'Throne Room' && !acts.some(c => c !== 'Throne Room')) continue;
      if (name === 'Moneylender' && hand.indexOf('Copper') < 0) continue;
      if (name === 'Mine' && !hand.some(c => c === 'Copper' || c === 'Silver')) continue;
      if (name === 'Chapel' && !hand.some(c => c === 'Curse' || c === 'Estate' || c === 'Copper')) continue;
      // Remodel only when there's something worth remodelling
      if (name === 'Remodel' && !hand.some(c => c === 'Curse' || c === 'Estate' || (c === 'Gold' && lateGame(g)))) continue;
      return i;
    }
    return -1;
  }

  function gainChoice(req, g, p) {
    const strat = p.bot || {};
    const ctx = ctxFor(g, p, req.maxCost);
    ctx.filter = req.filter;
    let c = strat.buy ? ruleCard(strat, ctx) : null;
    if (!c) {
      // fallback: the most useful card we're allowed
      const opts = g.gainOptions(req);
      // Treasures first (a Silver beats an unplanned Action); Victory cards only late.
      const score = n => (n === 'Curse' ? -9 : is(n, 'Victory') ? (lateGame(g) ? CARDS[n].cost + 3 : -1)
        : is(n, 'Treasure') ? CARDS[n].cost * 2 + 1 : CARDS[n].cost - 2);
      opts.sort((a, b) => score(b) - score(a));
      c = opts[0] || null;
      if (c && score(c) < 0 && req.optional) c = null;
    }
    return c;
  }

  function decide(req, g, p) {
    const hand = p.hand;
    switch (req.kind) {
      case 'action': return chooseAction(g, p);
      case 'buy': return p.bot && p.bot.buy ? chooseBuy(p.bot, g, p) : null;
      case 'gain': return gainChoice(req, g, p);
      case 'yesno':
        switch (req.reason) {
          case 'library': return g.actions === 0;
          case 'spy': {
            const bad = req.card === 'Curse' || is(req.card, 'Victory') || req.card === 'Copper';
            return req.target === p.i ? bad : !bad;
          }
          case 'thief-gain': return req.card !== 'Copper';
          default: return true; // moat, vassal, moneylender, chancellor
        }
      case 'pickHand': {
        const idx = (pred) => hand.map((c, i) => (pred(c) ? i : -1)).filter(i => i >= 0);
        switch (req.reason) {
          case 'cellar': return idx(c => c === 'Curse' || (is(c, 'Victory') && !is(c, 'Action')));
          case 'chapel': {
            const m = deckCounts(p);
            const money = (m.Silver || 0) * 2 + (m.Gold || 0) * 3;
            const out = idx(c => c === 'Curse').concat(lateGame(g) ? [] : idx(c => c === 'Estate'));
            let cop = idx(c => c === 'Copper');
            if (money < 6) cop = cop.slice(0, Math.max(0, (m.Copper || 0) - 3));
            return out.concat(cop).slice(0, req.max);
          }
          case 'militia': case 'poacher': return lowestIdx(hand, req.min, g);
          case 'bureaucrat': return [hand.findIndex(c => is(c, 'Victory'))];
          case 'throne': {
            for (const name of PLAY_ORDER) if (name !== 'Throne Room' && hand.indexOf(name) >= 0) return [hand.indexOf(name)];
            const i = hand.findIndex(c => is(c, 'Action'));
            return req.min || i >= 0 ? [i] : [];
          }
          case 'mine': {
            if (hand.indexOf('Silver') >= 0 && g.supply.Gold > 0) return [hand.indexOf('Silver')];
            if (hand.indexOf('Copper') >= 0 && g.supply.Silver > 0) return [hand.indexOf('Copper')];
            return req.min ? [hand.findIndex(c => is(c, 'Treasure'))] : [];
          }
          case 'remodel': {
            if (hand.indexOf('Gold') >= 0 && g.supply.Province > 0 && lateGame(g)) return [hand.indexOf('Gold')];
            for (const c of ['Curse', 'Estate']) if (hand.indexOf(c) >= 0) return [hand.indexOf(c)];
            return lowestIdx(hand, 1, g);
          }
          case 'artisan-top': {
            if (g.actions === 0) { const i = hand.findIndex(c => is(c, 'Action')); if (i >= 0) return [i]; }
            // topdeck the best Treasure we can spare without dropping this turn's buy tier
            const coin = g.coins + hand.reduce((s, c) => s + (CARDS[c].coin || 0), 0);
            const tier = x => (x >= 8 ? 4 : x >= 6 ? 3 : x >= 5 ? 2 : x >= 3 ? 1 : 0);
            let best = -1, bv = -1;
            hand.forEach((c, i) => {
              const v = CARDS[c].coin || 0;
              if (v && tier(coin - v) === tier(coin) && v > bv) { bv = v; best = i; }
            });
            if (best >= 0) return [best];
            const nonVic = hand.map((c, i) => i).filter(i => !(is(hand[i], 'Victory') || hand[i] === 'Curse'));
            if (nonVic.length) return [nonVic.sort((a, b) => keepValue(hand[a], g) - keepValue(hand[b], g))[0]];
            return [0];
          }
          default: return lowestIdx(hand, req.min, g);
        }
      }
      case 'pickList': {
        const cards = req.cards;
        switch (req.reason) {
          case 'harbinger': {
            let best = -1, bv = 2.5;
            cards.forEach((c, i) => { const v = keepValue(c, g); if (v > bv) { bv = v; best = i; } });
            return best >= 0 ? [best] : [];
          }
          case 'sentry-trash': {
            const m = deckCounts(p);
            const money = (m.Silver || 0) * 2 + (m.Gold || 0) * 3;
            return cards.map((c, i) => [c, i]).filter(([c]) => c === 'Curse' || (c === 'Estate' && !lateGame(g)) ||
              (c === 'Copper' && money >= 6)).map(x => x[1]);
          }
          case 'sentry-discard': return cards.map((c, i) => [c, i]).filter(([c]) => keepValue(c, g) < 0 || c === 'Copper').map(x => x[1]);
          case 'sentry-top': return [keepValue(cards[0], g) >= keepValue(cards[1], g) ? 0 : 1];
          case 'bandit': { // victim gives up the cheaper treasure
            const only = req.only || cards.map((c, i) => i);
            return [only.slice().sort((a, b) => CARDS[cards[a]].cost - CARDS[cards[b]].cost)[0]];
          }
          case 'thief': {
            const only = req.only || cards.map((c, i) => i);
            return [only.slice().sort((a, b) => CARDS[cards[b]].cost - CARDS[cards[a]].cost)[0]];
          }
          default: return cards.slice(0, req.min).map((c, i) => i);
        }
      }
    }
    return null;
  }

  return { decide, planBuys, chooseBuy, ruleCard, smartBuy, endOutcome, endsGame, keepValue, PLAY_ORDER, NON_TERMINAL, deckCounts };
});
