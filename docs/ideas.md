# Ideas — data and theory additions (2026-10-19)

Brainstormed for Tim's "brainstorm what additions you can do… implement your good ideas".
**Build** = in the app now. **Skip** = not built, with the reason.

| # | Idea | Verdict | Why / where |
|---|---|---|---|
| 1 | Next-hand odds of $5 / $6 / $8, exact (hypergeometric, handles reshuffles) | **Build** | Play tab, odds bar. Exact math, no simulation noise. |
| 2 | Deck tracker: each card in draw / discard / hand / all | **Build** | Laptop side panel; tap the odds bar on phone. |
| 3 | Card strength table: each card + Big Money vs plain Big Money, 2,000 games | **Build** | Kingdom tab % and word (Strong / Good / Fair / Weak alone). |
| 4 | Best simple plan per kingdom (candidates vs Big Money, then a round robin) | **Build** | Kingdom tab; runs in a Web Worker and is cached. The Hard computer uses it. |
| 5 | Measured computer levels (Easy / Medium / Hard win rates) | **Build** | Play tab "?": Hard beats Easy 80%, Medium 55%; Medium beats Easy 77% (6,000 games each). |
| 6 | Buy hint: light up what the simulator would buy now | **Build** | Green dot on supply tiles plus a line in the prompt (Settings switch). |
| 7 | Study: every buy next to the simulator's buy, match rate | **Build** | Study tab. |
| 8 | Draw luck: money in your hands minus the exact expected money | **Build** | Study tab, in $ per turn. |
| 9 | Points race chart (VP after every turn) | **Build** | Study tab. |
| 10 | Empty-pile warning (3-pile ending) | **Build** | "Empty N" chip turns red at 2. |
| 11 | Opening advice: what the best plan buys on $4/$3 and $5/$2 | **Build** | Kingdom tab, under the best plan. |
| 12 | Opponent deck summary (what each computer owns, VP) | **Build** | Deck panel "Their decks". Public info in the real game: every gain is visible. |
| 13 | Penultimate Province Rule in the Hard bot | **Build (partial)** | Only the last-Province check is kept. The full rule measured 42% vs Big Money (it backfires for simple bots). |
| 14 | Win-probability graph during the game (rollouts each turn) | **Skip** | About 1,000 simulated games per turn would lag iPhones. Little gain over the points race. |
| 15 | "Points lost" per buy (rollouts comparing your buy with the sim's) | **Skip** | Same cost problem, and noisy at phone-friendly sample sizes. |
| 16 | Engine-building computer (village + draw chains) | **Skip** | Tried as candidate plans ("X + Festival engine"). They win in only a few kingdoms; a smarter engine bot is a big project. |
| 17 | Shuffle-luck replay ("what if you'd drawn average hands") | **Skip** | Draw luck already says it in one number. |
| 18 | Kingdom strength note for any 10 cards (fast/slow game, attack-heavy) | **Skip** | The per-card % plus the best plan already answer "what's strong here". |
| 19 | 5–6 player games | **Skip** | Needs the separate Base Cards box; Tim asked for the base game. |
| 20 | Pass-the-phone play | **Skip** | Hidden hands make one shared phone awkward; online rooms cover playing with friends. |
