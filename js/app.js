/* Dominion Lab: UI controller. One store object (localStorage 'dominion:v1'), render*() functions
   writing template strings, one delegated click handler per view. The game itself lives in
   DomEngine as {setup, actions}; a "table" object is the seat transport (local now, online later). */
(function () {
  'use strict';
  const VERSION = '1.0 · 2026-10-19';
  const { CARDS, is } = DomCards;
  const KEY = 'dominion:v1';
  let ME = 0; // my seat: 0 on this device, the room's seat online
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLORS = ['#f0b354', '#6ea8fe', '#e98bd0', '#6ee7a8'];
  const LEVEL_NOTE = { easy: 'Big Money', medium: 'Money + 1 card', hard: 'Best plan' };
  // Measured by tools/measure-levels.js 100 60 (100 random kingdoms x 60 games per pairing), 2026-10-19.
  const STRENGTH_NOTE = { games: '6,000', hardEasy: '80%', hardMedium: '55%', mediumEasy: '77%' };

  // ------------------------------------------------------------------ storage
  function fresh() {
    return { v: 1, settings: { edition: 2, odds: true, hints: true, opps: 1, level: 'hard' }, kingdom: null, plans: {}, game: null, last: null };
  }
  const store = (function () {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 1) {
        const out = Object.assign(fresh(), s, { settings: Object.assign(fresh().settings, s.settings || {}) });
        // saved data can be old or hand-edited: snap every setting back into its allowed values
        const st = out.settings, def = fresh().settings;
        if (![1, 2, 3].includes(st.opps)) st.opps = def.opps;
        if (!['easy', 'medium', 'hard'].includes(st.level)) st.level = def.level;
        if (![1, 2, 'mix'].includes(st.edition)) st.edition = def.edition;
        st.odds = st.odds !== false; st.hints = st.hints !== false;
        if (!out.plans || typeof out.plans !== 'object') out.plans = {};
        if (out.kingdom != null && (!Array.isArray(out.kingdom) || out.kingdom.length !== 10 || out.kingdom.some(c => !CARDS[c]))) out.kingdom = null;
        return out;
      }
    } catch (e) { /* private mode or bad JSON: start fresh */ }
    return fresh();
  })();
  function save() {
    try {
      const keys = Object.keys(store.plans);
      if (keys.length > 40) for (const k of keys.slice(0, keys.length - 40)) delete store.plans[k];
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch (e) { /* storage full or blocked: keep playing */ }
  }

  // ------------------------------------------------------------------ kingdom + plans
  const rulesEd = () => (store.settings.edition === 1 ? 1 : 2);
  function randomKingdom() {
    const pool = DomCards.pool(store.settings.edition).slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, 10);
  }
  const byCost = (a, b) => CARDS[a].cost - CARDS[b].cost || a.localeCompare(b);
  if (!store.kingdom || store.kingdom.length !== 10 || store.kingdom.some(c => !CARDS[c])) store.kingdom = DomCards.PRESETS[0].cards.slice();
  const planKey = (k, ed) => k.slice().sort().join('|') + '#' + ed;

  let worker = null;
  const waiting = {};
  let jobId = 0;
  function getWorker() {
    if (worker !== null) return worker;
    try {
      worker = new Worker('js/worker.js?v=1');
      worker.onmessage = e => {
        const w = waiting[e.data.id];
        if (!w) return;
        if (e.data.progress != null) { w.progress(e.data.progress); return; }
        delete waiting[e.data.id];
        if (e.data.error) w.reject(new Error(e.data.error)); else w.resolve(e.data.result);
      };
      worker.onerror = () => { worker = false; };
    } catch (e) { worker = false; }
    return worker;
  }
  const planJobs = {};
  // Best simple plans for a kingdom, cached in storage. onProgress(0..1) while simulating.
  function getPlan(kingdom, ed, onProgress) {
    const key = planKey(kingdom, ed);
    if (store.plans[key]) return Promise.resolve(store.plans[key]);
    if (planJobs[key]) { planJobs[key].listeners.push(onProgress); return planJobs[key].p; }
    const job = { listeners: [onProgress] };
    const progress = x => job.listeners.forEach(f => f && f(x));
    job.p = new Promise((resolve, reject) => {
      const w = getWorker();
      const done = r => { store.plans[key] = r; save(); delete planJobs[key]; resolve(r); };
      if (w) {
        const id = ++jobId;
        waiting[id] = { resolve: done, reject, progress };
        w.postMessage({ id, kingdom, edition: ed });
      } else {
        setTimeout(() => {
          const r = DomSim.findBest(kingdom, { edition: ed });
          done(r.ranked.map(x => ({ strat: x.strat, vsBM: x.vsBM, rr: x.rr })));
        }, 30);
      }
    });
    planJobs[key] = job;
    return job.p;
  }

  // ------------------------------------------------------------------ table (seat transport)
  // Local table: every seat is on this device (you + computers). An online table will expose
  // the same view()/act() so the screens don't care where a seat lives.
  function LocalTable(state) { this.state = state; }
  LocalTable.prototype.view = function (seat) { return DomEngine.view(this.state, seat); };
  LocalTable.prototype.act = function (seat, answer) { this.state = DomEngine.apply(this.state, { seat, answer }); return this.state; };

  let table = null;
  if (store.game && store.game.state) {
    try { table = new LocalTable(store.game.state); table.view(ME); } catch (e) { table = null; store.game = null; save(); }
  }

  // Online table: the same view() over the shared online module (js/online.js + free Firebase).
  // The module and Firebase load only when someone opens online play.
  function OnlineTable(room) { this.online = true; this.room = room; this.snap = room.view(); }
  OnlineTable.prototype.view = function () { return DomOnlineGame.viewFromSnap(this.snap); };
  const net = { room: null, snap: null, busy: false, sentV: null, timer: null, savedLast: false, connecting: false };
  function loadOnline() {
    if (net.room) return Promise.resolve(net.room);
    return import(new URL('js/online.js?v=1', location.href).href).then(mod => {
      if (net.room) return net.room;
      net.room = mod.createOnline({ game: DomOnlineGame.game, gameId: 'dominion', botDelayMs: 700 });
      net.room.on('change', onNet);
      net.room.on('error', msg => { unbusy(); toast(String(msg)); if (ui.tab === 'play') renderPlay(); });
      return net.room;
    });
  }
  function unbusy() { net.busy = false; clearTimeout(net.timer); }
  function backToLocal() {
    ME = 0; net.savedLast = false;
    table = store.game && store.game.state ? new LocalTable(store.game.state) : null;
  }
  function onNet(snap) {
    net.snap = snap;
    if (net.busy && snap.v !== net.sentV) unbusy();
    if (snap.status === 'playing' || snap.status === 'finished') {
      if (!table || !table.online) { table = new OnlineTable(net.room); resetSel(); ui.prevTurns = -1; net.savedLast = false; }
      table.snap = snap;
      ME = snap.mySeat >= 0 ? snap.mySeat : 0;
      if (snap.status === 'finished' && snap.pub && !net.savedLast) { net.savedLast = true; store.last = { view: DomOnlineGame.viewFromSnap(snap) }; save(); }
    } else if (table && table.online) backToLocal();
    if (snap.status === 'closed' || snap.status === 'left') {
      store.online = false; save();
      if (snap.status === 'closed') toast('The room was closed');
    }
    if (ui.tab === 'play') renderPlay();
  }
  function leaveOnline() {
    const r = net.room;
    store.online = false; ui.online = false; save();
    backToLocal(); resetSel();
    if (r) r.leave().catch(() => {});
    renderPlay();
  }
  async function onlineBtn(k) {
    if (k === 'open') {
      ui.online = true; renderPlay();
      loadOnline().catch(() => toast('Online play couldn’t load. Check your internet.'));
      return;
    }
    if (k === 'back') {
      if (net.snap && net.snap.status === 'lobby') { confirmBox('Leave this room?', 'Leave', leaveOnline); return; }
      ui.online = false; renderPlay(); return;
    }
    if (k === 'start') {
      if (net.connecting) return;
      net.connecting = true; renderPlay();
      const r = await net.room.start();
      net.connecting = false;
      if (!r.ok) toast(r.message);
      renderPlay(); return;
    }
    if (k !== 'create' && k !== 'join') return;
    const nameEl = $('#on-name');
    if (nameEl) { store.settings.name = nameEl.value.trim().slice(0, 20); save(); }
    const name = store.settings.name || 'Player';
    const codeEl = $('#on-code');
    const code = codeEl ? codeEl.value.trim().toUpperCase() : '';
    if (k === 'join' && code.length !== 5) { toast('Room codes have 5 letters'); return; }
    if (net.connecting) return;
    net.connecting = true; renderPlay();
    let r;
    try {
      const room = await loadOnline();
      if (k === 'create') {
        const ed = rulesEd(), kd = store.kingdom.slice();
        const cached = store.plans[planKey(kd, ed)];
        const plan = cached ? cached[0].strat : DomSim.quickPlan(kd);
        const seats = ['human'].concat(new Array(store.settings.opps).fill('empty'));
        r = await room.createRoom({ name, seats, options: { kingdom: kd, edition: ed, level: store.settings.level, plan } });
      } else r = await room.joinRoom(code, name);
    } catch (e) { r = { ok: false, message: 'Online play couldn’t load. Check your internet.' }; }
    net.connecting = false;
    if (r.ok) { store.online = true; save(); } else toast(r.message);
    renderPlay();
  }

  // ------------------------------------------------------------------ ui state
  const ui = { online: false, tab: 'play', sel: null, selHand: -1, picks: [], prevTurns: -1, prevHand: 0, prevPlay: 0, studyAll: false, starting: false, planProgress: 0 };
  function resetSel() { ui.sel = null; ui.selHand = -1; ui.picks = []; }

  // ------------------------------------------------------------------ helpers
  function mainType(name) {
    const t = CARDS[name].types;
    if (t.indexOf('Curse') >= 0) return 'Curse';
    if (t.indexOf('Reaction') >= 0) return 'Reaction';
    if (t.indexOf('Attack') >= 0) return 'Attack';
    if (t.indexOf('Treasure') >= 0) return 'Treasure';
    if (t.indexOf('Victory') >= 0) return 'Victory';
    return 'Action';
  }
  function face(name, o) {
    o = o || {};
    const c = CARDS[name];
    const cls = ['cf', mainType(name), o.size || '', o.cls || ''].join(' ');
    return '<div class="' + cls + '"' + (o.attr || '') + ' style="' + (o.delay ? 'animation-delay:' + o.delay + 'ms' : '') + '">' +
      '<div class="nm">' + esc(name) + '</div>' + DomArt.svg(name) +
      (o.size === 'big' ? '<div class="tx">' + esc(c.text) + '</div>' : '') +
      '<div class="ft"><span class="cost">' + c.cost + '</span><span>' + esc(c.types.join(' · ').replace('Action · ', '')) + '</span></div></div>';
  }
  // red -> green for "good" numbers (tight range given per use)
  function heat(x, lo, hi) {
    const f = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
    return 'hsl(' + Math.round(f * 130) + ', 70%, 62%)';
  }
  const pct = x => Math.round(x * 100) + '%';
  function strengthOf(name) {
    const S = window.DomStrength;
    if (!S || !S.byCard[name]) return null;
    return S.byCard[name];
  }
  function strengthWord(w) { return w >= 0.7 ? 'Strong' : w >= 0.57 ? 'Good' : w >= 0.45 ? 'Fair' : 'Weak alone'; }
  const qBtn = text => '<button class="q" data-q="' + esc(text) + '" aria-label="Why?">?</button>';
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }
  function confirmBox(msg, yes, onYes) {
    const back = document.createElement('div');
    back.className = 'confirm-back';
    back.innerHTML = '<div class="panel"><p style="margin:0 0 14px">' + esc(msg) + '</p><div class="row" style="justify-content:flex-end">' +
      '<button class="btn ghost" data-c="no">Cancel</button><button class="btn primary" data-c="yes">' + esc(yes) + '</button></div></div>';
    back.addEventListener('click', e => {
      const b = e.target.closest('[data-c]');
      if (e.target === back || b) { back.remove(); if (b && b.dataset.c === 'yes') onYes(); }
    });
    document.body.appendChild(back);
  }
  function sheet(title, html) {
    closeSheet();
    const back = document.createElement('div');
    back.className = 'sheet-back'; back.id = 'sheet';
    back.innerHTML = '<div class="sheet"><div class="row"><h3 class="grow">' + esc(title) + '</h3><button class="btn small ghost" data-close>Close</button></div><div class="scroll">' + html + '</div></div>';
    back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) closeSheet(); });
    document.body.appendChild(back);
  }
  function closeSheet() { const s = $('#sheet'); if (s) s.remove(); }

  // ------------------------------------------------------------------ tabs
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    showTab(b.dataset.tab, true);
  });
  function showTab(tab, push) {
    ui.tab = tab;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + tab));
    if (push) try { history.pushState({ tab }, '', '#' + tab); } catch (e) { /* file:// */ }
    render();
  }
  // Back goes to where you just were (the previous tab)
  window.addEventListener('popstate', e => { showTab((e.state && e.state.tab) || 'play', false); });

  // help bubbles
  document.addEventListener('click', e => {
    const old = $('.pop');
    const q = e.target.closest('[data-q]');
    if (old) old.remove();
    if (!q || (old && old.dataset.for === q.dataset.q)) return;
    const pop = document.createElement('div');
    pop.className = 'pop'; pop.textContent = q.dataset.q; pop.dataset.for = q.dataset.q;
    document.body.appendChild(pop);
    const r = q.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let x = Math.min(window.innerWidth - w - 12, Math.max(12, r.left + r.width / 2 - w / 2));
    let y = r.bottom + 8;
    if (y + h > window.innerHeight - 8) y = r.top - h - 8;
    pop.style.left = x + 'px'; pop.style.top = Math.max(8, y) + 'px';
  });

  function render() {
    if (ui.tab === 'play') renderPlay();
    else if (ui.tab === 'kingdom') renderKingdom();
    else if (ui.tab === 'study') renderStudy();
    else renderSettings();
  }

  // ================================================================== PLAY
  const vPlay = $('#v-play');
  function renderPlay() { if (table) renderGame(); else if (ui.online) renderOnline(); else renderSetup(); }

  function renderOnline() {
    const s = net.snap;
    const st = s ? s.status : 'none';
    let body;
    if (net.connecting && st !== 'lobby') body = '<div class="panel"><b>Connecting…</b><p class="muted small" style="margin:0">Talking to the game server.</p></div>';
    else if (st === 'joining') body = '<div class="panel"><b>Joining…</b><p class="muted small" style="margin:0">Waiting for the host to give you a seat.</p></div>';
    else if (st === 'lobby') {
      const host = s.isHost;
      const o = s.options || {};
      const seats = s.seats.map((x, i) => {
        const who = x.kind === 'human' ? esc(x.name || 'Player') + (i === s.mySeat ? ' <span class="muted">(you)</span>' : '') + (x.online ? '' : ' <span class="muted">· away</span>') :
          x.kind === 'computer' ? 'Computer' : '<span class="muted">Open seat</span>';
        let b = '';
        if (host && i !== s.mySeat) b = x.kind === 'empty' ? '<button class="btn small" data-seat="' + i + '" data-kind="computer">Computer</button>' :
          '<button class="btn small ghost" data-seat="' + i + '" data-kind="empty">' + (x.kind === 'human' ? 'Remove' : 'Open') + '</button>';
        return '<div class="seatrow"><span class="dot" style="background:' + COLORS[i % 4] + '"></span><span class="grow">' + who + '</span>' + b + '</div>';
      }).join('');
      body = '<div class="panel" style="align-items:center;gap:4px"><span class="label">Room code</span><div class="code-big">' + esc(s.code) + '</div>' +
        '<p class="muted small" style="margin:0;text-align:center">Friends open this site, tap Play online and type the code.</p></div>' +
        '<div class="panel"><span class="label">Seats</span><div class="seats">' + seats + '</div>' +
        (o.kingdom ? '<span class="label">Kingdom · ' + (o.edition === 1 ? '1st' : '2nd') + ' edition</span><div class="kmini">' + o.kingdom.slice().sort(byCost).map(c => '<span>' + esc(c) + '</span>').join('') + '</div>' : '') +
        (host ? '<button class="btn primary" data-on="start" style="width:100%"' + (net.connecting ? ' disabled' : '') + '>' + (net.connecting ? 'Starting…' : 'Start') + '</button>' +
          '<p class="muted small" style="margin:0">Open seats become ' + esc(cap(o.level || 'hard')) + ' computers.</p>' :
          '<p class="muted small" style="margin:0">Waiting for the host to start…</p>') + '</div>';
    } else {
      body = '<div class="panel"><span class="label">Your name</span>' +
        '<input class="txt" id="on-name" maxlength="20" autocomplete="nickname" placeholder="Name" value="' + esc(store.settings.name || '') + '">' +
        '<button class="btn primary" data-on="create" style="width:100%">Create a room</button>' +
        '<p class="muted small" style="margin:0">Uses your kingdom, number of opponents and computer level. Open seats can be friends or computers.</p></div>' +
        '<div class="panel"><span class="label">Join a friend</span><div class="row">' +
        '<input class="txt code" id="on-code" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Code">' +
        '<button class="btn primary" data-on="join">Join</button></div></div>';
    }
    vPlay.innerHTML = '<div class="setup"><div class="row"><button class="btn small ghost" data-on="back">Back</button><span class="grow"></span><span class="label">Play online</span></div>' + body + '</div>';
  }

  function renderSetup() {
    const s = store.settings;
    const k = store.kingdom.slice().sort(byCost);
    const lv = STRENGTH_NOTE ? 'Measured over ' + STRENGTH_NOTE.games + ' simulated games each: Hard beats Easy ' + STRENGTH_NOTE.hardEasy +
      ', Hard beats Medium ' + STRENGTH_NOTE.hardMedium + ', Medium beats Easy ' + STRENGTH_NOTE.mediumEasy + '.' :
      'Easy buys only money. Medium adds the strongest single card. Hard plays the best plan the simulator finds for this kingdom.';
    vPlay.innerHTML = '<div class="setup">' +
      '<div class="hero"><img src="icon.svg" alt=""><div><h1>Dominion Lab</h1><p>The base game vs measured computers, with live odds.</p></div></div>' +
      '<div class="panel">' +
      '<div class="row"><span class="label grow">Kingdom</span><button class="btn small" data-go="kingdom">Change</button></div>' +
      '<div class="kmini">' + k.map(c => '<span>' + esc(c) + '</span>').join('') + '</div>' +
      '<div class="label">Opponents</div><div class="seg" data-set="opps">' + [1, 2, 3].map(n => '<button aria-pressed="' + (s.opps === n) + '" data-v="' + n + '">' + n + '</button>').join('') + '</div>' +
      '<div class="row"><span class="label grow">Computer</span>' + qBtn(lv) + '</div>' +
      '<div class="seg" data-set="level">' + ['easy', 'medium', 'hard'].map(l => '<button aria-pressed="' + (s.level === l) + '" data-v="' + l + '">' + l[0].toUpperCase() + l.slice(1) + '<small>' + LEVEL_NOTE[l] + '</small></button>').join('') + '</div>' +
      '<button class="btn primary" data-start style="width:100%">Deal</button>' +
      '<button class="btn" data-on="open" style="width:100%">Play online</button>' +
      '</div>' +
      (store.last ? '<button class="btn ghost" data-go="study">Study your last game</button>' : '') +
      '<details class="panel" style="gap:6px"><summary style="cursor:pointer;font-weight:650">How Dominion works</summary>' +
      '<p class="muted" style="margin:8px 0 0;font-size:13.5px">Everyone starts with 7 Coppers and 3 Estates. Each turn: play one Action, then spend your Treasure to buy one card, then discard everything and draw 5 new cards. ' +
      'Bought cards go to your discard pile and come back when you reshuffle, so your deck improves as you go. The game ends when the Provinces run out or any 3 piles are empty. Most victory points wins; on a tie, fewer turns wins.</p></details>' +
      '</div>';
  }

  // Deal is instant: Hard uses the simulated plan if it's ready, else the best measured single-card plan.
  function startGame() {
    const s = store.settings;
    const k = store.kingdom.slice();
    const ed = rulesEd();
    const cached = store.plans[planKey(k, ed)];
    const best = cached ? cached[0].strat : DomSim.quickPlan(k);
    const mk = () => (s.level === 'easy' ? DomSim.bigMoney() : s.level === 'medium' ? DomSim.mediumFor(k) : best);
    const lvl = s.level[0].toUpperCase() + s.level.slice(1);
    const players = [{ name: 'You' }];
    for (let i = 0; i < s.opps; i++) players.push({ name: s.opps > 1 ? lvl + ' ' + (i + 1) : lvl, bot: mk() });
    const setup = { seed: (Math.random() * 4294967296) >>> 0, kingdom: k, edition: ed, players, advisor: best, maxRounds: 80 };
    table = new LocalTable(DomEngine.newGame(setup));
    store.game = { state: table.state, started: Date.now(), planReady: !!cached };
    resetSel(); ui.prevTurns = -1;
    save();
    renderPlay();
  }

  vPlay.addEventListener('click', e => {
    const t = e.target;
    const go = t.closest('[data-go]');
    if (go) { showTab(go.dataset.go, true); return; }
    const segb = t.closest('[data-set] button');
    if (segb) {
      const key = segb.parentElement.dataset.set;
      store.settings[key] = key === 'opps' ? Number(segb.dataset.v) : segb.dataset.v;
      save(); renderPlay(); return;
    }
    if (t.closest('[data-start]')) { startGame(); return; }
    const on = t.closest('[data-on]');
    if (on) { onlineBtn(on.dataset.on); return; }
    const sb = t.closest('[data-seat]');
    if (sb && net.room) { net.room.setSeat(Number(sb.dataset.seat), sb.dataset.kind); return; }
    if (!table) return;
    const v = table.view(ME);
    const p = v.pending;
    const tile = t.closest('[data-tile]');
    const hc = t.closest('[data-hand]');
    const lc = t.closest('[data-list]');
    const btn = t.closest('[data-btn]');
    if (tile) onTile(tile.dataset.tile, v, p);
    else if (hc) onHand(Number(hc.dataset.hand), v, p);
    else if (lc) onList(Number(lc.dataset.list), p);
    else if (btn) onButton(btn.dataset.btn, v, p);
  });

  function tileAllowed(name, v, p) {
    if (!p || !(v.supply[name] > 0)) return false;
    if (p.kind === 'buy') return CARDS[name].cost <= v.coins;
    if (p.kind === 'gain') return CARDS[name].cost <= p.maxCost && (!p.filter || is(name, p.filter));
    return false;
  }
  function handAllowed(i, v, p) {
    const c = v.me.hand[i];
    if (!p || !c) return false;
    if (p.kind === 'action') return is(c, 'Action');
    if (p.kind === 'pickHand') return !p.filter || is(c, p.filter);
    return false;
  }
  function act(answer) {
    if (table.online) {
      // one move per room version, so a double tap can't send two
      if (net.busy) return;
      net.busy = true; net.sentV = table.snap.v;
      clearTimeout(net.timer); net.timer = setTimeout(() => { unbusy(); }, 12000);
      resetSel(); renderGame();
      table.room.act({ answer }).then(r => { if (!r.ok) { unbusy(); toast(r.message); renderGame(); } });
      return;
    }
    try { table.act(ME, answer); } catch (e) { toast(e.message); return; }
    store.game.state = table.state;
    const v = table.view(ME);
    if (v.over && !store.game.finished) { store.game.finished = true; store.last = { state: table.state }; }
    save();
    resetSel();
    renderPlay();
  }
  function onTile(name, v, p) {
    if (tileAllowed(name, v, p)) {
      if (ui.sel === name) { act(name); return; }
      ui.sel = name;
    } else ui.sel = ui.sel === name ? null : name;
    ui.selHand = -1;
    renderGame();
  }
  function onHand(i, v, p) {
    if (p && p.kind === 'pickHand' && handAllowed(i, v, p)) {
      const at = ui.picks.indexOf(i);
      if (at >= 0) ui.picks.splice(at, 1);
      else if (p.max === 1) ui.picks = [i];
      else if (ui.picks.length < p.max) ui.picks.push(i);
      ui.sel = v.me.hand[i];
      renderGame(); return;
    }
    if (p && p.kind === 'action' && handAllowed(i, v, p)) {
      if (ui.selHand === i) { act(i); return; }
      ui.selHand = i; ui.sel = v.me.hand[i];
      renderGame(); return;
    }
    ui.sel = ui.sel === v.me.hand[i] && ui.selHand === i ? null : v.me.hand[i];
    ui.selHand = ui.sel ? i : -1;
    renderGame();
  }
  function onList(i, p) {
    if (!p || p.kind !== 'pickList') return;
    if (p.only && p.only.indexOf(i) < 0) return;
    const at = ui.picks.indexOf(i);
    if (at >= 0) ui.picks.splice(at, 1);
    else if (p.max === 1) ui.picks = [i];
    else if (ui.picks.length < p.max) ui.picks.push(i);
    ui.sel = p.cards[i];
    renderGame();
  }
  function onButton(b, v, p) {
    switch (b) {
      case 'play': if (ui.selHand >= 0) act(ui.selHand); break;
      case 'tobuy': act(-1); break;
      case 'buy': case 'gain': if (ui.sel) act(ui.sel); break;
      case 'end': case 'skip': act(null); break;
      case 'confirm': act(ui.picks.slice()); break;
      case 'yes': act(true); break;
      case 'no': act(false); break;
      case 'deck': sheet('Your deck', deckHTML(v)); break;
      case 'log': sheet('What happened', logHTML(v)); break;
      case 'quit':
        if (table.online) confirmBox(v.over ? 'Leave this room?' : 'Leave this online game? A computer takes your seat.', 'Leave', leaveOnline);
        else confirmBox('Quit this game? It can\'t be resumed.', 'Quit', () => { table = null; store.game = null; save(); resetSel(); renderPlay(); });
        break;
      case 'new':
        if (table.online) { leaveOnline(); break; }
        table = null; store.game = null; save(); resetSel(); renderPlay(); break;
      case 'study': showTab('study', true); break;
    }
  }

  function nameOf(v, seat) { return seat === ME ? 'You' : v.players[seat].name; }
  function promptFor(v, p) {
    const by = v.players[v.cur].name;
    const attacker = v.cur === ME ? '' : by + '’s ';
    switch (p.kind) {
      case 'action': return ['Your turn: play Actions', v.actions + ' action' + (v.actions === 1 ? '' : 's') + ' left. Tap a card twice to play it.'];
      case 'buy': return ['Buy: $' + v.coins + ' · ' + v.buys + ' buy' + (v.buys === 1 ? '' : 's'), 'Tap a card twice to buy it.'];
      case 'gain': {
        const where = p.dest === 'hand' ? ' into your hand' : '';
        const what = p.filter ? 'a ' + p.filter : 'a card';
        return [cap(p.reason) + ': gain ' + what + ' up to $' + p.maxCost + where, 'Tap a lit card twice.'];
      }
      case 'yesno': {
        switch (p.reason) {
          case 'moat': return [attacker + (p.attack || 'attack') + ': show your Moat?', 'Showing it makes you safe from this attack.'];
          case 'vassal': return ['Vassal flipped ' + p.card + '. Play it?', 'Playing it doesn’t use up an Action.'];
          case 'moneylender': return ['Moneylender: trash a Copper for +$3?', ''];
          case 'library': return ['Library drew ' + p.card + '. Set it aside?', 'Set-aside cards are discarded; you draw another instead.'];
          case 'chancellor': return ['Chancellor: move your deck into your discard pile?', 'Good when your deck has bad cards left.'];
          case 'spy': return ['Spy: ' + (p.target === ME ? 'your' : nameOf(v, p.target) + '’s') + ' top card is ' + p.card + '. Discard it?', ''];
          case 'thief-gain': return ['Thief: take the ' + p.card + ' for yourself?', 'Otherwise it stays in the trash.'];
        }
        return ['Yes or no?', ''];
      }
      case 'pickHand': {
        const n = p.min === p.max ? p.min : (p.min ? p.min + '–' : 'up to ') + p.max;
        const T = {
          cellar: ['Cellar: discard any cards', 'You draw one card for each card you discard.'],
          chapel: ['Chapel: trash up to 4 cards', 'Trashed cards leave the game.'],
          militia: [attacker + 'Militia: discard ' + p.min, 'Keep your best 3 cards.'],
          poacher: ['Poacher: discard ' + p.min, 'One card per empty Supply pile.'],
          bureaucrat: [attacker + 'Bureaucrat: put a Victory card on your deck', ''],
          throne: ['Throne Room: pick an Action to play twice', ''],
          mine: ['Mine: pick a Treasure to upgrade', 'You gain a Treasure costing up to $3 more, into your hand.'],
          remodel: ['Remodel: pick a card to trash', 'Then gain a card costing up to $2 more.'],
          'artisan-top': ['Artisan: put a card from your hand onto your deck', 'You’ll draw it next turn.'],
        };
        const tt = T[p.reason] || ['Pick ' + n + ' card' + (p.max === 1 ? '' : 's'), ''];
        return [tt[0], tt[1] || ('Pick ' + n + '.')];
      }
      case 'pickList': {
        const T = {
          harbinger: ['Harbinger: put a discarded card on your deck?', 'Pick one, or confirm with none.'],
          'sentry-trash': ['Sentry: trash any of these?', 'Next you can discard the rest.'],
          'sentry-discard': ['Sentry: discard any of these?', 'The rest go back on your deck.'],
          'sentry-top': ['Sentry: which card goes on top?', 'You draw the top card first.'],
          bandit: [attacker + 'Bandit: which Treasure do you lose?', ''],
          thief: ['Thief: pick the Treasure to trash', ''],
        };
        return T[p.reason] || ['Pick', ''];
      }
    }
    return ['', ''];
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  function oppSummary(v) {
    // the other players' turns since my previous turn
    const mine = [];
    v.turns.forEach((t, i) => { if (t.seat === ME) mine.push(i); });
    const end = v.cur === ME && mine.length ? mine[mine.length - 1] : v.turns.length;
    const startAt = v.cur === ME ? (mine.length > 1 ? mine[mine.length - 2] + 1 : 0) : (mine.length ? mine[mine.length - 1] + 1 : 0);
    return v.turns.slice(startAt, end).filter(t => t.seat !== ME).map(t => '<b>' + esc(v.players[t.seat].name) + '</b>: ' + (t.played.length ? esc(t.played.join(', ')) + ' → ' : '') +
      (t.bought.length ? esc(t.bought.join(', ')) : 'nothing')).join(' · ');
  }

  function oddsCells(v) {
    let dist, note = '';
    if (v.cur === ME) { const r = DomOdds.forView(v); dist = r.dist; if (r.reshuffle) note = 'reshuffle'; }
    else {
      const m = DomOdds.money(v.me.hand);
      dist = new Array(m + 1).fill(0); dist[m] = 1;
    }
    const cells = [5, 6, 8].map(x => {
      const pr = DomOdds.atLeast(dist, x);
      return '<span>$' + x + '+ <span class="pct" style="color:' + heat(pr, 0.1, 0.8) + '">' + pct(pr) + '</span></span>';
    }).join('');
    return { cells, note, mean: DomOdds.mean(dist) };
  }

  function deckHTML(v) {
    const me = v.me;
    const owned = v.players[ME].owned;
    const names = Object.keys(owned).sort((a, b) => (owned[b] - owned[a]) || byCost(a, b));
    const hp = {};
    for (const c of me.hand) hp[c] = (hp[c] || 0) + 1;
    for (const c in me.playCounts) hp[c] = (hp[c] || 0) + me.playCounts[c];
    const cell = n => '<td class="' + (n ? '' : 'z') + '">' + (n || 0) + '</td>';
    let h = '<table class="dk"><tr><th>Card</th><th>Draw</th><th>Discard</th><th>Hand</th><th>All</th></tr>';
    for (const c of names) {
      h += '<tr><td><span class="tswatch" style="background:var(--t-' + mainType(c).toLowerCase() + ')"></span>' + esc(c) + '</td>' +
        cell(me.drawCounts[c]) + cell(me.discardCounts[c]) + cell(hp[c]) + cell(owned[c]) + '</tr>';
    }
    const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
    h += '<tr><td><b>Total</b></td>' + cell(sum(me.drawCounts)) + cell(sum(me.discardCounts)) + cell(sum(hp)) + cell(v.players[ME].total) + '</tr></table>';
    h += '<div class="label" style="margin:12px 0 4px">Their decks</div>';
    for (const pl of v.players) {
      if (pl.seat === ME) continue;
      const o = pl.owned;
      h += '<p style="margin:0 0 6px;font-size:12.5px"><b>' + esc(pl.name) + '</b> <span class="muted">(' + pl.total + ' cards, ' + pl.vp + ' VP)</span><br>' +
        Object.keys(o).sort(byCost).map(c => o[c] + ' ' + esc(c)).join(', ') + '</p>';
    }
    const tr = Object.keys(v.trash);
    if (tr.length) h += '<div class="label" style="margin:10px 0 4px">Trash</div><p style="margin:0;font-size:12.5px">' + tr.map(c => v.trash[c] + ' ' + esc(c)).join(', ') + '</p>';
    return h;
  }
  function logHTML(v) {
    const items = v.log.slice().reverse().map(l => '<li class="' + (l.p === ME ? 'me' : '') + '"><span class="r">' + l.r + '</span>' +
      (l.p >= 0 ? esc(nameOf(v, l.p)) + ' ' : '') + esc(l.text) + '</li>').join('');
    return '<ul class="log">' + (items || '<li>Nothing yet.</li>') + '</ul>';
  }

  function renderGame() {
    const v = table.view(ME);
    // online: the private half of a snapshot (my hand) can land a moment after the public half
    if (!v || !v.me) { vPlay.innerHTML = '<div class="setup"><p class="muted">Connecting…</p></div>'; return; }
    const p = v.pending;
    const s = store.settings;
    const handEl = $('.hand', vPlay);
    const keepScroll = handEl ? handEl.scrollLeft : 0;
    // animation bookkeeping: whole hand deals in at the start of a new turn of mine
    const myTurns = v.turns.filter(t => t.seat === ME).length;
    const newTurn = myTurns !== ui.prevTurns;
    const handFrom = newTurn ? 0 : Math.min(ui.prevHand, v.me.hand.length);
    const play = v.cur === ME ? v.players[ME].play : v.players[v.cur].play;
    const playFrom = newTurn ? 0 : Math.min(ui.prevPlay, play.length);
    ui.prevTurns = myTurns; ui.prevHand = v.me.hand.length; ui.prevPlay = play.length;

    // status
    const order = [];
    for (let k = 0; k < v.players.length; k++) order.push(v.players[k]);
    const away = i => !!(table.online && table.snap.seats && table.snap.seats[i] && !table.snap.seats[i].online);
    const chips = order.map(pl => '<span class="chip' + (pl.seat === v.cur && !v.over ? ' turn' : '') + (away(pl.seat) ? ' off' : '') + '"><span class="dot" style="background:' + COLORS[pl.seat % 4] + '"></span><span class="nmx">' + esc(pl.name) + '</span> <b>' + pl.vp + '</b></span>').join('');
    const empty = Object.keys(v.supply).filter(k => v.supply[k] === 0).length;
    const status = '<div class="status"><div class="chips">' + chips +
      '<span class="chip" title="Provinces left">Prov <b>' + v.supply.Province + '</b></span>' +
      (empty ? '<span class="chip" style="border-color:' + (empty >= 2 ? 'var(--bad)' : 'var(--line)') + '">Empty <b>' + empty + '</b></span>' : '') + '</div>' +
      '<button class="icon-btn" id="btn-sheet-log" data-btn="log" aria-label="Log"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg></button>' +
      '<button class="icon-btn" data-btn="quit" aria-label="Quit game"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';

    // supply
    const basics = ['Copper', 'Silver', 'Gold', 'Estate', 'Duchy', 'Province', 'Curse'];
    const names = basics.concat(v.kingdom.slice().sort(byCost));
    const hint = s.hints && p && p.kind === 'buy' ? (v.turns[v.turns.length - 1].suggest || []) : [];
    const supply = '<div class="supply">' + names.map(n => {
      const allowed = tileAllowed(n, v, p);
      const cls = ['tile', mainType(n), v.supply[n] === 0 ? 'empty' : '', allowed ? 'can' : (p && (p.kind === 'buy' || p.kind === 'gain') ? 'dim' : ''),
        ui.sel === n && ui.selHand < 0 ? 'sel' : '', hint.indexOf(n) >= 0 ? 'hint' : ''].join(' ');
      return '<div class="' + cls + '" data-tile="' + esc(n) + '">' + DomArt.svg(n) + '<span class="cost">' + CARDS[n].cost + '</span><span class="cnt">' + v.supply[n] + '</span><div class="tn">' + esc(n) + '</div></div>';
    }).join('') + '</div>';

    // info
    let p1 = '', p2 = '', mine = false;
    if (v.over) {
      const r = v.result;
      const win = r.winners.length > 1 ? 'Shared win!' : (r.winners[0] === ME ? 'You win!' : esc(v.players[r.winners[0]].name) + ' wins');
      p1 = win + ' ' + r.vp.join(' – ');
      p2 = order.map(pl => '<b>' + esc(pl.name) + '</b> ' + pl.vp + ' VP in ' + pl.turns + ' turns').join(' · ');
    } else if (p) {
      const t = promptFor(v, p);
      p1 = esc(t[0]); p2 = esc(t[1]); mine = true;
      if (p.kind === 'buy' && s.hints && hint.length) p2 = 'Simulator would buy: <b>' + esc(hint.join(', ')) + '</b>';
      if (p.kind === 'action' && !ui.sel) { const os = oppSummary(v); if (os) p2 = os; }
      if (p.kind === 'buy' && !s.hints) { const os = oppSummary(v); if (os) p2 = os; }
    } else {
      p1 = 'Waiting for ' + esc(v.players[v.waitingOn != null ? v.waitingOn : v.cur].name) + '…';
      if (table.online && table.snap.hostAway) p2 = 'The host’s connection dropped. Another player takes over in about a minute.';
      else if (table.online) p2 = 'Room ' + esc(table.snap.code);
    }
    if (ui.sel && CARDS[ui.sel]) {
      const c = CARDS[ui.sel];
      p2 = '<b>' + esc(ui.sel) + '</b> · $' + c.cost + ' · ' + esc(c.text) + (v.supply[ui.sel] != null ? ' <span>(' + v.supply[ui.sel] + ' left)</span>' : '');
    }
    const infoCard = ui.sel && CARDS[ui.sel] ? face(ui.sel, { size: 'big' }) : '';
    const info = '<div class="info' + (mine ? ' mine' : '') + '"><div class="info-card">' + infoCard + '</div><div class="grow"><div class="p1">' + p1 + '</div><div class="p2">' + p2 + '</div></div></div>';

    // tray: a choice list, or the cards in play + counters
    let tray;
    if (p && p.kind === 'pickList') {
      tray = '<div class="tray"><div class="cards">' + p.cards.map((c, i) => face(c, {
        size: 'mini', cls: (ui.picks.indexOf(i) >= 0 ? 'sel' : '') + (p.only && p.only.indexOf(i) < 0 ? ' dim' : ' can'), attr: ' data-list="' + i + '"',
      })).join('') + '</div><span class="cap">Pick</span></div>';
    } else {
      const who = v.cur === ME ? 'You' : v.players[v.cur].name;
      tray = '<div class="tray"><div class="cards">' + (play.length ? play.map((c, i) => face(c, { size: 'mini', cls: i >= playFrom ? 'popin' : '' })).join('') : '<span class="cap">' + esc(who) + ': nothing in play</span>') + '</div>' +
        '<div class="counters"><span>Actions <b>' + (v.cur === ME ? v.actions : '–') + '</b></span><span>Buys <b>' + (v.cur === ME ? v.buys : '–') + '</b></span><span>$ <b>' + (v.cur === ME ? v.coins : '–') + '</b></span></div></div>';
    }

    // odds
    let odds = '';
    if (s.odds) {
      const o = oddsCells(v);
      odds = '<div class="odds" data-btn="deck"><span class="label">Next hand</span><div class="cells">' + o.cells + '</div>' +
        '<span class="deck">Deck ' + v.players[ME].total + ' · draw ' + v.me.drawSize + '</span>' +
        qBtn('Chance your next 5-card hand has at least this much money from Treasures, worked out exactly from what is left in your draw pile (and your discard pile if you will reshuffle). Action cards can add more. Tap the bar for your deck.') + '</div>';
    } else odds = '<div class="odds" data-btn="deck"><span class="label">Deck</span><span class="deck grow">' + v.players[ME].total + ' cards · draw ' + v.me.drawSize + ' · discard ' + Object.values(v.me.discardCounts).reduce((a, b) => a + b, 0) + '</span></div>';

    // hand
    const hand = '<div class="hand">' + (v.me.hand.length ? v.me.hand.map((c, i) => {
      const allowed = handAllowed(i, v, p);
      const picked = (p && p.kind === 'pickHand' && ui.picks.indexOf(i) >= 0) || ui.selHand === i;
      const dim = p && (p.kind === 'pickHand' || p.kind === 'action') && !allowed;
      return face(c, { cls: (allowed ? 'can ' : '') + (picked ? 'sel ' : '') + (dim ? 'dim ' : '') + (i >= handFrom ? 'deal' : ''), attr: ' data-hand="' + i + '"', delay: i >= handFrom ? (i - handFrom) * 60 : 0 });
    }).join('') : '<span class="muted" style="font-size:13px;padding:0 4px 40px">' + (v.cur === ME && v.phase === 'buy' ? 'Your Treasures are in play.' : 'No cards in hand.') + '</span>') + '</div>';

    // buttons
    let acts = '';
    const B = (k, label, cls, dis) => '<button class="btn ' + (cls || '') + '" data-btn="' + k + '"' + (dis ? ' disabled' : '') + '>' + label + '</button>';
    if (v.over) acts = B('study', 'Study this game') + B('new', 'New game', 'primary');
    else if (p) {
      switch (p.kind) {
        case 'action': acts = (ui.selHand >= 0 ? B('play', 'Play ' + esc(v.me.hand[ui.selHand]), 'warm') : '') + B('tobuy', 'Buy phase', 'primary'); break;
        case 'buy': {
          const ok = ui.sel && tileAllowed(ui.sel, v, p);
          acts = (ok ? B('buy', 'Buy ' + esc(ui.sel), 'warm') : '') + B('end', 'End turn', ok ? '' : 'primary');
          break;
        }
        case 'gain': {
          const ok = ui.sel && tileAllowed(ui.sel, v, p);
          acts = B('gain', ok ? 'Gain ' + esc(ui.sel) : 'Pick a card', 'warm', !ok) + (p.optional ? B('skip', 'Skip') : '');
          break;
        }
        case 'pickHand': case 'pickList': {
          const n = ui.picks.length;
          const okp = n >= p.min && n <= p.max;
          acts = B('confirm', n ? 'Confirm (' + n + ')' : (p.min ? 'Pick ' + p.min : 'Confirm none'), 'primary', !okp);
          break;
        }
        case 'yesno': {
          const L = { moat: ['Show Moat', 'Don’t'], vassal: ['Play it', 'No'], moneylender: ['Trash Copper', 'No'], library: ['Set aside', 'Keep it'], chancellor: ['Yes', 'No'], spy: ['Discard', 'Leave it'], 'thief-gain': ['Take it', 'Trash it'] }[p.reason] || ['Yes', 'No'];
          acts = B('yes', L[0], 'primary') + B('no', L[1]);
          break;
        }
      }
    }
    const side = '<div id="g-side"><div class="panel deckbox"><div class="row" style="margin-bottom:6px"><span class="label grow">Your deck</span>' +
      qBtn('Draw = still in your draw pile (you know what, not the order). Discard = waiting for the next reshuffle. Hand = in your hand or in play this turn.') +
      '</div><div class="scroll">' + deckHTML(v) + '</div></div>' +
      '<div class="panel logbox"><div class="label" style="margin-bottom:6px">What happened</div><div class="scroll">' + logHTML(v) + '</div></div></div>';

    vPlay.innerHTML = '<div id="game">' + status + supply + info + tray + odds + hand + '<div class="acts">' + acts + '</div>' + side + '</div>';
    const h2 = $('.hand', vPlay);
    if (h2 && !newTurn) h2.scrollLeft = keepScroll;
  }

  // ================================================================== KINGDOM
  const vK = $('#v-kingdom');
  function renderKingdom() {
    const k = store.kingdom.slice().sort(byCost);
    const ed = store.settings.edition;
    const presets = DomCards.PRESETS.filter(pr => ed === 'mix' || pr.ed === Number(ed));
    const rows = k.map(n => {
      const st = strengthOf(n);
      const w = st ? st.win : null;
      return '<div class="krow"><div class="thumb" style="border-color:var(--t-' + mainType(n).toLowerCase() + ')">' + DomArt.svg(n) + '</div>' +
        '<div class="kt"><div class="kn"><span class="cost">' + CARDS[n].cost + '</span>' + esc(n) + '</div><div class="kx">' + esc(CARDS[n].text) + '</div></div>' +
        (w != null ? '<div class="str"><span class="pct" style="color:' + heat(w, 0.35, 0.8) + '">' + pct(w) + '</span>' + strengthWord(w) + '</div>' : '') +
        '<button class="icon-btn" data-swap="' + esc(n) + '" aria-label="Swap ' + esc(n) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/></svg></button></div>';
    }).join('');
    const key = planKey(store.kingdom, rulesEd());
    const plans = store.plans[key];
    let plan;
    if (plans) {
      plan = plans.slice(0, 3).map((x, i) => '<div class="pl"><span class="rk">' + (i + 1) + '</span><span class="grow">' + esc(x.strat.label) + '</span>' +
        '<span class="pct" style="color:' + heat(x.vsBM, 0.45, 0.85) + '">' + pct(x.vsBM) + '</span></div>').join('') +
        (function () {
          const op = DomSim.opening(plans[0].strat, store.kingdom);
          const two = a => a.map(c => c || 'nothing').map(esc).join(' + ');
          return '<div class="row" style="font-size:13px;gap:6px"><span class="label">Opening</span><span class="grow">$4/$3: <b>' + two(op['4/3']) + '</b> · $5/$2: <b>' + two(op['5/2']) + '</b></span>' +
            qBtn('Your first two hands always add up to $7: either $4 and $3, or $5 and $2 (1 game in 6). This is what plan 1 buys with each split.') + '</div>';
        })() +
        '<div class="muted" style="font-size:12px">% = wins vs plain Big Money. Ranked by a round robin between the top plans.</div>';
    } else {
      plan = '<div class="muted" style="font-size:13px">Simulating thousands of games…</div><div class="bar"><i style="width:' + Math.round(ui.planProgress * 100) + '%"></i></div>';
      getPlan(store.kingdom.slice(), rulesEd(), x => { ui.planProgress = x; const b = $('#v-kingdom .bar i'); if (b) b.style.width = Math.round(x * 100) + '%'; })
        .then(() => { if (ui.tab === 'kingdom') renderKingdom(); }).catch(() => {});
    }
    vK.innerHTML = '<div class="kwrap">' +
      '<div class="khead row"><span class="label grow">Kingdom · ' + (ed === 'mix' ? 'both editions' : ed === 1 ? '1st edition' : '2nd edition') + '</span>' +
      '<select data-preset aria-label="Suggested sets"><option value="">Suggested sets</option>' + presets.map(pr => '<option>' + esc(pr.name) + '</option>').join('') + '</select>' +
      '<button class="btn small primary" data-random>Random</button></div>' +
      '<div class="klist scroll">' + rows + '</div>' +
      '<div class="kside panel plan"><div class="row"><span class="label grow">Best simple plan</span>' +
      qBtn('Each plan is a simple buy rule (like "Big Money + 2 Smithies"). The simulator plays every plan against plain Big Money, then the best few play each other. The Hard computer uses plan 1. Card % on the left: that card alone added to Big Money.') + '</div>' + plan +
      '<button class="btn" data-playk>Play this kingdom</button></div>' +
      '</div>';
  }
  vK.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-random]')) { store.kingdom = randomKingdom(); ui.planProgress = 0; save(); renderKingdom(); return; }
    const sw = t.closest('[data-swap]');
    if (sw) {
      const pool = DomCards.pool(store.settings.edition).filter(c => store.kingdom.indexOf(c) < 0);
      if (!pool.length) return;
      const i = store.kingdom.indexOf(sw.dataset.swap);
      store.kingdom[i] = pool[Math.floor(Math.random() * pool.length)];
      ui.planProgress = 0; save(); renderKingdom(); return;
    }
    if (t.closest('[data-playk]')) {
      if (table) { toast('Finish or quit the current game first'); showTab('play', true); return; }
      showTab('play', true);
    }
  });
  vK.addEventListener('change', e => {
    if (!e.target.matches('[data-preset]')) return;
    const pr = DomCards.PRESETS.find(x => x.name === e.target.value);
    if (pr) { store.kingdom = pr.cards.slice(); ui.planProgress = 0; save(); renderKingdom(); }
  });

  // ================================================================== STUDY
  const vS = $('#v-study');
  function sameBuys(a, b) { return a.slice().sort().join(',') === b.slice().sort().join(','); }
  function renderStudy() {
    // newest finished game first (a local game's state, or an online game's final view), else the game in progress
    const g0 = store.game && store.game.state;
    let ME = 0, v = null;
    const src = (g0 && store.game.finished) ? g0 : (store.last && (store.last.state || store.last.view)) || g0;
    if (!src) {
      vS.innerHTML = '<div class="set"><div class="panel"><b>Nothing to study yet.</b><p class="muted" style="margin:6px 0 0">Play a game. Afterwards you’ll see every buy next to what the simulator would buy, your draw luck, and the points race.</p></div></div>';
      return;
    }
    try { if (src.setup) v = DomEngine.view(src, 0); else { v = src; ME = v.seat || 0; } } catch (e) { vS.innerHTML = '<div class="set"><div class="panel">This saved game can’t be opened.</div></div>'; return; }
    const mineT = v.turns.filter(t => t.seat === ME && t.bought);
    const counted = mineT.filter(t => t.suggest);
    const match = counted.filter(t => sameBuys(t.bought, t.suggest)).length;
    const luckT = mineT.filter(t => t.handMoney != null && t.expMoney != null);
    const luck = luckT.length ? luckT.reduce((a, t) => a + t.handMoney - t.expMoney, 0) / luckT.length : 0;
    const r = v.result;
    const head = v.over ? (r.winners.length > 1 ? 'Shared win' : r.winners[0] === ME ? 'You won' : esc(v.players[r.winners[0]].name) + ' won') : 'Game in progress';
    const sum = '<div class="panel s-head"><div class="sum"><span class="big">' + head + '</span><span class="muted">' + v.players.map(pl => esc(pl.name) + ' ' + pl.vp).join(' · ') + '</span></div>' +
      '<div class="sum" style="margin-top:8px"><span>Matched the simulator <b class="pct" style="color:' + heat(counted.length ? match / counted.length : 0, 0.3, 0.9) + '">' + match + ' / ' + counted.length + '</b> ' +
      qBtn('A turn matches when you bought exactly what the Hard computer’s plan would buy with the same money. The plan is simple, so a mismatch isn’t always a mistake (engines and attacks can beat it).') + '</span>' +
      '<span>Draw luck <b class="pct" style="color:' + heat(luck, -1, 1) + '">' + (luck >= 0 ? '+' : '') + luck.toFixed(2) + ' $</b> ' +
      qBtn('Average money your 5-card hands had, minus what your deck was expected to give at that moment (exact odds over the cards you could have drawn). Positive = lucky shuffles.') + '</span></div></div>';
    // points race
    const series = v.players.map(() => []);
    v.turns.forEach((t, i) => { if (t.vpAfter) t.vpAfter.forEach((x, s) => series[s].push([i, x])); });
    const maxX = Math.max(1, v.turns.length - 1), maxY = Math.max(10, ...series.flat().map(p => p[1]));
    const W = 320, H = 120;
    const line = (pts, c) => '<polyline fill="none" stroke="' + c + '" stroke-width="2" points="' + pts.map(p => (8 + p[0] / maxX * (W - 16)).toFixed(1) + ',' + (H - 8 - p[1] / maxY * (H - 18)).toFixed(1)).join(' ') + '"/>';
    const chart = '<div class="panel s-chart chart"><div class="row"><span class="label grow">Points race</span>' + v.players.map(pl => '<span style="font-size:12px;color:' + COLORS[pl.seat % 4] + '">' + esc(pl.name) + '</span>').join('') + '</div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><line x1="8" y1="' + (H - 8) + '" x2="' + (W - 8) + '" y2="' + (H - 8) + '" stroke="#2a3042"/>' + series.map((sr, s) => line(sr, COLORS[s % 4])).join('') + '</svg></div>';
    const rows = v.turns.filter(t => ui.studyAll || t.seat === ME).map(t => {
      const ok = t.suggest && sameBuys(t.bought, t.suggest);
      return '<tr><td class="n">' + t.round + '</td>' + (ui.studyAll ? '<td>' + esc(v.players[t.seat].name) + '</td>' : '') + '<td class="n">$' + t.coins + '</td><td>' +
        (t.bought.length ? esc(t.bought.join(', ')) : '<span class="muted">nothing</span>') + '</td><td>' + (t.suggest && t.suggest.length ? esc(t.suggest.join(', ')) : '<span class="muted">nothing</span>') +
        '</td><td class="' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓' : '✗') + '</td></tr>';
    }).join('');
    const list = '<div class="s-list" style="display:flex;flex-direction:column;min-height:0;gap:8px"><div class="seg" data-study><button aria-pressed="' + !ui.studyAll + '" data-v="me">Your turns</button><button aria-pressed="' + ui.studyAll + '" data-v="all">Everyone</button></div>' +
      '<div class="scroll" style="flex:1"><table class="turns"><tr><th>Rnd</th>' + (ui.studyAll ? '<th>Who</th>' : '') + '<th>$</th><th>Bought</th><th>Sim</th><th></th></tr>' + rows + '</table></div></div>';
    vS.innerHTML = '<div class="study">' + sum + chart + list + '</div>';
  }
  vS.addEventListener('click', e => {
    const b = e.target.closest('[data-study] button');
    if (b) { ui.studyAll = b.dataset.v === 'all'; renderStudy(); }
  });

  // ================================================================== SETTINGS
  const vSet = $('#v-settings');
  function renderSettings() {
    const s = store.settings;
    const sw = (k, label, sub) => '<div class="setrow"><div class="grow"><b>' + label + '</b><span>' + sub + '</span></div><label class="switch"><input type="checkbox" data-sw="' + k + '"' + (s[k] ? ' checked' : '') + '><span></span></label></div>';
    vSet.innerHTML = '<div class="set scroll">' +
      '<div class="panel"><div class="row"><span class="label grow">Card set</span>' + qBtn('2nd edition (2016) swapped six cards for seven new ones and made Moneylender, Mine and Throne Room optional ("you may"). 1st edition plays those three as must-do. Both = any of the 32 cards, with 2nd-edition rules.') + '</div>' +
      '<div class="seg" data-ed style="margin-top:8px"><button aria-pressed="' + (s.edition === 2) + '" data-v="2">2nd edition</button><button aria-pressed="' + (s.edition === 1) + '" data-v="1">1st edition</button><button aria-pressed="' + (s.edition === 'mix') + '" data-v="mix">Both</button></div>' +
      (table ? '<p class="muted" style="font-size:12.5px;margin:8px 0 0">Applies to your next game.</p>' : '') + '</div>' +
      '<div class="panel">' + sw('odds', 'Show odds', 'Chance of $5 / $6 / $8 next hand') + sw('hints', 'Buy hints', 'Light up what the simulator would buy') + '</div>' +
      '<div class="panel"><div class="setrow"><div class="grow"><b>Online play</b><span>Friends on their own phones, any mix with computers.</span></div><button class="btn small" data-online>Open</button></div></div>' +
      '<div class="panel"><div class="setrow"><div class="grow"><b>Reset</b><span>Clears the saved game, last game and settings.</span></div><button class="btn small" data-reset>Reset</button></div></div>' +
      '<p class="ver">Dominion Lab ' + VERSION + ' · <a href="../">more board &amp; card games</a><br>Fan-made study tool, not affiliated with the publisher. Card art drawn for this site.</p>' +
      '</div>';
  }
  vSet.addEventListener('click', e => {
    const b = e.target.closest('[data-ed] button');
    if (b) {
      store.settings.edition = b.dataset.v === 'mix' ? 'mix' : Number(b.dataset.v);
      const pool = DomCards.pool(store.settings.edition);
      if (store.kingdom.some(c => pool.indexOf(c) < 0)) store.kingdom = randomKingdom();
      save(); renderSettings(); return;
    }
    if (e.target.closest('[data-online]')) { if (!table) ui.online = true; showTab('play', true); if (table && !table.online) toast('Finish or quit the current game first'); return; }
    if (e.target.closest('[data-reset]')) confirmBox('Clear everything saved on this device?', 'Reset', () => {
      try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ }
      location.reload();
    });
  });
  vSet.addEventListener('change', e => {
    const k = e.target.dataset.sw;
    if (k) { store.settings[k] = e.target.checked; save(); }
  });

  // ------------------------------------------------------------------ boot
  const start = (location.hash || '').slice(1);
  if (['play', 'kingdom', 'study', 'settings'].indexOf(start) >= 0) ui.tab = start;
  try { history.replaceState({ tab: ui.tab }, '', '#' + ui.tab); } catch (e) { /* ignore */ }
  showTab(ui.tab, false);
  // warm the plan cache for the current kingdom so "Deal" is instant
  if (!table) getPlan(store.kingdom.slice(), rulesEd()).catch(() => {});
  // back into an online room after a reload
  if (store.online) {
    ui.online = true; net.connecting = true; renderPlay();
    loadOnline().then(r => r.resume()).then(ok => {
      net.connecting = false;
      if (!ok) { store.online = false; ui.online = false; save(); }
      renderPlay();
    }).catch(() => { net.connecting = false; renderPlay(); });
  }
  window.DomApp = { store, get table() { return table; }, act: a => act(a), net, version: VERSION };
})();
