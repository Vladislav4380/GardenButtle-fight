// Treasure battle: what each vegetable is and how it carries out each of the three roles.
// One contract per vegetable: stats, one skill, movement traits and, for every role, a short description and the
// named behaviours the generic role engine runs (treasure-roles.js). A new vegetable either reuses behaviours or
// supplies its own `plan(ctx)` for a role, without copying the battle engine.
var TB = globalThis.TB || (globalThis.TB = {});
TB.vegetables = (() => {
  const ROLE_NAMES = { defense: "Защита", support: "Поддержка", attack: "Нападение" },
    ROLE_ICONS = { defense: "🛡", support: "✚", attack: "⚔" };
  const VEGETABLES = {
    tomato: {
      name: "Помидор",
      kind: "Тяжёлый боец",
      // Same numbers as the main battle.
      stats: { max: 900, power: 28, defense: 10, attackInterval: 1.15, moveSpeed: 38, mass: 3, attackRange: 100, preferredRange: 80, minimumRange: 30 },
      skill: { id: "shield", name: "Щит отряда", cost: 4 },
      traits: {
        // Detours only around allies; enemies in the way are shot and pushed with its mass.
        pathing: "push",
        // How far beyond the defence zone it follows an intruder, in B.
        leash: 2.5,
        // Share of speed an enemy loses while this vegetable holds it in body contact.
        grip: 0.85,
      },
      roles: {
        defense: { short: "перекрывает подход", text: "встаёт на пути к сокровищу, держит и выталкивает врага, далеко не гонится", respond: "block", idle: "guard" },
        attack: { short: "пробивает путь", text: "упорно идёт к сокровищу соперника, бьёт тех, кто перекрыл путь, и продавливает их массой", advance: "push" },
        support: { short: "прикрывает наступление", text: "при угрозе встаёт между врагом и сокровищем, без угрозы идёт за наступающим", respond: "block", idle: "escort" },
      },
    },
    carrot: {
      name: "Морковь",
      kind: "Мобильный боец",
      stats: { max: 600, power: 39, defense: 6, attackInterval: 0.75, moveSpeed: 78, mass: 1.2, attackRange: 27, preferredRange: 0, minimumRange: 0 },
      skill: { id: "dash", name: "Рывок", cost: 3 },
      traits: { pathing: "weave", leash: 4, grip: 0.55 },
      roles: {
        defense: { short: "перехватывает прорыв", text: "перехватывает прорвавшихся и обходящих, после угрозы возвращается к сокровищу", respond: "intercept", idle: "guard" },
        attack: { short: "ищет проход", text: "ищет свободный проход к сокровищу, обходит занятые места, не обязана бить самого толстого", advance: "weave" },
        support: { short: "помогает перехвату", text: "при угрозе быстро помогает перехватить, без угрозы прорывается или помогает наступающим", respond: "intercept", idle: "breakthrough" },
      },
    },
    pepper: {
      name: "Перец",
      kind: "Дальнобойный",
      stats: { max: 430, power: 30, defense: 6, attackInterval: 0.95, moveSpeed: 55, mass: 1.7, attackRange: 125, preferredRange: 100, minimumRange: 35 },
      skill: { id: "fireball", name: "Огненный шар", cost: 4 },
      traits: { pathing: "steer", leash: 0.5, grip: 0.3 },
      roles: {
        defense: { short: "обстреливает подход", text: "стреляет по приближающимся, держит позицию у сокровища и не отступает от него", respond: "cover", idle: "guard" },
        attack: { short: "расчищает путь", text: "идёт к сокровищу с остановками для стрельбы, расчищает путь издалека и идёт дальше", advance: "shootAndGo" },
        support: { short: "прикрывает огнём", text: "при угрозе прикрывает оборону огнём, без угрозы поддерживает наступающего", respond: "cover", idle: "fireSupport" },
      },
    },
  };
  const IDS = Object.keys(VEGETABLES);
  const roleText = (id, role) => `${VEGETABLES[id].name} · ${ROLE_NAMES[role]} — ${VEGETABLES[id].roles[role].text}`;
  return { VEGETABLES, IDS, ROLE_NAMES, ROLE_ICONS, roleText };
})();
