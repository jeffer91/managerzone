(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MZMarketParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ATTRS = Object.freeze({
    ve: 'Velocidad',
    res: 'Resistencia',
    intel: 'Inteligencia',
    pa: 'Pases',
    rem: 'Remates',
    ca: 'Cabezazos',
    at: 'Atajando',
    ctrl: 'Control de balón',
    en: 'Entradas',
    pl: 'Pases Largos',
    bp: 'Balón Parado',
    exp: 'Experiencia',
    ef: 'Estado físico'
  });

  const normalize = value => String(value ?? '').replace(/\r/g, '').replace(/\u00a0/g, ' ');
  const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const money = value => {
    const raw = normalize(value);
    const negative = /^\s*-/.test(raw);
    const digits = raw.replace(/[^0-9]/g, '');
    return digits ? Number((negative ? '-' : '') + digits) : 0;
  };
  const number = value => {
    const match = normalize(value).match(/-?\d+(?:[.,]\d+)?/);
    return match ? Number(match[0].replace(',', '.')) : 0;
  };

  function stripMarkdown(value) {
    return normalize(value)
      .replace(/\[image\]\([^)]*\)/gi, ' ')
      .replace(/\[\*\*([^\]]+?)\*\*\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+?)\]\([^)]*\)/g, '$1')
      .replace(/\*\*/g, '')
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function capture(text, regex, group = 1) {
    const match = normalize(text).match(regex);
    return match ? match[group] : '';
  }

  function parseDeadline(value) {
    const raw = stripMarkdown(value);
    const match = raw.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})\s+(\d{1,2}):(\d{2})/);
    if (!match) return { text: raw, timestamp: null };
    const [, d, m, y, h, min] = match.map((part, index) => index === 0 ? part : Number(part));
    const date = new Date(y, m - 1, d, h, min, 0, 0);
    return { text: raw, timestamp: Number.isFinite(date.getTime()) ? date.getTime() : null };
  }

  function parseSnapshot(text, capturedAt = Date.now()) {
    const raw = normalize(text);
    const amount = label => money(capture(raw, new RegExp(`${escapeRegExp(label)}\\s*:?\\s*\\*\\*([^*]+?)\\s*USD\\*\\*`, 'i')));
    const integer = label => number(capture(raw, new RegExp(`${escapeRegExp(label)}\\s*:?\\s*\\*\\*([^*]+?)\\*\\*`, 'i')));
    const balanceMatch = /Saldo disponible\s*:?\s*\*\*([^*]+?)\s*USD\*\*/i.test(raw);
    const assetsMatch = /Activos del equipo\s*:?\s*\*\*([^*]+?)\s*USD\*\*/i.test(raw);
    return {
      capturedAt: Number(capturedAt) || Date.now(),
      pageClock: capture(raw, /^\s*\*\*(\d{1,2}:\d{2}:\d{2})\*\*/m),
      hasAvailableBalance: balanceMatch,
      hasTeamAssets: assetsMatch,
      localPlayers: integer('Jugadores locales'),
      foreignPlayers: integer('Jugadores extranjeros'),
      workPermits: integer('Permiso de trabajo'),
      teamAssets: amount('Activos del equipo'),
      availableBalance: amount('Saldo disponible'),
      teamValue: amount('Valor del Equipo')
    };
  }

  function findPlayerHeaders(text) {
    const raw = normalize(text);
    const regex = /(?:^|\n)\s*(?:##\s*)?(?:\[image\]\([^\n)]*\)\s*)?\[([^\]\n]+)\]\((https?:\/\/www\.managerzone\.com\/\?p=players[^\n)]*?pid=(\d+)[^\n)]*)\)\s*(?:id:\s*(\d+))?/gim;
    const headers = [];
    let match;
    while ((match = regex.exec(raw))) {
      headers.push({ index: match.index, end: regex.lastIndex, name: stripMarkdown(match[1]), url: match[2], pid: String(match[3] || match[4] || '').trim() });
    }
    return headers;
  }

  function splitCandidateBlocks(text) {
    const raw = normalize(text);
    const headers = findPlayerHeaders(raw);
    return headers.map((header, index) => ({
      header,
      block: raw.slice(header.index, index + 1 < headers.length ? headers[index + 1].index : raw.length)
    }));
  }

  function attribute(block, label) {
    const safe = escapeRegExp(label).replace(/\\ /g, '\\s+');
    const row = new RegExp(`^\\s*\\|?\\s*${safe}(?:\\*\\*\\d+\\*\\*)?\\s*\\|[^\\n]*?\\((\\d{1,2})\\)\\s*\\|?\\s*$`, 'im');
    const rowMatch = normalize(block).match(row);
    if (rowMatch) return Math.max(0, Math.min(10, Number(rowMatch[1])));
    const alt = normalize(block).match(new RegExp(`\\[${safe}\\s*:\\s*(\\d{1,2})\\]`, 'i'));
    return alt ? Math.max(0, Math.min(10, Number(alt[1]))) : 0;
  }

  function tableCell(block, label) {
    const safe = escapeRegExp(label).replace(/\\ /g, '\\s+');
    const match = normalize(block).match(new RegExp(`\\|\\s*${safe}\\s*:?\\s*\\|\\s*([^\\n|]+)`, 'i'));
    return match ? stripMarkdown(match[1]) : '';
  }

  function parseCandidate(blockInfo) {
    const { header, block } = blockInfo;
    if (!header.pid || !header.name) return null;

    const attrs = {};
    let foundStats = 0;
    for (const [key, label] of Object.entries(ATTRS)) {
      const value = attribute(block, label);
      attrs[key] = value;
      const safe = escapeRegExp(label).replace(/\\ /g, '\\s+');
      if (new RegExp(`^\\s*\\|?\\s*${safe}(?:\\*\\*\\d+\\*\\*)?\\s*\\|`, 'im').test(block)) foundStats += 1;
    }

    const deadline = parseDeadline(capture(block, /Fecha\s+l[ií]mite\s*\|\s*\*\*([^*]+?)\*\*/i) || tableCell(block, 'Fecha límite'));
    const priceBase = money(capture(block, /Precio\s+base\s*\|\s*\*\*([^*]+?)\s*USD\*\*/i));
    const lastOffer = money(capture(block, /[UÚ]ltima\s+oferta:\s*\|\s*\*\*([^*]+?)\s*USD\*\*/i));
    const value = money(capture(block, /Valor:\s*\|\s*\*\*([^*]+?)\s*USD\*\*/i));
    const salary = money(capture(block, /Sueldo:\s*\*\*([^*]+?)\s*USD\*\*/i));

    return {
      id: header.pid,
      pid: header.pid,
      uid: `market-${header.pid}`,
      url: header.url,
      name: header.name,
      age: number(capture(block, /Edad:\s*\|\s*\*\*(\d+)\*\*/i)),
      temp: number(capture(block, /Temp:\s*\|\s*\*\*Temporada\s*(\d+)\*\*/i)),
      weightKg: number(capture(block, /Peso:\s*\|\s*\*\*([\d.,]+)\s*kg\*\*/i)),
      heightCm: number(capture(block, /Altura:\s*\|\s*\*\*([\d.,]+)\s*cm\*\*/i)),
      foot: stripMarkdown(capture(block, /Pie:\s*\|\s*\*\*([^*]+?)\*\*/i)),
      totalAttributes: number(capture(block, /Total\s+de\s+atributos:\s*\|\s*\*\*(\d+)/i)),
      value,
      salary,
      club: tableCell(block, 'Club'),
      deadlineText: deadline.text,
      deadlineAt: deadline.timestamp,
      priceBase,
      lastOffer,
      priceCurrent: Math.max(priceBase, lastOffer),
      foundStats,
      completeStats: foundStats === Object.keys(ATTRS).length,
      ...attrs
    };
  }

  function parseMarketPage(text, capturedAt = Date.now()) {
    const raw = normalize(text);
    const snapshot = parseSnapshot(raw, capturedAt);
    const candidates = [];
    const seen = new Set();
    for (const blockInfo of splitCandidateBlocks(raw)) {
      const candidate = parseCandidate(blockInfo);
      if (!candidate || seen.has(candidate.pid)) continue;
      seen.add(candidate.pid);
      candidates.push(candidate);
    }
    const warnings = [];
    if (!candidates.length) warnings.push('No se detectaron jugadores del mercado.');
    if (!snapshot.hasAvailableBalance) warnings.push('No se detectó el saldo disponible.');
    const incomplete = candidates.filter(candidate => !candidate.completeStats).length;
    if (incomplete) warnings.push(`${incomplete} jugador${incomplete === 1 ? '' : 'es'} con atributos incompletos.`);
    return { snapshot, candidates, warnings };
  }

  return { ATTRS, money, stripMarkdown, parseDeadline, parseSnapshot, findPlayerHeaders, splitCandidateBlocks, parseCandidate, parseMarketPage };
});