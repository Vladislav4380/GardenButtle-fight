import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BatchStats,
  BattleConfig,
  BattleOrientation,
  BattleState,
  createBattle,
  currentSpeed,
  distance,
  Hero,
  HeroType,
  HERO_TYPES,
  MovementMode,
  momentum,
  resolveOverlaps,
  runBatch,
  stepBattle,
  Team,
  TargetMode,
} from './battle-engine';
type Lang = 'ua' | 'en';
type EditableStat =
  | 'maxHp'
  | 'hp'
  | 'attackPower'
  | 'defense'
  | 'attackRange'
  | 'preferredRange'
  | 'minimumEffectiveRange'
  | 'attackInterval'
  | 'moveSpeed'
  | 'mass'
  | 'retargetInterval'
  | 'retargetThreshold';
const TEXT = {
  ua: {
    title: 'Лабораторія Garden Battle',
    lab: 'Лабораторія',
    subtitle: 'ТАКТИЧНА СИМУЛЯЦІЯ · BUILD 0.1',
    ready: 'ГОТОВО',
    running: 'ТРИВАЄ',
    paused: 'ПАУЗА',
    finished: 'ЗАВЕРШЕНО',
    start: 'Старт',
    pause: 'Пауза',
    reset: 'Скинути',
    setup: 'Налаштування експерименту',
    configuration: 'ЛАБОРАТОРІЯ БОЮ / НАЛАШТУВАННЯ',
    intro: 'Змініть склад, запустіть живий бій або сотні симуляцій без рендерингу.',
    team: 'КОМАНДА',
    blue: 'СИНІ',
    red: 'ЧЕРВОНІ',
    run10: 'Запустити 10',
    run100: 'Запустити 100',
    state: 'Стан',
    size: 'Кількість героїв',
    fieldOrientation: 'Орієнтація поля',
    portrait: 'Вертикальна',
    landscape: 'Горизонтальна',
    results: 'РЕЗУЛЬТАТИ СЕРІЇ',
    blueWins: 'Перемоги синіх',
    redWins: 'Перемоги червоних',
    draws: 'Нічиї',
    duration: 'СЕРЕДНЯ ТРИВАЛІСТЬ',
    remaining: 'СЕРЕДНЄ ЗАЛИШКОВЕ HP',
    inspector: 'ІНСПЕКТОР AI',
    select: 'Оберіть героя',
    selectHint: 'Натисніть на бійця, щоб побачити рішення AI.',
    role: 'Роль',
    hp: 'Поточне HP',
    maxHp: 'Максимальне HP',
    attack: 'Сила атаки',
    defense: 'Захист',
    attackRange: 'Дальність атаки',
    preferredRange: 'Бажана дистанція',
    minimumRange: 'Мін. ефективна дистанція',
    interval: 'Інтервал атаки',
    speed: 'Швидкість руху',
    mass: 'Маса',
    currentSpeed: 'Поточна швидкість',
    momentum: 'Імпульс зіткнення',
    retargetInterval: 'Інтервал зміни цілі',
    retargetThreshold: 'Поріг зміни цілі',
    editHint: 'Зміни застосовуються одразу та зберігаються після скидання бою.',
    restore: 'Типові значення',
    tactic: 'Тактика',
    tacticHow: 'ЯК ПРАЦЮЄ ТАКТИКА',
    targetRule: 'ЦІЛЬ',
    movementRule: 'РУХ',
    retargetRule: 'ЗМІНА ЦІЛІ',
    target: 'Поточна ціль',
    score: 'Оцінка цілі',
    distance: 'Відстань',
    reason: 'ПРИЧИНА ВИБОРУ ЦІЛІ',
    type: 'ТИП',
    damage: 'ШКОДА',
    life: 'ЖИТТЯ',
    kills: 'ВБИВСТВА',
    switches: 'ЗМІНИ ЦІЛІ',
    tacticLibrary: 'КОНСТРУКТОР ТАКТИК',
    tacticName: 'Назва тактики',
    addTactic: 'Додати тактику',
    chooseTactic: 'Обрати тактику',
    tacticAdded: 'Тактику додано. Вона доступна у списку кожного героя.',
    tacticNameRequired: 'Вкажіть назву тактики.',
    customTacticsLabel: 'ДОДАНІ ТАКТИКИ',
    downloadStats: 'Завантажити статистику CSV',
    dragHint: 'Перетягніть героя, щоб змінити позицію',
  },
  en: {
    title: 'Garden Battle Lab',
    lab: 'Lab',
    subtitle: 'TACTICAL SIMULATION · BUILD 0.1',
    ready: 'READY',
    running: 'RUNNING',
    paused: 'PAUSED',
    finished: 'FINISHED',
    start: 'Start',
    pause: 'Pause',
    reset: 'Reset',
    setup: 'Experiment setup',
    configuration: 'BATTLE LAB / CONFIGURATION',
    intro: 'Change the roster, run a live battle, or simulate hundreds without rendering.',
    team: 'TEAM',
    blue: 'BLUE',
    red: 'RED',
    run10: 'Run 10',
    run100: 'Run 100',
    state: 'State',
    size: 'Team size',
    fieldOrientation: 'Field orientation',
    portrait: 'Portrait',
    landscape: 'Landscape',
    results: 'BATCH RESULTS',
    blueWins: 'Blue wins',
    redWins: 'Red wins',
    draws: 'Draws',
    duration: 'AVG DURATION',
    remaining: 'AVG REMAINING HP',
    inspector: 'AI INSPECTOR',
    select: 'Select a hero',
    selectHint: 'Tap any unit to inspect its AI decision.',
    role: 'Role',
    hp: 'Current HP',
    maxHp: 'Maximum HP',
    attack: 'Attack power',
    defense: 'Defense',
    attackRange: 'Attack range',
    preferredRange: 'Preferred range',
    minimumRange: 'Min. effective range',
    interval: 'Attack interval',
    speed: 'Move speed',
    mass: 'Mass',
    currentSpeed: 'Current speed',
    momentum: 'Collision momentum',
    retargetInterval: 'Retarget interval',
    retargetThreshold: 'Retarget threshold',
    editHint: 'Changes apply immediately and persist after battle reset.',
    restore: 'Restore defaults',
    tactic: 'Tactic',
    tacticHow: 'HOW THE TACTIC WORKS',
    targetRule: 'TARGET',
    movementRule: 'MOVEMENT',
    retargetRule: 'RETARGET',
    target: 'Current target',
    score: 'Target score',
    distance: 'Distance',
    reason: 'TARGET REASON',
    type: 'TYPE',
    damage: 'DAMAGE',
    life: 'LIFE',
    kills: 'KILLS',
    switches: 'SWITCHES',
    tacticLibrary: 'TACTIC BUILDER',
    tacticName: 'Tactic name',
    addTactic: 'Add tactic',
    chooseTactic: 'Choose tactic',
    tacticAdded: 'Tactic added. It is available in every hero list.',
    tacticNameRequired: 'Enter a tactic name.',
    customTacticsLabel: 'ADDED TACTICS',
    downloadStats: 'Download statistics CSV',
    dragHint: 'Drag a hero to change its position',
  },
} as const;

const TACTIC_INFO: Record<
  Lang,
  Record<HeroType, { summary: string; target: string; movement: string; retarget: string }>
> = {
  ua: {
    Guardian: {
      summary: 'Тримає передню лінію та прикриває вразливих союзників.',
      target: 'Найближчий ворог попереду або загроза біля фронту.',
      movement: 'Зближується для ближнього бою, але не переслідує ворога через усе поле.',
      retarget: 'Майже не змінює живу ціль; відпускає її, якщо вона відійшла надто далеко.',
    },
    Brawler: {
      summary: 'Простий і передбачуваний боєць ближнього бою.',
      target: 'Завжди обирає найближчого живого противника.',
      movement: 'Йде прямо до цілі та намагається триматися в радіусі удару.',
      retarget: 'Змінює ціль переважно після її смерті.',
    },
    Sniper: {
      summary: 'Завдає дальньої шкоди та намагається зберігати безпечну дистанцію.',
      target:
        'Пріоритет визначає targetPolicy: найбільша атака, найменше HP або найменший відсоток HP.',
      movement:
        'Наближається до бажаної дистанції та відступає, якщо ворог ближче minimumEffectiveRange.',
      retarget:
        'Періодично шукає ціннішу ціль і перемикається лише при достатньому прирості оцінки.',
    },
    Assassin: {
      summary: 'Проривається повз фронт до ослаблених і дальніх героїв.',
      target:
        'Найслабший ворог за відсотком HP; стрільці отримують бонус пріоритету, танки — штраф.',
      movement: 'Швидко рухається безпосередньо до обраної цілі, навіть якщо поруч є танк.',
      retarget: 'Часто переоцінює ворогів і переходить на помітно слабшу ціль.',
    },
    Hunter: {
      summary: 'Полює на противника з найбільшою поточною бойовою загрозою.',
      target: 'Максимальний threatScore: attackPower / attackInterval × 1000.',
      movement: 'Намагається тримати середню дистанцію та входить у власний радіус атаки.',
      retarget: 'Перемикається, якщо нова загроза перевищує поточну на retargetThreshold.',
    },
  },
  en: {
    Guardian: {
      summary: 'Holds the frontline and screens vulnerable allies.',
      target: 'The nearest enemy ahead or a threat close to the frontline.',
      movement: 'Closes for melee but refuses to chase an enemy across the entire field.',
      retarget: 'Rarely drops a living target; releases it when it moves too far away.',
    },
    Brawler: {
      summary: 'A simple and predictable melee fighter.',
      target: 'Always chooses the nearest living opponent.',
      movement: 'Moves directly toward the target and stays within striking range.',
      retarget: 'Usually changes target only after the current one dies.',
    },
    Sniper: {
      summary: 'Deals ranged damage while maintaining a safe distance.',
      target: 'targetPolicy selects highest attack, lowest HP, or lowest HP percentage.',
      movement: 'Approaches preferredRange and retreats inside minimumEffectiveRange.',
      retarget:
        'Periodically searches for a more valuable target and requires a sufficient score gain.',
    },
    Assassin: {
      summary: 'Breaks through the frontline toward weakened and ranged heroes.',
      target: 'Lowest HP percentage; archers gain priority and tanks receive a penalty.',
      movement: 'Rushes directly toward the chosen target even when a tank is nearby.',
      retarget: 'Frequently reevaluates enemies and switches to a noticeably weaker target.',
    },
    Hunter: {
      summary: 'Hunts the opponent with the highest current combat threat.',
      target: 'Highest threatScore: attackPower / attackInterval × 1000.',
      movement: 'Maintains medium distance and moves into its own attack range.',
      retarget: 'Switches when a new threat exceeds the current one by retargetThreshold.',
    },
  },
};

interface TacticDefinition {
  id: string;
  name: string;
  targetMode: TargetMode;
  movementMode: MovementMode;
  preferredRange: number;
  minimumEffectiveRange: number;
  retargetInterval: number;
  retargetThreshold: number;
}

const BUILTIN_TACTICS: TacticDefinition[] = [
  {
    id: 'hold_front',
    name: 'Hold front',
    targetMode: 'frontline',
    movementMode: 'hold_front',
    preferredRange: 22,
    minimumEffectiveRange: 0,
    retargetInterval: 1800,
    retargetThreshold: 0.5,
  },
  {
    id: 'nearest_enemy',
    name: 'Nearest enemy',
    targetMode: 'nearest',
    movementMode: 'direct',
    preferredRange: 25,
    minimumEffectiveRange: 0,
    retargetInterval: 2500,
    retargetThreshold: 0.5,
  },
  {
    id: 'high_value_target',
    name: 'High value target',
    targetMode: 'highest_attack',
    movementMode: 'keep_range',
    preferredRange: 180,
    minimumEffectiveRange: 70,
    retargetInterval: 1200,
    retargetThreshold: 0.15,
  },
  {
    id: 'weakest_target',
    name: 'Weakest target',
    targetMode: 'lowest_hp_percent',
    movementMode: 'direct',
    preferredRange: 20,
    minimumEffectiveRange: 0,
    retargetInterval: 650,
    retargetThreshold: 0.12,
  },
  {
    id: 'highest_threat',
    name: 'Highest threat',
    targetMode: 'highest_threat',
    movementMode: 'keep_range',
    preferredRange: 100,
    minimumEffectiveRange: 35,
    retargetInterval: 1000,
    retargetThreshold: 0.2,
  },
];

const TARGET_MODE_LABELS: Record<Lang, Record<TargetMode, string>> = {
  ua: {
    frontline: 'Захист фронту',
    nearest: 'Найближчий ворог',
    highest_attack: 'Найвища сила атаки',
    lowest_hp: 'Найменше поточне HP',
    lowest_hp_percent: 'Найменший відсоток HP',
    highest_threat: 'Найвища загроза',
  },
  en: {
    frontline: 'Protect frontline',
    nearest: 'Nearest enemy',
    highest_attack: 'Highest attack',
    lowest_hp: 'Lowest current HP',
    lowest_hp_percent: 'Lowest HP percentage',
    highest_threat: 'Highest threat',
  },
};

const MOVEMENT_MODE_LABELS: Record<Lang, Record<MovementMode, string>> = {
  ua: { hold_front: 'Тримати фронт', direct: 'Пряме зближення', keep_range: 'Тримати дистанцію' },
  en: { hold_front: 'Hold frontline', direct: 'Direct approach', keep_range: 'Keep distance' },
};
const TACTIC_NAMES: Record<Lang, Record<string, string>> = {
  ua: {
    hold_front: 'Тримати фронт',
    nearest_enemy: 'Найближчий ворог',
    high_value_target: 'Пріоритетна ціль',
    weakest_target: 'Найслабша ціль',
    highest_threat: 'Найвища загроза',
  },
  en: {
    hold_front: 'Hold front',
    nearest_enemy: 'Nearest enemy',
    high_value_target: 'High value target',
    weakest_target: 'Weakest target',
    highest_threat: 'Highest threat',
  },
};
const HERO_TYPE_LABELS: Record<Lang, Record<HeroType, string>> = {
  ua: {
    Guardian: 'Вартовий',
    Brawler: 'Боєць',
    Sniper: 'Снайпер',
    Assassin: 'Асасин',
    Hunter: 'Мисливець',
  },
  en: {
    Guardian: 'Guardian',
    Brawler: 'Brawler',
    Sniper: 'Sniper',
    Assassin: 'Assassin',
    Hunter: 'Hunter',
  },
};
const ROLE_LABELS: Record<Lang, Record<string, string>> = {
  ua: { Tank: 'Танк', Fighter: 'Боєць', Archer: 'Стрілець', Assassin: 'Асасин', Counter: 'Контргерой' },
  en: { Tank: 'Tank', Fighter: 'Fighter', Archer: 'Archer', Assassin: 'Assassin', Counter: 'Counter' },
};
const STATE_LABELS: Record<Lang, Record<string, string>> = {
  ua: {
    idle: 'очікує',
    moving: 'рухається',
    retreating: 'відступає',
    attacking: 'атакує',
    cooldown: 'перезаряджається',
    dead: 'мертвий',
  },
  en: {
    idle: 'idle',
    moving: 'moving',
    retreating: 'retreating',
    attacking: 'attacking',
    cooldown: 'cooldown',
    dead: 'dead',
  },
};
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./battle-lab-base.css', './app.css'],
})
export class App implements OnInit, OnDestroy {
  lang: Lang = 'ua';
  heroTypes = HERO_TYPES;
  blue: HeroType[] = ['Guardian', 'Sniper', 'Assassin'];
  red: HeroType[] = ['Brawler', 'Brawler', 'Hunter'];
  orientation: BattleOrientation = 'portrait';
  overrides: Record<string, Partial<Hero>> = {};
  battle = createBattle(this.blue, this.red, this.overrides, this.battleConfig());
  selectedId = '';
  speed = 1;
  stats?: BatchStats;
  labOpen = false;
  customTactics: TacticDefinition[] = [];
  tacticNotice = '';
  tacticNoticeError = false;
  tacticDraft: TacticDefinition = {
    id: '',
    name: '',
    targetMode: 'nearest',
    movementMode: 'direct',
    preferredRange: 25,
    minimumEffectiveRange: 0,
    retargetInterval: 1000,
    retargetThreshold: 0.2,
  };
  private frame = 0;
  private last = 0;
  private orientationMedia?: MediaQueryList;
  private draggedHero?: {
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  };
  private suppressedClickHeroId = '';
  inspectorSwipeOffset = 0;
  inspectorSwiping = false;
  private inspectorSwipe?: { pointerId: number; startY: number };
  labSwipeOffset = 0;
  labSwiping = false;
  private labSwipe?: { pointerId: number; startY: number };
  private readonly handleDeviceOrientation = (event: MediaQueryListEvent) => {
    if (window.innerWidth <= 950) this.setOrientation(event.matches ? 'portrait' : 'landscape');
  };
  private readonly handleBrowserBack = () => {
    if (this.selectedId) this.selectedId = '';
  };
  t(k: keyof typeof TEXT.ua) {
    return TEXT[this.lang][k];
  }
  get selectedHero() {
    return this.battle.heroes.find((h) => h.id === this.selectedId);
  }
  ngOnInit() {
    this.orientationMedia = window.matchMedia('(orientation: portrait)');
    if (window.innerWidth <= 950) {
      this.orientation = this.orientationMedia.matches ? 'portrait' : 'landscape';
      this.reset();
    }
    this.orientationMedia.addEventListener('change', this.handleDeviceOrientation);
    window.addEventListener('popstate', this.handleBrowserBack);
    const tick = (now: number) => {
      if (!this.last) this.last = now;
      const dt = Math.min(50, now - this.last) * this.speed;
      this.last = now;
      if (this.battle.status === 'running') stepBattle(this.battle, dt, true);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }
  ngOnDestroy() {
    cancelAnimationFrame(this.frame);
    this.orientationMedia?.removeEventListener('change', this.handleDeviceOrientation);
    window.removeEventListener('popstate', this.handleBrowserBack);
  }
  teamAlive(team: Team) {
    return this.battle.heroes.filter((h) => h.team === team && h.hp > 0).length;
  }
  teamCount(team: Team) {
    return this.battle.heroes.filter((h) => h.team === team).length;
  }
  isDragging(h: Hero) {
    return this.draggedHero?.id === h.id;
  }
  startHeroDrag(event: PointerEvent, h: Hero, arena: HTMLElement) {
    if (h.hp <= 0) return;
    if (this.battle.status === 'running') this.pause();
    this.draggedHero = {
      id: h.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  moveHeroDrag(event: PointerEvent, arena: HTMLElement) {
    if (!this.draggedHero || this.draggedHero.pointerId !== event.pointerId) return;
    if (
      !this.draggedHero.moved &&
      Math.hypot(
        event.clientX - this.draggedHero.startX,
        event.clientY - this.draggedHero.startY,
      ) < 6
    )
      return;
    this.draggedHero.moved = true;
    this.placeDraggedHero(event, arena);
    event.preventDefault();
  }
  endHeroDrag(event: PointerEvent) {
    if (!this.draggedHero || this.draggedHero.pointerId !== event.pointerId) return;
    const dragged = this.draggedHero;
    if (dragged.moved) {
      for (const unit of this.battle.heroes) {
        this.overrides[unit.id] = {
          ...(this.overrides[unit.id] ?? {}),
          position: { ...unit.position },
          spawn: { ...unit.position },
        };
        unit.spawn = { ...unit.position };
      }
      this.suppressedClickHeroId = dragged.id;
      setTimeout(() => {
        if (this.suppressedClickHeroId === dragged.id) this.suppressedClickHeroId = '';
      });
      this.stats = undefined;
      event.preventDefault();
    }
    this.draggedHero = undefined;
  }
  selectHero(h: Hero, event: MouseEvent) {
    if (this.suppressedClickHeroId === h.id) {
      this.suppressedClickHeroId = '';
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!this.selectedId && window.innerWidth <= 950) {
      window.history.pushState({ battleLabSheet: 'hero' }, '', window.location.href);
    }
    this.selectedId = h.id;
  }
  closeHeroSettings() {
    if (window.innerWidth <= 950 && window.history.state?.battleLabSheet === 'hero') {
      window.history.back();
    } else {
      this.selectedId = '';
    }
  }
  startInspectorSwipe(event: PointerEvent) {
    this.inspectorSwipe = { pointerId: event.pointerId, startY: event.clientY };
    this.inspectorSwiping = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  moveInspectorSwipe(event: PointerEvent) {
    if (!this.inspectorSwipe || this.inspectorSwipe.pointerId !== event.pointerId) return;
    this.inspectorSwipeOffset = Math.max(0, event.clientY - this.inspectorSwipe.startY);
    event.preventDefault();
  }
  endInspectorSwipe(event: PointerEvent) {
    if (!this.inspectorSwipe || this.inspectorSwipe.pointerId !== event.pointerId) return;
    const shouldClose = this.inspectorSwipeOffset >= 72;
    this.inspectorSwipe = undefined;
    this.inspectorSwiping = false;
    this.inspectorSwipeOffset = 0;
    if (shouldClose) this.closeHeroSettings();
    event.preventDefault();
  }
  toggleLab() {
    this.labOpen = !this.labOpen;
  }
  startLabSwipe(event: PointerEvent) {
    this.labSwipe = { pointerId: event.pointerId, startY: event.clientY };
    this.labSwiping = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  moveLabSwipe(event: PointerEvent) {
    if (!this.labSwipe || this.labSwipe.pointerId !== event.pointerId) return;
    this.labSwipeOffset = Math.max(0, event.clientY - this.labSwipe.startY);
    event.preventDefault();
  }
  endLabSwipe(event: PointerEvent) {
    if (!this.labSwipe || this.labSwipe.pointerId !== event.pointerId) return;
    const shouldClose = this.labSwipeOffset >= 72;
    this.labSwipe = undefined;
    this.labSwiping = false;
    this.labSwipeOffset = 0;
    if (shouldClose) this.labOpen = false;
    event.preventDefault();
  }
  private placeDraggedHero(event: PointerEvent, arena: HTMLElement) {
    if (!this.draggedHero) return;
    const h = this.battle.heroes.find((unit) => unit.id === this.draggedHero?.id);
    if (!h) return;
    const rect = arena.getBoundingClientRect();
    h.position.x = Math.max(
      h.radius,
      Math.min(
        this.battle.width - h.radius,
        ((event.clientX - rect.left) / rect.width) * this.battle.width,
      ),
    );
    h.position.y = Math.max(
      h.radius,
      Math.min(
        this.battle.height - h.radius,
        ((event.clientY - rect.top) / rect.height) * this.battle.height,
      ),
    );
    resolveOverlaps(this.battle);
  }
  battleConfig(): BattleConfig {
    return {
      blueLines: Math.ceil(this.blue.length / 4),
      redLines: Math.ceil(this.red.length / 4),
      orientation: this.orientation,
    };
  }
  reset(keepSelection = false) {
    const id = keepSelection ? this.selectedId : '';
    this.battle = createBattle(this.blue, this.red, this.overrides, this.battleConfig());
    this.selectedId = this.battle.heroes.some((h) => h.id === id) ? id : '';
    this.stats = undefined;
  }
  start() {
    if (this.battle.status === 'finished') this.reset();
    this.battle.status = 'running';
  }
  pause() {
    if (this.battle.status === 'running') this.battle.status = 'paused';
  }
  setTeam(team: Team, index: number, value: string) {
    const arr = [...(team === 'blue' ? this.blue : this.red)];
    arr[index] = value as HeroType;
    team === 'blue' ? (this.blue = arr) : (this.red = arr);
    this.reset();
  }
  resizeTeam(team: Team, delta: number) {
    const arr = [...(team === 'blue' ? this.blue : this.red)];
    if (delta > 0 && arr.length < 8) arr.push(HERO_TYPES[arr.length % 5]);
    if (delta < 0 && arr.length > 1) arr.pop();
    team === 'blue' ? (this.blue = arr) : (this.red = arr);
    this.clearPositionOverrides();
    this.reset();
  }
  setOrientation(orientation: BattleOrientation) {
    if (this.orientation === orientation) return;
    this.orientation = orientation;
    this.clearPositionOverrides();
    this.reset();
  }
  private clearPositionOverrides() {
    for (const id of Object.keys(this.overrides)) {
      const { position: _position, spawn: _spawn, ...stats } = this.overrides[id];
      this.overrides[id] = stats;
    }
  }
  editStat(h: Hero, key: EditableStat, value: unknown) {
    let n = Number(value);
    if (!Number.isFinite(n)) return;
    const min =
      key === 'attackInterval' || key === 'retargetInterval' ? 50 : key === 'mass' ? 0.1 : 0;
    n = Math.max(min, n);
    if (key === 'retargetThreshold') n = Math.min(5, n);
    if (key === 'hp') n = Math.min(h.maxHp, n);
    if (key === 'maxHp') {
      n = Math.max(1, n);
      h.hp = Math.min(h.hp, n);
    }
    (h[key] as number) = n;
    this.overrides[h.id] = {
      ...(this.overrides[h.id] ?? {}),
      [key]: n,
      ...(key === 'maxHp' ? { hp: h.hp } : {}),
    };
    this.stats = undefined;
  }
  restoreHero(h: Hero) {
    delete this.overrides[h.id];
    this.reset(true);
  }
  run(n: number) {
    this.stats = runBatch(n, this.blue, this.red, this.overrides, this.battleConfig());
    this.labOpen = true;
  }
  downloadStats() {
    if (!this.stats) return;
    const heroTypeUa: Record<HeroType, string> = {
      Guardian: 'Вартовий',
      Brawler: 'Боєць',
      Sniper: 'Снайпер',
      Assassin: 'Асасин',
      Hunter: 'Мисливець',
    };
    const winnerUa = { blue: 'Сині', red: 'Червоні', draw: 'Нічия' } as const;
    const rows: Array<Array<string | number>> = [
      ['ЕКСПЕРИМЕНТ'],
      ['Дата формування', new Date().toLocaleString('uk-UA')],
      ['Кількість боїв', this.stats.runs],
      ['Орієнтація поля', this.orientation === 'portrait' ? 'Вертикальна' : 'Горизонтальна'],
      ['Команда синіх', this.blue.map((type) => heroTypeUa[type]).join(' | ')],
      ['Команда червоних', this.red.map((type) => heroTypeUa[type]).join(' | ')],
      ['Перемоги синіх', this.stats.blueWins],
      ['Перемоги червоних', this.stats.redWins],
      ['Нічиї', this.stats.draws],
      ['Середня тривалість, мс', this.stats.avgDuration.toFixed(1)],
      ['Середнє залишкове HP', this.stats.avgRemainingHp.toFixed(1)],
      [],
      ['РЕЗУЛЬТАТИ БОЇВ'],
      [
        '№ бою',
        'Переможець',
        'Тривалість, мс',
        'Залишкове HP синіх',
        'Залишкове HP червоних',
        'Вижило синіх',
        'Вижило червоних',
      ],
      ...this.stats.battles.map((battle) => [
        battle.run,
        winnerUa[battle.winner],
        battle.duration,
        battle.blueRemainingHp.toFixed(1),
        battle.redRemainingHp.toFixed(1),
        battle.blueSurvivors,
        battle.redSurvivors,
      ]),
      [],
      ['СТАТИСТИКА ЗА ТИПОМ ГЕРОЯ'],
      [
        'Тип героя',
        'Кількість',
        'Середня шкода',
        'Середній час життя, мс',
        'Середня кількість убивств',
        'Середня кількість змін цілі',
      ],
      ...Object.entries(this.stats.byType).map(([type, value]) => [
        heroTypeUa[type as HeroType] ?? type,
        value.count,
        (value.damage / value.count).toFixed(2),
        (value.lifetime / value.count).toFixed(2),
        (value.kills / value.count).toFixed(3),
        (value.switches / value.count).toFixed(3),
      ]),
    ];
    const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `statystyka-boiv-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  targetOf(h: Hero) {
    return this.battle.heroes.find((x) => x.id === h.currentTargetId);
  }
  distanceTo(h: Hero) {
    const target = this.targetOf(h);
    return target ? distance(h, target).toFixed(1) : '—';
  }
  currentSpeedOf(h: Hero) {
    return currentSpeed(h).toFixed(1);
  }
  momentumOf(h: Hero) {
    return momentum(h).toFixed(1);
  }
  tacticInfo(h: Hero) {
    const custom = this.customTactics.find((x) => x.id === h.tactic);
    if (custom) {
      return {
        summary: custom.name,
        target: custom.targetMode,
        movement: `${custom.movementMode}; preferredRange ${custom.preferredRange}; minimumEffectiveRange ${custom.minimumEffectiveRange}`,
        retarget: `${custom.retargetInterval} ms; threshold ${custom.retargetThreshold}`,
      };
    }
    const typeByTactic: Record<string, HeroType> = {
      hold_front: 'Guardian',
      nearest_enemy: 'Brawler',
      high_value_target: 'Sniper',
      weakest_target: 'Assassin',
      highest_threat: 'Hunter',
    };
    return TACTIC_INFO[this.lang][typeByTactic[h.tactic] ?? h.type];
  }
  tacticOptions() {
    return [...BUILTIN_TACTICS, ...this.customTactics];
  }
  targetModes(): TargetMode[] {
    return [
      'frontline',
      'nearest',
      'highest_attack',
      'lowest_hp',
      'lowest_hp_percent',
      'highest_threat',
    ];
  }
  movementModes(): MovementMode[] {
    return ['hold_front', 'direct', 'keep_range'];
  }
  targetModeLabel(mode: TargetMode) {
    return TARGET_MODE_LABELS[this.lang][mode];
  }
  movementModeLabel(mode: MovementMode) {
    return MOVEMENT_MODE_LABELS[this.lang][mode];
  }
  tacticName(tactic: TacticDefinition) {
    return TACTIC_NAMES[this.lang][tactic.id] ?? tactic.name;
  }
  currentTacticName(h: Hero) {
    const tactic = this.tacticOptions().find((option) => option.id === h.tactic);
    return tactic ? this.tacticName(tactic) : h.tactic;
  }
  heroTypeLabel(type: HeroType) {
    return HERO_TYPE_LABELS[this.lang][type];
  }
  statsTypeLabel(type: string) {
    return HERO_TYPE_LABELS[this.lang][type as HeroType] ?? type;
  }
  roleLabel(role: string) {
    return ROLE_LABELS[this.lang][role] ?? role;
  }
  stateLabel(state: string) {
    return STATE_LABELS[this.lang][state] ?? state;
  }
  teamLabel(team: Team) {
    return this.t(team);
  }
  targetReasonLabel(reason: string) {
    if (this.lang === 'en') return reason;
    return reason
      .replace('Nearest enemy', 'Найближчий ворог')
      .replace('Protecting frontline', 'Захист передньої лінії')
      .replace('Highest attack:', 'Найвища атака:')
      .replace('Weakest target:', 'Найслабша ціль:')
      .replace('Highest threat:', 'Найвища загроза:');
  }
  applyTactic(h: Hero, tacticId: string) {
    const tactic = this.tacticOptions().find((x) => x.id === tacticId);
    if (!tactic) return;
    const values: Partial<Hero> = {
      tactic: tactic.id,
      targetMode: tactic.targetMode,
      movementMode: tactic.movementMode,
      preferredRange: tactic.preferredRange,
      minimumEffectiveRange: tactic.minimumEffectiveRange,
      retargetInterval: tactic.retargetInterval,
      retargetThreshold: tactic.retargetThreshold,
    };
    Object.assign(h, values);
    this.overrides[h.id] = { ...(this.overrides[h.id] ?? {}), ...values };
    h.currentTargetId = undefined;
    h.lastRetarget = -h.retargetInterval;
    this.stats = undefined;
  }
  addTactic() {
    const name = this.tacticDraft.name.trim();
    if (!name) {
      this.tacticNotice = this.t('tacticNameRequired');
      this.tacticNoticeError = true;
      return;
    }
    let id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    if (!id) id = `custom_${this.customTactics.length + 1}`;
    if (this.tacticOptions().some((x) => x.id === id)) id += `_${this.customTactics.length + 1}`;
    this.customTactics = [...this.customTactics, { ...this.tacticDraft, id, name }];
    this.tacticDraft = { ...this.tacticDraft, id: '', name: '' };
    this.tacticNotice = this.t('tacticAdded');
    this.tacticNoticeError = false;
  }
  statusText() {
    return this.t(this.battle.status);
  }
  heroLeft(h: Hero) {
    return (h.position.x / this.battle.width) * 100;
  }
  heroTop(h: Hero) {
    return (h.position.y / this.battle.height) * 100;
  }
  attackStyle(a: { from: string; to: string }) {
    const f = this.battle.heroes.find((x) => x.id === a.from),
      t = this.battle.heroes.find((x) => x.id === a.to);
    if (!f || !t) return {};
    const dx = t.position.x - f.position.x,
      dy = t.position.y - f.position.y;
    return {
      left: `${(f.position.x / this.battle.width) * 100}%`,
      top: `${(f.position.y / this.battle.height) * 100}%`,
      width: `${(Math.hypot(dx, dy) / this.battle.width) * 100}%`,
      transform: `rotate(${(Math.atan2(dy, dx) * 180) / Math.PI}deg)`,
    };
  }
  damageStyle(a: { to: string }) {
    const h = this.battle.heroes.find((x) => x.id === a.to);
    return h ? { left: `${this.heroLeft(h)}%`, top: `${this.heroTop(h)}%` } : {};
  }
  entries() {
    return Object.entries(this.stats?.byType ?? {});
  }
}

