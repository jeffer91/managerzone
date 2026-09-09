(() => {
  'use strict';

  const old = typeof parseRoster === 'function' ? parseRoster : null;
  const KEYS = ['ve','res','intel','pa','rem','ca','at','ctrl','en','pl','bp','exp','ef'];
  let report = { strategy: 'none', count: 0, warnings: [] };

  const strip = value => String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[\*\*(.*?)\*\*\]\([^)]*\)/g, '$1')
    .replace(/\[(.*?)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__/g, '')
    .trim();

  const line = value => strip(value).replace(/[ ]{2,}/g, ' ').trim();
  const key = value => strip(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const money = value => {
    const digits = strip(value).replace(/[^0-9]/g, '');
    return digits ? Number(digits) : 0;
  };
  const currency = value => /(?:USD|EUR|SEK|\$|€)/i.test(strip(value)) && /\d/.test(value);
  const standaloneId = value => /^\d{1,4}[.)-]?$/.test(strip(value));
  const idOf = value => ((strip(value).match(/^(\d{1,4})/) || [])[1] || '');
  const header = value => /^(n|nombre|valor|sueldo|edad|temp|ve|res|in|pa|rem|ca|at|ctrl|en|pl|bp|exp|ef|velocidad|resistencia|inteligencia|pases|remates|cabezazos|atajando|control de balon|entradas|pases largos|balon parado|experiencia|estado fisico)$/i.test(key(value)) || /^n nombre valor sueldo edad temp/.test(key(value));
  const isName = value => {
    const s = strip(value).replace(/^\d{1,4}\s*[.)-]?\s+/, '').trim();
    return !!s && !header(s) && !currency(s) && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]/.test(s) && !/^(edad|pie|velocidad|resistencia|inteligencia|pases|remates|cabezazos|atajando|control|entradas|experiencia|estado)/i.test(s) && s.length < 90;
  };
  const cleanName = value => strip(value).replace(/^\d{1,4}\s*[.)-]?\s+/, '').replace(/\s+/g, ' ').trim();
  const nums = value => (strip(value).match(/-?\d+/g) || []).map(Number);
  const valid = values => values.length >= 15 && values[0] >= 14 && values[0] <= 60 && values[1] >= 0 && values[1] <= 100 && values.slice(2,15).every(n => Number.isInteger(n) && n >= 0 && n <= 10);

  function player(id, name, value, salary, stats, source) {
    if (!valid(stats) || !isName(name)) return null;
    const a = stats.slice(0, 15);
    const p = {
      id: String(id || ''),
      name: cleanName(name),
      value: money(value),
      salary: money(salary),
      age: a[0], temp: a[1],
      ve: a[2], res: a[3], intel: a[4], pa: a[5], rem: a[6], ca: a[7], at: a[8], ctrl: a[9], en: a[10], pl: a[11], bp: a[12], exp: a[13], ef: a[14],
      importSource: source
    };
    try { return typeof normalizePlayer === 'function' ? normalizePlayer(p) : p; }
    catch { return p; }
  }

  function unique(arr) {
    const map = new Map();
    for (const p of (arr || []).filter(Boolean)) {
      const id = String(p.id || '').trim();
      const dedupeKey = id ? `id:${id}` : `name:${key(p.name)}`;
      if (!map.has(dedupeKey)) map.set(dedupeKey, p);
    }
    return [...map.values()];
  }

  function smart(text) {
    const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map(line).filter(Boolean);
    const out = [];

    for (let i = 0; i < lines.length; i++) {
      let id = '';
      let nameIndex = -1;
      const combo = lines[i].match(/^(\d{1,4})\s*[.)-]?\s+(.+)$/);

      if (combo && isName(combo[2])) {
        id = combo[1];
        nameIndex = i;
      } else if (standaloneId(lines[i])) {
        id = idOf(lines[i]);
        for (let x = i + 1; x <= Math.min(i + 4, lines.length - 1); x++) {
          if (isName(lines[x])) { nameIndex = x; break; }
        }
      } else if (isName(lines[i])) {
        nameIndex = i;
        if (i && standaloneId(lines[i - 1])) id = idOf(lines[i - 1]);
      }

      if (nameIndex < 0) continue;
      const playerName = combo && nameIndex === i ? combo[2] : lines[nameIndex];
      const currencyIndices = [];

      for (let x = nameIndex + 1; x <= Math.min(nameIndex + 8, lines.length - 1); x++) {
        if (currency(lines[x])) currencyIndices.push(x);
        if (currencyIndices.length === 2) break;
        if (x > nameIndex + 1 && standaloneId(lines[x])) break;
      }
      if (currencyIndices.length < 2) continue;

      const stats = [];
      let end = currencyIndices[1];
      for (let x = currencyIndices[1] + 1; x < lines.length && x <= currencyIndices[1] + 7 && stats.length < 15; x++) {
        if (stats.length && standaloneId(lines[x])) break;
        if (!currency(lines[x]) && !header(lines[x])) stats.push(...nums(lines[x]));
        end = x;
      }
      if (!valid(stats)) continue;

      const parsed = player(id || String(out.length + 1), playerName, lines[currencyIndices[0]], lines[currencyIndices[1]], stats, 'smart');
      if (parsed) {
        out.push(parsed);
        i = Math.max(i, end);
      }
    }

    return unique(out);
  }

  function parse(text) {
    const attempts = [];
    if (old) {
      try { attempts.push({ strategy: 'tabla', players: unique(old(text) || []) }); }
      catch { attempts.push({ strategy: 'tabla', players: [] }); }
    }
    attempts.push({ strategy: 'inteligente', players: smart(text) });
    attempts.sort((a, b) => b.players.length - a.players.length);

    const best = attempts[0] || { strategy: 'none', players: [] };
    const warnings = [];
    if (best.players.length && best.players.length < 11) warnings.push('La selección parece parcial.');
    if (!best.players.length) warnings.push('No se encontraron bloques completos de jugadores.');

    report = {
      strategy: best.strategy,
      count: best.players.length,
      warnings,
      attempts: attempts.map(a => ({ strategy: a.strategy, count: a.players.length }))
    };
    window.MZ_LAST_PARSE_REPORT = report;
    return best.players;
  }

  parseRoster = parse;

  function preview() {
    const input = document.querySelector('#roster-input');
    const msg = document.querySelector('#import-message');
    if (!input || !msg) return;
    let timer;
    const go = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!input.value.trim()) return;
        const parsed = parse(input.value);
        if (parsed.length) {
          msg.textContent = `${parsed.length} jugadores detectados automáticamente · formato ${report.strategy}.`;
          msg.style.color = '#55e98a';
        } else {
          msg.textContent = 'Aún no detecto jugadores completos. Pega directamente desde ManagerZone; no necesitas ordenar el texto.';
          msg.style.color = '';
        }
      }, 120);
    };
    input.addEventListener('paste', go);
    input.addEventListener('input', go);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', preview, { once: true });
  else preview();

  window.MZSmartParser = { parse, getReport: () => report };
})();
