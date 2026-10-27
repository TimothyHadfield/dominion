/* domprofile.js: Dominion's part of the player profile (shared kit js/profile.js, never edit that one here):
   the computer levels' ratings, the achievements, the Daily game and turning a game into a result.

   What counts as one game: a whole game vs computers. Leaving before the end counts as a loss.
   A game where you used Undo counts as "with help" and isn't rated. The guided first game and online
   games aren't counted. Plain script: window.DomProfile in the browser, module.exports in node. */
(function (root) {
  'use strict';
  // Elo of each level from head-to-head games (tools/measure-levels.js, progress.md):
  // difference = 400·log10(p / (1 − p)), rounded to 10, Easy anchored at 1200. Ladder of 2026-10-27 (6,000 games a pair):
  // Medium beats Easy 76.8% (+208), Hard beats Medium 59.9% (+70) and Easy 82.3% (+267): Hard = mean of 1478 and 1467.
  const LEVELS = [{ id: 'easy', name: 'Easy', rating: 1200 }, { id: 'medium', name: 'Medium', rating: 1410 }, { id: 'hard', name: 'Hard', rating: 1470 }];
  const RANK = { easy: 0, medium: 1, hard: 2 };

  const won = c => !!(c.last && c.last.won);
  const ex = c => (c.last && c.last.extra) || {};
  const ACH = [
    { id: 'first', title: 'First win', desc: 'Win a game of Dominion', test: c => c.stats.wins >= 1 },
    { id: 'medium', title: 'Landholder', desc: 'Win against Medium', test: c => won(c) && RANK[c.last.level] >= 1 },
    { id: 'hard', title: 'Crowned', desc: 'Win against Hard', test: c => won(c) && c.last.level === 'hard' },
    { id: 'table', title: 'Full table', desc: 'Win against 3 computers', test: c => won(c) && ex(c).opps >= 3 },
    { id: 'double', title: 'Double Province', desc: 'Buy 2 Provinces in one turn', test: c => ex(c).bestTurn >= 2 },
    { id: 'six', title: 'Six Provinces', desc: 'Own 6 Provinces at the end of a game', test: c => ex(c).provinces >= 6 },
    { id: 'landslide', title: 'Landslide', desc: 'Win by 20 points or more', test: c => won(c) && ex(c).margin >= 20 },
    { id: 'gardens', title: 'Green thumb', desc: 'Win with 4 or more Gardens', test: c => won(c) && ex(c).gardens >= 4 },
    { id: 'streak', title: 'Hat trick', desc: 'Win 3 in a row', test: c => c.stats.bestStreak >= 3 },
    { id: 'daily', title: 'Daily ruler', desc: '3-day Daily streak', test: c => c.daily.streak >= 3 },
  ];

  // Today's Daily game: the same 2nd-edition kingdom and the same shuffles for everyone that day, you vs 1 Hard.
  const DAILY = { level: 'hard', opps: 1, edition: 2 };

  function init(onDaily) {
    if (!root.Profile) return false;
    root.Profile.init({
      game: 'dominion', levels: LEVELS, achievements: ACH, draws: true,
      modes: { computer: { name: 'vs computer' }, help: { name: 'With help' }, online: { hide: true } },
      daily: { title: 'Daily kingdom', onPlay: () => onDaily && onDaily() },
    });
    return true;
  }

  /** Today's kingdom: 10 cards drawn with the day's seeded random numbers (same list for everyone). */
  function dailyKingdom(pool, rng) {
    const p = pool.slice().sort();
    for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    return p.slice(0, 10);
  }

  /** What a game adds up to for me, from the engine's view (v = DomEngine.view(state, me)). */
  function summary(v, me) {
    const mine = v.players[me];
    let opp = -Infinity;
    v.players.forEach(pl => { if (pl.seat !== me) opp = Math.max(opp, pl.vp); });
    let bestTurn = 0;
    v.turns.forEach(t => { if (t.seat === me) bestTurn = Math.max(bestTurn, t.bought.filter(c => c === 'Province').length); });
    return {
      vp: mine.vp, margin: mine.vp - opp, opps: v.players.length - 1, bestTurn,
      provinces: mine.owned.Province || 0, gardens: mine.owned.Gardens || 0, curses: mine.owned.Curse || 0, turns: mine.turns,
    };
  }

  /** A finished (or abandoned) game -> Profile.recordResult input. g: { v, me, level, helped, daily } */
  function result(g) {
    const v = g.v, me = g.me;
    let w = false, draw = false;
    if (v.over && v.result) {
      const win = v.result.winners;
      if (win.indexOf(me) >= 0) { if (win.length > 1) draw = true; else w = true; }
    }
    const mode = g.helped ? 'help' : 'computer';
    const extra = summary(v, me);
    if (!v.over) extra.quit = true;
    return { mode, level: mode === 'computer' ? g.level : null, won: w, draw, score: extra.vp, daily: !!g.daily, extra };
  }

  const api = { LEVELS, ACH, DAILY, RANK, init, dailyKingdom, summary, result };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DomProfile = api;
})(typeof window !== 'undefined' ? window : globalThis);
