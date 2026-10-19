// Treasure battle: match rules and result. No time limit and no win on remaining health.
var TB = globalThis.TB || (globalThis.TB = {});
TB.match = (() => {
  // Stalemate rule chosen by the player (option B): at most two heroes may start in the defence zone.
  // If a team has only defenders left alive and no enemy has come near for QUIET_TIME seconds, they go on the attack,
  // otherwise two lone defences would stand forever (there is no time limit).
  const MAX_DEFENDERS = 2;
  const QUIET_TIME = 8;
  // Second stalemate breaker: after CALM_START seconds, if nobody has taken damage for CALM_TIME seconds, defence and
  // support of both teams go on the attack (two shooters can stand out of reach of each other forever otherwise).
  const CALM_START = 15;
  const CALM_TIME = 8;

  // Capture is a hold: an enemy has to stand in the capture zone for CAPTURE_TIME seconds. While every enemy in the
  // zone is under attack (hit in the last UNDER_FIRE seconds, or an enemy has it as target within reach) the bar
  // fills at SLOWED speed only; an empty zone lets it drain at DECAY per second.
  const CAPTURE_TIME = 3;
  const DECAY = 1;
  const SLOWED = 0.15;
  const UNDER_FIRE = 1;

  function create() {
    return { time: 0, over: false, result: null, progress: [0, 0], contested: [false, false] };
  }
  const alive = (w, team) => w.fighters.filter((f) => f.team === team && f.hp > 0);
  const takersOf = (w, team) => alive(w, 1 - team).filter((f) => TB.geometry.inCapture(w, w.treasures[team], f.x, f.y));
  function underAttack(w, f) {
    if (f.hitAt !== undefined && w.match.time - f.hitAt <= UNDER_FIRE) return true;
    return alive(w, 1 - f.team).some((q) => q.target === f && TB.nav.inRange(w, q, f));
  }
  // Every condition is checked on the same simulation step for both teams, so array order gives no advantage.
  // progress[team] is how long the enemy has held team's treasure zone.
  function check(w, dt = 0) {
    const m = w.match;
    if (!m.progress) m.progress = [0, 0];
    if (!m.contested) m.contested = [false, false];
    const takers = [0, 1].map((team) => takersOf(w, team));
    for (const team of [0, 1]) {
      const held = takers[team].length > 0,
        free = takers[team].some((f) => !underAttack(w, f));
      m.contested[team] = held && !free;
      if (!held) m.progress[team] = Math.max(0, m.progress[team] - DECAY * dt);
      else m.progress[team] = Math.min(CAPTURE_TIME, m.progress[team] + dt * (free ? 1 : SLOWED));
    }
    const captured = [0, 1].map((team) => takers[team].length > 0 && m.progress[team] >= CAPTURE_TIME - 1e-9),
      wiped = [0, 1].map((team) => alive(w, team).length === 0),
      wins = [captured[1] || wiped[1], captured[0] || wiped[0]];
    if (!wins[0] && !wins[1]) return null;
    if (wins[0] && wins[1]) {
      if (captured[0] && captured[1]) return { winner: null, reason: "capture-both", takers: [...takers[1], ...takers[0]] };
      // Proposed extra rule, waiting for confirmation: both squads wiped out in the same step is a draw.
      return { winner: null, reason: "wipe-both", takers: [] };
    }
    const winner = wins[0] ? 0 : 1;
    // A squad wiped out hands its treasure to the winner.
    return captured[1 - winner] ? { winner, reason: "capture", takers: takers[1 - winner] } : { winner, reason: "wipe", takers: [] };
  }
  function describe(result, names) {
    const who = (list) => [...new Set(list.map((f) => names[f.character]))].join(" и ");
    if (result.winner === null)
      return result.reason === "capture-both" ? "Оба сокровища удержаны в один момент" : "Оба отряда погибли в один момент (предложенное правило: ничья)";
    if (result.reason === "capture")
      return result.winner === 0 ? `${who(result.takers)}: удержал(и) сундук соперника ${CAPTURE_TIME} с` : `${who(result.takers)} соперника удержал(и) ваш сундук ${CAPTURE_TIME} с`;
    return result.winner === 0 ? "Отряд соперника уничтожен, его сокровище ваше" : "Ваш отряд уничтожен, соперник забирает сокровище";
  }
  return { MAX_DEFENDERS, QUIET_TIME, CAPTURE_TIME, DECAY, SLOWED, UNDER_FIRE, CALM_START, CALM_TIME, create, check, describe, alive, takersOf, underAttack };
})();
