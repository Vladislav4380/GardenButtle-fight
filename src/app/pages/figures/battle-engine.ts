export type Team = 'blue' | 'red';
export type BattleOrientation = 'portrait' | 'landscape';
export type HeroType = 'Guardian' | 'Brawler' | 'Sniper' | 'Assassin' | 'Hunter';
export type HeroState = 'idle' | 'moving' | 'retreating' | 'attacking' | 'cooldown' | 'dead';
export type TargetPolicy = 'highest_attack' | 'lowest_hp' | 'lowest_hp_percent';
export type TargetMode =
  | 'frontline'
  | 'nearest'
  | 'highest_attack'
  | 'lowest_hp'
  | 'lowest_hp_percent'
  | 'highest_threat';
export type MovementMode = 'hold_front' | 'direct' | 'keep_range';
export interface Point {
  x: number;
  y: number;
}
export interface Hero {
  id: string;
  team: Team;
  name: string;
  role: string;
  type: HeroType;
  maxHp: number;
  hp: number;
  attackPower: number;
  defense: number;
  attackInterval: number;
  moveSpeed: number;
  mass: number;
  attackRange: number;
  preferredRange: number;
  minimumEffectiveRange: number;
  radius: number;
  tactic: string;
  targetMode?: TargetMode;
  movementMode?: MovementMode;
  targetPolicy?: TargetPolicy;
  retargetInterval: number;
  retargetThreshold: number;
  position: Point;
  spawn: Point;
  velocity: Point;
  currentTargetId?: string;
  targetScore: number;
  targetReason: string;
  state: HeroState;
  lastAttack: number;
  lastRetarget: number;
  damageDone: number;
  kills: number;
  targetSwitches: number;
  deathTime?: number;
}
export interface AttackEvent {
  id: number;
  from: string;
  to: string;
  damage: number;
  time: number;
}
export interface BattleState {
  heroes: Hero[];
  time: number;
  status: 'ready' | 'running' | 'paused' | 'finished';
  winner?: Team | 'draw';
  attacks: AttackEvent[];
  width: number;
  height: number;
  stepCount: number;
  initiativeOffset: number;
  orientation: BattleOrientation;
}
export interface BattleConfig {
  blueLines: number;
  redLines: number;
  orientation: BattleOrientation;
}
export interface BattleResult {
  winner: Team | 'draw';
  duration: number;
  remainingHp: number;
  heroes: Hero[];
}
export const HERO_TYPES: HeroType[] = ['Guardian', 'Brawler', 'Sniper', 'Assassin', 'Hunter'];
export const FIELD = { width: 700, height: 390 };
export const PORTRAIT_FIELD = { width: 390, height: 700 };
export const DEFAULT_BATTLE_CONFIG: BattleConfig = {
  blueLines: 1,
  redLines: 1,
  orientation: 'portrait',
};
const specs: Record<HeroType, Partial<Hero>> = {
  Guardian: {
    name: 'GUA',
    role: 'Tank',
    maxHp: 240,
    attackPower: 22,
    defense: 12,
    attackInterval: 1150,
    moveSpeed: 38,
    mass: 3,
    attackRange: 30,
    preferredRange: 22,
    minimumEffectiveRange: 0,
    radius: 23,
    tactic: 'hold_front',
    retargetInterval: 1800,
    retargetThreshold: 0.5,
  },
  Brawler: {
    name: 'BRW',
    role: 'Fighter',
    maxHp: 165,
    attackPower: 34,
    defense: 7,
    attackInterval: 900,
    moveSpeed: 52,
    mass: 2,
    attackRange: 30,
    preferredRange: 25,
    minimumEffectiveRange: 0,
    radius: 21,
    tactic: 'nearest_enemy',
    retargetInterval: 2500,
    retargetThreshold: 0.5,
  },
  Sniper: {
    name: 'SNP',
    role: 'Archer',
    maxHp: 95,
    attackPower: 38,
    defense: 2,
    attackInterval: 1350,
    moveSpeed: 43,
    mass: 1,
    attackRange: 220,
    preferredRange: 180,
    minimumEffectiveRange: 70,
    radius: 19,
    tactic: 'high_value_target',
    targetPolicy: 'highest_attack',
    retargetInterval: 1200,
    retargetThreshold: 0.15,
  },
  Assassin: {
    name: 'ASN',
    role: 'Assassin',
    maxHp: 120,
    attackPower: 43,
    defense: 3,
    attackInterval: 800,
    moveSpeed: 78,
    mass: 1.2,
    attackRange: 27,
    preferredRange: 20,
    minimumEffectiveRange: 0,
    radius: 19,
    tactic: 'weakest_target',
    targetPolicy: 'lowest_hp_percent',
    retargetInterval: 650,
    retargetThreshold: 0.12,
  },
  Hunter: {
    name: 'HNT',
    role: 'Counter',
    maxHp: 145,
    attackPower: 31,
    defense: 6,
    attackInterval: 950,
    moveSpeed: 55,
    mass: 1.7,
    attackRange: 125,
    preferredRange: 100,
    minimumEffectiveRange: 35,
    radius: 20,
    tactic: 'highest_threat',
    retargetInterval: 1000,
    retargetThreshold: 0.2,
  },
};
function createHero(
  type: HeroType,
  team: Team,
  index: number,
  total: number,
  lines: number,
  orientation: BattleOrientation,
): Hero {
  const s = specs[type] as Required<
    Omit<
      Hero,
      | 'id'
      | 'team'
      | 'type'
      | 'hp'
      | 'position'
      | 'spawn'
      | 'velocity'
      | 'currentTargetId'
      | 'targetScore'
      | 'targetReason'
      | 'state'
      | 'lastAttack'
      | 'lastRetarget'
      | 'damageDone'
      | 'kills'
      | 'targetSwitches'
      | 'deathTime'
    >
  >;
  const field = orientation === 'portrait' ? PORTRAIT_FIELD : FIELD;
  const lineCount = Math.max(1, Math.min(lines, total));
  const line = index % lineCount;
  const slot = Math.floor(index / lineCount);
  const unitsInLine = Math.ceil((total - line) / lineCount);
  const across = (field[orientation === 'portrait' ? 'width' : 'height'] * (slot + 1)) /
    (unitsInLine + 1);
  const depth = 55 + line * 54;
  const p =
    orientation === 'portrait'
      ? { x: across, y: team === 'blue' ? field.height - depth : depth }
      : { x: team === 'blue' ? depth : field.width - depth, y: across };
  return {
    ...s,
    id: `${team}-${index}-${type}`,
    team,
    type,
    hp: s.maxHp,
    position: { ...p },
    spawn: { ...p },
    velocity: { x: 0, y: 0 },
    targetScore: 0,
    targetReason: '—',
    state: 'idle',
    lastAttack: -s.attackInterval,
    lastRetarget: -s.retargetInterval,
    damageDone: 0,
    kills: 0,
    targetSwitches: 0,
  };
}
export const distance = (a: Hero, b: Hero) =>
  Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
export const currentSpeed = (hero: Hero) => Math.hypot(hero.velocity.x, hero.velocity.y);
export const momentum = (hero: Hero) => hero.mass * hero.moveSpeed;
function score(h: Hero, e: Hero) {
  const mode =
    h.targetMode ??
    ({
      hold_front: 'frontline',
      nearest_enemy: 'nearest',
      high_value_target: h.targetPolicy ?? 'highest_attack',
      weakest_target: 'lowest_hp_percent',
      highest_threat: 'highest_threat',
    }[h.tactic] as TargetMode | undefined) ??
    'nearest';
  if (mode === 'frontline') {
    const forward = h.team === 'blue' ? e.position.x - h.position.x : h.position.x - e.position.x;
    return 1000 - distance(h, e) + Math.max(0, forward) * 0.15;
  }
  if (mode === 'nearest') return 1000 - distance(h, e);
  if (mode === 'highest_attack') return e.attackPower;
  if (mode === 'lowest_hp') return 1000 - e.hp;
  if (mode === 'lowest_hp_percent')
    return (
      1000 -
      (e.hp / e.maxHp) * 100 +
      (h.tactic === 'weakest_target' && e.role === 'Archer' ? 25 : 0)
    );
  return (e.attackPower / e.attackInterval) * 1000;
}
function chooseTarget(h: Hero, s: BattleState) {
  let enemies = s.heroes.filter((x) => x.team !== h.team && x.hp > 0);
  if (!enemies.length) return;
  const target = enemies.sort((a, b) => score(h, b) - score(h, a))[0],
    value = score(h, target);
  let reason = 'Nearest enemy';
  if (h.targetMode === 'frontline' || h.tactic === 'hold_front') reason = 'Protecting frontline';
  else if (h.targetMode === 'highest_attack' || h.tactic === 'high_value_target')
    reason = `Highest attack: ${target.attackPower}`;
  else if (
    h.targetMode === 'lowest_hp' ||
    h.targetMode === 'lowest_hp_percent' ||
    h.tactic === 'weakest_target'
  )
    reason = `Weakest target: ${Math.ceil(target.hp)}/${target.maxHp}`;
  else if (h.targetMode === 'highest_threat' || h.tactic === 'highest_threat')
    reason = `Highest threat: ${value.toFixed(1)}`;
  return { target, value, reason };
}
function shouldRetarget(h: Hero, current: Hero | undefined, s: BattleState) {
  if (!current || current.hp <= 0) return true;
  if (s.time - h.lastRetarget < h.retargetInterval) return false;
  if (h.tactic === 'nearest_enemy') return false;
  if (h.movementMode === 'hold_front' || h.tactic === 'hold_front')
    return distance(h, current) > 210;
  const next = chooseTarget(h, s);
  return (
    !!next &&
    next.target.id !== current.id &&
    next.value > h.targetScore * (1 + h.retargetThreshold)
  );
}
function movementModeFor(h: Hero): MovementMode {
  return (
    h.movementMode ??
    ({
      hold_front: 'hold_front',
      nearest_enemy: 'direct',
      high_value_target: 'keep_range',
      weakest_target: 'direct',
      highest_threat: 'keep_range',
    }[h.tactic] as MovementMode | undefined) ??
    'direct'
  );
}

function movement(h: Hero, target: Hero, s: BattleState) {
  const movementMode = movementModeFor(h);
  const desiredRange =
    movementMode === 'keep_range' || h.attackRange > 40
      ? Math.min(h.preferredRange, h.attackRange)
      : 0;
  const targetDistance = distance(h, target) - h.radius - target.radius;
  const targetIsAhead =
    s.orientation === 'portrait'
      ? h.team === 'blue'
        ? target.position.y <= h.position.y
        : target.position.y >= h.position.y
      : h.team === 'blue'
        ? target.position.x >= h.position.x
        : target.position.x <= h.position.x;
  let dx = target.position.x - h.position.x,
    dy = target.position.y - h.position.y,
    len = Math.max(1, Math.hypot(dx, dy)),
    retreat = false;
  dx /= len;
  dy /= len;
  if (movementMode === 'keep_range') {
    const nearestThreat = s.heroes
      .filter((unit) => unit.team !== h.team && unit.hp > 0)
      .sort((a, b) => distance(h, a) - distance(h, b))[0];
    const threatDistance = nearestThreat
      ? distance(h, nearestThreat) - h.radius - nearestThreat.radius
      : Number.POSITIVE_INFINITY;
    const tolerance = Math.max(4, Math.min(12, desiredRange * 0.08));
    const retreatRange = Math.max(h.minimumEffectiveRange, desiredRange - tolerance);
    if (nearestThreat && threatDistance < retreatRange) {
      len = Math.max(
        1,
        Math.hypot(
          h.position.x - nearestThreat.position.x,
          h.position.y - nearestThreat.position.y,
        ),
      );
      dx = (h.position.x - nearestThreat.position.x) / len;
      dy = (h.position.y - nearestThreat.position.y) / len;
      retreat = true;
    } else if (targetDistance <= desiredRange + tolerance) {
      return { dx: 0, dy: 0, retreat };
    }
  } else if (h.minimumEffectiveRange && targetDistance < h.minimumEffectiveRange) {
    dx = -dx;
    dy = -dy;
    retreat = true;
  } else if (targetDistance <= desiredRange) return { dx: 0, dy: 0, retreat };
  if (
    movementMode === 'hold_front' &&
    !targetIsAhead &&
    Math.hypot(h.position.x - h.spawn.x, h.position.y - h.spawn.y) > 190 &&
    targetDistance > h.attackRange + 30
  ) {
    len = Math.max(1, Math.hypot(h.spawn.x - h.position.x, h.spawn.y - h.position.y));
    dx = (h.spawn.x - h.position.x) / len;
    dy = (h.spawn.y - h.position.y) / len;
  }
  return { dx, dy, retreat };
}
function keepInsideField(h: Hero, s: BattleState) {
  h.position.x = Math.max(h.radius, Math.min(s.width - h.radius, h.position.x));
  h.position.y = Math.max(h.radius, Math.min(s.height - h.radius, h.position.y));
}
export function resolveOverlaps(s: BattleState, dt = 0) {
  const heroes = s.heroes.filter((h) => h.hp > 0);
  const padding = 2;
  const contactMargin = dt > 0 ? 1 : 0;
  const parents = heroes.map((_, index) => index);
  const find = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };
  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parents[rootB] = rootA;
  };

  for (let i = 0; i < heroes.length; i++) {
    for (let j = i + 1; j < heroes.length; j++) {
      const contactDistance = heroes[i].radius + heroes[j].radius + padding + contactMargin;
      if (distance(heroes[i], heroes[j]) <= contactDistance) union(i, j);
    }
  }

  const groups = new Map<number, Hero[]>();
  for (let index = 0; index < heroes.length; index++) {
    const root = find(index);
    const group = groups.get(root) ?? [];
    group.push(heroes[index]);
    groups.set(root, group);
  }

  if (dt > 0) {
    for (const group of groups.values()) {
      const blue = group.filter((hero) => hero.team === 'blue');
      const red = group.filter((hero) => hero.team === 'red');
      if (!blue.length || !red.length) continue;

      let pushBlueX = 0;
      let pushBlueY = 0;
      let maximumOverlap = 0;
      let enemyContacts = 0;
      for (const blueHero of blue) {
        for (const redHero of red) {
          let dx = blueHero.position.x - redHero.position.x;
          let dy = blueHero.position.y - redHero.position.y;
          const centerDistance = Math.hypot(dx, dy);
          const minimumDistance = blueHero.radius + redHero.radius + padding;
          if (centerDistance > minimumDistance + contactMargin) continue;
          if (centerDistance < 0.001) {
            dx = blueHero.team === 'blue' ? 0 : 1;
            dy = s.orientation === 'portrait' ? 1 : -1;
          }
          const length = Math.max(1, Math.hypot(dx, dy));
          pushBlueX += dx / length;
          pushBlueY += dy / length;
          maximumOverlap = Math.max(maximumOverlap, minimumDistance - centerDistance);
          enemyContacts++;
        }
      }
      if (!enemyContacts) continue;

      let normalLength = Math.hypot(pushBlueX, pushBlueY);
      if (normalLength < 0.001) {
        const blueCenter = blue.reduce(
          (point, hero) => ({ x: point.x + hero.position.x, y: point.y + hero.position.y }),
          { x: 0, y: 0 },
        );
        const redCenter = red.reduce(
          (point, hero) => ({ x: point.x + hero.position.x, y: point.y + hero.position.y }),
          { x: 0, y: 0 },
        );
        pushBlueX = blueCenter.x / blue.length - redCenter.x / red.length;
        pushBlueY = blueCenter.y / blue.length - redCenter.y / red.length;
        normalLength = Math.max(1, Math.hypot(pushBlueX, pushBlueY));
      }
      pushBlueX /= normalLength;
      pushBlueY /= normalLength;

      const blueMomentum = blue.reduce((sum, hero) => sum + momentum(hero), 0);
      const redMomentum = red.reduce((sum, hero) => sum + momentum(hero), 0);
      const difference = Math.abs(blueMomentum - redMomentum);
      const relativeDifference = difference / Math.max(blueMomentum, redMomentum, 1);
      const pressure = relativeDifference * 90 * (dt / 1000);
      const displacement = Math.max(0, maximumOverlap) + pressure;

      const moveGroup = (units: Hero[], dx: number, dy: number, amount: number) => {
        for (const hero of units) {
          hero.position.x += dx * amount;
          hero.position.y += dy * amount;
          keepInsideField(hero, s);
        }
      };

      if (blueMomentum < redMomentum) {
        moveGroup(blue, pushBlueX, pushBlueY, displacement);
      } else if (redMomentum < blueMomentum) {
        moveGroup(red, -pushBlueX, -pushBlueY, displacement);
      } else if (maximumOverlap > 0) {
        moveGroup(blue, pushBlueX, pushBlueY, maximumOverlap / 2);
        moveGroup(red, -pushBlueX, -pushBlueY, maximumOverlap / 2);
      }
    }
  }

  // A second, neutral solver removes remaining penetrations. It never compares
  // individual momenta, so it cannot force one member through its supporting group.
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < heroes.length; i++) {
      for (let j = i + 1; j < heroes.length; j++) {
        const a = heroes[i];
        const b = heroes[j];
        let dx = b.position.x - a.position.x;
        let dy = b.position.y - a.position.y;
        let centerDistance = Math.hypot(dx, dy);
        const minimumDistance = a.radius + b.radius + padding;
        if (centerDistance >= minimumDistance) continue;
        if (centerDistance < 0.001) {
          const angle = (((i + 1) * 37 + (j + 1) * 71) % 360) * (Math.PI / 180);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          centerDistance = 1;
        }
        const nx = dx / centerDistance;
        const ny = dy / centerDistance;
        const push = (minimumDistance - centerDistance) / 2;
        a.position.x -= nx * push;
        a.position.y -= ny * push;
        b.position.x += nx * push;
        b.position.y += ny * push;
        keepInsideField(a, s);
        keepInsideField(b, s);
      }
    }
  }
}
export function createBattle(
  blue: HeroType[],
  red: HeroType[],
  overrides: Record<string, Partial<Hero>> = {},
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
): BattleState {
  const normalizedConfig = {
    blueLines: Math.max(1, Math.min(config.blueLines, blue.length)),
    redLines: Math.max(1, Math.min(config.redLines, red.length)),
    orientation: config.orientation,
  };
  const field = normalizedConfig.orientation === 'portrait' ? PORTRAIT_FIELD : FIELD;
  const heroes = [
    ...blue.map((x, i) =>
      createHero(x, 'blue', i, blue.length, normalizedConfig.blueLines, config.orientation),
    ),
    ...red.map((x, i) =>
      createHero(x, 'red', i, red.length, normalizedConfig.redLines, config.orientation),
    ),
  ].map((h) => {
    const override = overrides[h.id] ?? {};
    const position = override.position ? { ...override.position } : { ...h.position };
    const spawn = override.spawn ? { ...override.spawn } : { ...position };
    return { ...h, ...override, position, spawn, velocity: { x: 0, y: 0 } };
  });
  return {
    heroes,
    time: 0,
    status: 'ready',
    attacks: [],
    stepCount: 0,
    initiativeOffset: Math.random() < 0.5 ? 0 : 1,
    orientation: normalizedConfig.orientation,
    ...field,
  };
}
export function stepBattle(s: BattleState, dt: number, visual = true) {
  if (s.status !== 'running') return;
  s.time += dt;
  s.stepCount++;
  for (const hero of s.heroes) hero.velocity = { x: 0, y: 0 };
  const blueFirst = (s.stepCount + s.initiativeOffset) % 2 === 0;
  const orderedHeroes = [...s.heroes].sort((a, b) => {
    if (a.team === b.team) return 0;
    return (a.team === 'blue') === blueFirst ? -1 : 1;
  });
  for (const h of orderedHeroes) {
    if (h.hp <= 0) {
      h.state = 'dead';
      continue;
    }
    let target = s.heroes.find((x) => x.id === h.currentTargetId);
    if (shouldRetarget(h, target, s)) {
      const pick = chooseTarget(h, s);
      if (pick) {
        if (h.currentTargetId && h.currentTargetId !== pick.target.id) h.targetSwitches++;
        h.currentTargetId = pick.target.id;
        h.targetScore = pick.value;
        h.targetReason = pick.reason;
        h.lastRetarget = s.time;
        target = pick.target;
      }
    }
    if (!target || target.hp <= 0) {
      h.state = 'idle';
      continue;
    }
    const d = distance(h, target) - h.radius - target.radius;
    const m = movement(h, target, s);
    const shouldMove = Math.abs(m.dx) > 0.001 || Math.abs(m.dy) > 0.001;
    if (shouldMove) {
      const sec = dt / 1000;
      const previousX = h.position.x;
      const previousY = h.position.y;
      h.position.x = Math.max(
        h.radius,
        Math.min(s.width - h.radius, h.position.x + m.dx * h.moveSpeed * sec),
      );
      h.position.y = Math.max(
        h.radius,
        Math.min(s.height - h.radius, h.position.y + m.dy * h.moveSpeed * sec),
      );
      if (sec > 0) {
        h.velocity.x = (h.position.x - previousX) / sec;
        h.velocity.y = (h.position.y - previousY) / sec;
      }
      h.state = m.retreat ? 'retreating' : 'moving';
    }

    const canAttackWhileMoving = movementModeFor(h) === 'keep_range';
    if (d <= h.attackRange && (!shouldMove || canAttackWhileMoving)) {
      if (s.time - h.lastAttack >= h.attackInterval) {
        const damage = Math.max(1, h.attackPower - target.defense);
        target.hp = Math.max(0, target.hp - damage);
        h.damageDone += damage;
        h.lastAttack = s.time;
        h.state = 'attacking';
        if (target.hp <= 0) {
          h.kills++;
          target.deathTime = s.time;
        }
        if (visual)
          s.attacks.push({ id: Math.random(), from: h.id, to: target.id, damage, time: s.time });
      } else if (!shouldMove) h.state = 'cooldown';
    } else if (!shouldMove) h.state = 'idle';
  }
  resolveOverlaps(s, dt);
  s.attacks = s.attacks.filter((a) => s.time - a.time < 240);
  const blue = s.heroes.some((x) => x.team === 'blue' && x.hp > 0),
    red = s.heroes.some((x) => x.team === 'red' && x.hp > 0);
  if (!blue || !red || s.time >= 120000) {
    s.status = 'finished';
    s.winner = blue && !red ? 'blue' : red && !blue ? 'red' : 'draw';
  }
}
export function simulate(
  blue: HeroType[],
  red: HeroType[],
  overrides: Record<string, Partial<Hero>> = {},
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
): BattleResult {
  const s = createBattle(blue, red, overrides, config);
  s.status = 'running';
  while (s.status === 'running') stepBattle(s, 50, false);
  return {
    winner: s.winner || 'draw',
    duration: s.time,
    remainingHp: s.heroes.reduce((a, h) => a + h.hp, 0),
    heroes: s.heroes,
  };
}
export interface BatchStats {
  runs: number;
  blueWins: number;
  redWins: number;
  draws: number;
  avgDuration: number;
  avgRemainingHp: number;
  battles: BatchBattleStats[];
  byType: Record<
    string,
    { damage: number; lifetime: number; kills: number; switches: number; count: number }
  >;
}
export interface BatchBattleStats {
  run: number;
  winner: Team | 'draw';
  duration: number;
  blueRemainingHp: number;
  redRemainingHp: number;
  blueSurvivors: number;
  redSurvivors: number;
}
export function runBatch(
  n: number,
  blue: HeroType[],
  red: HeroType[],
  overrides: Record<string, Partial<Hero>> = {},
  config: BattleConfig = DEFAULT_BATTLE_CONFIG,
) {
  const out: BatchStats = {
    runs: n,
    blueWins: 0,
    redWins: 0,
    draws: 0,
    avgDuration: 0,
    avgRemainingHp: 0,
    battles: [],
    byType: {},
  };
  for (let i = 0; i < n; i++) {
    const r = simulate(blue, red, overrides, config);
    r.winner === 'blue' ? out.blueWins++ : r.winner === 'red' ? out.redWins++ : out.draws++;
    out.avgDuration += r.duration;
    out.avgRemainingHp += r.remainingHp;
    out.battles.push({
      run: i + 1,
      winner: r.winner,
      duration: r.duration,
      blueRemainingHp: r.heroes
        .filter((h) => h.team === 'blue')
        .reduce((sum, h) => sum + h.hp, 0),
      redRemainingHp: r.heroes
        .filter((h) => h.team === 'red')
        .reduce((sum, h) => sum + h.hp, 0),
      blueSurvivors: r.heroes.filter((h) => h.team === 'blue' && h.hp > 0).length,
      redSurvivors: r.heroes.filter((h) => h.team === 'red' && h.hp > 0).length,
    });
    for (const h of r.heroes) {
      const x = (out.byType[h.type] ??= {
        damage: 0,
        lifetime: 0,
        kills: 0,
        switches: 0,
        count: 0,
      });
      x.damage += h.damageDone;
      x.lifetime += h.deathTime ?? r.duration;
      x.kills += h.kills;
      x.switches += h.targetSwitches;
      x.count++;
    }
  }
  out.avgDuration /= n;
  out.avgRemainingHp /= n;
  return out;
}
