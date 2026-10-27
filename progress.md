# Dominion Lab — progress

## START HERE
Read order: this file → CLAUDE.md → docs/rules-check.md → docs/ideas.md → chat.md.
Last updated: 2026-10-27 (improvement pass: stronger Hard, Undo, Daily, My stats, guided game + Rules, home-screen install, art + key moments).
Live: https://timothyhadfield.github.io/dominion/ · Repo: https://github.com/TimothyHadfield/dominion

## Goal right now
Dominion base game (1st + 2nd edition) vs 1–3 computers or online friends, with an odds layer, a best-plan finder per kingdom, a randomizer with strength notes, and a Study screen. Done and live; waiting on Tim's feedback.

## Status
| Part | State |
|---|---|
| Engine (all 39 base cards, both editions, 2–4 players) | Done. 26 engine tests. |
| Computers Easy / Medium / Hard | Done, measured 2026-10-27 (`node tools/measure-levels.js 100 60`, 6,000 games a pair): Hard beats Easy 82.3%, Medium 59.9% (was 55.3%); Medium beats Easy 76.8%. Ratings 1200 / 1410 / 1470. Hard = plan search v2 + endgame sense (`smart`: never ends the game on a losing buy, takes a winning game-ending buy). Target 65% vs Medium NOT reached. |
| Improvement pass (2026-10-27) | Undo in your own turn until something new shows (not Daily/guided; game counts "with help"); Daily kingdom vs Hard (same kingdom + shuffles for everyone, local best + streak); My stats + 10 achievements (`_profile` 1.1.0, js/domprofile.js); guided first game (9 steps) + Rules sheet (`_coach`, js/domcoach.js); home-screen install + offline (`_pwa` 1.2.0, pwa-check 18/18); fx.js re-copied; art finish (clouds/stars/sun, coin shine, vignette); Province chime, pile-out flash, last-2-Provinces pulse; laptop card box shows the hovered pile, else the sim's buy or last card bought. |
| Odds bar + deck tracker | Done (exact math). |
| Kingdom tab: presets, Random, swap, card %, best plan, opening | Done. Plan finder runs in a Web Worker. |
| Study tab: buys vs sim, draw luck, points race | Done. |
| Online rooms (shared `_online` module, Firebase `th-board-games`) | Done. Two-browser test passed: create, join, play to the end, reload mid-game, host leave. 7 online tests. |
| Rules check with sources | Done: docs/rules-check.md. |
| Design pass (2026-10-20) | Done: laptop supply tiles fill the column as tall cards, info box fixed height, bigger hand; phone hand 68x100; SE short-screen rule; dark select; tray "pop" class bug fixed. |
| Art fix (2026-10-20) | Province redrawn as a castle on hills (house → manor → castle trio); Harbinger and Poacher redrawn (subjects were cropped off the tiles). Others checked, fine. art.js?v=2. |
| Sound & effects (2026-10-20) | Done: js/fx.js (shared copy) + js/dom-fx.js (event diff → timed sounds/animations), Settings → "Sound & effects". 13 fx tests (`node tests/fx.test.js`). Map below. |
| Real-table look (2026-10-20) | Done: wood table from the player's seat. Supply laid out like the real game (basics Copper/Silver/Gold/Curse + Estate/Duchy/Province, Trash on laptop, 10 kingdom piles in 2 rows of 5 by cost), piles drawn as card stacks whose thickness tracks the count. Me at the bottom: deck (stack), hand fan, messy discard pile; play area above; opponents across the top (deck, hand of backs, discard). Real-proportion cards (59x92) with name banner, art, text box, type line, cost coin; navy card back. Motion: cards dealt face-down from the deck with a 3-D turn, played cards slide from hand, buys fly to the discard pile. Helpers kept (info plate, odds bar, log/deck table in laptop side panel or the log button). Uses shared `_table` kit copies css/table.css + js/table.js. |
| Edge pass (2026-10-20) | Done: 54 weird scenarios tested, 21 failed, 20 fixed (table below). 15 edge tests (`node tests/edge.test.js`). |
| Visibility pass (2026-10-21) | Done: my hand sorted (Actions, Treasures, Victory, Curses) with copies on one tight stack + "×N" badge, so each different card shows its name (11-card hand at 393px: 18px slivers → full names). Played cards: the same card played in a row stacks with "×N" (order kept); opponent's turn labelled with their name. Tap a played card or an opponent's discard pile to read it in the prompt box / laptop big card (`ui.look`). Checks in scratchpad vis/dominion (check.mjs 155, taps.mjs 18, WebKit + Chrome). |
| QA pass (2026-10-19, scratchpad dom-qa.mjs) | 15 edition × seats × level games played to the end with a reload mid-game; 6 kinds of corrupt saved data; 60 fast taps; hash/back. One bug found and fixed (saved opps 99 → 99 computers; settings now clamped on load). |

## Standing instructions (Tim's words)
- "do dominion"
- "build regular play online with a computer or other online players for all the games and their common varients that match exactly the play of the in-person game."
- "Really work on the webdesign of the games, aswell as art, fitting it with an iphone and computer"
- "make sure that everything works properlly without errors or whatnot... Make sure to get everything right like rules and artwork and specific numbers of cards"
- Common brief: $0, no copyrighted art or rulebook text, no page scroll on main screens, bottom tabs on phone, "?" explains why, choices in Settings.
- "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered." (2026-10-20)
- "could you also make sure that each of the games also have a look to them so that the game (either board or card layout) looks almost identical to how the board or card layout looks like in real life, so it's easy to understand if you've already played it before, and also so it feels more like you're actually playing in real life rather than you're playing it online. Even things like how youre cards or other things are laid out infront of you, make it look like they are actual cards laid out similar to how it looks like in real life. Make the decks look like actual decks. Make the board have the same design as it does in real life with the same layouts. It should look kind of like you're looking through a camera that is connected to a user's glasses that is playing in real life (not actually, but the layout and style of everything should be similar)." (2026-10-20)
- "for a lot of the games the cards or board layout is too small to easily see what's going on. ... Fix this so the view of what's happening and where everything is is very clear. Consider parts of the board that are dense in what's happening and if the user can reasonably see it." (2026-10-21)
- "I've noticed the games often have good user interfaces but could be improved especially when a scenario happens that the game might've not really thought about or whatnot. Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird." (2026-10-20)

## Edge pass scenarios (2026-10-20)
Full list: 54 scenarios in 5 families (rules R1–R19, people P1–P6, taps T1–T12, devices D1–D9, screens S1–S8). Rules via `tests/edge.test.js`; taps, devices and screens via headless WebKit at 8 sizes (393x659, 320x568, 320x460, 659x393, 568x320, 1280x800, 1280x600, 640x400 = 200% zoom).
| Family | Tested | Failed | Fixed | Fixes |
|---|---|---|---|---|
| Rules | 19 | 4 | 4 | Tiebreak / shared win / round-limit end now explained on the end screen and log (no rule changed) |
| People | 6 | 3 | 3 | Online computers named "Hard" / "Hard 1, Hard 2" not "Player 3"; same or blank names told apart; long names no longer cut short in landscape |
| Taps | 12 | 6 | 6 | Double tap on Buy phase / End turn / Confirm no longer skips a step (400 ms guard after the prompt changes); Back closes the log sheet, Quit confirm and "?" bubble instead of leaving the table |
| Devices | 9 | 4 | 3 | Setup fits without scrolling at 320 px and both phone landscapes; second tab follows the first instead of overwriting the game |
| Screens | 8 | 4 | 4 | "Empty" chip no longer covers odds; long type lines shrink; seats don't touch at 320 px/landscape; game-over shows the result instead of "nothing in play" |
Left: setup at 320x460 (SE with a browser bar) still hides "How Dominion works" under the tabs (Deal stays visible); opening "How Dominion works" scrolls inside the setup box by design.

## Event → sound map (js/dom-fx.js, from the log + turn records diff, so computers and online friends sound the same)
| Event | Sound | Animation |
|---|---|---|
| Deal (new game) / reshuffle | `shuffle` | deck bar pops (mine) |
| Card into my hand | `cardDeal` per card, 60 ms apart | existing deal-in, now started in step with the sound (≤ 400 ms) |
| Action played | `cardFlip` | existing pop-in in the tray |
| Treasures paid / Moneylender +$3 | `coins` | my $ counter counts up |
| Buy / gain | `cardSlide` | top card of the pile flies to my discard pile (mine) or their discard; "+N" VP float |
| Province bought | `province` (own: rising 4-note chime) + big moment | mine: star burst + `ding`; theirs: Prov chip pops |
| A Supply pile runs out (not the game-ending last Province) | `pileout` (own: low thud) | the pile flashes red and shakes |
| Provinces drop to 2 left | — | Prov chip flashes and pulses |
| Attack played (Militia, Witch, Bandit, Bureaucrat, Spy, Thief) | `hit` (full when it hits me, softer when mine) | my hand shakes / their chips shake |
| Curse gained | `curse` (own: sour falling pair) | chip flashes purple, "-1" |
| Trash / lost to Bandit, Thief | `trash` (own: paper crumple) | — |
| Discard, put on deck, Cellar | `cardFlip` (softer) | — |
| Moat block | `block` (own: shield clank) | chip pops |
| Thief steals | `capture` | — |
| Your turn after waiting (online only; vs computers it's instant) | `turn` | info box flashes |
| Illegal tap (2nd tap on an unaffordable tile / non-Action in Action phase, rejected move) | `error` | — |
| Game over | VP count-up on every chip, then `celebrate` win (confetti in my colour) / lose | |
Other players' sounds play at 0.75 volume. A whole computer turn is spaced out over ≤ 2.6 s; Fast = 0.55×.

## Traps
- `js/online.js` is a COPY of `../_online/online.js`. Never edit it here; recopy when the shared module changes.
- After changing any strategy in js/sim.js or js/bots.js: rerun `node tools/build-strength.js` (about 2.5 min) and `node tools/measure-levels.js`, then update STRENGTH_NOTE in js/app.js.
- No build step: bump `?v=` in index.html when changing a js file after the first deploy.
- wiki.dominionstrategy.com is behind a bot check; WebFetch fails. Use headless Playwright Chromium.
- WebKit logs "access control checks" for Firestore/worker requests cut off by a page reload. That is noise from the reload, not an app error.
- Online snapshots can arrive with `mine` empty for a moment; renderGame shows "Connecting…" then.
- Local test servers used ports 8231 and 8467. Old servers from past sessions still hold 8231 and serve stale files: use a fresh port (8793 on 10-20) and curl it first.
- `.pop` is the help bubble's class and the bubble code removes any `.pop` on click. Never reuse it on cards (played cards use `popin`).
- Card art is drawn in a 100x64 box with `slice`: phone tiles crop top/bottom, tall laptop tiles crop the sides (~x 12–88 visible). Keep each subject centred.
- `js/fx.js` is a COPY of `../_fx/fx.js`; never edit it here. Game-specific sounds go through `FX.define` in js/dom-fx.js.
- A DomEngine view shares its turn records with the live game (they keep changing): fx keeps `DomFx.snap(v)` as "prev", never the view itself.
- Chips carry `data-chip` (not `data-seat`: the lobby click handler uses `data-seat`).
- `css/table.css` and `js/table.js` are COPIES of `../_table/`; never edit them here.
- Supply card width uses container-query units (cqw/cqh) on `.supply`. FX.flyTo clones an element outside that container, so `fxDom.tile` sets `--cw` inline in px first (else the clone renders huge).
- WebKit ignores backface-visibility on the dealing ghost: faces swap via the `.half` class at the half turn. Don't "simplify" it back.
- Dimmed hand cards use a filter, not opacity (overlapping fan cards would show through).
- Double-tap guard: `ui.askKey` (turn|phase|pending|actions|buys|hand size) changes → `ui.btnLock` (performance.now clock) = render end + 400 ms, then extended to paint + 250 ms (layout/paint run after renderGame returns and took 100–600 ms under load). Taps are judged by `e.timeStamp` (when the finger landed). Buttons except deck/log ignore taps while locked. Test harness must wait for the lock before a deliberate tap.
- Overlays (log sheet, Quit confirm, "?" bubble) push a history state; Back closes them first (`ui.skipPop` when closed by hand). Don't remove the pushState in `sheet()`.
- `window.DomApp.ui` is exposed for tests only (also startGame, startDaily, startTutorial, undo, canUndo, openRules, openStats).
- Hard's plan cache key ends `#v<DomSim.PLAN_V>`; boot drops other versions. Bump PLAN_V when the plan search changes. Saved games keep the plan in their setup, so old games replay the same; the `smart` flag is added only in startGame (`DomSim.hardFor`), never to old setups. Online Hard (online-game.js) still gets the plain plan.
- Undo: `infoPrint` = turn + turn count + last log line by another player + every opponent's pile sizes + my draw size. Any change = new information = undo stack cleared. A Moat reveal moves no cards: the log line is what catches it (fixed 10-27; 257/257 leaks before, 0 after).
- Kit copies, never edit here: js/profile.js + css/profile.css (`_profile`), js/coach.js + css/coach.css (`_coach`), js/pwa.js + sw.js + tools/make-icons.mjs + tools/pwa-check.mjs (`_pwa`). All `-text` in .gitattributes. Bump `data-version` on pwa.js with every release.
- Tests: `node tests/engine.test.js` (26), `edge` (15), `smart` (7), `profile` (6), `fx` (14), `node tests/online.test.mjs` (7), `node tools/pwa-check.mjs` (18). Browser flow checks: scratchpad improve/dominion/flows.mjs (19) and moat.mjs.
- Guided game = DomCoach.GAME (seed 1: you open $4 then $3). Coach step titles are read by `.coach-title`.
- Playwright WebKit `touchscreen.tap` waits ~1 s per tap: test real double taps with two dispatched clicks 70 ms apart.
- My hand's DOM order = engine hand order (taps, deal motion); only positions are grouped (`handGroups` + `groupFan` override the TABLE.fan api's `layout`, which its ResizeObserver calls). The chosen copy goes on top of its stack, so `onHand` maps a tap on any copy of the chosen card to the chosen index (else a second tap on a lower copy reselected forever). Picking several cards (Militia, Cellar, Chapel) uses the loose layout: every copy gets its own room.
- `ui.look` (tap a played card / opponent discard) is separate from `ui.sel` on purpose: `ui.sel` equal to a pile name makes the next pile tap buy it.
- WebKit won't size an SVG by flex:1 or by top+bottom when absolutely positioned: give card art explicit heights (or calc()).

## Decisions
- Engine = generator replay: state `{v, setup, actions}`, `apply` validates, `view(state, seat)` hides hands and draw order.
- Computers chosen before the start are answered inside the engine (no Firestore writes); `game.bot` only for seats handed over mid-game.
- Hard = best plan from the finder; Medium = Big Money + the single best card; Easy = Big Money.
- Gardens rush reordered (Workshops first): went from 1% to 90% vs Big Money.
- Phone hand cards hide the type label (it was cramped); laptop shows it.
- Hand and play area group copies into stacks with "×N" (2026-10-21) instead of a fan of slivers.
- Design pass: selection = orange outline + glow, no movement; unaffordable tiles greyed; laptop info box height = big card height so picking a card never resizes it.
- 5–6 players and holding back Treasures not supported (see docs/rules-check.md). Still so after the 10-27 pass: 5–6 needs the Base Cards box (Tim's call).
- Hard v2 (10-27): adds "Big Money + 2 X, early" plans (X before Gold, 2nd copy at 11 cards; from per-card tuning: Witch 64% → 77% vs BM+Witch) and finalists also play Medium's plan. Tried and dropped: Monte Carlo rollout buys (42.7% vs Medium, 2.3 s a game), v3 finalists picked vs Medium (60.6%, no gain).
- Stats: games vs computer are rated; Undo games = "With help" (unrated); quitting mid-game = loss; guided and online games never count; a game left with no turn played is not counted.

## NOT verified
- A real iPhone (only Safari's engine at 393px via phone-view).
- Online with 3–4 humans at once (tested 2 humans; computers fill other seats in node tests).
- Hard beats Medium 60%, under the 65% target. Medium is already Big Money + the best card, so the gap is small; retuning Medium down is Tim's call.
- Improvement pass (10-27): Daily streak across real days, PWA install on a real iPhone, and the new sounds (chime, thud) never heard. 320x460 game screen has tiny supply tiles (same as before the pass).
- Sounds never heard: Playwright WebKit on Windows has no Web Audio; sound logic verified with a fake AudioContext in node only. Online fx (other humans' moves) verified by node diff tests, not in two live browsers.
- Real-table look: an outside reviewer ran in the edge pass (2026-10-20); its layout bugs were fixed. Its pure-style ideas (plaque buttons, no dimmed cards, bigger played cards, phone Trash pile, hide tabs in game) were left for Tim. Online table not shot in two live browsers (online node tests pass; same render path).
- Edge pass: setup at 320x460 (SE + browser bar) leaves "How Dominion works" under the tab bar. Two-tab sync tested locally only, not with online games (online already syncs through Firebase).
- Visibility pass: still small on phones (real-proportion cards in 574px): supply names 7px (393) / 5.5px (320), played cards 31px wide, opponents' discards 14px; all readable by tapping. Reviewer left items for Tim: desktop "Tap a card" box empty most of the time (fixed 10-27), "Hard 3:…" prompt cut at 320/landscape, "You" plate at the 320px edge.
- Design pass checked at 393x659, iPhone SE, 1280x800 and 1280x680 (WebKit). Not checked: laptops under ~650px tall, 3-opponent status row on SE.

## Rejected / parked
- ~~Win-probability graph~~: too slow on iPhones (see docs/ideas.md).
- ~~Full Penultimate Province Rule~~: measured worse (42% vs Big Money).
- ~~Pass-the-phone~~: hidden hands; online rooms cover it.
