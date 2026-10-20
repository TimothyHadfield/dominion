# Dominion Lab — chat log

## 2026-10-19 — first build + phase 2
- **Asked:** "do dominion" (base game vs computers, odds, best plan per kingdom, randomizer, Study). Phase 2: online play, exact rules and variants, ideas, art and design, no errors.
- **Decided:** generator-replay engine; computer levels from measured plans; Gardens rush fixed; 1st / 2nd / Both editions in Settings; online through the shared `_online` module.
- **Built:** whole site (index.html, js/*, original SVG art), docs/rules-check.md, docs/ideas.md (13 built, 7 skipped), tools for strength table and level measurement.
- **Verified:** `node tests/engine.test.js` (26 pass) and `node tests/online.test.mjs` (7 pass), each with a mutation that made a test fail. Two WebKit browsers played a full online game against live Firebase, including a reload and the host leaving. phone-view at 393px and desktop for every tab and a full game: no console errors, no overflow.
- **Open:** real iPhone check; Hard only 55% vs Medium.

## 2026-10-20 — visual design pass
- **Asked:** "review them again for design improvements especially visually" (manager brief, all games).
- **Built:** CSS polish in index.html (laptop table, phone hand, SE rule, dark select, tiles, kingdom, settings); app.js `pop`→`popin` (played cards were taking the help bubble's style and could vanish on a tap).
- **Verified:** before/after WebKit shots of 9 states x phone/laptop (scratchpad design/dominion/), no page scroll or overflow; tray bug shown on old (3→2 cards after a tap) and fixed (3→3); 26 + 7 tests pass.
- **Open:** real iPhone look.
