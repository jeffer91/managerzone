(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MZEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CONFIG = Object.freeze({
    YOUTH_MAX_AGE: 18,
    WEAK_PLAYER_THRESHOLD: 4.5,
    WEAK_PLAYER_PENALTY: 0.08,
    GK_THRESHOLD: 4,
    GK_PENALTY_PER_POINT: 0.08,
    BUY_MIN_TACTIC_GAIN: 0.01,
    TIE_EPSILON: 1e-9
  });

  const ROLES = Object.freeze(['POR', 'DEF', 'VOL', 'DEL']);
  const ATTR_LABELS = Object.freeze({
    ve:'Velocidad', res:'Resistencia', intel:'Inteligencia', pa:'Pases', rem:'Remates', ca:'Cabezazos',
    at:'Atajando', ctrl:'Control', en:'Entradas', pl:'Pases largos', bp:'Balón parado', exp:'Experiencia', ef:'Estado físico'
  });
  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || 0));

  const SLOT_PROFILES = Object.freeze({
    GK: {
      role:'POR', primary:'at', gate:.15,
      weights:{at:.60,intel:.15,exp:.10,res:.10,ve:.05},
      requirements:[['at',7]]
    },
    CB: {
      role:'DEF', primary:'en', gate:.12,
      weights:{en:.45,intel:.18,ca:.12,res:.10,exp:.08,ctrl:.04,ve:.03},
      requirements:[['en',7]]
    },
    FB: {
      role:'DEF', primary:'en', gate:.06,
      weights:{en:.30,ve:.20,res:.15,pa:.12,pl:.10,ctrl:.07,intel:.06},
      requirements:[['en',7],['ve',6]]
    },
    WB: {
      role:'DEF', primary:'en', gate:.04,
      weights:{en:.25,ve:.22,res:.18,pa:.13,pl:.10,ctrl:.07,intel:.05},
      requirements:[['en',6],['ve',7]]
    },
    DM: {
      role:'VOL', primary:'pa', gate:.06,
      weights:{pa:.25,en:.20,intel:.17,ctrl:.15,res:.12,pl:.06,ve:.05},
      requirements:[['pa',7],['en',6]]
    },
    CM: {
      role:'VOL', primary:'pa', gate:.07,
      weights:{pa:.30,ctrl:.20,intel:.16,res:.12,en:.10,pl:.07,ve:.05},
      requirements:[['pa',7]]
    },
    AM: {
      role:'VOL', primary:'pa', gate:.05,
      weights:{pa:.28,ctrl:.22,intel:.15,rem:.15,ve:.08,res:.06,pl:.06},
      requirements:[['pa',7],['ctrl',6]]
    },
    WM: {
      role:'VOL', primary:'pa', gate:.04,
      weights:{pa:.24,ve:.20,ctrl:.20,res:.12,pl:.10,intel:.08,rem:.06},
      requirements:[['pa',7],['ve',6]]
    },
    ST: {
      role:'DEL', primary:'rem', gate:.15,
      weights:{rem:.50,ctrl:.15,ca:.12,intel:.10,ve:.08,exp:.05},
      requirements:[['rem',7]]
    },
    ST2: {
      role:'DEL', primary:'rem', gate:.10,
      weights:{rem:.43,ctrl:.17,ca:.10,intel:.10,ve:.10,pa:.10},
      requirements:[['rem',7]]
    },
    WF: {
      role:'DEL', primary:'rem', gate:.08,
      weights:{rem:.35,pa:.20,ctrl:.20,ve:.15,intel:.10},
      requirements:[['rem',7],['pa',6]]
    }
  });

  function ratePlayer(player) {
    const a = key => clamp(player?.[key], 0, 10);
    const rawDEL = a('rem') * .45 + a('ctrl') * .15 + a('ve') * .15 + a('intel') * .10 + a('ca') * .10 + a('res') * .05;
    const rawDEF = a('en') * .45 + a('intel') * .15 + a('res') * .15 + a('ve') * .10 + a('ca') * .10 + a('ctrl') * .05;
    const rawPOR = a('at') * .60 + a('intel') * .15 + a('exp') * .10 + a('res') * .10 + a('ve') * .05;

    const midCore = [a('pa'), a('ctrl'), a('intel'), a('res'), a('en')];
    const rawVOL = a('pa') * .35 + a('ctrl') * .20 + a('intel') * .15 + a('res') * .10 + a('en') * .10 + a('ve') * .05 + a('pl') * .05;
    const mean = midCore.reduce((sum, value) => sum + value, 0) / midCore.length;
    const variance = midCore.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / midCore.length;
    const sd = Math.sqrt(variance);
    const balanceFactor = clamp(1.08 - sd * .055, .76, 1.06);
    const vol = rawVOL * balanceFactor;
    const dominantGate = (score, primary, weight) => score * (1 - weight) + primary * weight;

    const ratings = {
      POR: clamp(dominantGate(rawPOR, a('at'), .30), 0, 10),
      DEF: clamp(dominantGate(rawDEF, a('en'), .25), 0, 10),
      VOL: clamp(dominantGate(vol, a('pa'), .22), 0, 10),
      DEL: clamp(dominantGate(rawDEL, a('rem'), .25), 0, 10)
    };
    const bestRole = Object.entries(ratings).sort((a, b) => b[1] - a[1])[0][0];
    return {
      ...ratings,
      bestRole,
      bestScore: ratings[bestRole],
      balance: clamp(balanceFactor * 10, 0, 10)
    };
  }

  function roleRating(player, role) {
    return clamp(player?.ratings?.[role], 0, 10);
  }

  function slotType(slot, slots = []) {
    if (!slot) return 'CM';
    const list = Array.isArray(slots) && slots.length ? slots : [slot];
    const same = list.filter(item => item?.role === slot.role);
    const x = Number(slot.x) || 50;
    const y = Number(slot.y) || 50;

    if (slot.role === 'POR') return 'GK';
    if (slot.role === 'DEF') {
      if (same.length >= 5 && (x <= 20 || x >= 80)) return 'WB';
      if (same.length === 4 && (x <= 25 || x >= 75)) return 'FB';
      return 'CB';
    }
    if (slot.role === 'VOL') {
      if (x <= 22 || x >= 78) return 'WM';
      if (y >= 54) return 'DM';
      if (y <= 40) return 'AM';
      return 'CM';
    }
    if (slot.role === 'DEL') {
      if (same.length >= 3 && (x <= 30 || x >= 70)) return 'WF';
      if (same.length === 2) return 'ST2';
      return 'ST';
    }
    return 'CM';
  }

  function slotProfile(slot, slots = []) {
    const type = slotType(slot, slots);
    return { type, ...SLOT_PROFILES[type] };
  }

  function slotCode(slot, slots = []) {
    const type = slotType(slot, slots);
    const x = Number(slot?.x) || 50;
    if (type === 'GK') return 'POR';
    if (type === 'CB') return 'DFC';
    if (type === 'FB') return x < 50 ? 'LI' : 'LD';
    if (type === 'WB') return x < 50 ? 'CAI' : 'CAD';
    if (type === 'DM') return 'MCD';
    if (type === 'CM') return 'MC';
    if (type === 'AM') return 'MCO';
    if (type === 'WM') return x < 50 ? 'MI' : 'MD';
    if (type === 'WF') return x < 50 ? 'EI' : 'ED';
    return 'DC';
  }

  function slotLabel(slot, slots = []) {
    const type = slotType(slot, slots);
    const x = Number(slot?.x) || 50;
    if (type === 'GK') return 'Portero';
    if (type === 'CB') return 'Defensa central';
    if (type === 'FB') return x < 50 ? 'Lateral izquierdo' : 'Lateral derecho';
    if (type === 'WB') return x < 50 ? 'Carrilero izquierdo' : 'Carrilero derecho';
    if (type === 'DM') return 'Mediocentro defensivo';
    if (type === 'CM') return 'Mediocentro';
    if (type === 'AM') return 'Mediocentro ofensivo';
    if (type === 'WM') return x < 50 ? 'Volante izquierdo' : 'Volante derecho';
    if (type === 'WF') return x < 50 ? 'Extremo izquierdo' : 'Extremo derecho';
    return 'Delantero centro';
  }

  function hasProfileAttributes(player, profile) {
    return Object.keys(profile.weights || {}).some(key => Object.prototype.hasOwnProperty.call(player || {}, key));
  }

  function slotRating(player, slot, slots = []) {
    if (!player || !slot) return 0;
    const profile = slotProfile(slot, slots);
    if (!hasProfileAttributes(player, profile)) return roleRating(player, slot.role);
    let score = 0;
    for (const [key, weight] of Object.entries(profile.weights || {})) score += clamp(player?.[key], 0, 10) * weight;
    if (profile.primary && profile.gate) {
      const primary = clamp(player?.[profile.primary], 0, 10);
      score = score * (1 - profile.gate) + primary * profile.gate;
    }
    return clamp(score, 0, 10);
  }

  function slotRequirements(player, slot, slots = []) {
    const profile = slotProfile(slot, slots);
    return (profile.requirements || []).map(([key, floor]) => {
      const current = clamp(player?.[key], 0, 10);
      return {
        key,
        label: ATTR_LABELS[key] || key,
        current,
        minimum: Math.min(10, Math.max(Number(floor) || 0, Math.ceil(current + 1)))
      };
    });
  }

  function slotUtility(player, slot, slotsOrTotal = 11) {
    const slots = Array.isArray(slotsOrTotal) ? slotsOrTotal : [slot];
    const totalSlots = Array.isArray(slotsOrTotal) ? slotsOrTotal.length : Number(slotsOrTotal) || 11;
    const rating = slotRating(player, slot, slots);
    let utility = rating;
    if (rating < CONFIG.WEAK_PLAYER_THRESHOLD) utility -= CONFIG.WEAK_PLAYER_PENALTY * totalSlots;
    if (slot.role === 'POR' && rating < CONFIG.GK_THRESHOLD) {
      utility -= (CONFIG.GK_THRESHOLD - rating) * CONFIG.GK_PENALTY_PER_POINT * totalSlots;
    }
    return utility;
  }

  function tacticScore(slots, lineup) {
    if (!Array.isArray(slots) || !Array.isArray(lineup) || lineup.length !== slots.length || lineup.some(player => !player)) return null;
    const values = lineup.map((player, index) => slotRating(player, slots[index], slots));
    let average = values.reduce((sum, value) => sum + value, 0) / values.length;
    average -= values.filter(value => value < CONFIG.WEAK_PLAYER_THRESHOLD).length * CONFIG.WEAK_PLAYER_PENALTY;
    const keeperIndex = slots.findIndex(slot => slot.role === 'POR');
    if (keeperIndex >= 0 && values[keeperIndex] < CONFIG.GK_THRESHOLD) {
      average -= (CONFIG.GK_THRESHOLD - values[keeperIndex]) * CONFIG.GK_PENALTY_PER_POINT;
    }
    return clamp(average, 0, 10);
  }

  function optimizeAssignment(slots, roster, allowPartial) {
    const S = slots.length;
    const target = allowPartial ? Math.min(roster.length, S) : S;
    if (!allowPartial && roster.length < S) {
      return { lineup: new Array(S).fill(null), assigned: roster.length, utility: -Infinity, rawTotal: 0, average: 0, score: null };
    }
    if (!target) return { lineup: new Array(S).fill(null), assigned: 0, utility: 0, rawTotal: 0, average: 0, score: null };

    const maxMask = 1 << S;
    let utilities = new Array(maxMask).fill(-Infinity);
    let rawTotals = new Array(maxMask).fill(-Infinity);
    let paths = new Array(maxMask).fill(null);
    utilities[0] = 0;
    rawTotals[0] = 0;
    paths[0] = [];

    roster.forEach((player, playerIndex) => {
      const nextUtilities = utilities.slice();
      const nextRawTotals = rawTotals.slice();
      const nextPaths = paths.map(path => path ? path.slice() : null);
      for (let mask = 0; mask < maxMask; mask += 1) {
        if (utilities[mask] === -Infinity) continue;
        for (let slotIndex = 0; slotIndex < S; slotIndex += 1) {
          if (mask & (1 << slotIndex)) continue;
          const nextMask = mask | (1 << slotIndex);
          const slot = slots[slotIndex];
          const utility = utilities[mask] + slotUtility(player, slot, slots);
          const rawTotal = rawTotals[mask] + slotRating(player, slot, slots);
          const isBetter = utility > nextUtilities[nextMask] + CONFIG.TIE_EPSILON ||
            (Math.abs(utility - nextUtilities[nextMask]) <= CONFIG.TIE_EPSILON && rawTotal > nextRawTotals[nextMask] + CONFIG.TIE_EPSILON);
          if (isBetter) {
            nextUtilities[nextMask] = utility;
            nextRawTotals[nextMask] = rawTotal;
            nextPaths[nextMask] = [...paths[mask], { slotIndex, playerIndex }];
          }
        }
      }
      utilities = nextUtilities;
      rawTotals = nextRawTotals;
      paths = nextPaths;
    });

    let bestMask = -1;
    let bestUtility = -Infinity;
    let bestRawTotal = -Infinity;
    for (let mask = 0; mask < maxMask; mask += 1) {
      let bits = mask;
      let count = 0;
      while (bits) { bits &= bits - 1; count += 1; }
      if (count !== target || utilities[mask] === -Infinity) continue;
      if (utilities[mask] > bestUtility + CONFIG.TIE_EPSILON ||
          (Math.abs(utilities[mask] - bestUtility) <= CONFIG.TIE_EPSILON && rawTotals[mask] > bestRawTotal + CONFIG.TIE_EPSILON)) {
        bestMask = mask;
        bestUtility = utilities[mask];
        bestRawTotal = rawTotals[mask];
      }
    }

    const lineup = new Array(S).fill(null);
    (paths[bestMask] || []).forEach(({ slotIndex, playerIndex }) => { lineup[slotIndex] = roster[playerIndex]; });
    const assigned = lineup.filter(Boolean).length;
    return {
      lineup,
      assigned,
      utility: bestUtility,
      rawTotal: Math.max(0, bestRawTotal),
      average: assigned ? Math.max(0, bestRawTotal) / assigned : 0,
      score: assigned === S ? tacticScore(slots, lineup) : null
    };
  }

  function bestAssignment(slots, roster) {
    return optimizeAssignment(slots, roster, false);
  }

  function bestPartialAssignment(slots, roster) {
    return optimizeAssignment(slots, roster, true);
  }

  function lineupMetrics(slots, lineup) {
    const values = lineup.map((player, index) => player ? slotRating(player, slots[index], slots) : 0).sort((a, b) => a - b);
    const weakest = values[0] || 0;
    const bottom = values.slice(0, Math.min(3, values.length));
    const bottom3 = bottom.length ? bottom.reduce((sum, value) => sum + value, 0) / bottom.length : 0;
    return { weakest, bottom3 };
  }

  function selectBench(remaining) {
    const roles = ROLES.slice();
    let best = { count: -1, score: -Infinity, picks: [] };
    function walk(roleIndex, used, picks, score) {
      if (roleIndex === roles.length) {
        const count = picks.filter(Boolean).length;
        if (count > best.count || (count === best.count && score > best.score)) best = { count, score, picks: picks.slice() };
        return;
      }
      const role = roles[roleIndex];
      let hadChoice = false;
      for (let i = 0; i < remaining.length; i += 1) {
        if (used.has(i)) continue;
        hadChoice = true;
        used.add(i);
        picks.push({ role, player: remaining[i], score: roleRating(remaining[i], role) });
        walk(roleIndex + 1, used, picks, score + roleRating(remaining[i], role));
        picks.pop();
        used.delete(i);
      }
      if (!hadChoice || remaining.length < roles.length) {
        picks.push(null);
        walk(roleIndex + 1, used, picks, score);
        picks.pop();
      }
    }
    walk(0, new Set(), [], 0);
    return best.picks.filter(Boolean);
  }

  function benchStrength(roster, lineup) {
    const used = new Set((lineup || []).filter(Boolean).map(player => player.uid));
    const remaining = roster.filter(player => !used.has(player.uid));
    const bench = selectBench(remaining);
    return bench.length ? bench.reduce((sum, pick) => sum + pick.score, 0) / bench.length : 0;
  }

  function compareFormations(formations, roster) {
    const order = Object.keys(formations);
    const results = Object.entries(formations).map(([name, slots]) => {
      const assigned = bestAssignment(slots, roster);
      const metrics = lineupMetrics(slots, assigned.lineup);
      return {
        name,
        slots,
        lineup: assigned.lineup,
        score: assigned.score,
        rawTotal: assigned.rawTotal,
        weakest: metrics.weakest,
        bottom3: metrics.bottom3,
        bench: benchStrength(roster, assigned.lineup),
        complete: assigned.assigned === slots.length
      };
    });
    results.sort((a, b) => {
      if (a.complete !== b.complete) return a.complete ? -1 : 1;
      const scoreA = Number.isFinite(a.score) ? a.score : -Infinity;
      const scoreB = Number.isFinite(b.score) ? b.score : -Infinity;
      if (Math.abs(scoreB - scoreA) > CONFIG.TIE_EPSILON) return scoreB - scoreA;
      if (Math.abs(b.weakest - a.weakest) > CONFIG.TIE_EPSILON) return b.weakest - a.weakest;
      if (Math.abs(b.bottom3 - a.bottom3) > CONFIG.TIE_EPSILON) return b.bottom3 - a.bottom3;
      if (Math.abs(b.bench - a.bench) > CONFIG.TIE_EPSILON) return b.bench - a.bench;
      return order.indexOf(a.name) - order.indexOf(b.name);
    });
    return results;
  }

  function eligibleYouth(roster, mainLineup, maxAge = CONFIG.YOUTH_MAX_AGE) {
    const mainIds = new Set((mainLineup || []).filter(Boolean).map(player => player.uid));
    const allYouth = roster.filter(player => Number(player.age) <= maxAge);
    const excluded = allYouth.filter(player => mainIds.has(player.uid));
    const eligible = allYouth.filter(player => !mainIds.has(player.uid));
    return { allYouth, excluded, eligible };
  }

  function simulateCandidate(slots, baselineLineup, candidate) {
    const baseline = (baselineLineup || []).slice(0, slots.length);
    const beforeScore = tacticScore(slots, baseline);
    if (!Number.isFinite(beforeScore)) {
      return { beforeScore: null, afterScore: null, gain: 0, enters: false, afterLineup: baseline, candidateIndex: -1, displaced: null, currentAtSlot: null };
    }
    const poolMap = new Map();
    baseline.filter(Boolean).forEach(player => poolMap.set(player.uid, player));
    poolMap.set(candidate.uid, candidate);
    const after = bestAssignment(slots, [...poolMap.values()]);
    const afterScore = after.score;
    const candidateIndex = after.lineup.findIndex(player => player?.uid === candidate.uid);
    const enters = candidateIndex >= 0;
    const beforeIds = new Set(baseline.filter(Boolean).map(player => player.uid));
    const afterIds = new Set(after.lineup.filter(Boolean).map(player => player.uid));
    const displaced = baseline.find(player => player && beforeIds.has(player.uid) && !afterIds.has(player.uid)) || null;
    return {
      beforeScore,
      afterScore,
      gain: Number.isFinite(afterScore) ? afterScore - beforeScore : 0,
      enters,
      afterLineup: after.lineup,
      candidateIndex,
      displaced,
      currentAtSlot: candidateIndex >= 0 ? baseline[candidateIndex] || null : null
    };
  }

  return {
    CONFIG,
    ROLES,
    ATTR_LABELS,
    SLOT_PROFILES,
    clamp,
    ratePlayer,
    roleRating,
    slotType,
    slotProfile,
    slotCode,
    slotLabel,
    slotRating,
    slotRequirements,
    slotUtility,
    tacticScore,
    bestAssignment,
    bestPartialAssignment,
    lineupMetrics,
    selectBench,
    benchStrength,
    compareFormations,
    eligibleYouth,
    simulateCandidate
  };
});
