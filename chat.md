# Dominion Lab — chat log

## 2026-10-19 — first build + phase 2
- **Asked:** "do dominion" (base game vs computers, odds, best plan per kingdom, randomizer, Study). Phase 2: online play, exact rules and variants, ideas, art and design, no errors.
- **Decided:** generator-replay engine; computer levels from measured plans; Gardens rush fixed; 1st / 2nd / Both editions in Settings; online through the shared `_online` module.
- **Built:** whole site (index.html, js/*, original SVG art), docs/rules-check.md, docs/ideas.md (13 built, 7 skipped), tools for strength table and level measurement.
- **Verified:** `node tests/engine.test.js` (26 pass) and `node tests/online.test.mjs` (7 pass), each with a mutation that made a test fail. Two WebKit browsers played a full online game against live Firebase, including a reload and the host leaving. phone-view at 393px and desktop for every tab and a full game: no console errors, no overflow.
- **Open:** real iPhone check; Hard only 55% vs Medium.

## 2026-10-21 — visibility pass
- **Asked:** "for a lot of the games the cards or board layout is too small to easily see what's going on ... Consider parts of the board that are dense" (manager brief, all games).
- **Built:** app.js `handGroups`/`groupFan` (hand sorted, copies stacked with ×N, covered names left-aligned, loose layout when picking several), stack-tap mapping in `onHand`, played-card runs stacked with ×N, opponent's name in their play row, `ui.look` tap-to-read for played cards and opponent discards; index.html CSS for these. app.js?v=8.
- **Verified:** scratchpad vis/dominion: check.mjs 31 failures on the old build → 155/155 pass (WebKit, Chrome); taps.mjs 18/18 (stack-tap test failed 3/3 without the `onHand` mapping); 40 after-shots at 393x659, 320x568, 659x393, 1280x800, 1440x900: no page scroll, overflow or console errors; engine 26, edge 15, fx 13, online 7. One read-only reviewer; its regressions fixed (play order kept, badge off the cost coin, wider tap area on opponent discards).
- **Open:** phone supply names and played cards still small (tap to read); real iPhone.

## 2026-10-20 — edge pass (weird scenarios)
- **Asked:** "Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird." Plus: run the table-look reviewer that never ran; fix setup scrolling at 320 px and phone landscape.
- **Built:** end screen explains the ending (shared win, tiebreak, round limit) via engine `result.reason/tiebreak`; online computer and duplicate/blank names; 400 ms double-tap guard; Back closes overlays; two-tab sync; setup split into two merged panels with landscape 2-column grid; reviewer layout fixes (Empty chip, type lines, seats, SE landscape table, game-over info). Versions: engine 2, online-game 2, app 6, worker 2.
- **Verified:** tests edge 15 (5 failed before the fix), engine 26, online 7, fx 13. Headless WebKit scripts (scratchpad edge/dominion) at 8 sizes: before 22/32 setup checks failed, after all pass except 320x460; taps T1–T12 + D6–D8 pass (8 failed on the old code); layout S 96 checks pass.
- **Open:** style ideas from the reviewer left for Tim; 320x460 setup; real iPhone.

## 2026-10-20 — visual design pass
- **Asked:** "review them again for design improvements especially visually" (manager brief, all games).
- **Built:** CSS polish in index.html (laptop table, phone hand, SE rule, dark select, tiles, kingdom, settings); app.js `pop`→`popin` (played cards were taking the help bubble's style and could vanish on a tap).
- **Verified:** before/after WebKit shots of 9 states x phone/laptop (scratchpad design/dominion/), no page scroll or overflow; tray bug shown on old (3→2 cards after a tap) and fixed (3→3); 26 + 7 tests pass.
- **Open:** real iPhone look.

## 2026-10-20 — card art fix
- **Asked:** "the map of the US in TTR looks nothing like the US. Fix this and any other similar problems accross the games" (manager brief: Province art read as a blank wall).
- **Built:** js/art.js: Province = castle (two blue-coned towers, keep, red flags, gate, path, two hills); Harbinger (horn) and Poacher (bow + rabbit) re-centred so the tiles' crop no longer hides them. art.js?v=2.
- **Verified:** 26 + 7 tests pass; WebKit 393px + desktop game shots and art gallery incl. greyed tiles (scratchpad design/dominion-art/before|after); no overflow or console errors.
- **Open:** real iPhone look.

## 2026-10-20 — sounds, celebrations, animations
- **Asked:** "add opptional sounds ... win celebrations, and other fun annimations ... customizable in the settings" (manager brief, all games).
- **Built:** js/fx.js (copy of _fx), js/dom-fx.js (view diff → timed sounds + animations; own `trash`, `curse`, `block` sounds), app.js hooks (data-chip / data-ctr tags, error sound, Settings section), index.html (scripts, fx rows styled like the other switches, Animations off / Fast CSS), tests/fx.test.js.
- **Verified:** 13 fx tests (seen failing first: module missing, then a win/lose swap failed 3), 26 engine + 7 online pass. WebKit: full games (1 and 3 opponents, storage blocked) with no console errors, no scroll/overflow, no overlays left; shots of Settings, mid-game buy, win (star burst, VP count-up, confetti) at 393px + desktop (scratchpad design/dominion-fx/).
- **Open:** hearing it on a real iPhone; online fx in two live browsers.

## 2026-10-20 — real-table look
- **Asked:** make the game look like the real card layout on a real table, "like you're looking through a camera that is connected to a user's glasses" (manager brief, all games).
- **Built:** index.html game CSS rewritten (wood table, real Supply layout, stacked piles, real-proportion card faces + navy back, my deck/hand fan/discard at the bottom, opponents across the top, laptop side panel for big card/deck table/log); app.js renderGame rewritten + deal/flip/slide motion; dom-fx.js buys fly to the discard; css/table.css + js/table.js (copies of _table); js/fx.js recopied (1.0.3).
- **Verified:** 26 engine + 13 fx + 7 online tests pass. WebKit shots of setup/mid/late/end at 393x659, 320x568, 659x393, 1280x800, 1280x680: no console errors, no page scroll, no horizontal overflow on the table (scratchpad table/dominion/before|after). Motion script: ghosts deal and turn, nothing left hidden afterwards, play and buy land in the right place, phone + desktop.
- **Open:** independent reviewer agent not run (sub-agent limit); real iPhone look.

## 2026-10-27 — improvement pass (manager brief, all games)
- **Asked:** "start building every single improvement you can think of after your competitor analysis" / "make our boardgames the best in every single metric we can". Brief: Hard ≥ 65% vs Medium, variants, steal-list items, kits (_coach, _profile 1.1.0, _pwa 1.2.0, _fx), art + key moments, no empty bands. Online untouched (another builder).
- **Decided:** Hard = plan search v2 + endgame sense; Monte Carlo and v3 measured no better, dropped. No 5–6 players (needs Base Cards; Tim's call). Study tab = end-of-game review; treasures were already auto-played.
- **Built:** bots.js smartBuy; sim.js hardFor/PLAN_V/early plans/Medium gauntlet; app.js Undo, Daily, stats recording, quit = loss, guided game, Rules, My stats, laptop hover card box, PWA hook; js/domprofile.js, js/domcoach.js; kit copies + manifest + icons; art.js finish; dom-fx.js Province chime, pile-out, endnear. Tests smart (7), profile (6), fx +1.
- **Verified:** ladder 100×60: Hard vs Easy 80.3 → 82.3%, vs Medium 55.3 → 59.9%, Medium vs Easy 76.8%. New tests seen failing on the old code first (smart 4 fails, fx 2, Moat-undo 257/257 leaks). flows.mjs 19/19 in WebKit (tutorial, Undo, Daily, quit = loss, Rules/stats + Back); pwa-check 18/18; sizes 320x460 → 1440x900 in WebKit + Chrome: no overflow, no page errors, Deal/Daily/Undo visible. One reviewer: 2 bugs (Moat undo leak, Daily race) fixed.
- **Open:** 65% target missed (60%); sounds and Daily streak over real days not checked; real iPhone.

