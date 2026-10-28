/* Dominion card data. Effects are written in our own words (no rulebook text).
   Costs, types and counts are game facts, checked in docs/rules-check.md. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DomCards = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const CARDS = {};
  // ed: 0 = in both editions, 1 = first edition only, 2 = second edition only
  function def(name, cost, types, ed, text, o) {
    CARDS[name] = Object.assign({ name, cost, types, ed, text }, o || {});
  }
  // ---- basic supply
  def('Copper', 0, ['Treasure'], 0, '$1', { coin: 1 });
  def('Silver', 3, ['Treasure'], 0, '$2', { coin: 2 });
  def('Gold', 6, ['Treasure'], 0, '$3', { coin: 3 });
  def('Estate', 2, ['Victory'], 0, '1 point', { vp: 1 });
  def('Duchy', 5, ['Victory'], 0, '3 points', { vp: 3 });
  def('Province', 8, ['Victory'], 0, '6 points', { vp: 6 });
  def('Curse', 0, ['Curse'], 0, 'Minus 1 point', { vp: -1 });

  // ---- kingdom cards in both editions
  def('Cellar', 2, ['Action'], 0, '+1 Action. Discard any cards from your hand, then draw that many.', { plus: { actions: 1 } });
  def('Chapel', 2, ['Action'], 0, 'Trash up to 4 cards from your hand.');
  def('Moat', 2, ['Action', 'Reaction'], 0, '+2 Cards. When someone attacks, show this from your hand to be safe.', { plus: { cards: 2 } });
  def('Village', 3, ['Action'], 0, '+1 Card, +2 Actions.', { plus: { cards: 1, actions: 2 } });
  def('Workshop', 3, ['Action'], 0, 'Gain a card costing up to $4.');
  def('Bureaucrat', 4, ['Action', 'Attack'], 0, 'Gain a Silver onto your deck. Others put a Victory card from hand onto their deck.');
  def('Gardens', 4, ['Victory'], 0, '1 point per 10 cards you own (round down).');
  def('Militia', 4, ['Action', 'Attack'], 0, '+$2. Others discard down to 3 cards.', { plus: { coins: 2 } });
  def('Moneylender', 4, ['Action'], 0, 'Trash a Copper from your hand for +$3.');
  def('Remodel', 4, ['Action'], 0, 'Trash a card from your hand. Gain one costing up to $2 more.');
  def('Smithy', 4, ['Action'], 0, '+3 Cards.', { plus: { cards: 3 } });
  def('Throne Room', 4, ['Action'], 0, 'Play an Action card from your hand twice.');
  def('Council Room', 5, ['Action'], 0, '+4 Cards, +1 Buy. Everyone else draws a card.', { plus: { cards: 4, buys: 1 } });
  def('Festival', 5, ['Action'], 0, '+2 Actions, +1 Buy, +$2.', { plus: { actions: 2, buys: 1, coins: 2 } });
  def('Laboratory', 5, ['Action'], 0, '+2 Cards, +1 Action.', { plus: { cards: 2, actions: 1 } });
  def('Library', 5, ['Action'], 0, 'Draw until you hold 7 cards. You may set aside Actions you draw; discard them after.');
  def('Market', 5, ['Action'], 0, '+1 Card, +1 Action, +1 Buy, +$1.', { plus: { cards: 1, actions: 1, buys: 1, coins: 1 } });
  def('Mine', 5, ['Action'], 0, 'Trash a Treasure from your hand. Gain a Treasure costing up to $3 more, into your hand.');
  def('Witch', 5, ['Action', 'Attack'], 0, '+2 Cards. Everyone else gains a Curse.', { plus: { cards: 2 } });

  // ---- second edition only
  def('Harbinger', 3, ['Action'], 2, '+1 Card, +1 Action. You may put a card from your discard pile onto your deck.', { plus: { cards: 1, actions: 1 } });
  def('Merchant', 3, ['Action'], 2, '+1 Card, +1 Action. Your first Silver this turn makes $1 more.', { plus: { cards: 1, actions: 1 } });
  def('Vassal', 3, ['Action'], 2, '+$2. Discard your top card. If it is an Action, you may play it.', { plus: { coins: 2 } });
  def('Poacher', 4, ['Action'], 2, '+1 Card, +1 Action, +$1. Discard a card per empty Supply pile.', { plus: { cards: 1, actions: 1, coins: 1 } });
  def('Bandit', 5, ['Action', 'Attack'], 2, 'Gain a Gold. Others flip their top 2 cards, trash a Silver or Gold among them, and discard the rest.');
  def('Sentry', 5, ['Action'], 2, '+1 Card, +1 Action. Look at your top 2 cards: trash, discard or put back any of them.', { plus: { cards: 1, actions: 1 } });
  def('Artisan', 6, ['Action'], 2, 'Gain a card costing up to $5 into your hand. Put a card from your hand onto your deck.');

  // ---- first edition only
  def('Woodcutter', 3, ['Action'], 1, '+1 Buy, +$2.', { plus: { buys: 1, coins: 2 } });
  def('Chancellor', 3, ['Action'], 1, '+$2. You may move your whole deck into your discard pile.', { plus: { coins: 2 } });
  def('Feast', 4, ['Action'], 1, 'Trash this card. Gain a card costing up to $5.');
  def('Spy', 4, ['Action', 'Attack'], 1, '+1 Card, +1 Action. Everyone shows their top card; you choose discard or keep.', { plus: { cards: 1, actions: 1 } });
  def('Thief', 4, ['Action', 'Attack'], 1, 'Others flip 2 cards; you trash a Treasure among them and may take it.');
  def('Adventurer', 6, ['Action'], 1, 'Flip cards from your deck until you find 2 Treasures; take them into your hand.');

  // ---- Intrigue (second edition, 26 kingdom cards). set: 'intrigue'. Card text is our own wording.
  const I = (name, cost, types, text, o) => def(name, cost, types, 2, text, Object.assign({ set: 'intrigue' }, o || {}));
  I('Courtyard', 2, ['Action'], '+3 Cards. Put a card from your hand onto your deck.', { plus: { cards: 3 } });
  I('Lurker', 2, ['Action'], '+1 Action. Either trash an Action card from the Supply, or gain an Action card from the trash.', { plus: { actions: 1 } });
  I('Pawn', 2, ['Action'], 'Pick two different: +1 Card, +1 Action, +1 Buy, +$1.');
  I('Masquerade', 3, ['Action'], '+2 Cards. Everyone holding cards passes one to the next such player on their left, all at once. Then you may trash a card from your hand.', { plus: { cards: 2 } });
  I('Shanty Town', 3, ['Action'], '+2 Actions. Show your hand: if it has no Action cards, +2 Cards.', { plus: { actions: 2 } });
  I('Steward', 3, ['Action'], 'Pick one: +2 Cards, or +$2, or trash 2 cards from your hand.');
  I('Swindler', 3, ['Action', 'Attack'], '+$2. Each other player trashes their top card and gains a card of the same cost that you pick.', { plus: { coins: 2 } });
  I('Wishing Well', 3, ['Action'], '+1 Card, +1 Action. Name a card and flip your top card: if you named it, take it into your hand.', { plus: { cards: 1, actions: 1 } });
  I('Baron', 4, ['Action'], '+1 Buy. You may discard an Estate for +$4. If you don\'t, gain an Estate.', { plus: { buys: 1 } });
  I('Bridge', 4, ['Action'], '+1 Buy, +$1. Every card costs $1 less this turn (not below $0).', { plus: { buys: 1, coins: 1 } });
  I('Conspirator', 4, ['Action'], '+$2. If this is at least your 3rd Action played this turn: +1 Card, +1 Action.', { plus: { coins: 2 } });
  I('Diplomat', 4, ['Action', 'Reaction'], '+2 Cards; then if you hold 5 or fewer cards, +2 Actions. When someone attacks and you hold 5+ cards, you may show this to draw 2, then discard 3.', { plus: { cards: 2 } });
  I('Ironworks', 4, ['Action'], 'Gain a card costing up to $4. Action: +1 Action. Treasure: +$1. Victory: +1 Card.');
  I('Mill', 4, ['Action', 'Victory'], '+1 Card, +1 Action. You may discard 2 cards for +$2. Worth 1 point.', { plus: { cards: 1, actions: 1 }, vp: 1 });
  I('Mining Village', 4, ['Action'], '+1 Card, +2 Actions. You may trash this card for +$2.', { plus: { cards: 1, actions: 2 } });
  I('Secret Passage', 4, ['Action'], '+2 Cards, +1 Action. Put a card from your hand anywhere in your deck.', { plus: { cards: 2, actions: 1 } });
  I('Courtier', 5, ['Action'], 'Show a card from your hand. For each type it has, pick a different one: +1 Action, +1 Buy, +$3, or gain a Gold.');
  I('Duke', 5, ['Victory'], '1 point for each Duchy you own.');
  I('Minion', 5, ['Action', 'Attack'], '+1 Action. Pick one: +$2; or discard your hand and draw 4, and everyone else holding 5+ cards does the same.', { plus: { actions: 1 } });
  I('Patrol', 5, ['Action'], '+3 Cards. Flip your top 4 cards: Victory cards and Curses go into your hand, the rest back on top in any order.', { plus: { cards: 3 } });
  I('Replace', 5, ['Action', 'Attack'], 'Trash a card from your hand; gain one costing up to $2 more. Action or Treasure: it goes onto your deck. Victory: everyone else gains a Curse.');
  I('Torturer', 5, ['Action', 'Attack'], '+3 Cards. Everyone else picks: discard 2 cards, or take a Curse into their hand.', { plus: { cards: 3 } });
  I('Trading Post', 5, ['Action'], 'Trash 2 cards from your hand. If you did, gain a Silver into your hand.');
  I('Upgrade', 5, ['Action'], '+1 Card, +1 Action. Trash a card from your hand; gain one costing exactly $1 more.', { plus: { cards: 1, actions: 1 } });
  I('Farm', 6, ['Treasure', 'Victory'], '$2. Worth 2 points. (Called Harem in older printings.)', { coin: 2, vp: 2 });
  I('Nobles', 6, ['Action', 'Victory'], 'Pick one: +3 Cards or +2 Actions. Worth 2 points.', { vp: 2 });

  const BASICS = ['Copper', 'Silver', 'Gold', 'Estate', 'Duchy', 'Province', 'Curse'];
  const ALL_KINGDOM = Object.keys(CARDS).filter(n => !BASICS.includes(n) && !CARDS[n].set);
  const INTRIGUE = Object.keys(CARDS).filter(n => CARDS[n].set === 'intrigue');
  // edition: 2 = second edition set (26 cards), 1 = first edition set (25), 'mix' = all 32
  // cards: 'base' (default) = base game only, 'both' = base + Intrigue, 'intrigue' = Intrigue only
  function pool(edition, cards) {
    if (cards === 'intrigue') return INTRIGUE.slice();
    const base = edition === 'mix' ? ALL_KINGDOM.slice() : ALL_KINGDOM.filter(n => CARDS[n].ed === 0 || CARDS[n].ed === Number(edition));
    return cards === 'both' ? base.concat(INTRIGUE) : base;
  }

  // Suggested opening sets printed in the rulebooks (card lists are game facts).
  const PRESETS = [
    { name: 'First Game', ed: 2, cards: ['Cellar', 'Market', 'Merchant', 'Militia', 'Mine', 'Moat', 'Remodel', 'Smithy', 'Village', 'Workshop'] },
    { name: 'Size Distortion', ed: 2, cards: ['Artisan', 'Bandit', 'Bureaucrat', 'Chapel', 'Festival', 'Gardens', 'Sentry', 'Throne Room', 'Witch', 'Workshop'] },
    { name: 'Deck Top', ed: 2, cards: ['Artisan', 'Bureaucrat', 'Council Room', 'Festival', 'Harbinger', 'Laboratory', 'Moneylender', 'Sentry', 'Vassal', 'Village'] },
    { name: 'Sleight of Hand', ed: 2, cards: ['Cellar', 'Council Room', 'Festival', 'Gardens', 'Library', 'Harbinger', 'Militia', 'Poacher', 'Smithy', 'Throne Room'] },
    { name: 'Improvements', ed: 2, cards: ['Artisan', 'Cellar', 'Market', 'Merchant', 'Mine', 'Moat', 'Moneylender', 'Poacher', 'Remodel', 'Witch'] },
    { name: 'Silver & Gold', ed: 2, cards: ['Bandit', 'Bureaucrat', 'Chapel', 'Harbinger', 'Laboratory', 'Merchant', 'Mine', 'Moneylender', 'Throne Room', 'Vassal'] },
    { name: 'First Game (1st ed.)', ed: 1, cards: ['Cellar', 'Market', 'Militia', 'Mine', 'Moat', 'Remodel', 'Smithy', 'Village', 'Woodcutter', 'Workshop'] },
    { name: 'Big Money', ed: 1, cards: ['Adventurer', 'Bureaucrat', 'Chancellor', 'Chapel', 'Feast', 'Laboratory', 'Market', 'Mine', 'Moneylender', 'Throne Room'] },
    { name: 'Interaction', ed: 1, cards: ['Bureaucrat', 'Chancellor', 'Council Room', 'Festival', 'Library', 'Militia', 'Moat', 'Spy', 'Thief', 'Village'] },
    { name: 'Size Distortion (1st ed.)', ed: 1, cards: ['Cellar', 'Chapel', 'Feast', 'Gardens', 'Laboratory', 'Thief', 'Village', 'Witch', 'Woodcutter', 'Workshop'] },
    { name: 'Village Square', ed: 1, cards: ['Bureaucrat', 'Cellar', 'Festival', 'Library', 'Market', 'Remodel', 'Smithy', 'Throne Room', 'Village', 'Woodcutter'] },
    // Intrigue (2nd edition) rulebook sets. set: 'intrigue' = Intrigue alone, 'both' = Intrigue + base 2nd edition
    { name: 'Victory Dance', ed: 2, set: 'intrigue', cards: ['Baron', 'Courtier', 'Duke', 'Farm', 'Ironworks', 'Masquerade', 'Mill', 'Nobles', 'Patrol', 'Replace'] },
    { name: 'The Plot Thickens', ed: 2, set: 'intrigue', cards: ['Conspirator', 'Ironworks', 'Lurker', 'Mining Village', 'Pawn', 'Secret Passage', 'Steward', 'Swindler', 'Torturer', 'Trading Post'] },
    { name: 'Best Wishes', ed: 2, set: 'intrigue', cards: ['Baron', 'Conspirator', 'Courtyard', 'Diplomat', 'Duke', 'Secret Passage', 'Shanty Town', 'Torturer', 'Upgrade', 'Wishing Well'] },
    { name: 'Underlings', ed: 2, set: 'both', cards: ['Courtier', 'Diplomat', 'Minion', 'Nobles', 'Pawn', 'Cellar', 'Festival', 'Library', 'Sentry', 'Vassal'] },
    { name: 'Grand Scheme', ed: 2, set: 'both', cards: ['Bridge', 'Mill', 'Mining Village', 'Patrol', 'Shanty Town', 'Artisan', 'Council Room', 'Market', 'Militia', 'Workshop'] },
    { name: 'Deconstruction', ed: 2, set: 'both', cards: ['Diplomat', 'Farm', 'Lurker', 'Replace', 'Swindler', 'Bandit', 'Mine', 'Remodel', 'Throne Room', 'Village'] },
  ];
  // presets that fit a card-set choice (base presets keep their edition filter)
  function presetsFor(edition, cards) {
    return PRESETS.filter(pr => {
      if (pr.set) return cards === 'both' ? true : cards === 'intrigue' ? pr.set === 'intrigue' : false;
      if (cards === 'intrigue') return false;
      return edition === 'mix' || pr.ed === Number(edition);
    });
  }

  const is = (name, type) => CARDS[name].types.indexOf(type) >= 0;
  return { CARDS, BASICS, ALL_KINGDOM, INTRIGUE, pool, PRESETS, presetsFor, is };
});
