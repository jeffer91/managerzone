(() => {
  'use strict';

  function parseNumeric(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return 0;
    const hasCurrency = /(?:USD|EUR|SEK|\$|€)/i.test(raw);
    if (hasCurrency) {
      const negative = /^\s*-/.test(raw);
      const digits = raw.replace(/[^0-9]/g, '');
      return digits ? Number((negative ? '-' : '') + digits) : 0;
    }
    const normalized = raw.replace(/\s+/g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  numberFrom = parseNumeric;

  dedupePlayers = function dedupePlayersAudited(arr) {
    const seen = new Set();
    return (arr || []).filter(p => {
      if (!p || !p.name) return false;
      const id = String(p.id || '').trim();
      const nameKey = String(p.name).trim().toLowerCase();
      const key = id ? `id:${id}` : `name:${nameKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  function formationForStrength() {
    return formationResults?.[0]?.name || selectedFormation || Object.keys(FORMATIONS)[0];
  }

  function requiredRoleCount(role, formationName = formationForStrength()) {
    const slots = FORMATIONS[formationName] || [];
    const count = slots.filter(s => s.role === role).length;
    return count || 1;
  }

  averageRole = function averageRoleAudited(role, formationName = formationForStrength()) {
    if (!players.length) return 0;
    const required = Math.min(players.length, requiredRoleCount(role, formationName));
    const top = players
      .map(p => Number(p.ratings?.[role]) || 0)
      .sort((a, b) => b - a)
      .slice(0, required);
    if (!top.length) return 0;
    return r1(top.reduce((a, b) => a + b, 0) / top.length);
  };

  roleNeed = function roleNeedAudited(formationName = formationForStrength()) {
    return ['POR', 'DEF', 'VOL', 'DEL']
      .map(role => ({ role, score: averageRole(role, formationName) }))
      .sort((a, b) => a.score - b.score)[0] || { role: '—', score: 0 };
  };

  const baseEvaluateMarket = evaluateMarket;
  evaluateMarket = function evaluateMarketAudited(candidate) {
    const target = window.MZMarketTarget;
    if (!target || !target.role) return baseEvaluateMarket(candidate);

    const p = normalizePlayer(candidate);
    const role = target.role;
    const mainValue = Number(p[target.mainKey]) || 0;
    const rating = Number(p.ratings?.[role]) || 0;
    const meetsMain = mainValue >= Number(target.minimumMain || 0);
    const meetsRating = rating >= Number(target.minimumRating || 0);
    const currentPlayer = target.playerUid ? players.find(x => x.uid === target.playerUid) : null;
    const currentScore = Number(target.current || currentPlayer?.ratings?.[role] || 0);
    const delta = r1(rating - currentScore);

    let cls = 'no';
    let title = 'NO CUMPLE EL MÍNIMO';
    let reason = `Para ${target.position || role} necesitas ${target.mainLabel} ${target.minimumMain}+ y ${Number(target.minimumRating).toFixed(1)}/10+ como ${role}.`;

    if (meetsMain && meetsRating) {
      cls = 'buy';
      title = 'CUMPLE · COMPRAR';
      reason = `Cumple el mínimo definido para ${target.position || role} y mejora ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} puntos sobre tu referencia actual.`;
    } else if (meetsMain || meetsRating) {
      cls = 'maybe';
      title = 'CASI, PERO NO ALCANZA';
      const missing = [];
      if (!meetsMain) missing.push(`${target.mainLabel} ${target.minimumMain}+`);
      if (!meetsRating) missing.push(`${Number(target.minimumRating).toFixed(1)}/10+ como ${role}`);
      reason = `Le falta cumplir: ${missing.join(' y ')}.`;
    }

    return {
      p,
      role,
      bestCurrent: currentPlayer,
      delta,
      cls,
      title,
      reason,
      target
    };
  };

  const baseRenderMarketResult = renderMarketResult;
  renderMarketResult = function renderMarketResultAudited(result) {
    baseRenderMarketResult(result);
    if (!result?.target) return;
    const panel = document.getElementById('market-result');
    if (!panel) return;
    const target = result.target;
    const note = document.createElement('div');
    note.className = 'modal-analysis';
    note.innerHTML = `<h4>Objetivo de compra</h4><p>${escapeHtml(target.position || target.role)} · mínimo <b>${escapeHtml(target.mainLabel)} ${target.minimumMain}+</b> · <b>${Number(target.minimumRating).toFixed(1)}/10+ como ${target.role}</b>.</p>`;
    panel.prepend(note);
  };

  const baseSwitchView = switchView;
  switchView = function switchViewAudited(name) {
    if (name === 'market' && window.MZMarketTarget) {
      if (window.MZMarketTarget._openedOnce) {
        delete window.MZMarketTarget;
        document.getElementById('market-target-hint')?.remove();
      } else {
        window.MZMarketTarget._openedOnce = true;
      }
    }
    baseSwitchView(name);
  };

  window.MZAuditCore = {
    requiredRoleCount,
    formationForStrength
  };
})();
