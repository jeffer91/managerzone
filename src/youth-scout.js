(() => {
  'use strict';

  if (!window.MZMarketParser) throw new Error('MZMarketParser debe cargarse antes de youth-scout.js');

  const ROLE_NAMES = { POR: 'Portero', DEF: 'Defensa', VOL: 'Volante', DEL: 'Delantero' };
  const ROLE_ATTRS = {
    POR: ['at', 'intel', 'res', 'exp'],
    DEF: ['en', 'res', 'intel', 've'],
    VOL: ['pa', 'ctrl', 'intel', 'res', 'en'],
    DEL: ['rem', 'ctrl', 've', 'intel', 'ca']
  };
  const ATTR_NAME = {
    ve: 'Velocidad', res: 'Resistencia', intel: 'Inteligencia', pa: 'Pases', rem: 'Remates', ca: 'Cabezazos',
    at: 'Atajando', ctrl: 'Control de balón', en: 'Entradas', pl: 'Pases Largos', bp: 'Balón Parado',
    exp: 'Experiencia', ef: 'Estado físico'
  };

  let youthFormation = '';
  let youthLineupStates = Object.create(null);
  let candidateResults = [];
  let scoutFormation = '';
  let scoutInputCache = '';
  let scoutFilter = 'all';
  let scoutRoleFilter = 'ALL';
  let marketPageState = null;
  let previewTimer = null;

  function ensureStyles() {
    if (document.getElementById('youth-scout-styles')) return;
    const style = document.createElement('style');
    style.id = 'youth-scout-styles';
    style.textContent = `
      .youth-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px}
      .youth-stat{padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:#0b1710}
      .youth-stat span{display:block;color:#7f9585;font-size:8px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}
      .youth-stat strong{display:block;margin-top:5px;font-size:18px;color:#eef7f0}
      .youth-stat small{display:block;margin-top:3px;color:#8ba08f;font-size:9px}
      .youth-excluded-title{margin:16px 0 8px;font-size:8px;color:#789080;text-transform:uppercase;letter-spacing:.08em;font-weight:900}
      .youth-excluded{display:flex;flex-direction:column;gap:6px;max-height:210px;overflow:auto}
      .youth-excluded-item{display:flex;justify-content:space-between;gap:7px;padding:7px 8px;border:1px solid #203629;border-radius:8px;background:#08140d;font-size:8.5px}
      .youth-excluded-item span{color:#b8c8bb}.youth-excluded-item b{color:#819687}
      .youth-note{margin-top:10px;padding:9px;border:1px solid #5f4d24;border-radius:8px;background:#1b170c;color:#d9c58c;font-size:9px;line-height:1.45}

      .scout-toolbar{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:16px}
      .scout-toolbar h2{margin:5px 0 4px;font-size:23px}.scout-toolbar p{margin:0;color:var(--muted);font-size:10.5px;line-height:1.5}
      .scout-select{display:flex;flex-direction:column;gap:5px;min-width:220px;color:#789080;font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}
      .scout-select select,.scout-role-filter{background:#09150e;border:1px solid var(--line2);color:#eaf5ed;border-radius:8px;padding:9px 10px;outline:none;font-size:11px;text-transform:none;letter-spacing:0}
      .scout-panel{border:1px solid var(--line);border-radius:13px;background:#0a160f;padding:18px;box-shadow:var(--shadow)}
      .scout-guide{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;margin-bottom:11px;padding:10px 12px;border:1px solid #223c2b;border-radius:9px;background:#08140d}
      .scout-guide b{display:block;font-size:10px;color:#e8f3ea;margin-bottom:3px}.scout-guide span{font-size:9px;color:#849789}.scout-guide em{font-style:normal;font-size:8px;color:var(--green);font-weight:900;letter-spacing:.06em}
      .scout-input{width:100%;min-height:210px;resize:vertical;background:#07120c;color:#dce9df;border:1px solid #23412d;border-radius:9px;padding:12px;font:10px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;outline:none}
      .scout-input:focus{border-color:#35714a}.scout-actions{display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap}
      .scout-msg{font-size:10px;color:#8ea192}.scout-msg.error{color:#ef9c8f}.scout-msg.ok{color:var(--green)}
      .scout-target{margin-bottom:12px;padding:10px 12px;border:1px solid #2d5438;border-radius:9px;background:#08140d;color:#9fb1a3;font-size:10px}.scout-target b{color:var(--green)}
      .market-snapshot{margin:14px 0 0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
      .snapshot-card{border:1px solid var(--line);border-radius:10px;background:#0d1a12;padding:12px;min-width:0}
      .snapshot-card span{display:block;color:#7f9585;font-size:8px;text-transform:uppercase;font-weight:900;letter-spacing:.07em}
      .snapshot-card strong{display:block;margin-top:5px;font-size:17px;color:#eef7f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .snapshot-card.best strong{color:var(--green)}.snapshot-card small{display:block;margin-top:4px;color:#849889;font-size:8.5px;line-height:1.35}
      .scout-counts{display:flex;gap:7px;flex-wrap:wrap;margin:9px 0 0}.scout-count{padding:6px 9px;border:1px solid #223a2a;border-radius:999px;background:#09150e;color:#9eb0a2;font-size:8.5px}.scout-count b{color:#eef7f0}
      .scout-filters{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:14px;padding:10px;border:1px solid var(--line);border-radius:10px;background:#09150e}
      .scout-filter{border:1px solid #294331;background:#0b1710;color:#9db0a1;border-radius:999px;padding:6px 9px;font-size:8.5px;cursor:pointer}.scout-filter.active{border-color:#3b8552;color:#fff;background:#11271a;box-shadow:inset 0 0 0 1px rgba(78,226,125,.12)}
      .scout-role-filter{margin-left:auto;padding:6px 9px;font-size:9px}
      .candidate-list{display:flex;flex-direction:column;gap:9px;margin-top:10px}.candidate-card{border:1px solid var(--line);border-radius:11px;background:#0b1710;overflow:hidden}.candidate-card.buy{border-color:#285b39}.candidate-card.later{border-color:#6a5424}.candidate-card.no{border-color:#3b332c}
      .candidate-head{display:grid;grid-template-columns:minmax(200px,1.25fr) 90px minmax(170px,1fr) 105px 130px;gap:10px;align-items:center;padding:12px 13px;cursor:pointer}
      .candidate-name strong{display:block;color:#eef7f0;font-size:12px}.candidate-name small{display:block;margin-top:3px;color:#849889;font-size:9px;line-height:1.35}.candidate-role{font-weight:900;color:#d9e7dc;font-size:10px}.candidate-vs{font-size:9.5px;color:#9db0a1}.candidate-vs b{color:#eaf4ec}
      .candidate-gain{font-size:11px;font-weight:950;color:#91a596;font-variant-numeric:tabular-nums}.candidate-gain.positive{color:var(--green)}
      .decision{justify-self:end;padding:6px 9px;border-radius:999px;font-size:8.2px;font-weight:950;letter-spacing:.04em;text-align:center}.decision.buy{background:#153822;color:#56f187;border:1px solid #29603b}.decision.later{background:#2b220f;color:#e9c96e;border:1px solid #6a5424}.decision.no{background:#211811;color:#d9a77d;border:1px solid #4b3525}
      .candidate-detail{display:none;border-top:1px solid var(--line);padding:13px}.candidate-card.open .candidate-detail{display:block}
      .comparison-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.compare-person{border:1px solid #203629;border-radius:9px;padding:11px;background:#08140d}.compare-person h4{margin:0 0 4px;font-size:12px}.compare-person p{margin:0 0 10px;color:#8ea192;font-size:9px}
      .attr-compare{display:flex;flex-direction:column;gap:7px}.attr-row{display:grid;grid-template-columns:110px 1fr 24px;gap:8px;align-items:center}.attr-row span:first-child{font-size:8.5px;color:#93a697}.attr-row b{text-align:right;font-size:9.5px;color:#e8f2ea}
      .candidate-foot{margin-top:10px;display:flex;flex-wrap:wrap;gap:7px}.candidate-foot span{padding:6px 8px;border:1px solid #223a2a;border-radius:999px;color:#9eb0a2;font-size:8.5px}.candidate-foot .fit b{color:var(--green)}
      .market-detail{margin-top:10px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.market-detail div{padding:9px;border:1px solid #203629;border-radius:8px;background:#08140d;min-width:0}.market-detail span{display:block;color:#788e7f;font-size:7.8px;text-transform:uppercase;letter-spacing:.06em}.market-detail b{display:block;margin-top:4px;color:#e8f2ea;font-size:9.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.market-detail small{display:block;margin-top:3px;color:#7e9283;font-size:7.8px}
      .candidate-reason{margin-top:10px;color:#a9b9ac;font-size:9.5px;line-height:1.5}.candidate-reason b{color:#edf7ef}
      .scout-empty{margin-top:10px;padding:22px;border:1px dashed #213a29;border-radius:9px;text-align:center;color:#64776a;font-size:10px}
      @media(max-width:1200px){#view-youth .tactics-layout{grid-template-columns:190px minmax(520px,1fr) 190px}.candidate-head{grid-template-columns:1fr 80px 1fr 90px}.candidate-head .decision{grid-column:4}.market-snapshot{grid-template-columns:1fr 1fr}.market-detail{grid-template-columns:1fr 1fr}}
      @media(max-width:900px){#view-youth .tactics-layout{grid-template-columns:1fr}.youth-stats{grid-template-columns:1fr}.scout-toolbar{flex-direction:column;align-items:stretch}.candidate-head{grid-template-columns:1fr 100px}.candidate-vs,.candidate-gain{grid-column:1/-1}.candidate-head .decision{grid-column:2;grid-row:1}.comparison-grid,.market-snapshot{grid-template-columns:1fr}.scout-role-filter{margin-left:0}.market-detail{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  const balls = value => window.MZBallStrip ? window.MZBallStrip(value) : String(value);

  function exactPosition(slot, slots) {
    if (!slot) return '—';
    if (slot.role === 'POR') return 'Portero';
    const same = slots.filter(item => item.role === slot.role);
    if (slot.role === 'DEF') {
      if (slot.x <= 25) return 'Defensa izquierdo';
      if (slot.x >= 75) return 'Defensa derecho';
      return 'Defensa central';
    }
    if (slot.role === 'VOL') {
      if (slot.x <= 25) return 'Volante izquierdo';
      if (slot.x >= 75) return 'Volante derecho';
      return same.length >= 4 ? 'Volante interior/central' : 'Volante central';
    }
    if (slot.role === 'DEL') {
      if (same.length >= 3 && slot.x <= 30) return 'Delantero izquierdo';
      if (same.length >= 3 && slot.x >= 70) return 'Delantero derecho';
      return 'Delantero centro';
    }
    return ROLE_NAMES[slot.role] || slot.role;
  }

  function youthContext() {
    return MZEngine.eligibleYouth(players, getActiveMainLineup(), MZ_CONFIG.YOUTH_MAX_AGE);
  }

  function youthFormationResults(eligible) {
    return Object.entries(FORMATIONS).map(([name, slots]) => {
      const assigned = eligible.length >= slots.length ? bestAssignment(slots, eligible) : bestPartialAssignment(slots, eligible);
      const complete = assigned.assigned === slots.length;
      const metrics = MZEngine.lineupMetrics(slots, assigned.lineup);
      return {
        name,
        slots,
        lineup: assigned.lineup,
        assigned: assigned.assigned,
        complete,
        tactic: complete ? assigned.score : null,
        partial: assigned.average,
        weakest: metrics.weakest,
        bottom3: metrics.bottom3
      };
    }).sort((a, b) => {
      if (a.complete !== b.complete) return a.complete ? -1 : 1;
      if (a.complete) {
        if (Math.abs(b.tactic - a.tactic) > MZ_CONFIG.TIE_EPSILON) return b.tactic - a.tactic;
        if (Math.abs(b.weakest - a.weakest) > MZ_CONFIG.TIE_EPSILON) return b.weakest - a.weakest;
        if (Math.abs(b.bottom3 - a.bottom3) > MZ_CONFIG.TIE_EPSILON) return b.bottom3 - a.bottom3;
      }
      if (b.assigned !== a.assigned) return b.assigned - a.assigned;
      return b.partial - a.partial;
    });
  }

  function resolveYouthState(state, eligible) {
    const byId = new Map(eligible.map(player => [player.uid, player]));
    return state?.players?.map(uid => uid ? byId.get(uid) || null : null) || [];
  }

  function setYouthBest(name, result) {
    youthLineupStates[name] = { formation: name, players: (result?.lineup || []).map(player => player?.uid || null) };
  }

  function renderYouth() {
    ensureStyles();
    const view = document.getElementById('view-youth');
    if (!view) return;
    if (!players.length) {
      view.innerHTML = '<div class="panel empty-state large">Carga primero tu plantilla.</div>';
      return;
    }

    const ctx = youthContext();
    if (!ctx.allYouth.length) {
      view.innerHTML = '<div class="panel empty-state large">No hay jugadores de 18 años o menos en la plantilla.</div>';
      return;
    }

    const results = youthFormationResults(ctx.eligible);
    const bestName = results[0]?.name || Object.keys(FORMATIONS)[0];
    if (!youthFormation || !FORMATIONS[youthFormation]) youthFormation = bestName;
    const result = results.find(item => item.name === youthFormation) || results[0];
    if (!youthLineupStates[youthFormation]) setYouthBest(youthFormation, result);

    let lineup = resolveYouthState(youthLineupStates[youthFormation], ctx.eligible);
    if (lineup.length !== 11 || lineup.filter(Boolean).length !== result.assigned) {
      setYouthBest(youthFormation, result);
      lineup = resolveYouthState(youthLineupStates[youthFormation], ctx.eligible);
    }

    const score = result.complete ? tacticScore(result.slots, lineup) : null;
    const assigned = lineup.filter(Boolean).length;
    const missing = 11 - assigned;
    const weak = lineup.map((player, index) => ({
      player,
      role: result.slots[index].role,
      score: player ? roleRating(player, result.slots[index].role) : Infinity
    })).filter(item => item.player).sort((a, b) => a.score - b.score)[0];

    view.innerHTML = `
      <div class="youth-stats">
        <div class="youth-stat"><span>Juveniles</span><strong>${ctx.allYouth.length}</strong><small>Edad máxima: ${MZ_CONFIG.YOUTH_MAX_AGE} años</small></div>
        <div class="youth-stat"><span>Disponibles</span><strong>${ctx.eligible.length}</strong><small>Fuera del XI principal</small></div>
        <div class="youth-stat"><span>Usados en primer equipo</span><strong>${ctx.excluded.length}</strong><small>Excluidos automáticamente</small></div>
      </div>
      <div class="tactics-layout">
        <article class="panel tactic-sidebar-panel">
          <div class="panel-head"><div><span class="eyebrow">COMPARADOR JUVENIL</span><h3>Formaciones</h3></div></div>
          <div id="youth-formation-list" class="formation-list">${results.map(item => `<button class="formation-btn ${item.name === youthFormation ? 'active' : ''}" data-formation="${item.name}"><span>${item.name}</span><strong>${item.complete ? item.tactic.toFixed(2) : `${item.assigned}/11`}</strong></button>`).join('')}</div>
          <div class="divider"></div>
          <div class="tactic-score-box"><span>Nota de la táctica juvenil</span><strong>${Number.isFinite(score) ? `${score.toFixed(2)} / 10` : '— / 10'}</strong><small>${Number.isFinite(score) ? (weak ? `Punto más débil: ${escapeHtml(weak.player.name)} como ${weak.role} (${weak.score.toFixed(1)}).` : '') : `XI incompleto: ${assigned}/11 · calidad parcial ${result.partial.toFixed(1)}/10.`}</small></div>
          <button id="youth-reset-lineup" class="ghost-btn full">Restaurar mejor XI juvenil</button>
        </article>
        <article class="pitch-card">
          <div class="pitch-toolbar"><div><span class="eyebrow">EDITOR JUVENIL</span><h3>${result.name}</h3></div><span class="drag-tip">${missing ? `Faltan ${missing} jugador${missing === 1 ? '' : 'es'}` : 'Arrastra jugadores para intercambiar posiciones'}</span></div>
          <div class="pitch"><div class="pitch-line center"></div><div class="center-circle"></div><div class="penalty-area top"></div><div class="penalty-area bottom"></div><div id="youth-pitch-slots" class="pitch-slots"></div></div>
          ${missing ? '<div class="youth-note">No se completan huecos con mayores de 18 años ni con jugadores utilizados en el XI principal.</div>' : ''}
        </article>
        <article class="panel bench-panel">
          <div class="panel-head"><div><span class="eyebrow">BANCO JUVENIL</span><h3>Disponibles</h3></div></div>
          <p class="help compact">Solo juveniles elegibles que no están en este XI.</p>
          <div id="youth-bench-list" class="bench-list"></div>
          <div class="youth-excluded-title">No disponibles · XI principal</div>
          <div class="youth-excluded">${ctx.excluded.length ? ctx.excluded.map(player => `<div class="youth-excluded-item"><span>${escapeHtml(player.name)}</span><b>${player.age}a</b></div>`).join('') : '<div class="empty-state">Ningún juvenil está en el XI principal.</div>'}</div>
        </article>
      </div>`;

    document.querySelectorAll('#youth-formation-list .formation-btn').forEach(button => button.addEventListener('click', () => {
      youthFormation = button.dataset.formation;
      renderYouth();
    }));
    document.getElementById('youth-reset-lineup').addEventListener('click', () => {
      setYouthBest(youthFormation, result);
      renderYouth();
    });
    MZBoard.renderBoard(document.getElementById('youth-pitch-slots'), result.slots, lineup, {
      interactive: true,
      onSwap(from, to) {
        const state = youthLineupStates[youthFormation];
        [state.players[from], state.players[to]] = [state.players[to], state.players[from]];
        renderYouth();
      }
    });
    MZBoard.renderBenchList(document.getElementById('youth-bench-list'), ctx.eligible, lineup, { emptyText: 'No quedan juveniles elegibles para el banco.' });
  }

  function normalizeMarketCandidate(candidate) {
    const normalized = normalizePlayer({ ...candidate });
    normalized.pid = candidate.pid || candidate.id;
    normalized.priceCurrent = Math.max(Number(candidate.priceBase) || 0, Number(candidate.lastOffer) || 0);
    return normalized;
  }

  function parseMarketPage(text, capturedAt = Date.now()) {
    const parsed = MZMarketParser.parseMarketPage(text, capturedAt);
    return { ...parsed, candidates: parsed.candidates.map(normalizeMarketCandidate) };
  }

  function parseMarketCandidates(text) {
    return parseMarketPage(text).candidates;
  }

  function weakestStarterForRole(slots, lineup, role) {
    return slots.map((slot, index) => ({ slot, index, player: lineup[index] }))
      .filter(item => item.slot.role === role && item.player)
      .sort((a, b) => roleRating(a.player, role) - roleRating(b.player, role))[0] || null;
  }

  function targetFitFor(candidate) {
    const target = window.MZMarketTarget;
    if (!target?.role || !target?.mainKey) return null;
    const main = Number(candidate[target.mainKey]) || 0;
    const rating = roleRating(candidate, target.role);
    return {
      role: target.role,
      main,
      rating,
      meetsMain: main >= Number(target.minimumMain || 0),
      meetsRating: rating >= Number(target.minimumRating || 0),
      meets: main >= Number(target.minimumMain || 0) && rating >= Number(target.minimumRating || 0)
    };
  }

  function evaluateCandidate(candidate, formationName, baseline, snapshot) {
    const slots = FORMATIONS[formationName];
    const sim = MZEngine.simulateCandidate(slots, baseline, candidate);
    const role = sim.enters ? slots[sim.candidateIndex].role : candidate.ratings.bestRole;
    const weak = weakestStarterForRole(slots, baseline, role);
    const compare = sim.currentAtSlot || weak?.player || null;
    const roleDelta = compare ? roleRating(candidate, role) - roleRating(compare, role) : roleRating(candidate, role);
    const sporting = Boolean(sim.enters && sim.gain >= MZ_CONFIG.BUY_MIN_TACTIC_GAIN);
    const budgetKnown = Boolean(snapshot?.hasAvailableBalance);
    const balance = Number(snapshot?.availableBalance) || 0;
    const priceNow = Math.max(Number(candidate.priceBase) || 0, Number(candidate.lastOffer) || 0);
    const affordable = !budgetKnown || priceNow <= balance;
    const decision = sporting ? (affordable ? 'buy' : 'later') : 'no';
    const targetFit = targetFitFor(candidate);
    const budgetAfter = budgetKnown ? balance - priceNow : null;
    const efficiency = sporting ? (sim.gain * 100000) / Math.max(priceNow, 1000) : 0;
    return { candidate, formationName, slots, baseline, ...sim, role, position: sim.enters ? exactPosition(slots[sim.candidateIndex], slots) : ROLE_NAMES[role], compare, roleDelta, sporting, budgetKnown, balance, affordable, decision, targetFit, budgetAfter, efficiency, priceNow };
  }

  function scoutFormationName() {
    if (scoutFormation && FORMATIONS[scoutFormation]) return scoutFormation;
    if (selectedFormation && FORMATIONS[selectedFormation]) return selectedFormation;
    return formationResults[0]?.name || Object.keys(FORMATIONS)[0];
  }

  function decisionRank(decision) {
    return decision === 'buy' ? 3 : decision === 'later' ? 2 : 1;
  }

  function sortResults(results) {
    return results.sort((a, b) => {
      if (decisionRank(b.decision) !== decisionRank(a.decision)) return decisionRank(b.decision) - decisionRank(a.decision);
      if (Boolean(b.targetFit?.meets) !== Boolean(a.targetFit?.meets)) return Number(Boolean(b.targetFit?.meets)) - Number(Boolean(a.targetFit?.meets));
      if (Math.abs(b.gain - a.gain) > 1e-9) return b.gain - a.gain;
      if (Math.abs(b.roleDelta - a.roleDelta) > 1e-9) return b.roleDelta - a.roleDelta;
      return a.priceNow - b.priceNow;
    });
  }

  function snapshotAge(capturedAt) {
    if (!capturedAt) return '';
    const minutes = Math.max(0, Math.floor((Date.now() - capturedAt) / 60000));
    if (minutes < 1) return 'capturado ahora';
    if (minutes === 1) return 'capturado hace 1 min';
    return `capturado hace ${minutes} min`;
  }

  function deadlineLabel(candidate) {
    if (!candidate.deadlineAt) return candidate.deadlineText || 'No detectada';
    const delta = candidate.deadlineAt - Date.now();
    if (delta <= 0) return 'Finalizada';
    const minutes = Math.floor(delta / 60000);
    if (minutes < 60) return `Termina en ${Math.max(1, minutes)} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Termina en ${hours} h ${minutes % 60} min`;
    const days = Math.floor(hours / 24);
    return `Termina en ${days} d ${hours % 24} h`;
  }

  function ensureScoutUi() {
    const view = document.getElementById('view-market');
    if (!view || view.dataset.ready) return;
    view.dataset.ready = '1';
    view.innerHTML = `
      <div class="scout-toolbar">
        <div><span class="eyebrow">SCOUT DE MERCADO</span><h2>Jugadores a comprar</h2><p>Copia la página completa de Transferencias de ManagerZone. La app separará automáticamente jugadores, precios, subastas y tu saldo.</p></div>
        <label class="scout-select">Comparar en<select id="scout-formation"></select></label>
      </div>
      <article class="scout-panel">
        <div id="scout-target"></div>
        <div class="scout-guide"><div><b>Pega la página completa</b><span>No borres filtros, imágenes, historial ni textos de ManagerZone: el parser los ignora.</span></div><em>CTRL+A → COPIAR → PEGAR</em></div>
        <textarea id="scout-input" class="scout-input" spellcheck="false" placeholder="Pega aquí toda la página de Transferencias de ManagerZone..."></textarea>
        <div class="scout-actions"><button id="scout-analyze" class="primary-btn">Analizar mercado</button><button id="scout-clear" class="ghost-btn">Limpiar</button><span id="scout-msg" class="scout-msg"></span></div>
      </article>
      <div id="scout-results"></div>`;

    const input = document.getElementById('scout-input');
    input.addEventListener('input', scheduleMarketPreview);
    input.addEventListener('paste', scheduleMarketPreview);
    document.getElementById('scout-analyze').addEventListener('click', analyzeCandidatesFromInput);
    document.getElementById('scout-clear').addEventListener('click', () => {
      scoutInputCache = '';
      candidateResults = [];
      marketPageState = null;
      scoutFilter = 'all';
      scoutRoleFilter = 'ALL';
      input.value = '';
      document.getElementById('scout-results').innerHTML = '';
      const msg = document.getElementById('scout-msg');
      msg.textContent = '';
      msg.className = 'scout-msg';
    });
    document.getElementById('scout-formation').addEventListener('change', event => {
      scoutFormation = event.target.value;
      if (input.value.trim()) analyzeCandidatesFromInput();
    });
  }

  function prepareScout() {
    ensureScoutUi();
    const select = document.getElementById('scout-formation');
    if (!select) return;
    const chosen = scoutFormationName();
    const best = formationResults[0]?.name || selectedFormation;
    select.innerHTML = Object.keys(FORMATIONS).map(name => `<option value="${name}" ${name === chosen ? 'selected' : ''}>${name}${name === best ? ' · mejor automática' : ''}${name === selectedFormation ? ' · principal' : ''}</option>`).join('');
    document.getElementById('scout-input').value = scoutInputCache;
    const target = window.MZMarketTarget;
    document.getElementById('scout-target').innerHTML = target ? `<div class="scout-target">Prioridad detectada en “Qué comprar”: <b>${escapeHtml(target.position)}</b> · mínimo <b>${escapeHtml(target.mainLabel)} ${target.minimumMain}+</b> · <b>${Number(target.minimumRating).toFixed(1)}/10+ como ${target.role}</b>.</div>` : '';
    if (candidateResults.length) renderCandidateResults();
  }

  function scheduleMarketPreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(previewMarketInput, 140);
  }

  function previewMarketInput() {
    const input = document.getElementById('scout-input');
    const msg = document.getElementById('scout-msg');
    if (!input || !msg || !input.value.trim()) {
      if (msg) { msg.textContent = ''; msg.className = 'scout-msg'; }
      return;
    }
    const preview = MZMarketParser.parseMarketPage(input.value);
    if (!preview.candidates.length) {
      msg.textContent = 'Aún no detecto jugadores completos. Puedes pegar toda la página sin limpiarla.';
      msg.className = 'scout-msg';
      return;
    }
    const balance = preview.snapshot.hasAvailableBalance ? ` · saldo ${fmtUSD(preview.snapshot.availableBalance)}` : ' · saldo no detectado';
    const auctions = preview.candidates.filter(candidate => candidate.deadlineText || candidate.priceBase || candidate.lastOffer).length;
    msg.textContent = `✓ ${preview.candidates.length} jugadores detectados${balance} · ${auctions} con datos de subasta`;
    msg.className = 'scout-msg ok';
  }

  function analyzeCandidatesFromInput() {
    const input = document.getElementById('scout-input');
    const msg = document.getElementById('scout-msg');
    if (!players.length) {
      msg.textContent = 'Carga primero tu plantilla para poder comparar.';
      msg.className = 'scout-msg error';
      return;
    }
    scoutInputCache = input.value;
    const parsed = parseMarketPage(input.value, Date.now());
    if (!parsed.candidates.length) {
      msg.textContent = 'No pude detectar jugadores. Pega la página de Transferencias completa o bloques de jugadores de ManagerZone.';
      msg.className = 'scout-msg error';
      return;
    }
    const formationName = scoutFormationName();
    const baseline = getMainLineup(formationName);
    if (baseline.length !== 11 || baseline.some(player => !player)) {
      msg.textContent = 'No hay un XI completo para esta formación.';
      msg.className = 'scout-msg error';
      return;
    }
    marketPageState = parsed;
    candidateResults = sortResults(parsed.candidates.map(candidate => evaluateCandidate(candidate, formationName, baseline, parsed.snapshot)));
    scoutFilter = 'all';
    scoutRoleFilter = 'ALL';
    const sporting = candidateResults.filter(result => result.sporting).length;
    const buyNow = candidateResults.filter(result => result.decision === 'buy').length;
    const budgetText = parsed.snapshot.hasAvailableBalance ? ` · saldo ${fmtUSD(parsed.snapshot.availableBalance)}` : ' · saldo no detectado';
    msg.textContent = `${parsed.candidates.length} jugadores analizados · ${sporting} mejoran tu XI · ${buyNow} comprables ahora${budgetText}`;
    msg.className = 'scout-msg ok';
    renderCandidateResults();
  }

  function attributeRows(person, role) {
    if (!person) return '<div class="empty-state">Sin jugador comparable.</div>';
    return `<div class="attr-compare">${ROLE_ATTRS[role].map(key => `<div class="attr-row"><span>${ATTR_NAME[key]}</span>${balls(person[key])}<b>${person[key]}</b></div>`).join('')}</div>`;
  }

  function filteredResults() {
    return candidateResults.filter(result => {
      if (scoutRoleFilter !== 'ALL' && result.role !== scoutRoleFilter) return false;
      if (scoutFilter === 'buy' && result.decision !== 'buy') return false;
      if (scoutFilter === 'later' && result.decision !== 'later') return false;
      if (scoutFilter === 'no' && result.decision !== 'no') return false;
      if (scoutFilter === 'affordable' && !result.affordable) return false;
      return true;
    });
  }

  function decisionLabel(result) {
    if (result.decision === 'buy') return 'SÍ COMPRAR';
    if (result.decision === 'later') return 'NO COMPRAR AHORA';
    return 'NO COMPRAR';
  }

  function candidateCard(result, index) {
    const c = result.candidate;
    const compare = result.compare;
    const remaining = result.budgetKnown ? fmtUSD(Math.max(0, result.budgetAfter)) : '—';
    const fit = result.targetFit;
    const deadline = deadlineLabel(c);
    let reason;
    if (!result.sporting) {
      reason = `${escapeHtml(c.name)} no produce una mejora mínima de ${MZ_CONFIG.BUY_MIN_TACTIC_GAIN.toFixed(2)} puntos en la nota de tu XI de ${result.formationName}.`;
    } else if (result.decision === 'later') {
      reason = `${escapeHtml(c.name)} sí mejora deportivamente tu XI, pero su precio actual de ${fmtUSD(result.priceNow)} supera tu saldo disponible de ${fmtUSD(result.balance)}.`;
    } else {
      reason = `${escapeHtml(c.name)} entra en tu XI de ${result.formationName}${result.displaced ? ` y desplaza a ${escapeHtml(result.displaced.name)}` : ''}. La nota táctica mejora ${result.beforeScore.toFixed(2)} → ${result.afterScore.toFixed(2)} y entra dentro del presupuesto detectado.`;
    }
    return `
      <article class="candidate-card ${result.decision}${index === 0 && result.decision === 'buy' ? ' open' : ''}">
        <div class="candidate-head">
          <div class="candidate-name"><strong>${escapeHtml(c.name)}</strong><small>${c.age} años · ${escapeHtml(c.club || 'Club no detectado')} · PID ${escapeHtml(c.pid || c.id)}</small></div>
          <div class="candidate-role">${result.role} · ${roleRating(c, result.role).toFixed(1)}</div>
          <div class="candidate-vs">vs. <b>${compare ? escapeHtml(compare.name) : 'Sin comparable'}</b>${compare ? ` · ${roleRating(compare, result.role).toFixed(1)}` : ''}</div>
          <div class="candidate-gain ${result.sporting ? 'positive' : ''}">${result.gain >= 0 ? '+' : ''}${result.gain.toFixed(2)} táctica</div>
          <div class="decision ${result.decision}">${decisionLabel(result)}</div>
        </div>
        <div class="candidate-detail">
          <div class="comparison-grid">
            <div class="compare-person"><h4>Tu jugador actual</h4><p>${compare ? `${escapeHtml(compare.name)} · ${result.role} ${roleRating(compare, result.role).toFixed(1)}/10` : 'No hay titular comparable'}</p>${attributeRows(compare, result.role)}</div>
            <div class="compare-person"><h4>Candidato</h4><p>${escapeHtml(c.name)} · ${result.position} · ${result.role} ${roleRating(c, result.role).toFixed(1)}/10</p>${attributeRows(c, result.role)}</div>
          </div>
          <div class="candidate-foot">
            <span>Entra al XI: <b>${result.enters ? 'Sí' : 'No'}</b></span>
            <span>Táctica: <b>${result.beforeScore.toFixed(2)} → ${result.afterScore.toFixed(2)}</b></span>
            <span>Diferencia en puesto: <b>${result.roleDelta >= 0 ? '+' : ''}${result.roleDelta.toFixed(2)}</b></span>
            ${result.displaced && result.enters ? `<span>Reemplaza: <b>${escapeHtml(result.displaced.name)}</b></span>` : ''}
            ${fit ? `<span class="fit">Cumple “Qué comprar”: <b>${fit.meets ? 'Sí' : 'No'}</b></span>` : ''}
          </div>
          <div class="market-detail">
            <div><span>Precio base</span><b>${fmtUSD(c.priceBase || 0)}</b></div>
            <div><span>Última oferta</span><b>${fmtUSD(c.lastOffer || 0)}</b></div>
            <div><span>Precio actual</span><b>${fmtUSD(result.priceNow)}</b><small>${result.budgetKnown ? (result.affordable ? 'Dentro del presupuesto' : 'Fuera del presupuesto') : 'Sin saldo detectado'}</small></div>
            <div><span>Saldo después</span><b>${remaining}</b><small>${result.budgetKnown ? `Saldo detectado ${fmtUSD(result.balance)}` : 'No calculable'}</small></div>
            <div><span>Valor MZ</span><b>${fmtUSD(c.value || 0)}</b></div>
            <div><span>Sueldo</span><b>${fmtUSD(c.salary || 0)}</b></div>
            <div><span>Fecha límite</span><b>${escapeHtml(deadline)}</b><small>${escapeHtml(c.deadlineText || '')}</small></div>
            <div><span>Perfil</span><b>${c.heightCm ? `${c.heightCm} cm` : '—'} · ${escapeHtml(c.foot || '—')}</b><small>${c.totalAttributes ? `${c.totalAttributes} atributos totales` : ''}</small></div>
          </div>
          <div class="candidate-reason"><b>Conclusión:</b> ${reason}</div>
        </div>
      </article>`;
  }

  function renderFilters() {
    const counts = {
      all: candidateResults.length,
      buy: candidateResults.filter(result => result.decision === 'buy').length,
      later: candidateResults.filter(result => result.decision === 'later').length,
      no: candidateResults.filter(result => result.decision === 'no').length,
      affordable: candidateResults.filter(result => result.affordable).length
    };
    return `<div class="scout-filters">
      ${[
        ['all', 'Todos'],
        ['buy', 'Sí comprar'],
        ['later', 'No comprar ahora'],
        ['no', 'No comprar'],
        ['affordable', 'Dentro del presupuesto']
      ].map(([key, label]) => `<button class="scout-filter ${scoutFilter === key ? 'active' : ''}" data-filter="${key}">${label} · ${counts[key]}</button>`).join('')}
      <select id="scout-role-filter" class="scout-role-filter"><option value="ALL">Todos los roles</option>${MZEngine.ROLES.map(role => `<option value="${role}" ${scoutRoleFilter === role ? 'selected' : ''}>${role}</option>`).join('')}</select>
    </div>`;
  }

  function renderCandidateResults() {
    const wrap = document.getElementById('scout-results');
    if (!wrap) return;
    if (!candidateResults.length || !marketPageState) {
      wrap.innerHTML = '';
      return;
    }
    const snapshot = marketPageState.snapshot;
    const buyNow = candidateResults.filter(result => result.decision === 'buy');
    const sporting = candidateResults.filter(result => result.sporting).sort((a, b) => b.gain - a.gain);
    const valueOptions = buyNow.filter(result => result.gain > 0).sort((a, b) => b.efficiency - a.efficiency);
    const bestPurchase = buyNow[0] || null;
    const bestSporting = sporting[0] || null;
    const bestValue = valueOptions[0] || null;
    const shown = filteredResults();
    wrap.innerHTML = `
      <div class="market-snapshot">
        <div class="snapshot-card"><span>Saldo disponible</span><strong>${snapshot.hasAvailableBalance ? fmtUSD(snapshot.availableBalance) : 'No detectado'}</strong><small>${snapshotAge(snapshot.capturedAt)}${snapshot.pageClock ? ` · página ${escapeHtml(snapshot.pageClock)}` : ''}</small></div>
        <div class="snapshot-card best"><span>Mejor compra</span><strong>${bestPurchase ? escapeHtml(bestPurchase.candidate.name) : 'Ninguna'}</strong><small>${bestPurchase ? `${bestPurchase.position} · +${bestPurchase.gain.toFixed(2)} · ${fmtUSD(bestPurchase.priceNow)}` : 'Ningún candidato mejora y entra en presupuesto.'}</small></div>
        <div class="snapshot-card"><span>Mayor mejora deportiva</span><strong>${bestSporting ? escapeHtml(bestSporting.candidate.name) : 'Ninguna'}</strong><small>${bestSporting ? `+${bestSporting.gain.toFixed(2)} en táctica${bestSporting.affordable ? '' : ' · fuera de presupuesto'}` : 'Nadie mejora suficientemente el XI.'}</small></div>
        <div class="snapshot-card"><span>Mejor calidad/precio</span><strong>${bestValue ? escapeHtml(bestValue.candidate.name) : 'Ninguna'}</strong><small>${bestValue ? `+${bestValue.efficiency.toFixed(2)} de táctica por $100k al precio actual` : 'Sin opción positiva dentro del presupuesto.'}</small></div>
      </div>
      <div class="scout-counts">
        <span class="scout-count"><b>${candidateResults.length}</b> analizados</span>
        <span class="scout-count"><b>${sporting.length}</b> mejoran el XI</span>
        <span class="scout-count"><b>${buyNow.length}</b> comprar ahora</span>
        <span class="scout-count"><b>${candidateResults.filter(result => result.decision === 'later').length}</b> fuera de presupuesto</span>
        ${marketPageState.warnings.length ? `<span class="scout-count">${escapeHtml(marketPageState.warnings.join(' · '))}</span>` : ''}
      </div>
      ${renderFilters()}
      <div class="candidate-list">${shown.length ? shown.map(candidateCard).join('') : '<div class="scout-empty">No hay jugadores que coincidan con estos filtros.</div>'}</div>`;
    wrap.querySelectorAll('.candidate-head').forEach(head => head.addEventListener('click', () => head.closest('.candidate-card').classList.toggle('open')));
    wrap.querySelectorAll('.scout-filter').forEach(button => button.addEventListener('click', () => {
      scoutFilter = button.dataset.filter;
      renderCandidateResults();
    }));
    document.getElementById('scout-role-filter')?.addEventListener('change', event => {
      scoutRoleFilter = event.target.value;
      renderCandidateResults();
    });
  }

  function renderScout() {
    prepareScout();
  }

  function invalidateYouth() {
    youthLineupStates = Object.create(null);
  }

  function resetModule() {
    youthFormation = '';
    invalidateYouth();
    candidateResults = [];
    scoutFormation = '';
    scoutInputCache = '';
    scoutFilter = 'all';
    scoutRoleFilter = 'ALL';
    marketPageState = null;
  }

  registerView('youth', VIEW_META.youth, renderYouth);
  registerView('market', VIEW_META.market, renderScout);
  registerResetHandler(resetModule);
  document.addEventListener('mz:main-lineup-changed', () => {
    invalidateYouth();
    if (document.getElementById('view-youth')?.classList.contains('active')) renderYouth();
    if (document.getElementById('view-market')?.classList.contains('active') && scoutInputCache.trim()) analyzeCandidatesFromInput();
  });
  document.addEventListener('mz:roster-changed', resetModule);
  ensureStyles();
  window.MZYouthScout = { renderYouth, renderScout, parseMarketPage, parseMarketCandidates, analyzeCandidatesFromInput, invalidateYouth };
})();