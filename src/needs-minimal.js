(() => {
  'use strict';

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

  function ensureMinimalStyles() {
    if (document.getElementById('needs-minimal-styles')) return;
    const style = document.createElement('style');
    style.id = 'needs-minimal-styles';
    style.textContent = `
      #view-needs .needs-toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:18px}
      #view-needs .needs-toolbar h2{margin:5px 0 4px;font-size:23px}
      #view-needs .needs-toolbar p{margin:0;color:var(--muted);font-size:10.5px}
      #view-needs .needs-select-wrap{display:flex;flex-direction:column;gap:5px;min-width:210px;color:#789080;font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}
      #view-needs .needs-select-wrap select{background:#09150e;border:1px solid var(--line2);color:#eaf5ed;border-radius:8px;padding:9px 10px;outline:none;font-size:11px;text-transform:none;letter-spacing:0}
      .buy-one{max-width:880px;margin:0 auto;padding:24px;background:linear-gradient(180deg,#0e1b13,#0a1710);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow)}
      .buy-one-top{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}
      .buy-one-kicker{font-size:9px;color:var(--green);font-weight:950;letter-spacing:.1em}
      .buy-one h2{margin:7px 0 4px;font-size:30px}
      .buy-one-current{margin:0;color:#8fa596;font-size:11px}
      .buy-one-score{font-size:34px;line-height:1;color:var(--green);font-weight:950;white-space:nowrap}
      .buy-minimum{margin-top:20px;padding:18px;border:1px solid #2d5438;border-radius:11px;background:#08140d}
      .buy-minimum-label{font-size:9px;color:#789080;font-weight:900;letter-spacing:.09em;text-transform:uppercase}
      .buy-main-min{display:flex;align-items:baseline;gap:10px;margin-top:7px;flex-wrap:wrap}
      .buy-main-min strong{font-size:31px;color:#fff;line-height:1}
      .buy-main-min span{font-size:12px;color:var(--green);font-weight:900}
      .buy-secondary{display:flex;flex-wrap:wrap;gap:7px;margin-top:15px}
      .buy-secondary span{padding:7px 9px;border:1px solid #203a29;border-radius:999px;background:#0e1b13;color:#a8baad;font-size:9.5px}
      .buy-rule{margin:16px 0 0;color:#9aac9f;font-size:10.5px;line-height:1.55}
      .buy-rule strong{color:var(--green)}
      .buy-action{margin-top:18px;width:100%;padding:11px 14px}
      .buy-empty{max-width:880px;margin:0 auto;min-height:260px}
      .market-target-hint{margin:0 0 12px;padding:10px 12px;border:1px solid #2d5438;border-radius:9px;background:#08140d;color:#9fb1a3;font-size:10px;line-height:1.45}
      .market-target-hint b{color:var(--green)}
      @media(max-width:900px){#view-needs .needs-toolbar{flex-direction:column;align-items:stretch}.buy-one{margin:0}.buy-one-top{flex-direction:column}.buy-one-score{font-size:28px}}
    `;
    document.head.appendChild(style);
  }

  function ensureNeedsUi() {
    ensureMinimalStyles();

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
            <p>Una sola recomendación: el puesto más urgente y el mínimo que debe tener el jugador que compres.</p>
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

  function secondaryMinimums(role, player) {
    const next = (key, floor) => Math.min(10, Math.max(floor, Math.ceil((Number(player?.[key]) || 0) + 1)));
    if (role === 'POR') return [
      `Inteligencia ${next('intel',3)}+`,
      `Experiencia ${next('exp',3)}+`,
      `Resistencia ${Math.max(5, Number(player?.res) || 0)}+`
    ];
    if (role === 'DEF') return [
      `Resistencia ${Math.max(6, Number(player?.res) || 0)}+`,
      `Inteligencia ${next('intel',3)}+`,
      `Velocidad ${Math.max(5, Number(player?.ve) || 0)}+`
    ];
    if (role === 'VOL') return [
      `Control ${Math.max(6, Number(player?.ctrl) || 0)}+`,
      `Inteligencia ${next('intel',4)}+`,
      `Resistencia ${Math.max(6, Number(player?.res) || 0)}+`,
      'Perfil equilibrado'
    ];
    return [
      `Control ${Math.max(5, Number(player?.ctrl) || 0)}+`,
      `Velocidad ${Math.max(6, Number(player?.ve) || 0)}+`,
      `Inteligencia ${next('intel',3)}+`
    ];
  }

  function analyzeNeed(role, slots, lineup) {
    const roleSlots = slots.map((slot, i) => ({ slot, i })).filter(x => x.slot.role === role);
    if (!roleSlots.length) return null;

    const starters = roleSlots
      .map(({ slot, i }) => ({ slot, player: lineup[i], score: lineup[i]?.ratings?.[role] || 0 }))
      .sort((a, b) => a.score - b.score);

    const weakest = starters[0];
    if (!weakest?.player) return null;

    const used = new Set(lineup.filter(Boolean).map(p => p.uid));
    const backupScore = players
      .filter(p => !used.has(p.uid))
      .map(p => p.ratings[role])
      .sort((a, b) => b - a)[0] || 0;

    const performanceGap = clampNeed((7.5 - weakest.score) / 4.5, 0, 1);
    const depthGap = clampNeed((6.2 - backupScore) / 4.2, 0, 1);
    const agePressure = weakest.player.age >= 32 ? 1 : weakest.player.age >= 29 ? .55 : 0;
    const priority = Math.round(100 * (.68 * performanceGap + .22 * depthGap + .10 * agePressure));

    const main = ROLE_MAIN[role];
    const currentMain = Number(weakest.player[main.key]) || 0;
    const minimumMain = Math.min(10, Math.max(7, Math.ceil(currentMain + 1)));
    const minimumRating = Math.min(9.5, Math.max(6.5, weakest.score + 1));

    return {
      role,
      position: exactPosition(weakest.slot, slots),
      player: weakest.player,
      current: weakest.score,
      priority,
      mainKey: main.key,
      mainLabel: main.label,
      minimumMain,
      minimumRating: Math.round(minimumRating * 10) / 10,
      secondary: secondaryMinimums(role, weakest.player)
    };
  }

  function selectedFormationName() {
    const select = document.getElementById('needs-formation');
    if (select?.value && FORMATIONS[select.value]) return select.value;
    return formationResults[0]?.name || selectedFormation || Object.keys(FORMATIONS)[0];
  }

  function prepareSelect() {
    const select = document.getElementById('needs-formation');
    if (!select) return;
    const previous = select.value;
    const best = formationResults[0]?.name || selectedFormation;
    select.innerHTML = Object.keys(FORMATIONS).map(name => `<option value="${name}">${name}${name === best ? ' · mejor actual' : ''}</option>`).join('');
    select.value = previous && FORMATIONS[previous] ? previous : best;
    if (!select.dataset.minimalReady) {
      select.dataset.minimalReady = '1';
      select.addEventListener('change', renderMinimalNeeds);
    }
  }

  function setMarketTarget(first) {
    window.MZMarketTarget = {
      role: first.role,
      position: first.position,
      mainKey: first.mainKey,
      mainLabel: first.mainLabel,
      minimumMain: first.minimumMain,
      minimumRating: first.minimumRating,
      playerUid: first.player.uid,
      current: first.current
    };

    const marketPanel = document.querySelector('#view-market .panel');
    if (marketPanel) {
      let hint = document.getElementById('market-target-hint');
      if (!hint) {
        hint = document.createElement('div');
        hint.id = 'market-target-hint';
        hint.className = 'market-target-hint';
        const form = document.getElementById('market-form');
        marketPanel.insertBefore(hint, form);
      }
      hint.innerHTML = `Buscas <b>${escapeHtml(first.position)}</b>: mínimo <b>${escapeHtml(first.mainLabel)} ${first.minimumMain}+</b> y <b>${first.minimumRating.toFixed(1)}/10+ como ${first.role}</b>.`;
    }
  }

  function renderMinimalNeeds() {
    ensureNeedsUi();
    const content = document.getElementById('needs-content');
    if (!content) return;
    prepareSelect();

    if (!players.length) {
      content.innerHTML = '<div class="panel empty-state buy-empty">Carga primero tu plantilla.</div>';
      return;
    }

    if (!formationResults.length) compareFormations();
    const formationName = selectedFormationName();
    const slots = FORMATIONS[formationName];
    const lineup = bestAssignment(slots).lineup;
    const first = ['POR','DEF','VOL','DEL']
      .map(role => analyzeNeed(role, slots, lineup))
      .filter(Boolean)
      .sort((a,b) => b.priority - a.priority)[0];

    if (!first) {
      content.innerHTML = '<div class="panel empty-state buy-empty">No pude calcular una necesidad de compra.</div>';
      return;
    }

    content.innerHTML = `
      <article class="buy-one">
        <div class="buy-one-top">
          <div>
            <div class="buy-one-kicker">COMPRA RECOMENDADA · ${formationName}</div>
            <h2>${first.position}</h2>
            <p class="buy-one-current">Tu jugador actual es ${escapeHtml(first.player.name)} · ${first.current.toFixed(1)}/10.</p>
          </div>
          <div class="buy-one-score">${first.priority}%</div>
        </div>

        <div class="buy-minimum">
          <div class="buy-minimum-label">MÍNIMO QUE DEBES COMPRAR</div>
          <div class="buy-main-min">
            <strong>${first.mainLabel} ${first.minimumMain}+</strong>
            <span>· ${first.minimumRating.toFixed(1)}/10+ como ${first.role}</span>
          </div>
          <div class="buy-secondary">${first.secondary.map(x => `<span>${x}</span>`).join('')}</div>
        </div>

        <p class="buy-rule">Si el jugador del mercado no llega a <strong>${first.mainLabel} ${first.minimumMain}+</strong> y aproximadamente <strong>${first.minimumRating.toFixed(1)}/10 como ${first.role}</strong>, no lo compraría porque la mejora sería demasiado pequeña.</p>
        <button class="ghost-btn buy-action" id="buy-one-market">Evaluar un candidato en Mercado</button>
      </article>`;

    document.getElementById('buy-one-market')?.addEventListener('click', () => {
      setMarketTarget(first);
      switchView('market');
    });
  }

  ensureNeedsUi();

  const baseSwitchView = switchView;
  switchView = function switchViewWithMinimalNeeds(name) {
    if (name === 'needs') {
      $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-needs'));
      $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'needs'));
      $('#page-title').textContent = 'Qué comprar';
      $('#page-subtitle').textContent = 'Una sola recomendación de compra, con el mínimo aceptable.';
      renderMinimalNeeds();
      return;
    }
    baseSwitchView(name);
  };

  window.MZNeeds = { render: renderMinimalNeeds };
})();
