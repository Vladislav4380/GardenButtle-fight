// Treasure battle: page glue. Setup steps (treasure, then heroes), input, buttons, the frame loop and the result.
// The shared fighter renderer (combat-mix.js) expects a global canvas context `g` and `baseScale()`.
const g = document.querySelector("#cv").getContext("2d");
function baseScale() {
  return TB.battle.world.scale || 0.08;
}
TB.battle = (() => {
  const STORE = "gardenbattle.treasure",
    canvas = document.querySelector("#cv"),
    arena = document.querySelector("#arena"),
    hint = document.querySelector("#positionHint"),
    mainBtn = document.querySelector("#mainBtn"),
    resultBox = document.querySelector("#battleResult"),
    $ = (s) => document.querySelector(s);
  const V = TB.vegetables;
  function load() {
    const base = { lineup: ["tomato", "pepper", "carrot"], roles: ["attack", "support", "defense"], plan: null };
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "{}");
      const lineup = Array.isArray(saved.lineup) && saved.lineup.length === 3 && saved.lineup.every((id) => V.VEGETABLES[id]) ? saved.lineup : base.lineup;
      return { ...base, ...saved, lineup };
    } catch {
      return base;
    }
  }
  const saved = load();
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify(saved));
    } catch {}
  }
  const world = TB.sim.createWorld(characterProfiles);
  world.hooks = TB.view.hooks(world);
  let phase = "setup",
    selected = null,
    drag = null,
    rate = 1,
    paused = false,
    ready = false,
    enemyPlan = null,
    rematch = false;

  const own = () => world.fighters.filter((f) => f.team === 0).sort((a, b) => a.slot - b.slot);
  const toShare = (team, p) => {
    const l = TB.geometry.toLocal(world, team, p.x, p.y);
    return { u: l.u / TB.geometry.frontLine(world), v: l.v / TB.geometry.breadth(world) };
  };
  const fromShare = (team, s) => TB.geometry.toWorld(world, team, s.u * TB.geometry.frontLine(world), s.v * TB.geometry.breadth(world));
  function capturePlan(team) {
    return { treasure: toShare(team, world.treasures[team]), heroes: world.fighters.filter((f) => f.team === team).map((f) => ({ ...toShare(team, f), character: f.character })) };
  }
  function applyPlan(team, p) {
    const t = fromShare(team, p.treasure);
    TB.setup.placeTreasure(world, team, t.x, t.y);
    world.fighters
      .filter((f) => f.team === team)
      .forEach((f, i) => {
        const h = p.heroes[i];
        if (!h) return;
        if (h.character) f.character = h.character;
        const q = TB.geometry.clampDeploy(world, team, ...Object.values(fromShare(team, h)));
        f.x = q.x;
        f.y = q.y;
        TB.nav.clamp(world, f);
      });
  }

  function resize() {
    const r = arena.getBoundingClientRect(),
      d = Math.min(2, devicePixelRatio || 1);
    canvas.width = r.width * d;
    canvas.height = r.height * d;
    g.setTransform(d, 0, 0, d, 0, 0);
    if (!ready) return;
    const keep = world.treasures[0] ? { mine: capturePlan(0), foe: capturePlan(1) } : null;
    TB.sim.layout(world, r.width, r.height);
    if (keep) {
      applyPlan(0, keep.mine);
      applyPlan(1, keep.foe);
    }
  }
  addEventListener("resize", resize);

  // New setup: the player's saved plan (or defaults) against a new random opponent, or the same one in a rematch.
  function newSetup() {
    for (const f of world.fighters) TB.sim.resetFighter(f);
    world.started = false;
    world.match = TB.match.create();
    world.teamState = [];
    world.shots = [];
    world.shields = [0, 0];
    TB.view.reset();
    own().forEach((f, i) => (f.character = saved.lineup[i]));
    if (rematch && enemyPlan) applyPlan(1, enemyPlan);
    else {
      TB.setup.randomEnemy(world);
      enemyPlan = capturePlan(1);
    }
    rematch = false;
    if (saved.plan) applyPlan(0, saved.plan);
    else {
      const t = TB.setup.defaultTreasure(world, 0);
      TB.setup.placeTreasure(world, 0, t.x, t.y);
      TB.setup.placeByRoles(world, 0, saved.roles);
    }
    for (const f of world.fighters) f.role = TB.setup.startRole(world, f);
    setPhase("setup");
  }
  function setPhase(next) {
    phase = next;
    selected = null;
    drag = null;
    paused = false;
    resultBox.hidden = true;
    renderBars();
    updateHint();
    updateHeader();
  }
  function rememberPlan() {
    for (const f of world.fighters) if (!world.started) f.role = TB.setup.startRole(world, f);
    saved.plan = capturePlan(0);
    saved.roles = own().map((f) => f.role);
    saved.lineup = own().map((f) => f.character);
    save();
  }

  // ---- Bottom bar: setup steps or energy, three hero cards ----
  function renderBars() {
    const steps = $("#stepBar"),
      energy = $("#energyBox");
    const setup = phase === "setup";
    steps.style.display = setup ? "" : "none";
    energy.style.display = setup ? "none" : "";
    if (setup) {
      steps.innerHTML = `<span class="step">Расстановка</span><span class="rule">В защите до двух</span>`;
    }
    mainBtn.textContent = phase === "setup" ? "Начать бой" : phase === "battle" ? (paused ? "Продолжить" : "Пауза") : "Новый бой";
    mainBtn.classList.toggle("active", phase === "battle" && !paused);
    const bar = $(".skills");
    bar.style.gridTemplateColumns = "repeat(3,1fr)";
    bar.innerHTML = own()
      .map((f) => {
        const v = V.VEGETABLES[f.character],
          role = f.role || "support",
          battle = phase === "battle" || phase === "over",
          sub = battle ? v.skill.name : `${V.ROLE_ICONS[role]} ${V.ROLE_NAMES[role]} · ${v.roles[role].short}`;
        return `<button class="skill skill-${f.character} role-${role}${battle && f.hp <= 0 ? " dead" : ""}" data-slot="${f.slot}" ${battle && f.hp <= 0 ? "disabled" : ""}><span class="cost">${battle ? v.skill.cost : "↻"}</span><img src="/assets/characters/${f.character}/sprites/front/idle.png" alt=""><strong>${v.name}<em>${sub}</em></strong></button>`;
      })
      .join("");
    bar.querySelectorAll(".skill").forEach((b) => (b.onclick = () => cardTap(+b.dataset.slot)));
    sync();
  }
  // Before the battle a card tap swaps that hero's vegetable; in battle skills fire by themselves.
  function cardTap(slot) {
    if (phase !== "setup") return;
    const f = own()[slot],
      ids = V.IDS;
    f.character = ids[(ids.indexOf(f.character) + 1) % ids.length];
    TB.sim.resetFighter(f);
    f.role = TB.setup.startRole(world, f);
    selected = f;
    rememberPlan();
    renderBars();
    updateHint();
  }
  function sync() {
    const health = (team) => world.fighters.filter((f) => f.team === team).reduce((s, f) => s + Math.max(0, f.hp) / f.max, 0) / 3;
    $("#redHp").style.width = 100 * health(0) + "%";
    $("#blueHp").style.width = 100 * health(1) + "%";
    const e = Math.floor(world.energy[0]);
    $("#energyText").textContent = e + "/10";
    $("#cells").innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="cell ${i < e ? "on" : ""}"></i>`).join("");
    if (phase === "battle")
      document.querySelectorAll(".skill").forEach((b) => {
        const f = own()[+b.dataset.slot];
        b.classList.toggle("ready", f.hp > 0 && world.energy[0] >= V.VEGETABLES[f.character].skill.cost);
        b.classList.toggle("dead", f.hp <= 0);
      });
  }
  function updateHeader() {
    const names = document.querySelectorAll(".hero .name"),
      portraits = document.querySelectorAll(".hero .portrait img");
    if (names[0]) names[0].textContent = "Ваш отряд";
    if (names[1]) names[1].textContent = "Соперник";
    const lead = (team) => world.fighters.find((f) => f.team === team && f.slot === 0);
    if (portraits[0] && lead(0)) portraits[0].src = `/assets/characters/${lead(0).character}/sprites/front/idle.png`;
    if (portraits[1] && lead(1)) portraits[1].src = `/assets/characters/${lead(1).character}/sprites/front/idle.png`;
    const t = Math.floor(world.match.time || 0);
    $("#timer").textContent = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }
  function updateHint(extra) {
    hint.hidden = phase === "battle" || phase === "over";
    if (hint.hidden) return;
    hint.classList.toggle("warn", !!extra);
    const f = drag?.f || selected;
    if (extra) hint.innerHTML = `<b>${extra}</b>`;
    else if (f) hint.innerHTML = `<b>${V.VEGETABLES[f.character].name} · ${V.ROLE_ICONS[f.role]} ${V.ROLE_NAMES[f.role]}</b> — ${V.VEGETABLES[f.character].roles[f.role].text}.`;
    else if (drag?.treasure)
      hint.innerHTML = "<b>Сундук.</b> Круг вокруг — зона захвата: враг, простоявший в нём 3 с, забирает сундук. Пока захватчика бьют, захват идёт медленно. Зона защиты едет вместе с сундуком.";
    else
      hint.innerHTML =
        "<b>Перетащите сундук и героев.</b> Место задаёт роль: 🛡 у сундука — защита, ✚ в середине — поддержка, ⚔ впереди — нападение. В защите не больше двух.";
  }

  // ---- Buttons ----
  mainBtn.onclick = () => {
    if (phase === "setup") {
      if (TB.setup.tooManyDefenders(world, 0)) return updateHint("В защите больше двух героев: переставьте одного.");
      rememberPlan();
      TB.sim.start(world);
      TB.view.reset();
      setPhase("battle");
      return;
    }
    if (phase === "battle") {
      paused = !paused;
      renderBars();
      return;
    }
    if (phase === "over") newSetup();
  };
  $("#restartBtn").onclick = () => {
    rematch = phase !== "setup";
    newSetup();
  };
  $("#speedBtn").onclick = () => {
    rate = rate === 1 ? 2 : 1;
    $("#speedBtn").textContent = `×${rate} ▶`;
  };

  // ---- Result ----
  function showResult() {
    const r = world.match.result,
      outcome = r.winner === 0 ? "win" : r.winner === 1 ? "loss" : "draw";
    resultBox.dataset.outcome = outcome;
    $("#battleResultText").textContent = outcome === "win" ? "Вы победили" : outcome === "loss" ? "Вы проиграли" : "Ничья";
    $("#battleResultDetail").textContent = TB.match.describe(r, Object.fromEntries(V.IDS.map((id) => [id, V.VEGETABLES[id].name]))) + ` · ${Math.round(world.match.time)} с`;
    let box = resultBox.querySelector(".battle-summary");
    if (!box) {
      box = document.createElement("div");
      box.className = "battle-summary";
      resultBox.querySelector("small").before(box);
      const again = document.createElement("button");
      again.className = "battle-rematch";
      again.textContent = "Реванш";
      again.onclick = () => {
        rematch = true;
        newSetup();
      };
      resultBox.querySelector("small").before(again);
    }
    box.innerHTML = own()
      .map((f) => `<span>${V.VEGETABLES[f.character].name} (${V.ROLE_NAMES[f.role].toLowerCase()}): нанёс ${f.dealt}, получил ${f.taken}${f.hp > 0 ? "" : ", погиб"}</span>`)
      .join("");
    resultBox.hidden = false;
    renderBars();
  }

  // ---- Input ----
  function positionAt(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * world.W) / r.width, y: ((e.clientY - r.top) * world.H) / r.height };
  }
  function heroAt(p) {
    const h = world.scale * 1100;
    return own()
      .filter((f) => Math.abs(p.x - f.x) < Math.max(24, h * 0.42) && p.y >= f.y - h - 8 && p.y <= f.y + 15)
      .sort((a, b) => Math.hypot(p.x - a.x, p.y - (a.y - h * 0.5)) - Math.hypot(p.x - b.x, p.y - (b.y - h * 0.5)))[0];
  }
  // A hero may not stand on another hero.
  function free(f, x, y) {
    return own().every((q) => q === f || Math.hypot(q.x - x, q.y - y) >= TB.nav.radius(world, q) + TB.nav.radius(world, f));
  }
  function moveHero(f, x, y) {
    const p = TB.geometry.clampDeploy(world, 0, x, y),
      probe = { ...f, x: p.x, y: p.y };
    TB.nav.clamp(world, probe);
    f.x = probe.x;
    f.y = probe.y;
    f.role = TB.setup.startRole(world, f);
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (!ready || phase !== "setup") return;
    e.preventDefault();
    const p = positionAt(e),
      hit = heroAt(p),
      t = world.treasures[0],
      d = Math.hypot(p.x - t.x, p.y - t.y);
    // The chest itself, or its capture circle when no hero is selected, drags the treasure; heroes keep their spots
    // and their roles follow the zones.
    if (!hit && (d <= 1.2 * world.B || (!selected && d <= TB.geometry.captureRadius(world)))) {
      selected = null;
      drag = { treasure: true, ox: p.x - t.x, oy: p.y - t.y };
      canvas.setPointerCapture(e.pointerId);
      updateHint();
      return;
    }
    if (hit) {
      selected = hit;
      drag = { f: hit, ox: p.x - hit.x, oy: p.y - hit.y, from: { x: hit.x, y: hit.y } };
      canvas.setPointerCapture(e.pointerId);
    } else if (selected) {
      const from = { x: selected.x, y: selected.y };
      moveHero(selected, p.x, p.y);
      if (!TB.setup.allowed(world, selected, selected.x, selected.y) || !free(selected, selected.x, selected.y)) {
        Object.assign(selected, from);
        selected.role = TB.setup.startRole(world, selected);
        updateHint(!free(selected, p.x, p.y) ? "Здесь уже стоит герой." : "В защите уже двое.");
        return;
      }
      rememberPlan();
      selected = null;
    }
    updateHint();
    renderBars();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    e.preventDefault();
    const p = positionAt(e);
    if (drag.treasure) {
      TB.setup.placeTreasure(world, 0, p.x - drag.ox, p.y - drag.oy);
      for (const f of own()) f.role = TB.setup.startRole(world, f);
      updateHint(TB.setup.tooManyDefenders(world, 0) ? "В защите оказалось трое: переставьте одного героя." : null);
      return;
    }
    moveHero(drag.f, p.x - drag.ox, p.y - drag.oy);
    const ok = TB.setup.allowed(world, drag.f, drag.f.x, drag.f.y);
    updateHint(ok ? null : "В защите уже двое : здесь поставить нельзя.");
  });
  function endDrag() {
    if (!drag) return;
    if (drag.treasure) rememberPlan();
    if (drag.f) {
      const f = drag.f;
      if (!TB.setup.allowed(world, f, f.x, f.y) || !free(f, f.x, f.y)) {
        Object.assign(f, drag.from);
        f.role = TB.setup.startRole(world, f);
      }
      rememberPlan();
    }
    drag = null;
    updateHint();
    renderBars();
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  // ---- Loop ----
  let last = performance.now(),
    acc = 0;
  const STEP = 1 / 60;
  function frame(n) {
    const dt = Math.min(0.05, (n - last) / 1000);
    last = n;
    if (phase === "battle" && !paused) {
      acc += dt * rate;
      while (acc >= STEP && !world.match.over) {
        TB.sim.step(world, STEP);
        acc -= STEP;
      }
      if (world.match.over) {
        acc = 0;
        phase = "over";
        renderBars();
      }
      sync();
      updateHeader();
    }
    if (!paused) TB.view.advance(dt * rate);
    // The result appears once death effects have played out.
    if (phase === "over" && resultBox.hidden && !TB.view.effectsRunning()) showResult();
    const active = drag?.treasure ? "defense" : drag?.f ? drag.f.role : selected ? selected.role : null;
    TB.view.render(world, { phase, selected: drag?.f || selected, activeRole: phase === "setup" ? active : null, dragged: drag?.f || null });
    requestAnimationFrame(frame);
  }
  mixedReady.then(() => {
    TB.sim.makeFighters(world, [saved.lineup, ["tomato", "pepper", "carrot"]]);
    ready = true;
    resize();
    newSetup();
    requestAnimationFrame(frame);
  });
  return { world, state: () => ({ phase, paused, rate }) };
})();
