(() => {
  'use strict';

  function densityClass(slots, role) {
    const count = slots.filter(slot => slot.role === role).length;
    if (count >= 5) return 'dense';
    if (count === 4) return 'medium-density';
    return '';
  }

  function safePosition(slot) {
    let y = Number(slot.y) || 50;
    if (slot.role === 'POR') y = 91;
    else if (slot.role === 'DEF') y = Math.min(y, 76);
    else if (slot.role === 'VOL') y = Math.max(37, Math.min(y, 56));
    else if (slot.role === 'DEL') y = Math.max(13, Math.min(y, 26));
    return { x: Number(slot.x) || 50, y };
  }

  function visualDepth(role) {
    return ({ POR: 60, DEF: 45, VOL: 35, DEL: 25 })[role] || 20;
  }

  function renderBoard(wrap, slots, lineup, options = {}) {
    if (!wrap) return;
    const interactive = options.interactive !== false;
    const onSwap = typeof options.onSwap === 'function' ? options.onSwap : null;
    const badge = typeof options.badge === 'function' ? options.badge : player => `${player.age}a`;

    wrap.innerHTML = slots.map((slot, index) => {
      const player = lineup[index];
      const rate = player ? roleRating(player, slot.role) : 0;
      const quality = rate >= 7 ? 'FUERTE' : rate >= 5 ? 'MEDIA' : 'DÉBIL';
      const density = densityClass(slots, slot.role);
      const pos = safePosition(slot);
      const classes = ['slot', `role-${slot.role}`, density, player ? ratingClass(rate) : '', player ? '' : 'empty'].filter(Boolean).join(' ');
      return `<div class="${classes}" draggable="${interactive && !!player}" data-slot="${index}" style="left:${pos.x}%;top:${pos.y}%;z-index:${visualDepth(slot.role)}" ${player ? `title="${escapeHtml(player.name)} · ${slot.role} · ${rate.toFixed(1)}/10"` : ''}>
        <div class="slot-top">
          <span class="slot-pos">${slot.role}</span>
          <span class="slot-number">${player ? escapeHtml(badge(player, slot, index)) : '—'}</span>
        </div>
        <div class="slot-player">${player ? escapeHtml(player.name) : 'Vacío'}</div>
        <div class="slot-bottom">
          <div class="slot-rating"><span class="slot-rating-value">${player ? rate.toFixed(1) : '—'}</span><span class="slot-rating-max">${player ? '/10' : ''}</span></div>
          ${player ? `<span class="slot-quality">${quality}</span>` : ''}
        </div>
      </div>`;
    }).join('');

    if (!interactive || !onSwap) return;
    wrap.querySelectorAll('.slot').forEach(element => {
      element.addEventListener('dragstart', event => {
        if (element.classList.contains('empty')) { event.preventDefault(); return; }
        event.dataTransfer.setData('text/plain', element.dataset.slot);
      });
      element.addEventListener('dragover', event => { event.preventDefault(); element.classList.add('drag-over'); });
      element.addEventListener('dragleave', () => element.classList.remove('drag-over'));
      element.addEventListener('drop', event => {
        event.preventDefault();
        element.classList.remove('drag-over');
        const from = Number(event.dataTransfer.getData('text/plain'));
        const to = Number(element.dataset.slot);
        if (Number.isInteger(from) && Number.isInteger(to) && from !== to) onSwap(from, to);
      });
    });
  }

  function benchPicks(roster, lineup) {
    const used = new Set((lineup || []).filter(Boolean).map(player => player.uid));
    const remaining = roster.filter(player => !used.has(player.uid));
    const bench = MZEngine.selectBench(remaining);
    const usedBench = new Set(bench.map(pick => pick.player.uid));
    const comodin = remaining
      .filter(player => !usedBench.has(player.uid))
      .map(player => ({ player, score: (roleRating(player,'DEF') + roleRating(player,'VOL') + roleRating(player,'DEL')) / 3 }))
      .sort((a,b)=>b.score-a.score)[0];
    if (comodin) bench.push({ role:'COM', player:comodin.player, score:comodin.score });
    return bench;
  }

  function renderBenchList(wrap, roster, lineup, options = {}) {
    if (!wrap) return;
    const bench = benchPicks(roster, lineup);
    wrap.innerHTML = bench.length ? bench.map((pick, index) => `<div class="bench-item">
      <div class="bench-head"><span class="bench-role">${index + 1} · ${pick.role === 'COM' ? 'COMODÍN' : pick.role}</span><span class="bench-number">${pick.player.age}a</span></div>
      <strong>${escapeHtml(pick.player.name)}</strong>
      <span class="bench-score ${ratingClass(pick.score)}">${pick.score.toFixed(1)}/10</span>
    </div>`).join('') : `<div class="empty-state">${escapeHtml(options.emptyText || 'No quedan jugadores suficientes para completar el banco.')}</div>`;
  }

  renderPitch = function renderPitchShared(slots, lineup) {
    renderBoard($('#pitch-slots'), slots, lineup, {
      interactive: true,
      onSwap(from, to) {
        if (!currentLineup?.players) return;
        [currentLineup.players[from], currentLineup.players[to]] = [currentLineup.players[to], currentLineup.players[from]];
        renderTactics();
        notifyMainLineupChanged('swap');
      }
    });
  };

  renderBench = function renderBenchShared(lineup) {
    renderBenchList($('#bench-list'), players, lineup);
  };

  window.MZBoard = { renderBoard, renderBenchList, benchPicks, safePosition, densityClass };

  if (typeof renderTactics === 'function') {
    try { renderTactics(); } catch (error) { console.error('No se pudo renderizar la táctica:', error); }
  }
})();