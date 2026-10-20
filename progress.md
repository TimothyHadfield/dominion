# Dominion Lab — progress

## START HERE
Read order: this file → CLAUDE.md → docs/rules-check.md → docs/ideas.md → chat.md.
Last updated: 2026-10-20 (visual design pass).
Live: https://timothyhadfield.github.io/dominion/ · Repo: https://github.com/TimothyHadfield/dominion

## Goal right now
Dominion base game (1st + 2nd edition) vs 1–3 computers or online friends, with an odds layer, a best-plan finder per kingdom, a randomizer with strength notes, and a Study screen. Done and live; waiting on Tim's feedback.

## Status
| Part | State |
|---|---|
| Engine (all 39 base cards, both editions, 2–4 players) | Done. 26 engine tests. |
| Computers Easy / Medium / Hard | Done, measured (6,000 games each): Hard beats Easy 80%, Medium 55%; Medium beats Easy 77%. |
| Odds bar + deck tracker | Done (exact math). |
| Kingdom tab: presets, Random, swap, card %, best plan, opening | Done. Plan finder runs in a Web Worker. |
| Study tab: buys vs sim, draw luck, points race | Done. |
| Online rooms (shared `_online` module, Firebase `th-board-games`) | Done. Two-browser test passed: create, join, play to the end, reload mid-game, host leave. 7 online tests. |
| Rules check with sources | Done: docs/rules-check.md. |
| Design pass (2026-10-20) | Done: laptop supply tiles fill the column as tall cards, info box fixed height, bigger hand; phone hand 68x100; SE short-screen rule; dark select; tray "pop" class bug fixed. |
| QA pass (2026-10-19, scratchpad dom-qa.mjs) | 15 edition × seats × level games played to the end with a reload mid-game; 6 kinds of corrupt saved data; 60 fast taps; hash/back. One bug found and fixed (saved opps 99 → 99 computers; settings now clamped on load). |

## Standing instructions (Tim's words)
- "do dominion"
- "build regular play online with a computer or other online players for all the games and their common varients that match exactly the play of the in-person game."
- "Really work on the webdesign of the games, aswell as art, fitting it with an iphone and computer"
- "make sure that everything works properlly without errors or whatnot... Make sure to get everything right like rules and artwork and specific numbers of cards"
- Common brief: $0, no copyrighted art or rulebook text, no page scroll on main screens, bottom tabs on phone, "?" explains why, choices in Settings.

## Traps
- `js/online.js` is a COPY of `../_online/online.js`. Never edit it here; recopy when the shared module changes.
- After changing any strategy in js/sim.js or js/bots.js: rerun `node tools/build-strength.js` (about 2.5 min) and `node tools/measure-levels.js`, then update STRENGTH_NOTE in js/app.js.
- No build step: bump `?v=` in index.html when changing a js file after the first deploy.
- wiki.dominionstrategy.com is behind a bot check; WebFetch fails. Use headless Playwright Chromium.
- WebKit logs "access control checks" for Firestore/worker requests cut off by a page reload. That is noise from the reload, not an app error.
- Online snapshots can arrive with `mine` empty for a moment; renderGame shows "Connecting…" then.
- Local test servers used ports 8231 and 8467. Old servers from past sessions still hold 8231 and serve stale files: use a fresh port (8793 on 10-20) and curl it first.
- `.pop` is the help bubble's class and the bubble code removes any `.pop` on click. Never reuse it on cards (played cards use `popin`).
- WebKit won't size an SVG by flex:1 or by top+bottom when absolutely positioned: give card art explicit heights (or calc()).

## Decisions
- Engine = generator replay: state `{v, setup, actions}`, `apply` validates, `view(state, seat)` hides hands and draw order.
- Computers chosen before the start are answered inside the engine (no Firestore writes); `game.bot` only for seats handed over mid-game.
- Hard = best plan from the finder; Medium = Big Money + the single best card; Easy = Big Money.
- Gardens rush reordered (Workshops first): went from 1% to 90% vs Big Money.
- Phone hand cards hide the type label (it was cramped); laptop shows it.
- Design pass: selection = orange outline + glow, no movement; unaffordable tiles greyed; laptop info box height = big card height so picking a card never resizes it.
- 5–6 players and holding back Treasures not supported (see docs/rules-check.md).

## NOT verified
- A real iPhone (only Safari's engine at 393px via phone-view).
- Online with 3–4 humans at once (tested 2 humans; computers fill other seats in node tests).
- Medium vs Hard is close (55%); Hard is not much stronger than Medium.
- Design pass checked at 393x659, iPhone SE, 1280x800 and 1280x680 (WebKit). Not checked: laptops under ~650px tall, 3-opponent status row on SE.

## Rejected / parked
- ~~Win-probability graph~~: too slow on iPhones (see docs/ideas.md).
- ~~Full Penultimate Province Rule~~: measured worse (42% vs Big Money).
- ~~Pass-the-phone~~: hidden hands; online rooms cover it.
