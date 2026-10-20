# Dominion Lab — chat log

## 2026-10-19 — first build + phase 2
- **Asked:** "do dominion" (base game vs computers, odds, best plan per kingdom, randomizer, Study). Phase 2: online play, exact rules and variants, ideas, art and design, no errors.
- **Decided:** generator-replay engine; computer levels from measured plans; Gardens rush fixed; 1st / 2nd / Both editions in Settings; online through the shared `_online` module.
- **Built:** whole site (index.html, js/*, original SVG art), docs/rules-check.md, docs/ideas.md (13 built, 7 skipped), tools for strength table and level measurement.
- **Verified:** `node tests/engine.test.js` (26 pass) and `node tests/online.test.mjs` (7 pass), each with a mutation that made a test fail. Two WebKit browsers played a full online game against live Firebase, including a reload and the host leaving. phone-view at 393px and desktop for every tab and a full game: no console errors, no overflow.
- **Open:** real iPhone check; Hard only 55% vs Medium.
