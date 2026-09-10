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

  function validatePlayer(player) {
    const issues = [];
    if (!player?.uid) issues.push('sin uid');
    if (!player?.name) issues.push('sin nombre');
    for (const key of ATTRS) {
      const value = Number(player?.[key]);
      if (!Number.isFinite(value) || value < 0 || value > 10) issues.push(`${key} fuera de 0-10`);
    }
    for (const role of MZEngine.ROLES) {
      const value = Number(player?.ratings?.[role]);
      if (!Number.isFinite(value) || value < 0 || value > 10) issues.push(`${role} fuera de 0-10`);
    }
    return issues;
  }

  function validateLineup(slots, lineup) {
    const issues = [];
    if (!Array.isArray(lineup) || lineup.length !== slots.length) issues.push('cantidad de posiciones incorrecta');
    const ids = (lineup || []).filter(Boolean).map(player => player.uid);
    if (new Set(ids).size !== ids.length) issues.push('jugadores repetidos');
    return issues;
  }

  function validateRuntime() {
    const issues = [];
    players.forEach(player => validatePlayer(player).forEach(issue => issues.push(`${player.name || 'Jugador'}: ${issue}`)));
    if (players.length >= 11) {
      for (const result of formationResults) {
        validateLineup(result.slots, result.lineup).forEach(issue => issues.push(`${result.name}: ${issue}`));
        if (!Number.isFinite(result.score) || result.score < 0 || result.score > 10) issues.push(`${result.name}: nota inválida`);
      }
    }
    return { ok: !issues.length, issues };
  }

  window.MZAuditCore = { parseNumeric, validatePlayer, validateLineup, validateRuntime };
})();