(() => {
  const originalParseRoster = parseRoster;

  function parseManagerZoneClipboard(text) {
    const raw = String(text || '').replace(/\u00a0/g, ' ').trim();
    if (!raw) return [];

    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const currencyRe = /^[-+]?\d[\d\s.,]*\s*(?:USD|EUR|SEK)$/i;
    const result = [];

    for (let i = 0; i < lines.length - 4; i++) {
      if (!/^\d{1,4}$/.test(lines[i])) continue;

      const id = lines[i];
      const name = lines[i + 1];
      const valueLine = lines[i + 2];
      const salaryLine = lines[i + 3];

      if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(name)) continue;
      if (!currencyRe.test(valueLine) || !currencyRe.test(salaryLine)) continue;

      const stats = [];
      let j = i + 4;

      while (j < lines.length && stats.length < 15) {
        const nums = (lines[j].match(/\d+/g) || []).map(Number);
        stats.push(...nums);
        j++;
      }

      if (stats.length < 15) continue;
      const s = stats.slice(0, 15);

      const valid =
        s[0] >= 14 && s[0] <= 60 &&
        s[1] >= 0 && s[1] <= 100 &&
        s.slice(2).every((n) => n >= 0 && n <= 10);

      if (!valid) continue;

      const p = {
        id,
        name,
        value: numberFrom(valueLine),
        salary: numberFrom(salaryLine),
        age: s[0],
        temp: s[1],
        ve: s[2],
        res: s[3],
        intel: s[4],
        pa: s[5],
        rem: s[6],
        ca: s[7],
        at: s[8],
        ctrl: s[9],
        en: s[10],
        pl: s[11],
        bp: s[12],
        exp: s[13],
        ef: s[14]
      };

      result.push(normalizePlayer(p));
      i = j - 1;
    }

    return dedupePlayers(result);
  }

  parseRoster = function patchedParseRoster(text) {
    const parsed = originalParseRoster(text);
    if (parsed && parsed.length) return parsed;
    return parseManagerZoneClipboard(text);
  };
})();
