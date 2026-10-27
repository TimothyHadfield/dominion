/* Runs the best-plan finder off the main thread so the page never freezes. */
importScripts('cards.js?v=1', 'bots.js?v=2', 'odds.js?v=1', 'engine.js?v=2', 'strength-data.js?v=1', 'sim.js?v=3');
self.onmessage = function (e) {
  const d = e.data;
  try {
    let last = 0;
    const r = self.DomSim.findBest(d.kingdom, {
      edition: d.edition,
      onProgress: function (x) { if (x - last >= 0.04 || x >= 1) { last = x; self.postMessage({ id: d.id, progress: x }); } },
    });
    self.postMessage({ id: d.id, result: r.ranked.map(function (x) { return { strat: x.strat, vsBM: x.vsBM, rr: x.rr }; }) });
  } catch (err) {
    self.postMessage({ id: d.id, error: String(err && err.message || err) });
  }
};
