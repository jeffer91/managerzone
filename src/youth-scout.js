(() => {
  'use strict';

  const ROLE_NAMES = { POR: 'Portero', DEF: 'Defensa', VOL: 'Volante', DEL: 'Delantero' };
  const ROLE_ATTRS = {
    POR: ['at', 'intel', 'res', 'exp'],
    DEF: ['en', 'res', 'intel', 've'],
    VOL: ['pa', 'ctrl', 'intel', 'res', 'en'],
    DEL: ['rem', 'ctrl', 've', 'intel', 'ca']
  };
  const ATTR_NAME = {
    ve: 'Velocidad', res: 'Resistencia', intel: 'Inteligencia', pa: 'Pases', rem: 'Remates',
    ca: 'Cabezazos', at: 'Atajando', ctrl: 'Control de balón', en: 'Entradas', pl: 'Pases Largos',
    bp: 'Balón Parado', exp: 'Experiencia', ef: 'Estado físico'
  };
  const LABEL_TO_KEY = Object.fromEntries(Object.entries(ATTR_NAME).map(([key, label]) => [label.toLowerCase(), key]));
  LABEL_TO_KEY.control = 'ctrl';

  let youthFormation = null;
  let candidateResults = [];

  function ensureStyles() {
    if (document.getElementById('youth-scout-styles')) return;
    const style = document.createElement('style');
    style.id = 'youth-scout-styles';
    style.textContent = `
      .mz-balls{display:inline-flex;align-items:center;gap:3px;flex-wrap:wrap;min-height:15px}
      .mz-ball{width:13px;height:13px;border-radius:50%;display:inline-block;position:relative;box-sizing:border-box;border:1px solid #66716a;background:radial-gradient(circle at 50% 48%,#151a17 0 18%,transparent 20%),radial-gradient(circle at 35% 28%,#151a17 0 10%,transparent 12%),radial-gradient(circle at 68% 30%,#151a17 0 9%,transparent 11%),radial-gradient(circle at 28% 68%,#151a17 0 9%,transparent 11%),radial-gradient(circle at 70% 68%,#151a17 0 9%,transparent 11%),#edf1ee;box-shadow:inset 0 0 0 1px #fff8}
      .mz-ball-plus{margin-left:3px;color:var(--green);font-weight:950;font-size:12px}
      .need-ball-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:9px}
      .need-ball-side{padding:11px 12px;border:1px solid #203a29;border-radius:9px;background:#0b1810}
      .need-ball-side.target{border-color:#2d653e;background:#0b1c12}
      .need-ball-side small{display:block;color:#819687;font-size:8.5px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;margin-bottom:7px}
      .need-ball-value{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
      .need-ball-value b{font-size:17px;color:#eff8f1}
      .need-rating-min{margin-top:10px;color:#91a596;font-size:10px}.need-rating-min b{color:var(--green)}
      .buy-one-score.enhanced{display:flex;flex-direction:column;align-items:flex-end;gap:2px}.buy-one-score.enhanced small{font-size:8px;color:#789080;letter-spacing:.08em}.buy-one-score.enhanced strong{font-size:34px;color:var(--green)}
      .buy-secondary .ball-secondary{display:flex;flex-direction:column;align-items:flex-start;gap:5px;border-radius:9px!important}.ball-secondary b{font-size:8.5px;color:#9eb0a2}.ball-secondary em{font-style:normal;color:#eaf5ed;font-weight:900}
      .youth-toolbar,.scout-toolbar{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:18px}.youth-toolbar h2,.scout-toolbar h2{margin:5px 0 4px;font-size:23px}.youth-toolbar p,.scout-toolbar p{margin:0;color:var(--muted);font-size:10.5px}
      .youth-select,.scout-select{display:flex;flex-direction:column;gap:5px;min-width:210px;color:#789080;font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}.youth-select select,.scout-select select{background:#09150e;border:1px solid var(--line2);color:#eaf5ed;border-radius:8px;padding:9px 10px;outline:none;font-size:11px;text-transform:none;letter-spacing:0}
      .youth-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}.youth-stat{padding:13px 14px;border:1px solid var(--line);border-radius:10px;background:#0b1710}.youth-stat span{display:block;color:#7f9585;font-size:8px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}.youth-stat strong{display:block;margin-top:5px;font-size:18px;color:#eef7f0}.youth-stat small{display:block;margin-top:3px;color:#8ba08f;font-size:9px}
      .youth-layout{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:14px}.youth-pitch-card{border:1px solid var(--line);border-radius:13px;background:#0a160f;padding:14px}.youth-pitch-card .pitch{min-height:560px}.youth-side-card{border:1px solid var(--line);border-radius:13px;background:#0a160f;padding:14px}.youth-side-card h3{margin:0 0 10px;font-size:15px}.youth-rule{padding:11px;border:1px solid #284934;border-radius:9px;background:#08140d;color:#9aae9e;font-size:10px;line-height:1.5;margin-bottom:12px}.youth-rule b{color:var(--green)}.youth-list{display:flex;flex-direction:column;gap:7px}.youth-list-item{display:flex;justify-content:space-between;gap:8px;padding:8px 9px;border:1px solid #1e3426;border-radius:8px}.youth-list-item span{color:#b3c2b6;font-size:9.5px}.youth-list-item b{color:#eef7f0;font-size:9.5px}.youth-incomplete{margin-top:11px;padding:10px;border-radius:8px;border:1px solid #5f4d24;background:#1b170c;color:#d9c58c;font-size:10px}
      .scout-panel{border:1px solid var(--line);border-radius:13px;background:#0a160f;padding:18px;box-shadow:var(--shadow)}.scout-input{width:100%;min-height:190px;resize:vertical;background:#07120c;color:#dce9df;border:1px solid #23412d;border-radius:9px;padding:12px;font:10px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;outline:none}.scout-input:focus{border-color:#35714a}.scout-actions{display:flex;align-items:center;gap:10px;margin-top:10px}.scout-msg{font-size:10px;color:#8ea192}.scout-msg.error{color:#ef9c8f}.scout-target{margin-bottom:12px;padding:10px 12px;border:1px solid #2d5438;border-radius:9px;background:#08140d;color:#9fb1a3;font-size:10px}.scout-target b{color:var(--green)}
      .scout-summary{margin-top:14px;display:grid;grid-template-columns:minmax(0,1.5fr) repeat(3,minmax(120px,.5fr));gap:9px}.scout-summary-card{border:1px solid var(--line);border-radius:10px;background:#0d1a12;padding:12px}.scout-summary-card span{display:block;color:#7f9585;font-size:8px;text-transform:uppercase;font-weight:900;letter-spacing:.07em}.scout-summary-card strong{display:block;margin-top:5px;font-size:17px;color:#eef7f0}.scout-summary-card.best strong{color:var(--green)}
      .candidate-list{display:flex;flex-direction:column;gap:9px;margin-top:14px}.candidate-card{border:1px solid var(--line);border-radius:11px;background:#0b1710;overflow:hidden}.candidate-card.buy{border-color:#285b39}.candidate-card.no{border-color:#3a3229}.candidate-head{display:grid;grid-template-columns:minmax(190px,1.3fr) 95px minmax(180px,1fr) 100px 100px;gap:10px;align-items:center;padding:12px 13px;cursor:pointer}.candidate-name strong{display:block;color:#eef7f0;font-size:12px}.candidate-name small{display:block;margin-top:3px;color:#849889;font-size:9px}.candidate-role{font-weight:900;color:#d9e7dc;font-size:10px}.candidate-vs{font-size:9.5px;color:#9db0a1}.candidate-vs b{color:#eaf4ec}.candidate-gain{font-size:11px;font-weight:950;color:#91a596}.candidate-gain.positive{color:var(--green)}.decision{justify-self:end;padding:6px 9px;border-radius:999px;font-size:8.5px;font-weight:950;letter-spacing:.05em}.decision.buy{background:#153822;color:#56f187;border:1px solid #29603b}.decision.no{background:#211811;color:#d9a77d;border:1px solid #4b3525}.candidate-detail{display:none;border-top:1px solid var(--line);padding:13px}.candidate-card.open .candidate-detail{display:block}.comparison-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.compare-person{border:1px solid #203629;border-radius:9px;padding:11px;background:#08140d}.compare-person h4{margin:0 0 4px;font-size:12px}.compare-person p{margin:0 0 10px;color:#8ea192;font-size:9px}.attr-compare{display:flex;flex-direction:column;gap:7px}.attr-row{display:grid;grid-template-columns:105px 1fr 24px;gap:8px;align-items:center}.attr-row span:first-child{font-size:8.5px;color:#93a697}.attr-row b{text-align:right;font-size:9.5px;color:#e8f2ea}.candidate-foot{margin-top:10px;display:flex;flex-wrap:wrap;gap:7px}.candidate-foot span{padding:6px 8px;border:1px solid #223a2a;border-radius:999px;color:#9eb0a2;font-size:8.5px}.candidate-reason{margin-top:10px;color:#a9b9ac;font-size:9.5px;line-height:1.5}.candidate-reason b{color:#edf7ef}
      @media(max-width:1050px){.youth-layout{grid-template-columns:1fr}.candidate-head{grid-template-columns:1fr 80px 1fr 90px}.candidate-head .decision{grid-column:4}.scout-summary{grid-template-columns:1fr 1fr}.comparison-grid{grid-template-columns:1fr}}
      @media(max-width:760px){.youth-toolbar,.scout-toolbar{flex-direction:column;align-items:stretch}.youth-stats{grid-template-columns:1fr}.candidate-head{grid-template-columns:1fr 80px}.candidate-vs,.candidate-gain{grid-column:1 / -1}.candidate-head .decision{grid-column:2;grid-row:1}.scout-summary{grid-template-columns:1fr}.need-ball-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ballStrip(value, plus = false) {
    const n = Math.max(0, Math.min(10, Math.round(Number(value) || 0)));
    if (!n) return `<span class="mz-balls"><span style="color:#728177;font-size:9px">0</span>${plus ? '<span class="mz-ball-plus">+</span>' : ''}</span>`;
    return `<span class="mz-balls">${'<span class="mz-ball"></span>'.repeat(n)}${plus ? '<span class="mz-ball-plus">+</span>' : ''}</span>`;
  }

  function exactPosition(slot, slots) {
    if (!slot) return '—';
    if (slot.role === 'POR') return 'Portero';
    const same = slots.filter(s => s.role === slot.role);
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

  function currentMainLineup() {
    const resolved = typeof resolveLineup === 'function' ? resolveLineup() : [];
    if (resolved?.length === 11 && resolved.some(Boolean)) return resolved;
    const best = formationResults?.[0];
    return best?.lineup || [];
  }

  function popcount(n) {
    let c = 0;
    while (n) { n &= n - 1; c += 1; }
    return c;
  }

  function bestPartialAssignment(slots, roster) {
    const S = slots.length;
    if (!roster.length) return { lineup: new Array(S).fill(null), score: 0, assigned: 0, average: 0 };
    if (roster.length >= S) {
      const full = bestAssignment(slots, roster);
      return { lineup: full.lineup, score: full.score, assigned: S, average: full.average };
    }
    const maxMask = 1 << S;
    let dp = new Array(maxMask).fill(-Infinity);
    let paths = new Array(maxMask).fill(null);
    dp[0] = 0;
    paths[0] = [];
    roster.forEach((p, pi) => {
      const next = dp.slice();
      const nextPaths = paths.map(x => x ? x.slice() : null);
      for (let mask = 0; mask < maxMask; mask += 1) {
        if (dp[mask] === -Infinity) continue;
        for (let si = 0; si < S; si += 1) {
          if (mask & (1 << si)) continue;
          const nm = mask | (1 << si);
          const sc = dp[mask] + p.ratings[slots[si].role];
          if (sc > next[nm]) {
            next[nm] = sc;
            nextPaths[nm] = [...paths[mask], { slotIndex: si, playerIndex: pi }];
          }
        }
      }
      dp = next;
      paths = nextPaths;
    });
    const target = Math.min(roster.length, S);
    let bestMask = 0;
    let bestScore = -Infinity;
    for (let mask = 0; mask < maxMask; mask += 1) {
      if (popcount(mask) === target && dp[mask] > bestScore) { bestMask = mask; bestScore = dp[mask]; }
    }
    const lineup = new Array(S).fill(null);
    (paths[bestMask] || []).forEach(x => { lineup[x.slotIndex] = roster[x.playerIndex]; });
    return { lineup, score: Math.max(0, bestScore), assigned: target, average: target ? r1(bestScore / target) : 0 };
  }

  function youthContext() {
    const main = currentMainLineup();
    const mainIds = new Set(main.filter(Boolean).map(p => p.uid));
    const allYouth = players.filter(p => Number(p.age) <= 18);
    const excluded = allYouth.filter(p => mainIds.has(p.uid));
    const eligible = allYouth.filter(p => !mainIds.has(p.uid));
    return { main, allYouth, excluded, eligible };
  }

  function ensureYouthUi() {
    if (!document.getElementById('view-youth')) {
      const needs = document.getElementById('view-needs');
      const section = document.createElement('section');
      section.id = 'view-youth';
      section.className = 'view';
      section.innerHTML = `
        <div class="youth-toolbar">
          <div><span class="eyebrow">SEGUNDO EQUIPO</span><h2>Táctica juvenil</h2><p>Solo jugadores de hasta 18 años que no estén utilizados en el XI principal.</p></div>
          <label class="youth-select">Formación juvenil<select id="youth-formation"></select></label>
        </div>
        <div id="youth-content"></div>`;
      (needs || document.getElementById('view-market')).parentNode.insertBefore(section, needs || document.getElementById('view-market'));
    }
    if (!document.querySelector('.nav-item[data-view="youth"]')) {
      const nav = document.getElementById('main-nav');
      const needsButton = nav.querySelector('.nav-item[data-view="needs"]') || nav.querySelector('.nav-item[data-view="market"]');
      const button = document.createElement('button');
      button.className = 'nav-item';
      button.dataset.view = 'youth';
      button.innerHTML = '<span>⚑</span> Juveniles';
      nav.insertBefore(button, needsButton);
      button.addEventListener('click', () => switchView('youth'));
    }
  }

  function youthFormationResults(eligible) {
    return Object.entries(FORMATIONS).map(([name, slots]) => {
      const assigned = bestPartialAssignment(slots, eligible);
      const complete = assigned.assigned === 11;
      return { name, slots, ...assigned, complete, tactic: complete ? tacticScore(slots, assigned.lineup) : 0 };
    }).sort((a, b) => {
      if (a.complete !== b.complete) return a.complete ? -1 : 1;
      return (b.complete ? b.tactic - a.tactic : b.average - a.average);
    });
  }

  function renderYouth() {
    ensureYouthUi();
    const content = document.getElementById('youth-content');
    const select = document.getElementById('youth-formation');
    if (!content || !select) return;
    if (!players.length) {
      content.innerHTML = '<div class="panel empty-state large">Carga primero tu plantilla.</div>';
      select.innerHTML = '';
      return;
    }
    const ctx = youthContext();
    const results = youthFormationResults(ctx.eligible);
    const bestName = results[0]?.name || Object.keys(FORMATIONS)[0];
    if (!youthFormation || !FORMATIONS[youthFormation]) youthFormation = bestName;
    select.innerHTML = results.map(r => `<option value="${r.name}">${r.name}${r.name === bestName ? ' · mejor juvenil' : ''}</option>`).join('');
    select.value = youthFormation;
    if (!select.dataset.ready) {
      select.dataset.ready = '1';
      select.addEventListener('change', () => { youthFormation = select.value; renderYouth(); });
    }
    const result = results.find(r => r.name === youthFormation) || results[0];
    if (!ctx.allYouth.length) {
      content.innerHTML = '<div class="panel empty-state large">No hay jugadores de 18 años o menos en la plantilla.</div>';
      return;
    }
    const missing = Math.max(0, 11 - result.assigned);
    const mainFormation = currentLineup?.formation || selectedFormation || formationResults?.[0]?.name || '—';
    content.innerHTML = `
      <div class="youth-stats">
        <div class="youth-stat"><span>Juveniles totales</span><strong>${ctx.allYouth.length}</strong><small>Edad máxima: 18 años</small></div>
        <div class="youth-stat"><span>Disponibles</span><strong>${ctx.eligible.length}</strong><small>Después de excluir el XI principal</small></div>
        <div class="youth-stat"><span>Estado del XI</span><strong>${result.assigned}/11</strong><small>${result.complete ? `Nota ${result.tactic.toFixed(1)}/10` : `Faltan ${missing} jugador${missing === 1 ? '' : 'es'}`}</small></div>
      </div>
      <div class="youth-layout">
        <article class="youth-pitch-card">
          <div class="pitch-toolbar"><div><span class="eyebrow">TÁCTICA JUVENIL</span><h3>${result.name}</h3></div><span class="drag-tip">${result.complete ? `${result.tactic.toFixed(1)} / 10` : `${result.assigned}/11 disponibles`}</span></div>
          <div class="pitch"><div class="pitch-line center"></div><div class="center-circle"></div><div class="penalty-area top"></div><div class="penalty-area bottom"></div><div id="youth-pitch-slots" class="pitch-slots"></div></div>
        </article>
        <aside class="youth-side-card">
          <h3>Reglas de elegibilidad</h3>
          <div class="youth-rule"><b>1.</b> Máximo 18 años.<br><b>2.</b> Ningún jugador del XI principal (${mainFormation}) puede repetirse aquí.</div>
          <h3>Excluidos por el primer equipo</h3>
          <div class="youth-list">${ctx.excluded.length ? ctx.excluded.map(p => `<div class="youth-list-item"><span>${escapeHtml(p.name)}</span><b>${p.age} años</b></div>`).join('') : '<div class="empty-state">Ningún juvenil está usado en el XI principal.</div>'}</div>
          ${missing ? `<div class="youth-incomplete">No se completan posiciones con mayores de 18 años ni se reutilizan jugadores del primer equipo. Faltan ${missing}.</div>` : ''}
        </aside>
      </div>`;
    const pitch = document.getElementById('youth-pitch-slots');
    pitch.innerHTML = result.slots.map((slot, i) => {
      const p = result.lineup[i];
      const score = p ? p.ratings[slot.role] : 0;
      return `<div class="slot" style="left:${slot.x}%;top:${slot.y}%"><div class="slot-role">${slot.role}</div><div class="slot-player">${p ? escapeHtml(p.name) : 'Vacío'}</div><div class="slot-rating">${p ? score.toFixed(1) : '—'}<small>${p ? '/10' : ''}</small></div></div>`;
    }).join('');
  }

  function marketNumber(text) {
    return Number(String(text || '').replace(/[^0-9]/g, '')) || 0;
  }

  function extractNumber(block, label) {
    const match = block.match(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\n]*\\((\\d+)\\)', 'i'));
    return match ? Number(match[1]) : 0;
  }

  function parseMarketCandidates(text) {
    const raw = String(text || '').replace(/\r/g, '');
    const blocks = raw.split(/^##\s+/m).filter(block => /p=players/.test(block));
    const parsed = [];
    for (const block of blocks) {
      const head = block.match(/\[([^\]]+)\]\(https:\/\/www\.managerzone\.com\/\?p=players[^)]*pid=(\d+)[^)]*\)id:\s*(\d+)/i);
      if (!head) continue;
      const age = block.match(/Edad:\s*\|\s*\*\*(\d+)\*\*/i);
      const value = block.match(/Valor:\s*\|\s*\*\*([^*]+?)\s*USD\*\*/i);
      const salary = block.match(/Sueldo:\s*\*\*([^*]+?)\s*USD\*\*/i);
      const priceBase = block.match(/Precio base\s*\|\s*\*\*([^*]+?)\s*USD\*\*/i);
      const lastOffer = block.match(/Última oferta:\s*\|\s*\*\*([^*]+?)\s*USD\*\*/i);
      const p = {
        id: head[2], uid: `market-${head[2]}`, name: cleanMarkdown(head[1]), age: Number(age?.[1] || 0), temp: 0,
        value: marketNumber(value?.[1]), salary: marketNumber(salary?.[1]), priceBase: marketNumber(priceBase?.[1]), lastOffer: marketNumber(lastOffer?.[1]),
        ve: extractNumber(block, 'Velocidad'), res: extractNumber(block, 'Resistencia'), intel: extractNumber(block, 'Inteligencia'),
        pa: extractNumber(block, 'Pases'), rem: extractNumber(block, 'Remates'), ca: extractNumber(block, 'Cabezazos'),
        at: extractNumber(block, 'Atajando'), ctrl: extractNumber(block, 'Control de balón'), en: extractNumber(block, 'Entradas'),
        pl: extractNumber(block, 'Pases Largos'), bp: extractNumber(block, 'Balón Parado'), exp: extractNumber(block, 'Experiencia'), ef: extractNumber(block, 'Estado físico')
      };
      parsed.push(normalizePlayer(p));
    }
    return dedupePlayers(parsed);
  }

  function weakestStarterForRole(slots, lineup, role) {
    return slots.map((slot, i) => ({ slot, i, player: lineup[i] }))
      .filter(x => x.slot.role === role && x.player)
      .sort((a, b) => a.player.ratings[role] - b.player.ratings[role])[0] || null;
  }

  function evaluateCandidate(candidate, formationName) {
    const slots = FORMATIONS[formationName];
    const before = bestAssignment(slots, players);
    const after = bestAssignment(slots, [...players, candidate]);
    const candidateIndex = after.lineup.findIndex(p => p?.uid === candidate.uid);
    const enters = candidateIndex >= 0;
    const role = enters ? slots[candidateIndex].role : candidate.ratings.bestRole;
    const weakSameRole = weakestStarterForRole(slots, before.lineup, role);
    const currentAtSlot = enters ? before.lineup[candidateIndex] : weakSameRole?.player || null;
    const beforeIds = new Set(before.lineup.filter(Boolean).map(p => p.uid));
    const afterIds = new Set(after.lineup.filter(Boolean).map(p => p.uid));
    const displaced = before.lineup.find(p => p && beforeIds.has(p.uid) && !afterIds.has(p.uid)) || currentAtSlot;
    const gainRaw = enters ? r1(after.score - before.score) : 0;
    const avgGain = enters ? Math.round(((after.score - before.score) / 11) * 100) / 100 : 0;
    const beforeTactic = tacticScore(slots, before.lineup);
    const afterTactic = tacticScore(slots, after.lineup);
    const roleDelta = currentAtSlot ? r1(candidate.ratings[role] - currentAtSlot.ratings[role]) : candidate.ratings[role];
    const buy = Boolean(enters && after.score > before.score + 0.05);
    const priceNow = Math.max(candidate.priceBase || 0, candidate.lastOffer || 0);
    return {
      candidate, formationName, slots, before, after, enters, role, position: enters ? exactPosition(slots[candidateIndex], slots) : ROLE_NAMES[role],
      candidateIndex, currentAtSlot, displaced, gainRaw, avgGain, beforeTactic, afterTactic, roleDelta, buy, priceNow
    };
  }

  function ensureScoutUi() {
    const view = document.getElementById('view-market');
    if (!view || view.dataset.scoutReady) return;
    view.dataset.scoutReady = '1';
    view.innerHTML = `
      <div class="scout-toolbar">
        <div><span class="eyebrow">SCOUT DE MERCADO</span><h2>Jugadores a comprar</h2><p>Pega varios jugadores de ManagerZone y la app dirá cuáles mejoran realmente lo que ya tienes.</p></div>
        <label class="scout-select">Comparar en<select id="scout-formation"></select></label>
      </div>
      <article class="scout-panel">
        <div id="scout-target"></div>
        <textarea id="scout-input" class="scout-input" spellcheck="false" placeholder="Pega aquí uno o varios jugadores del mercado de ManagerZone..."></textarea>
        <div class="scout-actions"><button id="scout-analyze" class="primary-btn">Analizar jugadores</button><button id="scout-clear" class="ghost-btn">Limpiar</button><span id="scout-msg" class="scout-msg"></span></div>
      </article>
      <div id="scout-results"></div>`;
    const marketButton = document.querySelector('.nav-item[data-view="market"]');
    if (marketButton) marketButton.innerHTML = '<span>⇄</span> Jugadores a comprar';
    document.getElementById('scout-analyze').addEventListener('click', analyzeCandidatesFromInput);
    document.getElementById('scout-clear').addEventListener('click', () => {
      document.getElementById('scout-input').value = '';
      document.getElementById('scout-results').innerHTML = '';
      const msg = document.getElementById('scout-msg'); msg.textContent = ''; msg.className = 'scout-msg';
      candidateResults = [];
    });
    document.getElementById('scout-formation').addEventListener('change', () => {
      if (candidateResults.length) analyzeCandidatesFromInput();
    });
  }

  function prepareScoutFormation() {
    const select = document.getElementById('scout-formation');
    if (!select) return;
    const prior = select.value;
    if (!formationResults.length && players.length) compareFormations();
    const best = formationResults?.[0]?.name || selectedFormation || Object.keys(FORMATIONS)[0];
    select.innerHTML = Object.keys(FORMATIONS).map(name => `<option value="${name}">${name}${name === best ? ' · mejor actual' : ''}</option>`).join('');
    select.value = prior && FORMATIONS[prior] ? prior : (selectedFormation && FORMATIONS[selectedFormation] ? selectedFormation : best);
  }

  function renderScoutTarget() {
    const wrap = document.getElementById('scout-target');
    if (!wrap) return;
    const t = window.MZMarketTarget;
    wrap.innerHTML = t ? `<div class="scout-target">Prioridad detectada en “Qué comprar”: <b>${escapeHtml(t.position)}</b> · mínimo <b>${escapeHtml(t.mainLabel)} ${t.minimumMain}+</b> · <b>${Number(t.minimumRating).toFixed(1)}/10+ como ${t.role}</b>.</div>` : '';
  }

  function analyzeCandidatesFromInput() {
    const input = document.getElementById('scout-input');
    const msg = document.getElementById('scout-msg');
    if (!players.length) {
      msg.textContent = 'Carga primero tu plantilla para poder comparar.'; msg.className = 'scout-msg error'; return;
    }
    const parsed = parseMarketCandidates(input.value);
    if (!parsed.length) {
      msg.textContent = 'No pude detectar jugadores. Pega el bloque completo de ManagerZone.'; msg.className = 'scout-msg error'; return;
    }
    const formationName = document.getElementById('scout-formation').value;
    candidateResults = parsed.map(p => evaluateCandidate(p, formationName)).sort((a, b) => Number(b.buy) - Number(a.buy) || b.gainRaw - a.gainRaw || b.candidate.ratings[b.role] - a.candidate.ratings[a.role]);
    msg.textContent = `${parsed.length} jugadores detectados · ${candidateResults.filter(x => x.buy).length} sí mejoran tu XI.`;
    msg.className = 'scout-msg';
    renderCandidateResults();
  }

  function attributeRows(person, role) {
    if (!person) return '<div class="empty-state">Sin jugador comparable.</div>';
    return `<div class="attr-compare">${ROLE_ATTRS[role].map(key => `<div class="attr-row"><span>${ATTR_NAME[key]}</span>${ballStrip(person[key])}<b>${person[key]}</b></div>`).join('')}</div>`;
  }

  function renderCandidateResults() {
    const wrap = document.getElementById('scout-results');
    if (!wrap) return;
    if (!candidateResults.length) { wrap.innerHTML = ''; return; }
    const yes = candidateResults.filter(x => x.buy);
    const best = yes[0] || null;
    wrap.innerHTML = `
      <div class="scout-summary">
        <div class="scout-summary-card best"><span>Mejor compra encontrada</span><strong>${best ? escapeHtml(best.candidate.name) : 'Ninguna'}</strong>${best ? `<small>${best.position} · +${best.avgGain.toFixed(2)} promedio XI</small>` : '<small>Ningún candidato mejora el XI actual.</small>'}</div>
        <div class="scout-summary-card"><span>Sí comprar</span><strong>${yes.length}</strong></div>
        <div class="scout-summary-card"><span>No comprar</span><strong>${candidateResults.length - yes.length}</strong></div>
        <div class="scout-summary-card"><span>Analizados</span><strong>${candidateResults.length}</strong></div>
      </div>
      <div class="candidate-list">${candidateResults.map((r, index) => candidateCard(r, index)).join('')}</div>`;
    wrap.querySelectorAll('.candidate-head').forEach(head => head.addEventListener('click', () => head.closest('.candidate-card').classList.toggle('open')));
  }

  function candidateCard(r, index) {
    const c = r.candidate;
    const compare = r.currentAtSlot;
    const compareName = compare ? compare.name : 'Sin comparable';
    const compareScore = compare ? compare.ratings[r.role] : 0;
    const reason = r.buy
      ? `${escapeHtml(c.name)} entra en el mejor XI de ${r.formationName}${r.displaced ? ` y desplaza a ${escapeHtml(r.displaced.name)}` : ''}. La suma de rendimiento del XI mejora ${r.gainRaw.toFixed(1)} puntos.`
      : `${escapeHtml(c.name)} no consigue mejorar el mejor XI de ${r.formationName}. Comprar este jugador no mejora lo que ya tienes para esa estructura.`;
    return `
      <article class="candidate-card ${r.buy ? 'buy' : 'no'}${index === 0 && r.buy ? ' open' : ''}">
        <div class="candidate-head">
          <div class="candidate-name"><strong>${escapeHtml(c.name)}</strong><small>${c.age} años · ${fmtUSD(c.value)} valor · ${r.priceNow ? `${fmtUSD(r.priceNow)} precio actual` : 'sin precio actual'}</small></div>
          <div class="candidate-role">${r.role} · ${c.ratings[r.role].toFixed(1)}</div>
          <div class="candidate-vs">vs. <b>${escapeHtml(compareName)}</b>${compare ? ` · ${compareScore.toFixed(1)}` : ''}</div>
          <div class="candidate-gain ${r.buy ? 'positive' : ''}">${r.buy ? `+${r.avgGain.toFixed(2)} XI` : '0.00 XI'}</div>
          <div class="decision ${r.buy ? 'buy' : 'no'}">${r.buy ? 'SÍ COMPRAR' : 'NO COMPRAR'}</div>
        </div>
        <div class="candidate-detail">
          <div class="comparison-grid">
            <div class="compare-person"><h4>Tu jugador actual</h4><p>${compare ? `${escapeHtml(compare.name)} · ${r.role} ${compare.ratings[r.role].toFixed(1)}/10` : 'No hay titular comparable'}</p>${attributeRows(compare, r.role)}</div>
            <div class="compare-person"><h4>Candidato</h4><p>${escapeHtml(c.name)} · ${r.position} · ${r.role} ${c.ratings[r.role].toFixed(1)}/10</p>${attributeRows(c, r.role)}</div>
          </div>
          <div class="candidate-foot"><span>Entra al XI: <b>${r.enters ? 'Sí' : 'No'}</b></span><span>Táctica: <b>${r.beforeTactic.toFixed(1)} → ${r.afterTactic.toFixed(1)}</b></span><span>Diferencia en puesto: <b>${r.roleDelta >= 0 ? '+' : ''}${r.roleDelta.toFixed(1)}</b></span>${r.displaced && r.enters ? `<span>Reemplaza: <b>${escapeHtml(r.displaced.name)}</b></span>` : ''}</div>
          <div class="candidate-reason"><b>Conclusión:</b> ${reason}</div>
        </div>
      </article>`;
  }

  function enhanceNeedsBalls() {
    const view = document.getElementById('view-needs');
    if (!view || !view.classList.contains('active')) return;
    const card = view.querySelector('.buy-one');
    if (!card || card.dataset.ballsReady) return;
    card.dataset.ballsReady = '1';

    const urgency = card.querySelector('.buy-one-score');
    if (urgency) {
      const value = urgency.textContent.trim();
      urgency.classList.add('enhanced');
      urgency.innerHTML = `<small>URGENCIA</small><strong>${escapeHtml(value)}</strong>`;
    }

    const mainStrong = card.querySelector('.buy-main-min strong');
    const ratingSpan = card.querySelector('.buy-main-min span');
    const match = mainStrong?.textContent.trim().match(/^(.+?)\s+(\d+)\+$/);
    if (match) {
      const label = match[1].trim();
      const minimum = Number(match[2]);
      const playerText = card.querySelector('.buy-one-current')?.textContent || '';
      const playerName = playerText.match(/Tu jugador actual es (.*?)\s*·/)?.[1]?.trim();
      const p = players.find(x => x.name === playerName);
      const key = LABEL_TO_KEY[label.toLowerCase()];
      const current = p && key ? Number(p[key]) || 0 : 0;
      const parent = card.querySelector('.buy-main-min');
      parent.innerHTML = `
        <div class="need-ball-grid">
          <div class="need-ball-side"><small>Tu jugador · ${escapeHtml(label)}</small><div class="need-ball-value">${ballStrip(current)}<b>${current}</b></div></div>
          <div class="need-ball-side target"><small>Mínimo a comprar · ${escapeHtml(label)}</small><div class="need-ball-value">${ballStrip(minimum, true)}<b>${minimum}+</b></div></div>
        </div>
        <div class="need-rating-min">Valoración interna mínima: <b>${escapeHtml((ratingSpan?.textContent || '').replace(/^\s*·\s*/, ''))}</b></div>`;
    }

    card.querySelectorAll('.buy-secondary span').forEach(chip => {
      const text = chip.textContent.trim();
      const m = text.match(/^(.+?)\s+(\d+)\+$/);
      if (!m) return;
      const label = m[1].trim(), n = Number(m[2]);
      chip.classList.add('ball-secondary');
      chip.innerHTML = `<b>${escapeHtml(label)}</b>${ballStrip(n, true)}<em>${n}+</em>`;
    });
    const action = card.querySelector('#buy-one-market');
    if (action) action.textContent = 'Analizar jugadores del mercado';
  }

  function renderScout() {
    ensureScoutUi();
    prepareScoutFormation();
    renderScoutTarget();
    if (!players.length) {
      const results = document.getElementById('scout-results');
      results.innerHTML = '<div class="panel empty-state large" style="margin-top:14px">Carga primero tu plantilla.</div>';
    }
  }

  ensureStyles();
  ensureYouthUi();
  ensureScoutUi();

  document.addEventListener('change', e => {
    if (e.target?.id === 'needs-formation') setTimeout(enhanceNeedsBalls, 0);
  });

  const previousSwitchView = switchView;
  switchView = function switchViewWithYouthAndScout(name) {
    if (name === 'youth') {
      $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-youth'));
      $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'youth'));
      $('#page-title').textContent = 'Juveniles';
      $('#page-subtitle').textContent = 'Táctica exclusiva para jugadores de hasta 18 años que no estén en el XI principal.';
      renderYouth();
      return;
    }
    previousSwitchView(name);
    if (name === 'needs') enhanceNeedsBalls();
    if (name === 'market') {
      $('#page-title').textContent = 'Jugadores a comprar';
      $('#page-subtitle').textContent = 'Compara jugadores reales del mercado con tu XI y decide cuáles sí mejoran la plantilla.';
      renderScout();
    }
  };

  window.MZYouthScout = { renderYouth, parseMarketCandidates, analyzeCandidatesFromInput, enhanceNeedsBalls };
})();
