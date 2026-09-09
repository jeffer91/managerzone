(() => {
  function densityClass(slots, role) {
    const count = slots.filter(s => s.role === role).length;
    if (count >= 5) return 'dense';
    if (count === 4) return 'medium-density';
    return '';
  }

  function visibleY(slot) {
    // Mantener la geometría de la formación. El portero vuelve a su posición
    // natural (91%); el CSS aumenta la altura útil del campo y compacta solo
    // su tarjeta para que no quede cortado ni tapado por los centrales.
    if (slot.role === 'POR') return Math.min(slot.y, 91);
    return slot.y;
  }

  function visualDepth(slot, y) {
    // El portero debe quedar por encima de la línea defensiva si las tarjetas
    // llegan a rozarse visualmente.
    if (slot.role === 'POR') return 60;
    if (slot.role === 'DEF') return 40;
    if (slot.role === 'VOL') return 30;
    if (slot.role === 'DEL') return 20;
    return Math.round(y);
  }

  renderPitch = function renderPitchVisible(slots, lineup) {
    const wrap = $('#pitch-slots');

    wrap.innerHTML = slots.map((s, i) => {
      const p = lineup[i];
      const rate = p ? p.ratings[s.role] : 0;
      const quality = rate >= 7 ? 'FUERTE' : rate >= 5 ? 'MEDIA' : 'DÉBIL';
      const number = p?.id ? `#${escapeHtml(String(p.id))}` : '—';
      const density = densityClass(slots, s.role);
      const y = visibleY(s);
      const z = visualDepth(s, y);
      const classes = [
        'slot',
        `role-${s.role}`,
        density,
        p ? ratingClass(rate) : '',
        p ? '' : 'empty'
      ].filter(Boolean).join(' ');

      return `<div class="${classes}" draggable="${!!p}" data-slot="${i}" style="left:${s.x}%;top:${y}%;z-index:${z}" ${p ? `title="${escapeHtml(p.name)} · ${s.role} · ${rate.toFixed(1)}/10"` : ''}>
        <div class="slot-top">
          <span class="slot-pos">${s.role}</span>
          <span class="slot-number">${number}</span>
        </div>
        <div class="slot-player">${p ? escapeHtml(p.name) : 'Vacío'}</div>
        <div class="slot-bottom">
          <div class="slot-rating">
            <span class="slot-rating-value">${p ? rate.toFixed(1) : '—'}</span>
            <span class="slot-rating-max">/10</span>
          </div>
          ${p ? `<span class="slot-quality">${quality}</span>` : ''}
        </div>
      </div>`;
    }).join('');

    wrap.querySelectorAll('.slot').forEach(el => {
      el.addEventListener('dragstart', e => {
        if (el.classList.contains('empty')) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('text/plain', el.dataset.slot);
      });

      el.addEventListener('dragover', e => {
        e.preventDefault();
        el.classList.add('drag-over');
      });

      el.addEventListener('dragleave', () => el.classList.remove('drag-over'));

      el.addEventListener('drop', e => {
        e.preventDefault();
        el.classList.remove('drag-over');
        const from = Number(e.dataTransfer.getData('text/plain'));
        const to = Number(el.dataset.slot);
        if (Number.isInteger(from) && Number.isInteger(to) && from !== to) {
          [currentLineup.players[from], currentLineup.players[to]] = [currentLineup.players[to], currentLineup.players[from]];
          renderTactics();
        }
      });
    });
  };

  renderBench = function renderBenchVisible(lineup) {
    const used = new Set(lineup.filter(Boolean).map(p => p.uid));
    const remaining = players.filter(p => !used.has(p.uid));
    const choose = (role, taken) => remaining
      .filter(p => !taken.has(p.uid))
      .sort((a, b) => b.ratings[role] - a.ratings[role])[0] || null;

    const taken = new Set();
    const bench = [];

    for (const role of ['POR', 'DEF', 'VOL', 'DEL']) {
      const p = choose(role, taken);
      if (p) {
        taken.add(p.uid);
        bench.push({ role, p, score: p.ratings[role] });
      }
    }

    const comodin = remaining
      .filter(p => !taken.has(p.uid))
      .map(p => ({ p, score: r1((p.ratings.DEF + p.ratings.VOL + p.ratings.DEL) / 3) }))
      .sort((a, b) => b.score - a.score)[0];

    if (comodin) bench.push({ role: 'COM', p: comodin.p, score: comodin.score });

    $('#bench-list').innerHTML = bench.length
      ? bench.map((x, i) => `<div class="bench-item">
          <div class="bench-head">
            <span class="bench-role">${i + 1} · ${x.role === 'COM' ? 'COMODÍN' : x.role}</span>
            <span class="bench-number">${x.p.id ? `#${escapeHtml(String(x.p.id))}` : '—'}</span>
          </div>
          <strong>${escapeHtml(x.p.name)}</strong>
          <span class="bench-score ${ratingClass(x.score)}">${x.score.toFixed(1)}/10</span>
        </div>`).join('')
      : '<div class="empty-state">No quedan jugadores suficientes para completar el banco.</div>';
  };

  if (typeof renderTactics === 'function') {
    try { renderTactics(); } catch (_) {}
  }
})();

/* ========================================================================== */
/* NECESIDADES DE MERCADO                                                     */
/* Analiza la plantilla y explica qué tipo de jugador conviene comprar.       */
/* ========================================================================== */
(() => {
  const ROLE_MAIN = {
    POR: { key: 'at', label: 'Atajando' },
    DEF: { key: 'en', label: 'Entradas' },
    VOL: { key: 'pa', label: 'Pases' },
    DEL: { key: 'rem', label: 'Remates' }
  };

  const ROLE_NAMES = {
    POR: 'Portero',
    DEF: 'Defensa',
    VOL: 'Volante',
    DEL: 'Delantero'
  };

  const clampNeed = (n, min, max) => Math.max(min, Math.min(max, n));

  function ensureNeedsStyles() {
    if (document.getElementById('needs-styles')) return;
    const style = document.createElement('style');
    style.id = 'needs-styles';
    style.textContent = `
      .needs-toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:14px}
      .needs-toolbar h2{margin:5px 0 5px;font-size:24px}.needs-toolbar p{margin:0;color:var(--muted);font-size:11px;line-height:1.5;max-width:720px}
      .needs-select-wrap{display:flex;flex-direction:column;gap:5px;min-width:230px;color:#809486;font-size:9px;text-transform:uppercase;letter-spacing:.08em;font-weight:800}
      .needs-select-wrap select{background:#09150e;border:1px solid var(--line2);color:#eaf5ed;border-radius:8px;padding:9px 10px;outline:none;font-size:11px;text-transform:none;letter-spacing:0}
      .needs-hero{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(260px,.55fr);gap:12px;margin-bottom:12px}
      .needs-primary{padding:20px}.needs-primary-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.needs-rank{font-size:10px;color:var(--green);font-weight:950;letter-spacing:.1em}.needs-primary h2{font-size:28px;margin:8px 0 4px}.needs-current{font-size:11px;color:#90a494;margin:0}.needs-big-score{font-size:35px;line-height:1;color:var(--green);font-weight:950;white-space:nowrap}.needs-profile{margin-top:17px;padding:13px;border-radius:10px;background:#09150e;border:1px solid var(--line)}
      .needs-profile b{display:block;font-size:10px;margin-bottom:7px;color:#dff0e3}.needs-profile p{margin:0;font-size:11px;line-height:1.55;color:#9bad9f}.needs-profile strong{color:#fff}
      .needs-explain{padding:18px}.needs-explain h3{font-size:15px;margin:5px 0 12px}.needs-explain-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #16291d;font-size:10px}.needs-explain-row:last-child{border-bottom:0}.needs-explain-row span{color:#778b7d}.needs-explain-row strong{text-align:right;color:#e8f4eb}
      .needs-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.need-card{position:relative;overflow:hidden;padding:16px;background:linear-gradient(180deg,#0e1b13,#0a1710);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow)}
      .need-card:before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#35503c}.need-card.high:before{background:var(--red)}.need-card.medium:before{background:var(--gold)}.need-card.low:before{background:var(--green)}
      .need-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.need-card .need-order{font-size:8px;color:#708377;font-weight:900;letter-spacing:.1em}.need-card h3{font-size:17px;margin:5px 0 3px}.need-card .need-player{font-size:10px;color:#899d8f;margin:0}.need-priority{border-radius:999px;padding:5px 8px;font-size:8px;font-weight:950;white-space:nowrap}.need-priority.high{color:#ff8984;background:rgba(235,106,103,.12);border:1px solid rgba(235,106,103,.30)}.need-priority.medium{color:var(--gold);background:rgba(232,196,92,.10);border:1px solid rgba(232,196,92,.26)}.need-priority.low{color:var(--green);background:rgba(78,226,125,.10);border:1px solid rgba(78,226,125,.24)}
      .need-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:13px 0}.need-metric{padding:9px;border-radius:8px;background:#08140d;border:1px solid #172b1e}.need-metric span{display:block;font-size:7.5px;color:#6f8375;text-transform:uppercase;letter-spacing:.07em}.need-metric strong{display:block;margin-top:4px;font-size:14px}.need-target{font-size:10px;line-height:1.55;color:#94a898;padding:10px 0}.need-target b{color:#e8f4eb}.need-buy-rule{padding:10px;border-radius:8px;background:#101d14;border:1px solid #203a29;font-size:10px;line-height:1.5;color:#9eb0a2}.need-buy-rule strong{color:var(--green)}
      .needs-empty{min-height:360px}.needs-market-btn{margin-top:10px;width:100%}
      @media(max-width:1100px){.needs-hero,.needs-list{grid-template-columns:1fr}.needs-toolbar{align-items:stretch;flex-direction:column}.needs-select-wrap{min-width:0}}
    `;
    document.head.appendChild(style);
  }

  function ensureNeedsUi() {
    ensureNeedsStyles();
    if (!document.getElementById('view-needs')) {
      const marketView = document.getElementById('view-market');
      const section = document.createElement('section');
      section.id = 'view-needs';
      section.className = 'view';
      section.innerHTML = `
        <div class="needs-toolbar">
          <div>
            <span class="eyebrow">PLAN DE CONTRATACIONES</span>
            <h2>¿Qué jugador debo comprar?</h2>
            <p>La app analiza tu XI, la profundidad del banco y el jugador más débil de cada línea. Luego te dice qué puesto reforzar y qué atributos buscar.</p>
          </div>
          <label class="needs-select-wrap">Analizar para
            <select id="needs-formation"></select>
          </label>
        </div>
        <div id="needs-content"></div>`;
      marketView.parentNode.insertBefore(section, marketView);
    }

    if (!document.querySelector('.nav-item[data-view="needs"]')) {
      const nav = document.getElementById('main-nav');
      const marketButton = nav.querySelector('.nav-item[data-view="market"]');
      const button = document.createElement('button');
      button.className = 'nav-item';
      button.dataset.view = 'needs';
      button.innerHTML = '<span>◎</span> Qué comprar';
      nav.insertBefore(button, marketButton);
      button.addEventListener('click', () => switchView('needs'));
    }
  }

  function exactPosition(slot, slots) {
    if (slot.role === 'POR') return 'Portero titular';
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

  function targetProfile(role, player, targetRating) {
    const main = ROLE_MAIN[role];
    const currentMain = Number(player?.[main.key]) || 0;
    const mainTarget = Math.min(10, Math.max(7, Math.ceil(currentMain + 1), Math.ceil(targetRating)));

    if (role === 'POR') {
      return {
        mainTarget,
        text: `<strong>${main.label} ${mainTarget}+</strong> · Inteligencia 4+ · Experiencia 3+ · Resistencia 5+`
      };
    }
    if (role === 'DEF') {
      return {
        mainTarget,
        text: `<strong>${main.label} ${mainTarget}+</strong> · Resistencia 6+ · Inteligencia 4+ · Velocidad 5+ · Cabezazo 4+`
      };
    }
    if (role === 'VOL') {
      return {
        mainTarget,
        text: `<strong>${main.label} ${mainTarget}+</strong> · Control 6+ · Inteligencia 5+ · Resistencia 6+ · Entradas 4+; debe ser equilibrado`
      };
    }
    return {
      mainTarget,
      text: `<strong>${main.label} ${mainTarget}+</strong> · Control 5+ · Velocidad 6+ · Inteligencia 4+ · Cabezazo 4+`
    };
  }

  function analyzeRoleNeed(role, slots, lineup) {
    const roleIndices = slots.map((s, i) => ({ s, i })).filter(x => x.s.role === role);
    if (!roleIndices.length) return null;

    const starters = roleIndices
      .map(({ s, i }) => ({ slot: s, player: lineup[i], score: lineup[i]?.ratings?.[role] || 0 }))
      .sort((a, b) => a.score - b.score);

    const weakest = starters[0];
    const avg = starters.reduce((sum, x) => sum + x.score, 0) / starters.length;
    const used = new Set(lineup.filter(Boolean).map(p => p.uid));
    const backups = players
      .filter(p => !used.has(p.uid))
      .map(p => ({ player: p, score: p.ratings[role] }))
      .sort((a, b) => b.score - a.score);
    const backup = backups[0] || null;
    const backupScore = backup?.score || 0;

    const performanceGap = clampNeed((7.5 - weakest.score) / 4.5, 0, 1);
    const depthGap = clampNeed((6.2 - backupScore) / 4.2, 0, 1);
    const agePressure = weakest.player?.age >= 32 ? 1 : weakest.player?.age >= 29 ? .55 : 0;
    const priority = Math.round(100 * (.65 * performanceGap + .25 * depthGap + .10 * agePressure));
    const level = priority >= 55 ? 'high' : priority >= 30 ? 'medium' : 'low';
    const levelLabel = priority >= 55 ? 'PRIORIDAD ALTA' : priority >= 30 ? 'PRIORIDAD MEDIA' : 'PRIORIDAD BAJA';
    const targetRating = Math.min(9.5, Math.max(6.5, weakest.score + .8, avg + .3));
    const profile = targetProfile(role, weakest.player, targetRating);

    return {
      role,
      position: exactPosition(weakest.slot, slots),
      player: weakest.player,
      current: weakest.score,
      average: r1(avg),
      backup,
      backupScore,
      priority,
      level,
      levelLabel,
      targetRating: r1(targetRating),
      profile
    };
  }

  function getFormationName() {
    const select = document.getElementById('needs-formation');
    if (select && select.value && FORMATIONS[select.value]) return select.value;
    return formationResults[0]?.name || selectedFormation || Object.keys(FORMATIONS)[0];
  }

  function fillFormationSelect() {
    const select = document.getElementById('needs-formation');
    if (!select) return;
    const previous = select.value;
    const best = formationResults[0]?.name || selectedFormation;
    select.innerHTML = Object.keys(FORMATIONS).map(name => `<option value="${name}">${name}${name === best ? ' · mejor actual' : ''}</option>`).join('');
    select.value = previous && FORMATIONS[previous] ? previous : best;
    if (!select.dataset.ready) {
      select.dataset.ready = '1';
      select.addEventListener('change', renderNeeds);
    }
  }

  function renderNeedCard(need, index) {
    const playerName = need.player ? escapeHtml(need.player.name) : 'Sin titular claro';
    const backupName = need.backup ? `${escapeHtml(need.backup.player.name)} · ${need.backupScore.toFixed(1)}` : 'Sin suplente adecuado';
    const improvement = Math.max(0, r1(need.targetRating - need.current));

    return `<article class="need-card ${need.level}">
      <div class="need-card-head">
        <div>
          <div class="need-order">PRIORIDAD ${index + 1} · ${need.role}</div>
          <h3>${need.position}</h3>
          <p class="need-player">Actual: ${playerName}</p>
        </div>
        <span class="need-priority ${need.level}">${need.levelLabel}</span>
      </div>
      <div class="need-metrics">
        <div class="need-metric"><span>Titular</span><strong class="${ratingClass(need.current)}">${need.current.toFixed(1)}</strong></div>
        <div class="need-metric"><span>Suplente</span><strong class="${ratingClass(need.backupScore)}">${need.backupScore.toFixed(1)}</strong></div>
        <div class="need-metric"><span>Objetivo</span><strong>${need.targetRating.toFixed(1)}+</strong></div>
      </div>
      <div class="need-target"><b>Perfil que debes buscar:</b><br>${need.profile.text}</div>
      <div class="need-buy-rule">Compra únicamente si el candidato llega aproximadamente a <strong>${need.targetRating.toFixed(1)}/10 o más como ${need.role}</strong>. Eso representaría al menos +${improvement.toFixed(1)} sobre tu punto débil actual. Mejor reserva: ${backupName}.</div>
      <button class="ghost-btn needs-market-btn" data-needs-market="${need.role}">Evaluar candidato en Mercado</button>
    </article>`;
  }

  function renderNeeds() {
    ensureNeedsUi();
    const content = document.getElementById('needs-content');
    fillFormationSelect();

    if (!players.length) {
      content.innerHTML = '<div class="panel empty-state needs-empty">Carga primero tu plantilla. Después podré decirte exactamente qué posición debes reforzar y qué atributos buscar.</div>';
      return;
    }

    if (!formationResults.length) compareFormations();
    const formationName = getFormationName();
    const slots = FORMATIONS[formationName];
    const assignment = bestAssignment(slots);
    const lineup = assignment.lineup;
    const needs = ['POR', 'DEF', 'VOL', 'DEL']
      .map(role => analyzeRoleNeed(role, slots, lineup))
      .filter(Boolean)
      .sort((a, b) => b.priority - a.priority);

    const first = needs[0];
    const strongest = [...needs].sort((a, b) => a.priority - b.priority)[0];
    const firstProfile = first?.profile?.text || '';
    const firstName = first?.player ? escapeHtml(first.player.name) : '—';

    content.innerHTML = `
      <div class="needs-hero">
        <article class="panel needs-primary">
          <div class="needs-primary-top">
            <div>
              <div class="needs-rank">COMPRA Nº 1 · ${formationName}</div>
              <h2>${first.position}</h2>
              <p class="needs-current">El punto más urgente ahora es ${firstName}, con ${first.current.toFixed(1)}/10 en ese puesto.</p>
            </div>
            <div class="needs-big-score">${first.priority}%</div>
          </div>
          <div class="needs-profile"><b>PERFIL RECOMENDADO</b><p>${firstProfile}</p></div>
        </article>
        <article class="panel needs-explain">
          <span class="eyebrow">LECTURA RÁPIDA</span>
          <h3>Plan de mercado</h3>
          <div class="needs-explain-row"><span>Primera compra</span><strong>${first.position}</strong></div>
          <div class="needs-explain-row"><span>Nota mínima buscada</span><strong>${first.targetRating.toFixed(1)}/10</strong></div>
          <div class="needs-explain-row"><span>No es prioridad</span><strong>${strongest.position}</strong></div>
          <div class="needs-explain-row"><span>Formación analizada</span><strong>${formationName}</strong></div>
        </article>
      </div>
      <div class="needs-list">${needs.map(renderNeedCard).join('')}</div>`;

    content.querySelectorAll('[data-needs-market]').forEach(button => {
      button.addEventListener('click', () => switchView('market'));
    });
  }

  ensureNeedsUi();

  const baseSwitchView = switchView;
  switchView = function switchViewWithNeeds(name) {
    if (name === 'needs') {
      $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-needs'));
      $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'needs'));
      $('#page-title').textContent = 'Qué comprar';
      $('#page-subtitle').textContent = 'Prioriza contrataciones según las debilidades reales de tu plantilla y tu formación.';
      renderNeeds();
      return;
    }
    baseSwitchView(name);
  };

  window.MZNeeds = { render: renderNeeds };
})();