/* Exact odds for the next hand. Cards are drawn without replacement, so the money in a
   5-card hand follows a multivariate hypergeometric distribution: we enumerate how many
   Golds / Silvers / Coppers / others land in the hand and weight each by C(n,k) products.
   Only Treasures count (an Action's +$ depends on how the turn is played). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DomOdds = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const COIN = { Copper: 1, Silver: 2, Gold: 3 };

  function choose(n, k) {
    if (k < 0 || k > n) return 0;
    let r = 1;
    for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return r;
  }
  // groups: {cardName: count}. Returns probs[s] = P(treasure money of k random cards = s).
  function coinDist(groups, k) {
    const c = [0, 0, 0, 0];
    let N = 0;
    for (const name in groups) { const n = groups[name] || 0; c[COIN[name] || 0] += n; N += n; }
    k = Math.min(k, N);
    const out = new Array(3 * k + 1).fill(0);
    const total = choose(N, k);
    if (total === 0) { out[0] = 1; return out; }
    for (let a3 = 0; a3 <= Math.min(k, c[3]); a3++)
      for (let a2 = 0; a2 <= Math.min(k - a3, c[2]); a2++)
        for (let a1 = 0; a1 <= Math.min(k - a3 - a2, c[1]); a1++) {
          const a0 = k - a3 - a2 - a1;
          if (a0 > c[0]) continue;
          const w = choose(c[3], a3) * choose(c[2], a2) * choose(c[1], a1) * choose(c[0], a0);
          out[3 * a3 + 2 * a2 + a1] += w / total;
        }
    return out;
  }
  function shift(dist, by) { return new Array(by).fill(0).concat(dist); }
  function atLeast(dist, x) { let s = 0; for (let i = x; i < dist.length; i++) s += dist[i]; return Math.min(1, s); }
  function mean(dist) { let s = 0; dist.forEach((p, i) => { s += p * i; }); return s; }
  function money(list) { let s = 0; for (const c of list) s += COIN[c] || 0; return s; }
  function add(a, b) { const m = Object.assign({}, a); for (const k in b) m[k] = (m[k] || 0) + b[k]; return m; }

  // From a player's view at any moment of THEIR turn: the hand they'll draw at clean-up.
  // drawCounts: what's left in the draw pile; rest: discard + hand + in play (all discarded at clean-up).
  function nextHand(drawCounts, restCounts, handSize) {
    handSize = handSize || 5;
    let d = 0; for (const k in drawCounts) d += drawCounts[k];
    if (d >= handSize) return { dist: coinDist(drawCounts, handSize), reshuffle: false };
    const fixed = money(Object.keys(drawCounts).reduce((a, k) => a.concat(new Array(drawCounts[k]).fill(k)), []));
    return { dist: shift(coinDist(restCounts, handSize - d), fixed), reshuffle: true, fromDraw: d };
  }
  // Convenience for an engine view (DomEngine.view) of the seat whose turn it is.
  function forView(v) {
    const me = v.me;
    const rest = add(add(me.discardCounts, me.playCounts), countList(me.hand));
    return nextHand(me.drawCounts, rest, 5);
  }
  function countList(list) { const m = {}; for (const c of list) m[c] = (m[c] || 0) + 1; return m; }

  return { coinDist, nextHand, forView, atLeast, mean, money, choose, COIN };
});
