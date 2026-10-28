/* domcoach.js: Dominion's guided first game and rules sheet, for the shared kit js/coach.js (never edit that one here).
   DomCoach.RULES  -> COACH.rules() options (our own words, no rulebook text)
   DomCoach.steps(get) -> the tour steps; get() returns { v, me } for the game on screen (or null)
   DomCoach.GAME   -> the guided game: First Game kingdom, you first vs 1 Easy, seed 1 (you open with $4 then $3) */
(function (root) {
  'use strict';
  const ID = 'dominion-first-game';
  const GAME = { seed: 1, first: 0, level: 'easy', opps: 1, edition: 2,
    kingdom: ['Cellar', 'Market', 'Merchant', 'Militia', 'Mine', 'Moat', 'Remodel', 'Smithy', 'Village', 'Workshop'] };

  const RULES = {
    title: 'How to play Dominion',
    intro: 'Build a deck while you play. Everyone starts with the same 10 cards and buys better ones; the most victory points at the end wins.',
    sections: [
      { id: 'goal', title: 'Goal', short: 'Goal', html:
        '<p>Have the most victory points (VP) when the game ends. Points come from Victory cards in your deck: Estate 1, Duchy 3, Province 6. Curses are −1. Gardens are worth 1 for every 10 cards you own.</p>' +
        '<p class="tip">Victory cards do nothing in your hand, so buying them too early slows your deck down.</p>' },
      { id: 'setup', title: 'Setup', short: 'Setup', html:
        '<p>Each player starts with 7 Coppers and 3 Estates, shuffled, and draws 5.</p>' +
        '<p>The Supply on the table holds the Treasures (Copper, Silver, Gold), the Victory cards, the Curses and 10 kingdom cards picked for this game (10 of each). With 2 players there are 8 of each Victory card; with 3–4 players, 12.</p>' },
      { id: 'turn', title: 'Your turn', short: 'Turn', html:
        '<p>Every turn has three steps:</p>' +
        '<ol><li><b>Action</b>: you may play one Action card. Cards that give "+Actions" let you play more.</li>' +
        '<li><b>Buy</b>: play your Treasures and buy one card from the Supply that costs up to the money you have. "+Buy" cards let you buy more than one.</li>' +
        '<li><b>Clean-up</b>: everything you played and everything left in your hand goes to your discard pile. Draw 5 new cards.</li></ol>' +
        '<p>When your draw pile runs out, shuffle your discard pile to make a new one, so the cards you bought come back to you.</p>' +
        '<p class="tip">On this site Treasures are played for you when you move to Buy, and unused Actions, Buys and money are simply lost at the end of the turn, like the real game.</p>' },
      { id: 'cards', title: 'Card types', short: 'Cards', html:
        '<ul><li><b>Treasure</b> (gold): money for buying.</li><li><b>Victory</b> (green): points at the end.</li>' +
        '<li><b>Action</b> (cream): played in the Action step, does what the card says.</li>' +
        '<li><b>Attack</b> (red): hurts the other players (Militia, Witch, Bandit…).</li>' +
        '<li><b>Reaction</b> (blue): Moat in your hand can block an attack.</li><li><b>Curse</b> (purple): −1 VP, given by the Witch.</li></ul>' +
        '<p>Tap any card on the table to read what it does.</p>' },
      { id: 'end', title: 'Game end', short: 'End', html:
        '<p>The game ends after the turn in which the <b>last Province</b> is bought, or <b>any 3 Supply piles</b> are empty (kingdom cards count too).</p>' +
        '<p>Count your points. Most VP wins. On a tie, the player who had fewer turns wins; still tied, they share the win.</p>' },
      { id: 'intrigue', title: 'Intrigue cards', short: 'Intrigue', html:
        '<p>Settings → Card set can add the 26 cards of the Intrigue expansion (2nd edition): base only (the default), base + Intrigue, or Intrigue only. They use the same Supply and rules.</p>' +
        '<ul><li><b>Choices</b>: many Intrigue cards say "pick one" (Steward, Nobles, Minion) or "pick two" (Pawn). You may pick an option you can\'t fully do; you do as much as you can.</li>' +
        '<li><b>Victory cards that do things</b>: Mill and Nobles are Actions, Farm is a Treasure, and all three are worth points. Duke is worth 1 point per Duchy you own.</li>' +
        '<li><b>Attacks</b>: Swindler, Minion, Replace and Torturer. Moat still blocks them; Diplomat lets you draw 2 and discard 3 first when you hold 5 or more cards.</li>' +
        '<li><b>Bridge</b>: everything costs $1 less for the rest of your turn, including what other cards let you gain.</li></ul>' },
      { id: 'videos', title: 'Videos', short: 'Videos', html:
        '<p>Short videos from YouTube (they open in a new tab):</p>' +
        '<ul>' +
        '<li><a href="https://www.youtube.com/watch?v=5jNGpgdMums" target="_blank" rel="noopener">How to Play Dominion in 3 Minutes</a> · The Rules Girl</li>' +
        '<li><a href="https://www.youtube.com/watch?v=z1tBKvyJruA" target="_blank" rel="noopener">How To Win Dominion: Early Game (Part 1)</a> · Hardy House Games</li>' +
        '<li><a href="https://www.youtube.com/watch?v=Ad3_zG3yOBo" target="_blank" rel="noopener">How To Win Dominion: Mid/Late Game (Part 2)</a> · Hardy House Games</li>' +
        '<li><a href="https://www.youtube.com/watch?v=z7BxZRAta4s" target="_blank" rel="noopener">How to play Dominion and Dominion: Intrigue</a> · Teach The Table</li>' +
        '</ul>' },
      { id: 'site', title: 'This site', short: 'Site', html:
        '<ul><li><b>Odds bar</b>: your chance of $5, $6 and $8 next hand, worked out exactly from your deck.</li>' +
        '<li><b>Buy hints</b>: a green dot on what the simulator would buy (Settings).</li>' +
        '<li><b>Undo</b>: takes back your last move until something new is revealed. A game with Undo counts as "with help" in My stats.</li>' +
        '<li><b>Daily</b>: the same kingdom and shuffles for everyone today, against Hard.</li>' +
        '<li><b>Study</b>: after a game, every buy next to the simulator\'s, your draw luck and the points race.</li></ul>' },
    ],
  };

  // the tour; get() -> { v, me } or null
  function steps(get) {
    const v = () => { const x = get(); return x && x.v; };
    const myTurns = () => { const x = v(); return x ? x.turns.filter(t => t.seat === 0) : []; };
    const bought = () => myTurns().reduce((a, t) => a + t.bought.length, 0);
    const pend = k => { const x = v(); return !!(x && x.pending && x.pending.kind === k); };
    const played = () => myTurns().reduce((a, t) => a + t.played.length, 0);
    let boughtAt = 0, playedAt = 0;
    return [
      { title: 'The Supply', target: '.supply', text: 'These piles are the cards you can buy. Top: money (Copper, Silver, Gold), Curses and points (Estate, Duchy, Province). Below: the 10 kingdom cards for this game. Tap any card to read it.' },
      { title: 'Your money', target: '.counters', text: 'Your Coppers were played for you: you have $4 to spend this turn. The number on each pile is how many are left.' },
      { title: 'Buy a Smithy', target: '[data-tile="Smithy"]', text: 'Smithy costs $4 and draws 3 cards when you play it. Tap it twice to buy it. (Any lit card is fine, though.)',
        until: () => bought() >= 1, onShow: () => { boughtAt = bought(); } },
      { title: 'Now buy a Silver', target: '[data-tile="Silver"]', text: 'With $3, Silver is the classic buy: it is worth $2 every time you draw it. Tap it twice.',
        when: () => pend('buy') && myTurns().length >= 2, until: () => bought() >= 2 },
      { title: 'What they did', target: '.info', text: 'This box asks you what to do and sums up the other player\'s turn. The green dot on a pile is what the simulator would buy (switch it off in Settings).',
        when: () => myTurns().length >= 3 },
      { title: 'Next-hand odds', target: '.odds', text: 'Your chance of having $5, $6 or $8 in your next hand, worked out exactly from the cards left in your deck.',
        when: () => myTurns().length >= 3 },
      { title: 'Play an Action', target: '.hand', text: 'When you draw an Action card like Smithy, tap it twice to play it before you buy. Then tap "Buy phase".',
        when: () => pend('action'), until: () => played() > playedAt || !pend('action'), onShow: () => { playedAt = played(); } },
      { title: 'Points', target: '[data-chip="prov"]', text: 'Provinces are worth 6 points and cost $8. The game ends when they run out (or any 3 piles do). Build up money first, then buy points.',
        when: () => myTurns().length >= 4 },
      { title: 'You\'re set', target: '#table', text: 'Finish the game against the Easy computer. The rules are on the start screen and in Settings any time.', next: true },
    ];
  }

  const api = { ID, GAME, RULES, steps };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DomCoach = api;
})(typeof window !== 'undefined' ? window : globalThis);
