# Rules check — Dominion base set (1st and 2nd edition)

Checked 2026-10-19 against two sources. Every row marked ✓ is also asserted by a test in
`tests/engine.test.js` (named in the last column).

**Sources**
- **R** = official rulebook, Rio Grande Games, 2nd edition (2021 printing), pages 2–13.
  Copy: <https://wiki.dominionstrategy.com/images/0/00/DominionRulebook2021.pdf>
  (publisher link: <https://www.riograndegames.com/wp-content/uploads/2016/09/Dominion-2nd-Edition-Rules.pdf>).
- **W** = Dominion Strategy wiki: [Dominion (Base Set)](https://wiki.dominionstrategy.com/index.php/Dominion_(Base_Set)),
  [Gameplay](https://wiki.dominionstrategy.com/index.php/Gameplay), [Supply](https://wiki.dominionstrategy.com/index.php/Supply),
  [Copper](https://wiki.dominionstrategy.com/index.php/Copper), [Curse](https://wiki.dominionstrategy.com/index.php/Curse),
  [Estate](https://wiki.dominionstrategy.com/index.php/Estate), [Province](https://wiki.dominionstrategy.com/index.php/Province),
  [Gardens](https://wiki.dominionstrategy.com/index.php/Gardens),
  [Recommended Kingdoms/Dominion](https://wiki.dominionstrategy.com/index.php/Recommended_Kingdoms/Dominion).

## Setup and counts

| Rule / number | R | W | In the app | Test |
|---|---|---|---|---|
| Box: 60 Copper, 40 Silver, 30 Gold, 24 Estate, 12 Duchy, 12 Province, 30 Curse (208 basic cards) | p2 | Base Set | ✓ | rules check |
| Start deck 7 Copper + 3 Estate, draw 5 | p3–4 | Copper, Estate | ✓ | starting deck |
| Copper pile = 60 − 7 per player (46 / 39 / 32) | p3 | Copper | ✓ | supply counts |
| Silver 40, Gold 30 (all copies) | p3 | — | ✓ | supply counts |
| Estate, Duchy, Province: 8 for 2 players, 12 for 3–4 | p3 | Estate, Gameplay | ✓ | supply counts |
| Curse: 10 / 20 / 30 for 2 / 3 / 4 players | p3 | Curse | ✓ | supply counts |
| Kingdom piles 10 each; Gardens 8 (2p) / 12 (3+p) | p3, p12 | Gardens | ✓ | supply counts |
| 10 Kingdom piles + 7 basic piles = 17 | p3 | Supply | ✓ | — |
| First player random | p4 | Gameplay | ✓ (seeded) | — |
| 2–4 players (5–6 need the Base Cards box) | p9 | — | 2–4 only | — |

## Turn and ending

| Rule | R | W | In the app |
|---|---|---|---|
| Action → Buy → Clean-up; 1 Action, 1 Buy | p4–5 | Gameplay | ✓ |
| Treasures are played in the Buy phase; you *may* hold some back | p5 | Gameplay | All Treasures auto-play. No base-set card rewards holding one back, so this never changes a result. |
| Buy one card per Buy costing ≤ your coins; coins split across Buys | p5, p7 | Gameplay | ✓ |
| Clean-up: discard play + hand, draw 5, shuffling discard under the deck when short | p5, p8 | Gameplay | ✓ (draws the rest first, then shuffles: same result) |
| Game ends at end of a turn when Provinces are gone or any 3 piles are empty | p6 | Gameplay, Supply | ✓ (test: Province end, 3-pile end) |
| Most VP wins; tie → fewer turns wins; still tied → shared win | p6 | Gameplay | ✓ (test: tie → shared) |
| Simultaneous effects go in turn order from the current player (e.g. Witch Curses) | p9 | — | ✓ |
| Hand sizes, top of discard, play area and trash are public | p9 | — | ✓ (the deck tracker only counts what you saw) |

## Kingdom cards — what changed between editions

| Fact | R | W | In the app | Test |
|---|---|---|---|---|
| 2nd edition has 26 Kingdom cards | p3 | Base Set | ✓ | card pools |
| 2nd ed. added Artisan, Bandit, Harbinger, Merchant, Poacher, Sentry, Vassal | p2 | Base Set | ✓ | rules check |
| 2nd ed. removed Adventurer, Chancellor, Feast, Spy, Thief, Woodcutter (1st ed. = 25 cards) | — | Base Set | ✓ (Settings → Card set → 1st edition) | card pools, rules check |
| Mine, Moneylender, Throne Room became "you may" in 2nd ed. (forced in 1st) | p13 | Base Set → Versions | ✓ | Moneylender 1st vs 2nd |
| Every card cost (39 cards) | p12–13 | Base Set | ✓ | rules check |

## Card rulings checked against the rulebook's card notes (R p12–13)

| Card | Ruling | Engine |
|---|---|---|
| Artisan | Gain up to $5 into hand, then put any card from hand on the deck | ✓ |
| Bandit | Gain Gold; others reveal 2, trash a non-Copper Treasure of *their* choice, discard the rest | ✓ (test) |
| Bureaucrat | Silver onto deck; others put a Victory card from hand onto their deck | ✓ |
| Cellar | Discard first, then draw that many (a shuffle includes the discarded cards) | ✓ |
| Council Room | Others must draw 1 | ✓ |
| Gardens | 1 VP per 10 cards, round down (37 → 3) | ✓ (test 40 → 8 with 2 Gardens, 39 → 3) |
| Harbinger | +1 Card +1 Action, then may put a card from discard on the deck | ✓ |
| Library | Draw to 7, may set aside Actions; set-aside cards are not shuffled in | ✓ (test) |
| Merchant | +$1 on the first Silver only, once per Merchant | ✓ (test) |
| Militia | Players with ≤ 3 cards discard nothing | ✓ (test) |
| Mine | Treasure gained into hand, playable this turn | ✓ |
| Moat | Reveal before the attack does anything; stays in hand | ✓ (test vs Witch) |
| Moneylender | +$3 only if a Copper was trashed | ✓ (test) |
| Poacher | Draw first; discard 1 per empty Supply pile (or the whole hand if fewer) | ✓ |
| Sentry, Vassal, Throne Room, Witch, Smithy, Village, Market, Festival, Laboratory, Workshop, Remodel, Chapel | Card text | ✓ (tests for Sentry, Vassal, Throne Room, Remodel, Market, Village, Smithy) |
| 1st-ed. only: Adventurer, Chancellor, Feast, Spy, Thief, Woodcutter | Card text from W (rulebook 2008) | ✓ (tests for Adventurer, Feast + Throne Room) |

## Recommended sets (Kingdom tab → Suggested sets)

All 11 match W exactly (asserted card by card in the "rules check" test):
2nd edition — First Game, Size Distortion, Deck Top, Sleight of Hand, Improvements, Silver & Gold.
1st edition — First Game, Big Money, Interaction, Size Distortion, Village Square.

## Weird-case rules (edge pass 2026-10-20, tests/edge.test.js)
No rule changed. These were checked against the rulebook and pinned with tests:
- Tie on VP: fewer turns wins; still tied, the win is shared (rulebook "Ending the game"). The end screen now says which.
- 3 empty Supply piles end the game, and the Curse pile counts as one (it's a Supply pile).
- Witch with no Curses left, Mine with no Gold left (must gain a cheaper Treasure), Workshop with nothing gainable, Poacher with more empty piles than cards, Militia vs 3 cards, Bandit/Spy/Vassal vs empty decks, Throne Room on Throne Room, Merchant + a Silver gained into hand by Mine: all match the card text.
- Not a rule: the site stops a game after round 80 (safety limit so two computers can't loop forever). The end screen and log now say so instead of naming a winner silently.

## Intrigue, 2nd edition (added 2026-10-28, tests/intrigue.test.js)
Source: Dominion Strategy wiki, [Intrigue](https://wiki.dominionstrategy.com/index.php/Intrigue) and each card's own page
(costs, types, card text, rulings, the recommended sets). Our card text is our own wording.
- Optional (Settings → Kingdom cards: Base only, the default / Base + Intrigue / Intrigue only). Base games are unchanged:
  the same seeds play the same games as before (old vs new code compared on 6 kingdoms).
- 26 kingdom cards: the 2016 second edition (Coppersmith, Great Hall, Saboteur, Scout, Secret Chamber, Tribute out;
  Courtier, Diplomat, Lurker, Mill, Patrol, Replace, Secret Passage in). Harem is shown under its 2024 name **Farm**.
- Victory kingdom piles (Nobles, Duke, Mill, Farm): 8 with 2 players, 12 with 3–4 (test "victory kingdom piles").
- Duke: 1 VP per Duchy. Farm: $2 Treasure + 2 VP. Nobles 2 VP, Mill 1 VP.
- Bridge: costs drop by $1 per Bridge played this turn (never below 0), for buying and for gaining (Swindler, Upgrade,
  Ironworks, Replace). Upgrade gains exactly $1 more; Swindler's victim gets a card of exactly the same cost, picked by the attacker.
- Diplomat reacts only with 5 or more cards in hand (draw 2, then discard 3); it can be shown before Moat.
- Masquerade passes to the next player who holds cards; everyone picks first, then all pass at once.
- Mining Village can only trash itself once (not on Throne Room's second play).
- Minion's attack hits players with 5 or more cards; Replace curses only when the gained card is a Victory card.
- Secret Passage on this site offers Top, 2nd…10th from top, or Bottom (a deep deck's exact middle positions are trimmed).

## Not covered (on purpose)
- 5–6 players (needs the separate Base Cards box).
- Choosing not to play a Treasure (no effect with base-set cards).
- Card text on screen is written in our own words, not copied from the cards.
