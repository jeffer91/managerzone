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
  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || 0));

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

  function slotUtility(player, slot, totalSlots = 11) {
    const rating = roleRating(player, slot.role);
    let utility = rating;
    if (rating < CONFIG.WEAK_PLAYER_THRESHOLD) utility -= CONFIG.WEAK_PLAYER_PENALTY * totalSlots;
    if (slot.role === 'POR' && rating < CONFIG.GK_THRESHOLD) {
      utility -= (CONFIG.GK_THRESHOLD - rating) * CONFIG.GK_PENALTY_PER_POINT * totalSlots;
    }
    return utility;
  }

  function tacticScore(slots, lineup) {
    if (!Array.isArray(slots) || !Array.isArray(lineup) || lineup.length !== slots.length || lineup.some(player => !player)) return null;
    const values = lineup.map((player, index) => roleRating(player, slots[index].role));
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
          const utility = utilities[mask] + slotUtility(player, slot, S);
          const rawTotal = rawTotals[mask] + roleRating(player, slot.role);
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
    const values = lineup.map((player, index) => player ? roleRating(player, slots[index].role) : 0).sort((a, b) => a - b);
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
    clamp,
    ratePlayer,
    roleRating,
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