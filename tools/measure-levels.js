// Head-to-head strength of the three computer levels over random 2nd-edition kingdoms.
// Easy = Big Money. Medium = Big Money + the best single card (measured table).
// Hard = the best simple plan found by simulation for that kingdom (js/sim.js findBest).
// Run: node tools/measure-levels.js [kingdoms] [gamesPerPairPerKingdom] [base|intrigue|both] [firstKingdom]
'use strict';
const C = require('../js/cards.js');
const E = require('../js/engine.js');
const S = require('../js/sim.js');

const K = Number(process.argv[2]) || 100;
const G = Number(process.argv[3]) || 40;
const rnd = E.mulberry32(20261019);
const SET = process.argv[4] || 'base';
const FROM = Number(process.argv[5]) || 0;
const pool = C.pool(2, SET);
const tally = { 'Hard vs Easy': 0, 'Hard vs Medium': 0, 'Medium vs Easy': 0 };
const plans = {};
const t0 = Date.now();
for (let i = 0; i < FROM + K; i++) {
  const k = pool.slice().sort(() => rnd() - 0.5).slice(0, 10);
  if (i < FROM) continue;
  const easy = S.bigMoney();
  const med = S.mediumFor(k);
  const hard = S.hardFor(S.findBest(k).ranked[0].strat); // what the app plays: best plan + endgame sense
  plans[hard.label.replace(/\d /, '')] = (plans[hard.label.replace(/\d /, '')] || 0) + 1;
  tally['Hard vs Easy'] += S.versus(k, hard, easy, G, 500 + i * 101);
  tally['Hard vs Medium'] += S.versus(k, hard, med, G, 900 + i * 101);
  tally['Medium vs Easy'] += S.versus(k, med, easy, G, 1300 + i * 101);
}
console.log(SET + ': ' + K + ' kingdoms x ' + G + ' games per pairing (' + (K * G) + ' games each), ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
for (const key in tally) console.log(key + ': ' + (100 * tally[key] / K).toFixed(1) + '%');
console.log('Hard plans chosen:', JSON.stringify(plans));
