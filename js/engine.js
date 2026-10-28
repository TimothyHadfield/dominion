/* Dominion rules engine.
   Inside: a Game object whose turn is a generator; every choice a player makes is a
   `yield {kind, player, ...}` request. Computer seats answer inline (DomBots), so the
   whole game is deterministic from (setup.seed, human answers).
   Outside: pure functions for the online/table layer:
     newGame(setup) -> state, apply(state, action) -> state, view(state, seat) -> what that seat may see.
   state = { v, setup, actions:[{seat, answer}] } is plain JSON; the live Game is rebuilt by replay
   (and cached, so normal play never replays). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cards.js'), require('./bots.js'), require('./odds.js'));
  else root.DomEngine = factory(root.DomCards, root.DomBots, root.DomOdds);
})(typeof self !== 'undefined' ? self : this, function (Cards, Bots, Odds) {
  'use strict';
  const { CARDS, is } = Cards;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function supplyFor(kingdom, n) {
    const vic = n <= 2 ? 8 : 12;
    const s = {
      Copper: 60 - 7 * n, Silver: 40, Gold: 30,
      Estate: vic, Duchy: vic, Province: vic, Curse: 10 * (n - 1),
    };
    for (const k of kingdom) s[k] = is(k, 'Victory') ? vic : 10;
    return s;
  }

  function counts(list) {
    const m = {};
    for (const c of list) m[c] = (m[c] || 0) + 1;
    return m;
  }

  function removeIdx(arr, idxs) {
    const sorted = idxs.slice().sort((a, b) => b - a);
    const out = [];
    for (const i of sorted) out.unshift(arr.splice(i, 1)[0]);
    return out;
  }

  class Game {
    constructor(setup) {
      this.setup = setup;
      this.ed = setup.edition === 1 || setup.edition === '1' ? 1 : 2;
      this.rand = mulberry32(setup.seed >>> 0);
      this.n = setup.players.length;
      this.quiet = !!setup.quiet;
      this.maxRounds = setup.maxRounds || 80;
      this.kingdom = setup.kingdom.slice();
      this.supply = supplyFor(this.kingdom, this.n);
      this.startProvinces = this.supply.Province;
      this.trash = [];
      this.log = [];
      this.turns = [];
      this.advisor = setup.advisor || null;
      this.players = setup.players.map((pl, i) => ({
        i, name: pl.name || ('Player ' + (i + 1)), bot: pl.bot || null,
        draw: [], hand: [], discard: [], play: [], turns: 0,
      }));
      for (const p of this.players) {
        p.draw = ['Copper', 'Copper', 'Copper', 'Copper', 'Copper', 'Copper', 'Copper', 'Estate', 'Estate', 'Estate'];
        this.shuffle(p.draw);
        this.drawCards(p, 5);
      }
      this.first = setup.first != null ? setup.first % this.n : Math.floor(this.rand() * this.n);
      this.cur = this.first;
      this.round = 1;
      this.actions = 0; this.buys = 0; this.coins = 0; this.merchants = 0; this.silverDone = false;
      this.costOff = 0; this.playedN = 0;
      this.phase = 'action';
      this.over = false; this.result = null; this.pending = null; this.answered = 0;
      this.gen = this.main();
      this.advance(undefined);
    }

    // ------------------------------------------------------------ plumbing
    shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(this.rand() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }
    say(p, text) { if (!this.quiet) this.log.push({ r: this.round, p: p == null ? -1 : p.i, text }); }
    advance(ans) {
      let r = this.gen.next(ans);
      while (!r.done) {
        const req = r.value;
        const pl = this.players[req.player];
        if (pl.bot) { r = this.gen.next(Bots.decide(req, this, pl)); continue; }
        this.pending = req;
        return req;
      }
      this.pending = null;
      return null;
    }
    answer(seat, ans) {
      const req = this.pending;
      if (!req) throw new Error('No decision is waiting');
      if (req.player !== seat) throw new Error('Not your decision');
      const why = this.invalid(req, ans);
      if (why) throw new Error(why);
      this.answered++;
      return this.advance(ans);
    }
    // Returns a reason string if `ans` isn't a legal answer to `req`.
    invalid(req, ans) {
      const p = this.players[req.player];
      const intList = (len) => {
        if (!Array.isArray(ans)) return 'Expected a list';
        const seen = new Set();
        for (const i of ans) {
          if (!Number.isInteger(i) || i < 0 || i >= len || seen.has(i)) return 'Bad pick';
          seen.add(i);
        }
        if (ans.length < req.min || ans.length > req.max) return 'Pick ' + (req.min === req.max ? req.min : req.min + '–' + req.max);
        return '';
      };
      switch (req.kind) {
        case 'action':
          if (ans === -1 || ans === null) return '';
          if (!Number.isInteger(ans) || !p.hand[ans] || !is(p.hand[ans], 'Action')) return 'Not an Action in hand';
          return '';
        case 'buy':
          if (ans === null) return '';
          if (!this.canBuy(ans)) return 'Can\'t buy that';
          return '';
        case 'yesno': return typeof ans === 'boolean' ? '' : 'Answer yes or no';
        case 'pickHand': {
          const e = intList(p.hand.length); if (e) return e;
          if (req.filter && ans.some(i => !is(p.hand[i], req.filter))) return 'Pick ' + req.filter + ' cards';
          return '';
        }
        case 'pickList': {
          const e = intList(req.cards.length); if (e) return e;
          if (req.only && ans.some(i => req.only.indexOf(i) < 0)) return 'Can\'t pick that';
          return '';
        }
        case 'choose': return intList(req.options.length);
        case 'name': return typeof ans === 'string' && Object.prototype.hasOwnProperty.call(this.supply, ans) ? '' : 'Name a card in this game';
        case 'gain':
          if (ans === null) return req.optional || !this.gainOptions(req).length ? '' : 'You must gain a card';
          if (this.gainOptions(req).indexOf(ans) < 0) return 'Can\'t gain that';
          return '';
      }
      return 'Unknown decision';
    }
    // what a card costs right now (Bridge makes everything $1 cheaper this turn, never below $0)
    cost(name) { return Math.max(0, CARDS[name].cost - (this.costOff || 0)); }
    canBuy(name) {
      return typeof name === 'string' && this.supply[name] > 0 && this.cost(name) <= this.coins && this.buys > 0;
    }
    gainOptions(req) {
      return Object.keys(this.supply).filter(n => this.supply[n] > 0 &&
        (req.exact != null ? this.cost(n) === req.exact : this.cost(n) <= req.maxCost) &&
        (!req.filter || is(n, req.filter)));
    }
    emptyPiles() { let e = 0; for (const k in this.supply) if (this.supply[k] === 0) e++; return e; }

    drawOne(p) {
      if (!p.draw.length) {
        if (!p.discard.length) return null;
        p.draw = this.shuffle(p.discard);
        p.discard = [];
        this.say(p, 'shuffled');
      }
      return p.draw.pop();
    }
    drawCards(p, k) {
      let got = 0;
      for (let i = 0; i < k; i++) { const c = this.drawOne(p); if (c == null) break; p.hand.push(c); got++; }
      return got;
    }
    gain(p, name, dest) {
      if (!(this.supply[name] > 0)) return false;
      this.supply[name]--;
      if (dest === 'hand') p.hand.push(name);
      else if (dest === 'deck') p.draw.push(name);
      else p.discard.push(name);
      return true;
    }
    allCards(p) { return p.draw.concat(p.hand, p.discard, p.play); }
    vp(p) {
      const all = this.allCards(p);
      let v = 0;
      let duchies = 0;
      for (const c of all) if (c === 'Duchy') duchies++;
      for (const c of all) {
        if (c === 'Gardens') v += Math.floor(all.length / 10);
        else if (c === 'Duke') v += duchies;
        else if (CARDS[c].vp) v += CARDS[c].vp;
      }
      return v;
    }

    // ------------------------------------------------------------ game flow
    *main() {
      for (;;) {
        yield* this.turn(this.players[this.cur]);
        if (this.endReached()) break;
        this.cur = (this.cur + 1) % this.n;
        if (this.cur === this.first) this.round++;
        if (this.round > this.maxRounds) break;
      }
      this.finish();
    }
    endReached() {
      return this.supply.Province === 0 || this.emptyPiles() >= (this.n >= 5 ? 4 : 3);
    }
    finish() {
      this.over = true;
      this.phase = 'over';
      const vp = this.players.map(p => this.vp(p));
      const best = Math.max.apply(null, vp);
      let tied = this.players.filter(p => vp[p.i] === best);
      const fewest = Math.min.apply(null, tied.map(p => p.turns));
      const onPoints = tied.length;
      tied = tied.filter(p => p.turns === fewest);
      // why it ended: the Provinces ran out, 3 piles ran out, or the safety round limit (no real-game rule)
      const reason = this.supply.Province === 0 ? 'provinces' : this.emptyPiles() >= (this.n >= 5 ? 4 : 3) ? 'piles' : 'rounds';
      this.result = { vp, winners: tied.map(p => p.i), turns: this.players.map(p => p.turns), reason, tiebreak: onPoints > tied.length };
      if (reason === 'rounds') this.say(null, 'Round ' + this.maxRounds + ' reached: the game stops here');
      this.say(null, tied.length > 1 ? 'Game over: shared win' : 'Game over: ' + tied[0].name + ' wins' + (onPoints > tied.length ? ' (tied on points, fewer turns)' : ''));
    }

    *turn(p) {
      p.turns++;
      this.actions = 1; this.buys = 1; this.coins = 0; this.merchants = 0; this.silverDone = false;
      this.costOff = 0; this.playedN = 0;
      this.phase = 'action';
      const rec = { round: this.round, seat: p.i, played: [], coins: 0, bought: [], suggest: [] };
      if (!this.quiet) { rec.handMoney = Odds.money(p.hand); rec.expMoney = p.expNext != null ? p.expNext : 3.5; }
      this.turns.push(rec);
      this.rec = rec;
      while (this.actions > 0 && p.hand.some(c => is(c, 'Action'))) {
        const a = yield { kind: 'action', player: p.i };
        if (a === -1 || a === null || a === undefined) break;
        const card = p.hand[a];
        if (!card || !is(card, 'Action')) continue;
        p.hand.splice(a, 1);
        p.play.push(card);
        this.actions--;
        rec.played.push(card);
        this.say(p, 'played ' + card);
        yield* this.playAction(p, card);
      }
      this.phase = 'buy';
      // Treasures: all of them are played (holding one back never helps with these cards).
      const tre = p.hand.filter(c => is(c, 'Treasure'));
      p.hand = p.hand.filter(c => !is(c, 'Treasure'));
      for (const c of tre) {
        p.play.push(c);
        this.coins += CARDS[c].coin;
        if (c === 'Silver' && !this.silverDone) { this.silverDone = true; this.coins += this.merchants; }
      }
      rec.coins = this.coins;
      rec.buysAvail = this.buys;
      if (this.advisor) rec.suggest = Bots.planBuys(this.advisor, this, p, this.coins, this.buys);
      while (this.buys > 0) {
        const b = yield { kind: 'buy', player: p.i };
        if (b === null || b === undefined) break;
        if (!this.canBuy(b)) continue;
        this.coins -= this.cost(b);
        this.buys--;
        this.gain(p, b);
        rec.bought.push(b);
      }
      this.say(p, rec.bought.length ? 'bought ' + rec.bought.join(', ') : 'bought nothing');
      this.phase = 'cleanup';
      p.discard.push(...p.hand, ...p.play);
      p.hand = []; p.play = [];
      this.costOff = 0;
      if (!this.quiet) p.expNext = Odds.mean(Odds.nextHand(counts(p.draw), counts(p.discard), 5).dist);
      this.drawCards(p, 5);
      if (!this.quiet) rec.vpAfter = this.players.map(o => this.vp(o));
    }

    *victims(p) {
      const out = [];
      for (let k = 1; k < this.n; k++) {
        const v = this.players[(p.i + k) % this.n];
        // Diplomat (Intrigue): from a hand of 5+, show it to draw 2 then discard 3 (again while still 5+)
        while (v.hand.indexOf('Diplomat') >= 0 && v.hand.length >= 5) {
          const yes = yield { kind: 'yesno', player: v.i, reason: 'diplomat', card: 'Diplomat', by: p.i, attack: this.attackCard };
          if (!yes) break;
          this.drawCards(v, 2);
          const k3 = Math.min(3, v.hand.length);
          const pick = yield { kind: 'pickHand', player: v.i, reason: 'diplomat-discard', min: k3, max: k3 };
          const out = removeIdx(v.hand, pick);
          v.discard.push(...out);
          this.say(v, 'showed Diplomat: drew 2, discarded ' + out.join(', '));
        }
        if (v.hand.indexOf('Moat') >= 0) {
          const yes = yield { kind: 'yesno', player: v.i, reason: 'moat', card: 'Moat', by: p.i, attack: this.attackCard };
          if (yes) { this.say(v, 'blocked it with Moat'); continue; }
        }
        out.push(v);
      }
      return out;
    }

    *gainUpTo(p, maxCost, reason, dest, filter, more) {
      const req = Object.assign({ kind: 'gain', player: p.i, reason, maxCost, filter: filter || null, dest: dest || 'discard', optional: false }, more || {});
      if (!this.gainOptions(req).length) return null;
      const g = yield req;
      const to = req.to != null ? this.players[req.to] : p;
      if (g && this.gain(to, g, req.dest)) { this.say(to, 'gained ' + g); return g; }
      return null;
    }
    // a choice between labelled options; answer = list of option indexes (all different)
    *choose(p, reason, options, k) {
      const n = Math.min(k || 1, options.length);
      const ans = yield { kind: 'choose', player: p.i, reason, options, min: n, max: n };
      return ans.map(i => options[i]);
    }
    // exactly k cards from hand (fewer if the hand is smaller), removed and returned
    *pickN(p, reason, k) {
      const n = Math.min(k, p.hand.length);
      if (!n) return [];
      const pick = yield { kind: 'pickHand', player: p.i, reason, min: n, max: n };
      return removeIdx(p.hand, pick);
    }

    *playAction(p, card, again) {
      const c = CARDS[card];
      this.playedN++;
      if (c.plus) {
        if (c.plus.cards) this.drawCards(p, c.plus.cards);
        if (c.plus.actions) this.actions += c.plus.actions;
        if (c.plus.buys) this.buys += c.plus.buys;
        if (c.plus.coins) this.coins += c.plus.coins;
      }
      switch (card) {
        case 'Cellar': {
          if (!p.hand.length) break;
          const pick = yield { kind: 'pickHand', player: p.i, reason: 'cellar', min: 0, max: p.hand.length };
          const out = removeIdx(p.hand, pick);
          p.discard.push(...out);
          this.drawCards(p, out.length);
          if (out.length) this.say(p, 'discarded and drew ' + out.length);
          break;
        }
        case 'Chapel': {
          if (!p.hand.length) break;
          const pick = yield { kind: 'pickHand', player: p.i, reason: 'chapel', min: 0, max: Math.min(4, p.hand.length) };
          const out = removeIdx(p.hand, pick);
          this.trash.push(...out);
          if (out.length) this.say(p, 'trashed ' + out.join(', '));
          break;
        }
        case 'Harbinger': {
          if (!p.discard.length) break;
          const pick = yield { kind: 'pickList', player: p.i, reason: 'harbinger', cards: p.discard.slice(), min: 0, max: 1 };
          if (pick.length) { const got = p.discard.splice(pick[0], 1)[0]; p.draw.push(got); this.say(p, 'put ' + got + ' on their deck'); }
          break;
        }
        case 'Merchant': this.merchants++; break;
        case 'Vassal': {
          const top = this.drawOne(p);
          if (top == null) break;
          p.discard.push(top);
          this.say(p, 'discarded ' + top);
          if (is(top, 'Action')) {
            const yes = yield { kind: 'yesno', player: p.i, reason: 'vassal', card: top };
            if (yes) {
              p.discard.splice(p.discard.lastIndexOf(top), 1);
              p.play.push(top);
              this.rec.played.push(top);
              this.say(p, 'played ' + top);
              yield* this.playAction(p, top);
            }
          }
          break;
        }
        case 'Workshop': yield* this.gainUpTo(p, 4, 'workshop'); break;
        case 'Feast': {
          // Throne Room's second play can't trash it again, but still gains.
          const at = again ? -1 : p.play.lastIndexOf('Feast');
          if (at >= 0) { p.play.splice(at, 1); this.trash.push('Feast'); }
          yield* this.gainUpTo(p, 5, 'feast');
          break;
        }
        case 'Bureaucrat': {
          if (this.gain(p, 'Silver', 'deck')) this.say(p, 'gained Silver onto deck');
          this.attackCard = card;
          const vs = yield* this.victims(p);
          for (const v of vs) {
            const idx = [];
            v.hand.forEach((x, i) => { if (is(x, 'Victory')) idx.push(i); });
            if (!idx.length) { this.say(v, 'had no Victory card'); continue; }
            let pick = [idx[0]];
            if (new Set(idx.map(i => v.hand[i])).size > 1) {
              pick = yield { kind: 'pickHand', player: v.i, reason: 'bureaucrat', min: 1, max: 1, filter: 'Victory' };
            }
            const got = v.hand.splice(pick[0], 1)[0];
            v.draw.push(got);
            this.say(v, 'put ' + got + ' onto their deck');
          }
          break;
        }
        case 'Militia': {
          this.attackCard = card;
          const vs = yield* this.victims(p);
          for (const v of vs) {
            if (v.hand.length <= 3) continue;
            const k = v.hand.length - 3;
            const pick = yield { kind: 'pickHand', player: v.i, reason: 'militia', min: k, max: k };
            const out = removeIdx(v.hand, pick);
            v.discard.push(...out);
            this.say(v, 'discarded ' + out.join(', '));
          }
          break;
        }
        case 'Moneylender': {
          const at = p.hand.indexOf('Copper');
          if (at < 0) break;
          const yes = this.ed === 1 ? true : yield { kind: 'yesno', player: p.i, reason: 'moneylender', card: 'Copper' };
          if (yes) { p.hand.splice(p.hand.indexOf('Copper'), 1); this.trash.push('Copper'); this.coins += 3; this.say(p, 'trashed Copper for $3'); }
          break;
        }
        case 'Poacher': {
          const k = Math.min(this.emptyPiles(), p.hand.length);
          if (!k) break;
          const pick = yield { kind: 'pickHand', player: p.i, reason: 'poacher', min: k, max: k };
          const out = removeIdx(p.hand, pick);
          p.discard.push(...out);
          this.say(p, 'discarded ' + out.join(', '));
          break;
        }
        case 'Remodel': {
          if (!p.hand.length) break;
          const pick = yield { kind: 'pickHand', player: p.i, reason: 'remodel', min: 1, max: 1 };
          const t = p.hand.splice(pick[0], 1)[0];
          this.trash.push(t);
          this.say(p, 'trashed ' + t);
          yield* this.gainUpTo(p, CARDS[t].cost + 2, 'remodel');
          break;
        }
        case 'Throne Room': {
          if (!p.hand.some(x => is(x, 'Action'))) break;
          const pick = yield { kind: 'pickHand', player: p.i, reason: 'throne', min: this.ed === 1 ? 1 : 0, max: 1, filter: 'Action' };
          if (!pick.length) break;
          const t = p.hand.splice(pick[0], 1)[0];
          p.play.push(t);
          this.rec.played.push(t);
          this.say(p, 'played ' + t + ' twice');
          yield* this.playAction(p, t);
          yield* this.playAction(p, t, true);
          break;
        }
        case 'Bandit': {
          if (this.gain(p, 'Gold')) this.say(p, 'gained Gold');
          this.attackCard = card;
          const vs = yield* this.victims(p);
          for (const v of vs) {
            const shown = [];
            for (let i = 0; i < 2; i++) { const x = this.drawOne(v); if (x != null) shown.push(x); }
            const can = [];
            shown.forEach((x, i) => { if (is(x, 'Treasure') && x !== 'Copper') can.push(i); });
            let ti = -1;
            if (can.length === 1 || (can.length === 2 && shown[can[0]] === shown[can[1]])) ti = can[0];
            else if (can.length === 2) {
              const pick = yield { kind: 'pickList', player: v.i, reason: 'bandit', cards: shown.slice(), min: 1, max: 1, only: can };
              ti = can.indexOf(pick[0]) >= 0 ? pick[0] : can[0];
            }
            if (ti >= 0) { this.trash.push(shown[ti]); this.say(v, 'lost ' + shown[ti]); }
            v.discard.push(...shown.filter((x, i) => i !== ti));
          }
          break;
        }
        case 'Council Room':
          for (let k = 1; k < this.n; k++) this.drawCards(this.players[(p.i + k) % this.n], 1);
          break;
        case 'Library': {
          const aside = [];
          while (p.hand.length < 7) {
            const x = this.drawOne(p);
            if (x == null) break;
            if (is(x, 'Action')) {
              const skip = yield { kind: 'yesno', player: p.i, reason: 'library', card: x };
              if (skip) { aside.push(x); continue; }
            }
            p.hand.push(x);
          }
          p.discard.push(...aside);
          break;
        }
        case 'Mine': {
          if (!p.hand.some(x => is(x, 'Treasure'))) break;
          const pick = yield { kind: 'pickHand', player: p.i, reason: 'mine', min: this.ed === 1 ? 1 : 0, max: 1, filter: 'Treasure' };
          if (!pick.length) break;
          const t = p.hand.splice(pick[0], 1)[0];
          this.trash.push(t);
          this.say(p, 'trashed ' + t);
          yield* this.gainUpTo(p, CARDS[t].cost + 3, 'mine', 'hand', 'Treasure');
          break;
        }
        case 'Sentry': {
          const look = [];
          for (let i = 0; i < 2; i++) { const x = this.drawOne(p); if (x != null) look.push(x); }
          if (!look.length) break;
          const tr = yield { kind: 'pickList', player: p.i, reason: 'sentry-trash', cards: look.slice(), min: 0, max: look.length };
          const trashed = removeIdx(look, tr);
          this.trash.push(...trashed);
          if (trashed.length) this.say(p, 'trashed ' + trashed.join(', '));
          let rest = look;
          if (rest.length) {
            const ds = yield { kind: 'pickList', player: p.i, reason: 'sentry-discard', cards: rest.slice(), min: 0, max: rest.length };
            const gone = removeIdx(rest, ds);
            p.discard.push(...gone);
            if (gone.length) this.say(p, 'discarded ' + gone.join(', '));
          }
          if (rest.length === 2 && rest[0] !== rest[1]) {
            const top = yield { kind: 'pickList', player: p.i, reason: 'sentry-top', cards: rest.slice(), min: 1, max: 1 };
            const t = rest.splice(top[0], 1)[0];
            p.draw.push(rest[0], t);
          } else p.draw.push(...rest);
          break;
        }
        case 'Witch': {
          this.attackCard = card;
          const vs = yield* this.victims(p);
          for (const v of vs) if (this.gain(v, 'Curse')) this.say(v, 'gained a Curse');
          break;
        }
        case 'Artisan': {
          yield* this.gainUpTo(p, 5, 'artisan', 'hand');
          if (!p.hand.length) break;
          const pick = yield { kind: 'pickHand', player: p.i, reason: 'artisan-top', min: 1, max: 1 };
          const t = p.hand.splice(pick[0], 1)[0];
          p.draw.push(t);
          this.say(p, 'put a card onto their deck');
          break;
        }
        case 'Chancellor': {
          if (!p.draw.length) break;
          const yes = yield { kind: 'yesno', player: p.i, reason: 'chancellor' };
          if (yes) { p.discard.push(...p.draw); p.draw = []; this.say(p, 'put their deck into the discard pile'); }
          break;
        }
        case 'Spy': {
          this.attackCard = card;
          const vs = yield* this.victims(p);
          for (const v of [p].concat(vs)) {
            const x = this.drawOne(v);
            if (x == null) continue;
            const discard = yield { kind: 'yesno', player: p.i, reason: 'spy', card: x, target: v.i };
            if (discard) { v.discard.push(x); this.say(v, 'had ' + x + ' discarded'); }
            else { v.draw.push(x); this.say(v, 'kept ' + x + ' on top'); }
          }
          break;
        }
        case 'Thief': {
          this.attackCard = card;
          const vs = yield* this.victims(p);
          for (const v of vs) {
            const shown = [];
            for (let i = 0; i < 2; i++) { const x = this.drawOne(v); if (x != null) shown.push(x); }
            const can = [];
            shown.forEach((x, i) => { if (is(x, 'Treasure')) can.push(i); });
            let ti = -1;
            if (can.length === 1 || (can.length === 2 && shown[can[0]] === shown[can[1]])) ti = can[0];
            else if (can.length === 2) {
              const pick = yield { kind: 'pickList', player: p.i, reason: 'thief', cards: shown.slice(), min: 1, max: 1, only: can };
              ti = can.indexOf(pick[0]) >= 0 ? pick[0] : can[0];
            }
            if (ti >= 0) {
              const t = shown[ti];
              const take = yield { kind: 'yesno', player: p.i, reason: 'thief-gain', card: t };
              if (take) { p.discard.push(t); this.say(p, 'stole ' + t); }
              else { this.trash.push(t); this.say(v, 'lost ' + t); }
            }
            v.discard.push(...shown.filter((x, i) => i !== ti));
          }
          break;
        }
        case 'Adventurer': {
          const found = [], other = [];
          while (found.length < 2) {
            const x = this.drawOne(p);
            if (x == null) break;
            (is(x, 'Treasure') ? found : other).push(x);
          }
          p.hand.push(...found);
          p.discard.push(...other);
          break;
        }
        // ---------------------------------------------------------------- Intrigue
        case 'Courtyard': {
          const out = yield* this.pickN(p, 'courtyard', 1);
          if (out.length) { p.draw.push(out[0]); this.say(p, 'put a card onto their deck'); }
          break;
        }
        case 'Lurker': {
          const ch = (yield* this.choose(p, 'lurker', ['Trash an Action from the Supply', 'Gain an Action from the trash']))[0];
          if (ch.indexOf('Trash') === 0) {
            const req = { kind: 'gain', player: p.i, reason: 'lurker-trash', maxCost: 99, filter: 'Action', dest: 'trash', optional: false };
            if (!this.gainOptions(req).length) break;
            const x = yield req;
            if (x && this.supply[x] > 0) { this.supply[x]--; this.trash.push(x); this.say(p, 'trashed ' + x + ' from the Supply'); }
          } else {
            const acts = Array.from(new Set(this.trash.filter(x => is(x, 'Action'))));
            if (!acts.length) break;
            let i = 0;
            if (acts.length > 1) i = (yield { kind: 'pickList', player: p.i, reason: 'lurker-gain', cards: acts, min: 1, max: 1 })[0];
            this.trash.splice(this.trash.lastIndexOf(acts[i]), 1);
            p.discard.push(acts[i]);
            this.say(p, 'gained ' + acts[i] + ' from the trash');
          }
          break;
        }
        case 'Pawn': {
          const ch = yield* this.choose(p, 'pawn', ['+1 Card', '+1 Action', '+1 Buy', '+$1'], 2);
          for (const o of ch) {
            if (o === '+1 Card') this.drawCards(p, 1);
            else if (o === '+1 Action') this.actions++;
            else if (o === '+1 Buy') this.buys++;
            else this.coins++;
          }
          this.say(p, 'chose ' + ch.join(' and '));
          break;
        }
        case 'Masquerade': {
          // everyone holding cards picks one, then they all move left at once (to the next player who held cards)
          const ring = [];
          for (let k = 0; k < this.n; k++) { const q = this.players[(p.i + k) % this.n]; if (q.hand.length) ring.push(q); }
          const chosen = [];
          for (const q of ring) {
            let i = 0;
            if (new Set(q.hand).size > 1) i = (yield { kind: 'pickHand', player: q.i, reason: 'masquerade', min: 1, max: 1, by: p.i })[0];
            chosen.push(q.hand.splice(i, 1)[0]);
          }
          ring.forEach((q, k) => ring[(k + 1) % ring.length].hand.push(chosen[k]));
          if (ring.length > 1) this.say(p, 'had everyone pass a card left');
          if (p.hand.length) {
            const tr = yield { kind: 'pickHand', player: p.i, reason: 'masq-trash', min: 0, max: 1 };
            if (tr.length) { const x = p.hand.splice(tr[0], 1)[0]; this.trash.push(x); this.say(p, 'trashed ' + x); }
          }
          break;
        }
        case 'Shanty Town':
          this.say(p, 'showed their hand' + (p.hand.length ? ': ' + p.hand.join(', ') : ' (empty)'));
          if (!p.hand.some(x => is(x, 'Action'))) this.drawCards(p, 2);
          break;
        case 'Steward': {
          const ch = (yield* this.choose(p, 'steward', ['+2 Cards', '+$2', 'Trash 2 cards from your hand']))[0];
          if (ch === '+2 Cards') this.drawCards(p, 2);
          else if (ch === '+$2') this.coins += 2;
          else {
            const out = yield* this.pickN(p, 'steward-trash', 2);
            this.trash.push(...out);
            if (out.length) this.say(p, 'trashed ' + out.join(', '));
          }
          break;
        }
        case 'Swindler': {
          this.attackCard = card;
          const vs = yield* this.victims(p);
          for (const v of vs) {
            const x = this.drawOne(v);
            if (x == null) continue;
            this.trash.push(x);
            this.say(v, 'trashed ' + x);
            yield* this.gainUpTo(p, this.cost(x), 'swindler', 'discard', null, { exact: this.cost(x), to: v.i, card: x });
          }
          break;
        }
        case 'Wishing Well': {
          if (!p.draw.length && !p.discard.length) break;
          const named = yield { kind: 'name', player: p.i, reason: 'wishing-well' };
          const x = this.drawOne(p);
          if (x == null) break;
          if (x === named) { p.hand.push(x); this.say(p, 'named ' + named + ' and found it'); }
          else { p.draw.push(x); this.say(p, 'named ' + named + ', flipped ' + x); }
          break;
        }
        case 'Baron': {
          let yes = false;
          if (p.hand.indexOf('Estate') >= 0) yes = yield { kind: 'yesno', player: p.i, reason: 'baron', card: 'Estate' };
          if (yes) { p.discard.push(p.hand.splice(p.hand.indexOf('Estate'), 1)[0]); this.coins += 4; this.say(p, 'discarded an Estate for $4'); }
          else if (this.gain(p, 'Estate')) this.say(p, 'gained an Estate');
          break;
        }
        case 'Bridge': this.costOff++; break;
        case 'Conspirator':
          if (this.playedN >= 3) { this.drawCards(p, 1); this.actions++; }
          break;
        case 'Diplomat':
          if (p.hand.length <= 5) this.actions += 2;
          break;
        case 'Ironworks': {
          const x = yield* this.gainUpTo(p, 4, 'ironworks');
          if (!x) break;
          if (is(x, 'Action')) this.actions++;
          if (is(x, 'Treasure')) this.coins++;
          if (is(x, 'Victory')) this.drawCards(p, 1);
          break;
        }
        case 'Mill': {
          if (!p.hand.length) break;
          const pick = yield { kind: 'pickHand', player: p.i, reason: 'mill', min: 0, max: Math.min(2, p.hand.length) };
          const out = removeIdx(p.hand, pick);
          p.discard.push(...out);
          if (out.length === 2) this.coins += 2;
          if (out.length) this.say(p, 'discarded ' + out.join(', ') + (out.length === 2 ? ' for $2' : ''));
          break;
        }
        case 'Mining Village': {
          // Throne Room's second play can't trash it again
          if (again || p.play.lastIndexOf('Mining Village') < 0) break;
          const yes = yield { kind: 'yesno', player: p.i, reason: 'mining-village', card: 'Mining Village' };
          if (yes) { p.play.splice(p.play.lastIndexOf('Mining Village'), 1); this.trash.push('Mining Village'); this.coins += 2; this.say(p, 'trashed Mining Village for $2'); }
          break;
        }
        case 'Secret Passage': {
          const out = yield* this.pickN(p, 'passage', 1);
          if (!out.length) break;
          const L = p.draw.length;
          let pos = 0;
          if (L) {
            const ord = n => n + (n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
            const opts = [];
            for (let k = 0; k <= Math.min(L - 1, 9); k++) opts.push(k === 0 ? 'Top' : ord(k + 1) + ' from top');
            opts.push('Bottom');
            const i = (yield { kind: 'choose', player: p.i, reason: 'passage-where', options: opts, min: 1, max: 1, card: out[0] })[0];
            pos = i === opts.length - 1 ? L : i;
          }
          p.draw.splice(p.draw.length - pos, 0, out[0]);
          this.say(p, 'put a card into their deck');
          break;
        }
        case 'Courtier': {
          if (!p.hand.length) break;
          const pick = yield { kind: 'pickHand', player: p.i, reason: 'courtier-show', min: 1, max: 1 };
          const x = p.hand[pick[0]];
          this.say(p, 'showed ' + x);
          const ch = yield* this.choose(p, 'courtier', ['+1 Action', '+1 Buy', '+$3', 'Gain a Gold'], CARDS[x].types.length);
          for (const o of ch) {
            if (o === '+1 Action') this.actions++;
            else if (o === '+1 Buy') this.buys++;
            else if (o === '+$3') this.coins += 3;
            else if (this.gain(p, 'Gold')) this.say(p, 'gained Gold');
          }
          this.say(p, 'chose ' + ch.join(', '));
          break;
        }
        case 'Minion': {
          this.attackCard = card;
          const vs = yield* this.victims(p);
          const ch = (yield* this.choose(p, 'minion', ['+$2', 'Discard your hand, draw 4 (attack)']))[0];
          if (ch === '+$2') { this.coins += 2; break; }
          p.discard.push(...p.hand); p.hand = [];
          this.drawCards(p, 4);
          this.say(p, 'discarded their hand and drew 4');
          for (const v of vs) {
            if (v.hand.length < 5) continue;
            v.discard.push(...v.hand); v.hand = [];
            this.drawCards(v, 4);
            this.say(v, 'discarded their hand and drew 4');
          }
          break;
        }
        case 'Patrol': {
          const look = [];
          for (let i = 0; i < 4; i++) { const x = this.drawOne(p); if (x != null) look.push(x); }
          if (!look.length) break;
          this.say(p, 'flipped ' + look.join(', '));
          const rest = look.filter(x => !(is(x, 'Victory') || x === 'Curse'));
          p.hand.push(...look.filter(x => is(x, 'Victory') || x === 'Curse'));
          const order = [];
          while (rest.length > 1 && new Set(rest).size > 1) {
            const i = (yield { kind: 'pickList', player: p.i, reason: 'patrol-order', cards: rest.slice(), min: 1, max: 1 })[0];
            order.push(rest.splice(i, 1)[0]);
          }
          order.push(...rest);
          for (let i = order.length - 1; i >= 0; i--) p.draw.push(order[i]);
          break;
        }
        case 'Replace': {
          this.attackCard = card;
          const vs = yield* this.victims(p);
          const out = yield* this.pickN(p, 'replace', 1);
          if (!out.length) break;
          this.trash.push(out[0]);
          this.say(p, 'trashed ' + out[0]);
          const x = yield* this.gainUpTo(p, this.cost(out[0]) + 2, 'replace');
          if (!x) break;
          if (is(x, 'Action') || is(x, 'Treasure')) { p.discard.splice(p.discard.lastIndexOf(x), 1); p.draw.push(x); this.say(p, 'put ' + x + ' onto their deck'); }
          if (is(x, 'Victory')) for (const v of vs) if (this.gain(v, 'Curse')) this.say(v, 'gained a Curse');
          break;
        }
        case 'Torturer': {
          this.attackCard = card;
          const vs = yield* this.victims(p);
          for (const v of vs) {
            const ch = (yield* this.choose(v, 'torturer', ['Discard 2 cards', 'Take a Curse into your hand']))[0];
            if (ch.indexOf('Discard') === 0) {
              const out = yield* this.pickN(v, 'torturer-discard', 2);
              v.discard.push(...out);
              this.say(v, out.length ? 'discarded ' + out.join(', ') : 'had nothing to discard');
            } else if (this.gain(v, 'Curse', 'hand')) this.say(v, 'took a Curse into their hand');
            else this.say(v, 'took a Curse (none left)');
          }
          break;
        }
        case 'Trading Post': {
          const out = yield* this.pickN(p, 'trading-post', 2);
          this.trash.push(...out);
          if (out.length) this.say(p, 'trashed ' + out.join(', '));
          if (out.length === 2 && this.gain(p, 'Silver', 'hand')) this.say(p, 'gained a Silver into their hand');
          break;
        }
        case 'Upgrade': {
          const out = yield* this.pickN(p, 'upgrade', 1);
          if (!out.length) break;
          this.trash.push(out[0]);
          this.say(p, 'trashed ' + out[0]);
          const c1 = this.cost(out[0]) + 1;
          yield* this.gainUpTo(p, c1, 'upgrade', 'discard', null, { exact: c1 });
          break;
        }
        case 'Nobles': {
          const ch = (yield* this.choose(p, 'nobles', ['+3 Cards', '+2 Actions']))[0];
          if (ch === '+3 Cards') this.drawCards(p, 3); else this.actions += 2;
          break;
        }
        default: break; // pure "+" cards
      }
    }
  }

  // ------------------------------------------------------------- pure API
  const cache = new WeakMap();
  function newGame(setup) {
    const state = { v: 1, setup: JSON.parse(JSON.stringify(setup)), actions: [] };
    cache.set(state, new Game(state.setup));
    return state;
  }
  function materialize(state) {
    let g = cache.get(state);
    if (g) return g;
    g = new Game(state.setup);
    for (const a of state.actions) g.answer(a.seat, a.answer);
    cache.set(state, g);
    return g;
  }
  // apply never mutates `state`; the cached Game moves on to the new state object.
  function apply(state, action) {
    const g = materialize(state);
    // validate first so a bad action leaves the cached game untouched
    if (!g.pending) throw new Error('No decision is waiting');
    if (g.pending.player !== action.seat) throw new Error('Not your decision');
    const why = g.invalid(g.pending, action.answer);
    if (why) throw new Error(why);
    cache.delete(state);
    g.answer(action.seat, action.answer);
    const next = { v: state.v, setup: state.setup, actions: state.actions.concat([{ seat: action.seat, answer: action.answer }]) };
    cache.set(next, g);
    return next;
  }
  function pileCounts(list) { return counts(list); }
  function view(state, seat) {
    const g = materialize(state);
    const pub = g.players.map(p => ({
      seat: p.i, name: p.name, bot: !!p.bot,
      handSize: p.hand.length, drawSize: p.draw.length, discardSize: p.discard.length,
      discardTop: p.discard.length ? p.discard[p.discard.length - 1] : null,
      play: p.play.slice(), owned: counts(g.allCards(p)), total: g.allCards(p).length,
      vp: g.vp(p), turns: p.turns,
    }));
    const me = g.players[seat];
    return {
      seat, cur: g.cur, round: g.round, phase: g.phase, edition: g.ed,
      actions: g.actions, buys: g.buys, coins: g.coins, costOff: g.costOff || 0,
      supply: Object.assign({}, g.supply), kingdom: g.kingdom.slice(), trash: counts(g.trash),
      startProvinces: g.startProvinces,
      players: pub,
      me: me ? {
        hand: me.hand.slice(), drawCounts: counts(me.draw), discardCounts: counts(me.discard),
        playCounts: counts(me.play), drawSize: me.draw.length,
      } : null,
      pending: g.pending && g.pending.player === seat ? JSON.parse(JSON.stringify(g.pending)) : null,
      waitingOn: g.pending ? g.pending.player : null,
      log: g.log.slice(-60), turns: g.turns.map(t => Object.assign({}, t)),
      over: g.over, result: g.result,
    };
  }

  return { Game, newGame, apply, view, materialize, supplyFor, mulberry32, counts: pileCounts };
});
