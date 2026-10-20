# Dominion Lab — project rules

Static site (GitHub Pages, repo `TimothyHadfield/dominion`, live https://timothyhadfield.github.io/dominion/).
Base-game Dominion (1st + 2nd edition) vs measured computers, live odds, best-plan simulator, study mode,
and online rooms through the shared module in `../_online/`. Read `progress.md` first.

- **No build step.** Plain UMD scripts in `js/` shared by browser, Web Worker and node tests. Bump `?v=N` on
  script tags in `index.html` and `js/worker.js` when a JS file changes.
- **Engine contract:** state = `{v, setup, actions}`; `DomEngine.apply(state, {seat, answer})` throws on illegal
  moves, `DomEngine.view(state, seat)` hides other hands and every draw order. Bots answer inside the engine.
  `js/online-game.js` adapts this to the shared online module's `game` interface; keep it that way.
- **`js/online.js` is a copy** of `../_online/online.js`. Never edit it here; recopy when the shared one changes.
- **Card text is our own words. Art is our own SVG** (`js/art.js`). No rulebook text, no publisher art.
- Tests: `node tests/engine.test.js` and `node tests/online.test.mjs`. Rules facts live in `docs/rules-check.md`
  and are asserted by the "rules check" test.
- Strength numbers: `node tools/build-strength.js` (writes `js/strength-data.js`, ~3 min) and
  `node tools/measure-levels.js 100 60` (~8 min). Put new level numbers in `STRENGTH_NOTE` in `js/app.js`.
- Tim's global rules apply: $0, no permission prompts, explicit `git add` paths, nothing inside `.claude` folders.
