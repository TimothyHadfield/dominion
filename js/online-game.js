/* The Dominion engine as the shared online module's `game` object (see _online/README.md).
   State stays {v, setup, actions}: replaying the actions from the seed rebuilds the game exactly.
   Computers chosen before the start are answered inside the engine (no extra Firestore writes);
   game.bot only covers a seat handed to a computer mid-game. publicView never holds the seed or
   anyone's hand or draw order. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./cards.js'), require('./engine.js'), require('./bots.js'), require('./sim.js'));
  } else root.DomOnlineGame = factory(root.DomCards, root.DomEngine, root.DomBots, root.DomSim);
})(typeof self !== 'undefined' ? self : this, function (Cards, Engine, Bots, Sim) {
  'use strict';
  const { CARDS } = Cards;

  // online.js hands us fresh copies; this memo lets them reuse the cached live game instead of replaying.
  let memo = { key: null, state: null };
  function canon(state) {
    const key = JSON.stringify(state);
    if (memo.key === key) return memo.state;
    memo = { key, state };
    return state;
  }
  const live = state => Engine.materialize(canon(state));

  function cleanKingdom(k) {
    const ok = Array.isArray(k) && k.length === 10 && new Set(k).size === 10 &&
      k.every(c => CARDS[c] && !Cards.BASICS.includes(c));
    return ok ? k.slice() : Cards.PRESETS[0].cards.slice();
  }
  const isPlan = p => p && typeof p === 'object' && Array.isArray(p.buy) && p.buy.every(r => r && CARDS[r.card]);

  const game = {
    id: 'dominion',
    minSeats: 2,
    maxSeats: 4,
    // options: {kingdom, edition, level: 'easy'|'medium'|'hard', plan}
    setup(nSeats, options, rng, seats) {
      const o = options || {};
      const kingdom = cleanKingdom(o.kingdom);
      const best = isPlan(o.plan) ? o.plan : Sim.quickPlan(kingdom);
      const level = o.level === 'easy' || o.level === 'medium' ? o.level : 'hard';
      const comp = () => (level === 'easy' ? Sim.bigMoney() : level === 'medium' ? Sim.mediumFor(kingdom) : best);
      const players = [];
      for (let i = 0; i < nSeats; i++) {
        const s = (seats && seats[i]) || { kind: 'computer' };
        players.push({ name: String(s.name || 'Player ' + (i + 1)).slice(0, 24), bot: s.kind === 'computer' ? comp() : null });
      }
      return Engine.newGame({
        seed: Math.floor(rng() * 4294967296) >>> 0, kingdom, edition: o.edition === 1 ? 1 : 2,
        players, advisor: best, maxRounds: 80,
      });
    },
    toAct(state) {
      const g = live(state);
      return !g.over && g.pending ? [g.pending.player] : [];
    },
    // action = {answer}; throws on anything illegal (engine validates)
    apply(state, seat, action) {
      if (!action || typeof action !== 'object' || !('answer' in action)) throw new Error('Bad move');
      const next = Engine.apply(canon(state), { seat, answer: action.answer });
      memo = { key: JSON.stringify(next), state: next };
      return next;
    },
    publicView(state) {
      const v = Engine.view(canon(state), -1);
      delete v.me; delete v.pending; delete v.seat;
      return v;
    },
    privateView(state, seat) {
      const v = Engine.view(canon(state), seat);
      return { me: v.me, pending: v.pending };
    },
    bot(ctx, seat) {
      const g = live(ctx.state);
      const req = g.pending;
      const strat = ctx.state.setup.players[seat].bot || ctx.state.setup.advisor || Sim.bigMoney();
      const pl = Object.assign({}, g.players[seat], { bot: strat });
      return { answer: Bots.decide(req, g, pl) };
    },
    isOver(state) { return live(state).over; },
  };
  // the screens use the same shape as DomEngine.view(state, seat)
  function viewFromSnap(snap) {
    return Object.assign({}, snap.pub, { seat: snap.mySeat, me: snap.mine && snap.mine.me, pending: snap.mine && snap.mine.pending });
  }
  return { game, viewFromSnap };
});
