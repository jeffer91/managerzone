(() => {
  function densityClass(slots, role) {
    const count = slots.filter(s => s.role === role).length;
    if (count >= 5) return 'dense';
    if (count === 4) return 'medium-density';
    return '';
  }

  function visibleY(slot) {
    // Las tarjetas nuevas son más altas que las originales. El portero se
    // mantiene dentro del campo y con suficiente margen inferior.
    if (slot.role === 'POR') return Math.min(slot.y, 84);
    return slot.y;
  }

  function visualDepth(slot, y) {
    // El portero puede quedar solapado por los centrales porque su tarjeta se
    // renderiza antes. Le damos prioridad visual para que siempre quede encima.
    if (slot.role === 'POR') return 50;
    if (slot.role === 'DEF') return 30;
    if (slot.role === 'VOL') return 20;
    if (slot.role === 'DEL') return 10;
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
