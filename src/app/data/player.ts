// The player as the app's own screens see him: the profile chosen on the first entry (kept in this browser), and
// a summary of the garden and of both glories read from the scenes' saves. No server yet.

export interface Keeper {
  code: string;
  name: string;
  short: string;
  text: string;
  image: string;
  preview: string;
  background: string;
}

// The keepers to choose from on the first entry (pictures and words from the first version of the game). The
// look only: it gives nothing in battle.
export const KEEPERS: Keeper[] = [
  {
    code: 'young_gardener',
    name: 'Молодой садовник',
    short: 'Любит выращивать новые культуры.',
    text: 'Энтузиаст своего дела, который верит, что любое семечко может стать легендой.',
    image: 'assets/ui/avatars/young-gardener.webp',
    preview: 'assets/ui/avatars/young-gardener-preview.webp',
    background: 'assets/ui/avatars/bg-garden.webp',
  },
  {
    code: 'forest_druid',
    name: 'Лесной друид',
    short: 'Хранитель природы и урожая.',
    text: 'Мудрый дух леса, который чувствует силу земли, листьев и древних корней.',
    image: 'assets/ui/avatars/forest-druid.webp',
    preview: 'assets/ui/avatars/forest-druid-preview.webp',
    background: 'assets/ui/avatars/bg-forest.webp',
  },
  {
    code: 'harvest_guardian',
    name: 'Хранитель урожая',
    short: 'Защищает огород от вредителей.',
    text: 'Суровый защитник грядок. Никто не пройдёт к урожаю без его разрешения.',
    image: 'assets/ui/avatars/harvest-guardian.webp',
    preview: 'assets/ui/avatars/harvest-guardian-preview.webp',
    background: 'assets/ui/avatars/bg-arena.webp',
  },
  {
    code: 'season_traveler',
    name: 'Следопыт сезонов',
    short: 'Собирает редкие культуры со всего мира.',
    text: 'Исследователь дальних земель, который ищет необычные семена и забытые садовые тайны.',
    image: 'assets/ui/avatars/season-traveler.webp',
    preview: 'assets/ui/avatars/season-traveler-preview.webp',
    background: 'assets/ui/avatars/bg-mountains.webp',
  },
];

export interface Profile {
  keeper: string;
  name: string;
  since: number;
}

const PROFILE_KEY = 'player-v1';
const GARDEN_KEY = 'garden-test-v13'; // the garden scene's save (src/scenes/garden/garden.js, SAVE_KEY)

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

export const loadProfile = (): Profile | null => read<Profile>(PROFILE_KEY);
export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {}
}
export const keeperOf = (p: Profile | null): Keeper => KEEPERS.find((k) => k.code === p?.keeper) || KEEPERS[0];

// The name Telegram knows the player by, if the app was opened there.
export function telegramName(): string {
  return (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.first_name || '';
}

// Titles of both glories, the same as in the scenes (garden.js G_TITLES, tft-battle.js B_TITLES).
const G_TITLES: [number, string][] = [
  [0, 'Росток'],
  [800, 'Грядочник'],
  [2000, 'Огородник'],
  [3500, 'Садовод'],
  [5000, 'Агроном'],
  [6500, 'Мастер урожая'],
];
const B_TITLES: [number, string][] = [
  [0, 'Новобранец'],
  [300, 'Боец'],
  [1500, 'Ветеран'],
  [5000, 'Полководец'],
];
const titleOf = (list: [number, string][], n: number) => list.filter(([at]) => n >= at).pop()![1];
export const battleTitle = (n: number) => titleOf(B_TITLES, n);
export const gardenTitle = (n: number) => titleOf(G_TITLES, n);

// The season of the glory tables: 4 weeks, counted from a fixed day (the same for everyone). The days left of it.
export function seasonDaysLeft(): number {
  const day = Math.floor(Date.now() / 86400000);
  return 28 - (day % 28);
}
const nextOf = (list: [number, string][], n: number) => list.find(([at]) => at > n);

// Grow times in minutes, as in garden.js CROPS (only what the summary needs).
const GROW: Record<string, number> = {
  tomato: 15, carrot: 20, potato: 30, peach: 45, onion: 60, corn: 90,
  pepper: 30, beet: 20, zucchini: 45, walnut: 90, eggplant: 60, cucumber: 20, cabbage: 45,
  grape: 60, pineapple: 90, banana: 60, cherry: 30, parsley: 15, dill: 15,
};

export interface Glory {
  points: number;
  // the next title's threshold (the last one's when at the top)
  nextAt: number;
  title: string;
  next: string | null;
  toNext: number;
}
export interface Summary {
  hasGarden: boolean;
  gold: number;
  army: number;
  ripe: number;
  growing: number;
  dry: number;
  pests: number;
  orders: number;
  ordersReady: number;
  nextRipeMin: number | null;
  // Each sown bed: its crop and minutes left (0: ripe); the barn by crop.
  beds: { crop: string; leftMin: number }[];
  barn: Record<string, number>;
  orderGold: number[];
  garden: Glory;
  battle: Glory;
}

const glory = (list: [number, string][], n: number): Glory => {
  const nx = nextOf(list, n);
  return { points: Math.floor(n), title: titleOf(list, n), next: nx ? nx[1] : null, nextAt: nx ? nx[0] : list[list.length - 1][0], toNext: nx ? Math.ceil(nx[0] - n) : 0 };
};

// What the main screen shows, from the garden's save (it may not exist yet: a new player before the garden).
export function summary(): Summary {
  const g: any = read(GARDEN_KEY);
  const battlePoints = +(localStorage.getItem('glory-battle') || 0);
  if (!g) {
    // A new player's barracks is empty: the first fighters come from the first harvest.
    const barn = {};
    return { hasGarden: false, gold: 3000, army: 0, ripe: 0, growing: 0, dry: 0, pests: 0, orders: 0, ordersReady: 0, nextRipeMin: null, beds: [], barn, orderGold: [], garden: glory(G_TITLES, 0), battle: glory(B_TITLES, battlePoints) };
  }
  // The garden's clock runs on while it is closed: its time now.
  const now = (g.time || 0) + Math.max(0, Date.now() - (g.real || Date.now())) * (g.speed || 1);
  const beds = (g.objects || []).filter((o: any) => o.kind === 'bed' && o.crop);
  const left = (b: any) => (b.quick ? 75000 : (GROW[b.crop] || 30) * 60000) - (now - b.at);
  const growingBeds = beds.filter((b: any) => left(b) > 0);
  const barn: Record<string, number> = g.barn || {};
  const canDo = (o: any) => Object.entries(o.items || {}).every(([id, n]) => (barn[id] || 0) >= (n as number));
  return {
    hasGarden: true,
    gold: g.gold || 0,
    army: Object.values(barn).reduce((a, b) => a + b, 0),
    ripe: beds.length - growingBeds.length,
    growing: growingBeds.length,
    dry: growingBeds.filter((b: any) => !b.wet).length,
    pests: (g.pests || []).length,
    orders: (g.orders || []).filter((o: any) => !o.done).length,
    ordersReady: (g.orders || []).filter((o: any) => !o.done && canDo(o)).length,
    nextRipeMin: growingBeds.length ? Math.ceil(Math.min(...growingBeds.map(left)) / 60000) : null,
    beds: beds.map((b: any) => ({ crop: b.crop, leftMin: Math.max(0, Math.ceil(left(b) / 60000)) })),
    barn,
    orderGold: (g.orders || []).filter((o: any) => !o.done).map((o: any) => o.gold),
    garden: glory(G_TITLES, g.glory?.total || 0),
    battle: glory(B_TITLES, battlePoints),
  };
}
