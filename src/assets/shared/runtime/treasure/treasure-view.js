// Treasure battle: drawing. Uses the shared fighter renderer (combat-mix.js) and the canvas context `g`.
var TB = globalThis.TB || (globalThis.TB = {});
TB.view = (() => {
  const ROLE_COLORS = { defense: "#48aaff", support: "#5fd068", attack: "#ff6a4a" },
    TEAM_RING = ["#ffd65a", "#c58bff"];
  let fx = { sparks: [], floaters: [], blasts: [], deaths: [] };
  const zoneCache = new WeakMap();

  function reset() {
    fx = { sparks: [], floaters: [], blasts: [], deaths: [] };
  }
  function glow(x, y, r, col, a) {
    const q = g.createRadialGradient(x, y, 0, x, y, r);
    q.addColorStop(0, col.replace("A", a));
    q.addColorStop(1, col.replace("A", "0"));
    g.fillStyle = q;
    g.beginPath();
    g.arc(x, y, r, 0, 7);
    g.fill();
  }
  function burst(x, y, col = "rgba(255,122,26,A)") {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * 7,
        v = 35 + Math.random() * 150;
      fx.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.25 + Math.random() * 0.35, max: 0.6, col });
    }
  }
  function floater(x, y, text, color, size = 18, t = 0.8) {
    fx.floaters.push({ x, y, text, color, size, t });
  }
  // Simulation hooks: the battle reports events, the view turns them into effects.
  function hooks(w) {
    return {
      socket: (f) => mixedSocket(f),
      onHit(f, d) {
        burst(f.x, f.y - w.scale * 550);
        floater(f.x + (Math.random() - 0.5) * 28, f.y - w.scale * 1050 - Math.random() * 14, "-" + d, f.team ? "#ffe36b" : "#ff472c");
      },
      onDeath: (f) => beginDeath(w, f),
      onSkill(f, skill) {
        floater(f.x, f.y - w.scale * 1150 - 22, skill.name, f.team ? "#ffb4a3" : "#bfe6ff", 15, 1.2);
        fx.blasts.push({ x: f.x, y: f.y - w.scale * 500, r: 0, max: 26 * w.unit, t: 0.3, life: 0.3, col: f.team ? "rgba(255,90,60,A)" : "rgba(90,180,255,A)" });
        if (skill.id === "shield") for (const q of w.fighters) if (q.team === f.team && q.hp > 0) burst(q.x, q.y - 45, "rgba(255,214,90,A)");
      },
      onBurst: burst,
      onDust(f) {
        fx.sparks.push({ x: f.x + (Math.random() - 0.5) * 10, y: f.y - 4, vx: -f.vx * 0.15, vy: -20, t: 0.35, max: 0.35, col: "rgba(214,160,90,A)" });
      },
      onImpact(s) {
        if (s.kind === "tomato") burst(s.x, s.y, "rgba(225,28,18,A)");
        if (s.big) {
          fx.blasts.push({ x: s.x, y: s.y, r: 0, max: 90 * w.unit, t: 0.5, life: 0.5, col: "rgba(255,120,30,A)" });
          for (let i = 0; i < 3; i++) burst(s.x, s.y);
        }
      },
    };
  }
  // Death uses particles only, as in the main battle.
  function beginDeath(w, f) {
    const kind = Math.random() < 0.5 ? "smoke" : "sparks",
      profile = characterProfiles[f.character],
      z = (w.scale * 1100 * (profile.scale || 1)) / profile.visualHeight,
      h = profile.visualHeight * z,
      e = { kind, x: f.x, y: f.y, z, h, image: mixedPose(f), flip: mixedFlip(f), profile, age: 0, duration: 1.3, parts: [] };
    for (let i = 0; i < 55; i++) {
      const a = Math.random() * Math.PI * 2,
        v = h * (0.4 + Math.random() * 1.6);
      e.parts.push({
        x: f.x + (Math.random() - 0.5) * h * 0.55,
        y: f.y - h * (0.08 + Math.random() * 0.85),
        vx: kind === "smoke" ? (Math.random() - 0.5) * h * 0.4 : Math.cos(a) * v,
        vy: kind === "smoke" ? -h * (0.3 + Math.random() * 0.7) : Math.sin(a) * v - h * 0.4,
        size: h * (kind === "smoke" ? 0.025 + Math.random() * 0.055 : 0.012 + Math.random() * 0.02),
        tint: i % 3,
      });
    }
    fx.deaths.push(e);
  }
  const effectsRunning = () => fx.deaths.length > 0;
  function advance(dt) {
    for (const e of fx.deaths) {
      e.age += dt;
      for (const p of e.parts) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.exp(-1.6 * dt);
        p.vy += (e.kind === "smoke" ? -e.h * 0.3 : e.h * 1.7) * dt;
      }
    }
    fx.deaths = fx.deaths.filter((e) => e.age < e.duration);
    for (const p of fx.sparks) {
      p.t -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-4 * dt);
      p.vy *= Math.exp(-4 * dt);
    }
    fx.sparks = fx.sparks.filter((p) => p.t > 0);
    for (const b of fx.blasts) {
      b.t -= dt;
      b.r = b.max * (1 - Math.max(0, b.t) / b.life);
    }
    fx.blasts = fx.blasts.filter((b) => b.t > 0);
    for (const p of fx.floaters) {
      p.t -= dt;
      p.y -= 35 * dt;
    }
    fx.floaters = fx.floaters.filter((p) => p.t > 0);
  }

  // Deploy zones are painted once per treasure position into an offscreen layer per role.
  function zoneLayers(w, z) {
    let c = zoneCache.get(z);
    if (c && c.W === w.W && c.H === w.H) return c;
    c = { W: w.W, H: w.H };
    for (const role of TB.geometry.ROLE_IDS) {
      const layer = document.createElement("canvas");
      layer.width = Math.ceil(w.W);
      layer.height = Math.ceil(w.H);
      const q = layer.getContext("2d"),
        a = TB.geometry.toWorld(w, z.team, 0, 0),
        b = TB.geometry.toWorld(w, z.team, z.frontLine, z.breadth),
        band = TB.geometry.toWorld(w, z.team, z.attackFrom, 0);
      q.fillStyle = ROLE_COLORS[role];
      q.save();
      q.beginPath();
      q.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      q.clip();
      const disc = () => {
        q.beginPath();
        q.arc(z.treasure.x, z.treasure.y, z.defenseRadius, 0, 7);
      };
      // The front band is the part of the deploy area beyond attackFrom.
      const bandRect = () => {
        q.beginPath();
        if (w.orient === "landscape") q.rect(Math.min(band.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - band.x), Math.abs(b.y - a.y));
        else q.rect(Math.min(a.x, b.x), Math.min(band.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - band.y));
      };
      if (role === "defense") {
        disc();
        q.fill();
      } else {
        if (role === "attack") bandRect();
        else {
          q.beginPath();
          q.rect(0, 0, w.W, w.H);
        }
        q.fill();
        if (role === "support") {
          q.globalCompositeOperation = "destination-out";
          bandRect();
          q.fill();
        }
        q.globalCompositeOperation = "destination-out";
        disc();
        q.fill();
      }
      q.restore();
      c[role] = layer;
    }
    zoneCache.set(z, c);
    return c;
  }
  const ROLE_LABEL = (role) => TB.vegetables.ROLE_ICONS[role] + " " + TB.vegetables.ROLE_NAMES[role].toUpperCase();
  // Zones the dragged hero's body touches: its own zone, plus the neighbour when it stands on a border.
  function touchedZones(w, f) {
    const z = w.zones[f.team],
      r = TB.nav.radius(w, f),
      set = new Set([TB.geometry.roleAt(w, z, f.x, f.y)]);
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6,
        x = f.x + Math.cos(a) * r,
        y = f.y + Math.sin(a) * r;
      if (TB.geometry.inDeploy(w, f.team, x, y)) set.add(TB.geometry.roleAt(w, z, x, y));
    }
    return [...set];
  }
  function drawZones(w, team, roles, active) {
    const layers = zoneLayers(w, w.zones[team]);
    g.save();
    for (const role of roles) {
      g.globalAlpha = role === active ? 0.5 : 0.3;
      g.drawImage(layers[role], 0, 0, w.W, w.H);
    }
    g.restore();
  }
  function drawZoneLabels(w, team, roles, active) {
    const z = w.zones[team];
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const role of roles) {
      let p = z.inner[role];
      // The defence label sits above the chest, not on it.
      if (role === "defense") p = { x: z.treasure.x, y: z.treasure.y - Math.min(z.defenseRadius * 0.72, w.B * 2.6) };
      const on = role === active;
      g.font = `${on ? 1000 : 800} ${on ? 13 : 11}px system-ui`;
      g.lineWidth = 3;
      g.strokeStyle = "#000b";
      g.fillStyle = on ? "#fff" : "#ffffffcc";
      g.strokeText(ROLE_LABEL(role), p.x, p.y);
      g.fillText(ROLE_LABEL(role), p.x, p.y);
    }
    g.restore();
  }
  // Chest drawn in code (no new image files); the capture zone is a ring around it.
  function drawTreasure(w, team, danger) {
    const t = w.treasures[team],
      R = TB.geometry.captureRadius(w),
      s = w.B * 0.62,
      pulse = danger ? 0.5 + 0.5 * Math.sin(performance.now() / 110) : 0;
    g.save();
    g.fillStyle = team ? "#a35bff1c" : "#ffd65a1c";
    g.beginPath();
    g.arc(t.x, t.y, R, 0, 7);
    g.fill();
    g.setLineDash([10, 6]);
    g.lineWidth = 2.5 + pulse * 2;
    g.strokeStyle = danger ? `rgba(255,80,50,${0.6 + pulse * 0.4})` : TEAM_RING[team];
    g.stroke();
    g.setLineDash([]);
    // Capture bar: an arc in the attacker's colour filling over the hold time; grey while a defender contests it.
    const m = w.match,
      k = m && m.progress ? m.progress[team] / TB.match.CAPTURE_TIME : 0;
    if (k > 0.005) {
      g.lineWidth = 7;
      g.lineCap = "round";
      g.strokeStyle = "#0008";
      g.beginPath();
      g.arc(t.x, t.y, R, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = 5;
      g.strokeStyle = m.contested?.[team] ? "#c8c8c8" : TEAM_RING[1 - team];
      g.beginPath();
      g.arc(t.x, t.y, R, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
      g.stroke();
      g.lineCap = "butt";
      // Label above the ring: seconds held of the hold time; "под ударом" while the intruder is attacked (slow).
      const label = `Захват ${m.progress[team].toFixed(1)} / ${TB.match.CAPTURE_TIME} с` + (m.contested?.[team] ? " · под ударом" : "");
      g.font = `800 ${Math.round(Math.max(11, w.B * 0.32))}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "bottom";
      g.lineWidth = 3;
      g.strokeStyle = "#000b";
      g.fillStyle = m.contested?.[team] ? "#dcdcdc" : TEAM_RING[1 - team];
      const ly = Math.max(t.y - R - 6, (w.headroom || 0) + 16);
      g.strokeText(label, t.x, ly);
      g.fillText(label, t.x, ly);
    }
    // Shadow, box, lid, bands and a team-coloured gem.
    g.fillStyle = "#0006";
    g.beginPath();
    g.ellipse(t.x, t.y + s * 0.15, s * 1.25, s * 0.38, 0, 0, 7);
    g.fill();
    const x = t.x - s,
      y = t.y - s * 1.15,
      wid = s * 2,
      hgt = s * 1.2;
    let q = g.createLinearGradient(0, y, 0, y + hgt);
    q.addColorStop(0, "#9a5a26");
    q.addColorStop(1, "#5a3114");
    g.fillStyle = q;
    g.fillRect(x, y, wid, hgt);
    g.fillStyle = "#b36a2c";
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(t.x, y - s * 0.9, x + wid, y);
    g.closePath();
    g.fill();
    g.fillStyle = "#f2c544";
    g.fillRect(x - 1, y - 1, wid + 2, s * 0.16);
    g.fillRect(x + wid * 0.18, y - s * 0.5, s * 0.16, hgt + s * 0.5);
    g.fillRect(x + wid * 0.82 - s * 0.16, y - s * 0.5, s * 0.16, hgt + s * 0.5);
    g.fillStyle = team ? "#c58bff" : "#4fb4ff";
    g.beginPath();
    g.arc(t.x, y + hgt * 0.35, s * 0.2, 0, 7);
    g.fill();
    g.strokeStyle = "#2a1505";
    g.lineWidth = 1.2;
    g.strokeRect(x, y, wid, hgt);
    g.restore();
  }
  function drawRoleBadge(w, f, small) {
    const r = small ? 7 : 9,
      x = f.x,
      y = f.y + r + 3;
    g.save();
    g.globalAlpha = small ? 0.8 : 1;
    g.fillStyle = "#081008e0";
    g.strokeStyle = ROLE_COLORS[f.role || "support"];
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, r, 0, 7);
    g.fill();
    g.stroke();
    g.fillStyle = "#fff";
    g.font = `${small ? 9 : 11}px system-ui`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(TB.vegetables.ROLE_ICONS[f.role || "support"], x, y + 0.5);
    g.restore();
  }
  function drawSelection(w, f) {
    g.save();
    g.strokeStyle = "#ffe167";
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(f.x, f.y + 3, w.scale * 350, w.scale * 95, 0, 0, 7);
    g.stroke();
    g.restore();
  }
  function drawTomatoShot(s) {
    const r = 6;
    g.save();
    g.translate(s.x, s.y);
    g.rotate(s.spin);
    const q = g.createRadialGradient(-r * 0.35, -r * 0.35, 1, 0, 0, r);
    q.addColorStop(0, "#ff7a5c");
    q.addColorStop(0.55, "#e3241a");
    q.addColorStop(1, "#9c1109");
    g.fillStyle = q;
    g.beginPath();
    g.ellipse(0, 0, r, r * 0.88, 0, 0, 7);
    g.fill();
    g.fillStyle = "#3f8a22";
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5,
        l = i % 2 ? r * 0.18 : r * 0.62;
      g.lineTo(Math.cos(a) * l, -r * 0.55 + Math.sin(a) * l * 0.5);
    }
    g.closePath();
    g.fill();
    g.restore();
  }
  function drawDeaths() {
    for (const e of fx.deaths) {
      const fade = Math.max(0, 1 - e.age / e.duration);
      if (e.image && e.age < 0.25) {
        g.save();
        g.globalAlpha = Math.max(0, 1 - e.age / 0.25);
        g.translate(e.x, e.y);
        g.scale(e.flip, 1);
        g.drawImage(e.image, -e.profile.anchor.x * e.z, -e.profile.anchor.y * e.z, Math.max(e.profile.canvas.width, e.image.naturalWidth) * e.z, e.profile.canvas.height * e.z);
        g.restore();
      }
      for (const p of e.parts) {
        g.save();
        g.translate(p.x, p.y);
        if (e.kind === "smoke") {
          g.globalAlpha = fade * 0.38;
          g.fillStyle = ["#77736d", "#8c8984", "#555451"][p.tint];
          g.beginPath();
          g.arc(0, 0, Math.max(0.5, p.size * (1 + e.age * 1.2)), 0, Math.PI * 2);
          g.fill();
        } else {
          g.globalCompositeOperation = "lighter";
          g.globalAlpha = fade;
          g.rotate(Math.atan2(p.vy, p.vx));
          g.fillStyle = ["#fff4bd", "#ffc247", "#ff7329"][p.tint];
          g.fillRect(-p.size * 2, -p.size * 0.35, Math.max(1, p.size * 4), Math.max(0.7, p.size * 0.7));
        }
        g.restore();
      }
    }
  }
  function drawShields(w) {
    for (const team of [0, 1]) {
      if (w.shields[team] <= 0) continue;
      const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 120);
      for (const f of w.fighters) {
        if (f.team !== team || f.hp <= 0) continue;
        const h = w.scale * 1150 * (characterProfiles[f.character]?.scale || 1);
        g.save();
        g.globalAlpha = Math.min(1, w.shields[team]) * 0.55 * pulse;
        g.strokeStyle = "#ffd65a";
        g.fillStyle = "#ffd65a22";
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(f.x, f.y - h * 0.45, h * 0.42, h * 0.6, 0, 0, 7);
        g.fill();
        g.stroke();
        g.restore();
      }
    }
  }
  // Health bars without names; bars that would overlap are stacked upward.
  function drawHealthBars(w) {
    const wid = Math.max(24, Math.min(44, w.scale * 540)),
      placed = [];
    for (const f of w.fighters.filter((q) => q.hp > 0).sort((a, b) => b.y - a.y)) {
      const p = characterProfiles[f.character];
      const x = f.x - wid / 2;
      let y = f.y - w.scale * 1150 * (p?.scale || 1);
      for (let k = 0; k < 6; k++) {
        const clash = placed.find((r) => Math.abs(r.x - x) < wid + 2 && Math.abs(r.y - y) < 9);
        if (!clash) break;
        y = clash.y - 10;
      }
      placed.push({ x, y });
      g.fillStyle = "#050806cc";
      g.fillRect(x, y, wid, 7);
      g.fillStyle = f.team ? "#ff3e2e" : "#44a4ff";
      g.fillRect(x + 1, y + 1, ((wid - 2) * f.hp) / f.max, 5);
      if (w.shields[f.team] > 0) {
        g.strokeStyle = "#ffd65a";
        g.lineWidth = 1.5;
        g.strokeRect(x - 1, y - 1, wid + 2, 9);
      }
    }
  }
  // ui: { phase: "setup" | "battle" | "over", selected, activeRole, dragged }
  function render(w, ui) {
    g.clearRect(0, 0, w.W, w.H);
    if (!w.treasures[0] || !w.treasures[1]) return;
    const setup = ui.phase === "setup";
    // Deploy zones only while a hero is dragged, and only the ones its body touches.
    const shown = setup && ui.dragged ? touchedZones(w, ui.dragged) : [];
    drawZones(w, 0, shown, ui.activeRole);
    for (const team of [0, 1]) drawTreasure(w, team, ui.phase === "battle" && !!TB.team.mainThreat(w, team, 2));
    const visible = w.fighters;
    if (setup) for (const f of visible) drawRoleBadge(w, f, f.team === 1);
    else for (const f of visible) if (f.hp > 0) drawRoleBadge(w, f, true);
    if (ui.selected && setup) drawSelection(w, ui.selected);
    for (const f of [...visible].sort((a, b) => a.y - b.y)) drawMixedFighter(f);
    drawShields(w);
    drawDeaths();
    g.globalCompositeOperation = "lighter";
    for (const s of w.shots) {
      if (s.kind === "tomato") continue;
      const k = s.big ? 2.2 : 1;
      for (const q of s.trail) glow(q.x, q.y, 12 * k, "rgba(255,65,8,A)", Math.max(0, q.t / 0.22) * 0.4);
      glow(s.x, s.y, 18 * k, "rgba(255,60,8,A)", 0.9);
      glow(s.x, s.y, 11 * k, "rgba(255,210,55,A)", 1);
      glow(s.x, s.y, 5 * k, "rgba(255,255,225,A)", 1);
    }
    for (const b of fx.blasts) {
      const a = Math.max(0, b.t / b.life);
      glow(b.x, b.y, Math.max(1, b.r), b.col, 0.55 * a);
      g.strokeStyle = b.col.replace("A", (0.9 * a).toFixed(2));
      g.lineWidth = 3;
      g.beginPath();
      g.arc(b.x, b.y, Math.max(1, b.r), 0, 7);
      g.stroke();
    }
    for (const p of fx.sparks) glow(p.x, p.y, 8, p.col, Math.max(0, p.t / p.max));
    g.globalCompositeOperation = "source-over";
    for (const s of w.shots) if (s.kind === "tomato") drawTomatoShot(s);
    if (!setup) drawHealthBars(w);
    drawZoneLabels(w, 0, shown, ui.activeRole);
    for (const p of fx.floaters) {
      g.globalAlpha = Math.min(1, Math.max(0, p.t / 0.8));
      g.fillStyle = p.color || "#ff472c";
      g.font = `1000 ${p.size || 18}px system-ui`;
      g.textAlign = "center";
      g.lineWidth = 3;
      g.strokeStyle = "#000a";
      g.strokeText(p.text, p.x, p.y);
      g.fillText(p.text, p.x, p.y);
    }
    g.globalAlpha = 1;
  }
  return { ROLE_COLORS, reset, hooks, advance, render, effectsRunning, floater };
})();
