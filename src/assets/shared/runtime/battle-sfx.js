// Battle sounds: one file per cue in assets/audio/sfx (the game's own sound set, loudness levelled), played at a
// slightly random pitch so repeats do not sound mechanical. Until a file has loaded, and for the draw tune that has
// none, the cue is made on the fly with Web Audio. BattleSfx.play(name, { kind, big }) plays one cue; the same cue is
// not repeated within GAP seconds, so a crowd of blows sounds like a fight, not a buzz.
// The sound starts after the first tap (browsers keep audio silent until then); "muted" is remembered on the device.
(function () {
  const GAP = 0.05,
    VOLUME = 0.3;
  let ctx = null,
    master = null,
    noiseBuf = null,
    muted = false;
  const last = {};
  try {
    muted = localStorage.getItem("battle-sfx-muted") === "1";
  } catch (e) {}

  function init() {
    if (ctx) return ctx.state === "suspended" ? ctx.resume() : null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    // A compressor glues the short bursts together and makes them punchier.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    loadSamples();
  }

  // The bundled sounds are assets/audio/sfx (built by tools/build-sfx.cjs); sounds put in assets/audio/sfx-local by
  // tools/import-local-sfx.cjs (this computer only, not in git) take the place of the bundled ones of the same name,
  // unless the page address asks for the site's own (?sfx=site). Each folder's list.json gives every cue's number
  // of takes (name-0.mp3, name-1.mp3, ...).
  const buffers = {};
  async function loadSamples() {
    const list = (dir) =>
      fetch(`/assets/audio/${dir}/list.json`)
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({}));
    const site = await list("sfx"),
      local = /[?&]sfx=site\b/.test(location.search) ? {} : await list("sfx-local");
    for (const [dir, cues] of [
      ["sfx-local", local],
      ["sfx", site],
    ])
      for (const [name, n] of Object.entries(cues))
        if (dir === "sfx-local" || !local[name])
          for (let i = 0; i < n; i++)
            fetch(`/assets/audio/${dir}/${name}-${i}.mp3`)
              .then((r) => r.arrayBuffer())
              .then((b) => new Promise((ok, fail) => ctx.decodeAudioData(b, ok, fail)))
              .then((buf) => (buffers[name] ||= []).push(buf))
              .catch(() => {});
  }
  // A file's sound; false while it is not loaded yet, so the caller falls back to a made sound. Short blows get a
  // slightly random pitch; tunes (vary = false) keep theirs.
  function sample(name, vol = 1, rate = 1, at = 0, vary = true) {
    const takes = buffers[name];
    if (!takes?.length) return false;
    const s = ctx.createBufferSource(),
      g = ctx.createGain();
    s.buffer = takes[Math.floor(Math.random() * takes.length)];
    s.playbackRate.value = vary ? rate * (0.94 + Math.random() * 0.12) : rate;
    g.gain.value = vol;
    s.connect(g).connect(master);
    s.start(ctx.currentTime + at);
    return true;
  }
  addEventListener("pointerdown", init, true);
  addEventListener("keydown", init, true);

  // A note: oscillator from f0 to f1 over dur, loudness vol, starting `at` seconds from now.
  function tone(type, f0, f1, dur, vol, at = 0) {
    const t = ctx.currentTime + at,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  // A burst of noise through a filter swept from f0 to f1: hits, swishes and flames.
  function noise(filter, f0, f1, dur, vol, at = 0, q = 1) {
    const t = ctx.currentTime + at,
      s = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    s.buffer = noiseBuf;
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  // A blow is a noise crack (the contact) over a short low thud (the weight) and a click (the edge). Pitch slides
  // down are kept tiny: a long falling tone sounded like a stone dropping into water.
  const thud = (f, dur, vol, at) => tone("sine", f, f * 0.8, dur, vol, at),
    click = (vol, at) => noise("highpass", 5000, 3000, 0.018, vol, at);
  const HIT = {
    blunt: (k) => (noise("lowpass", 2600 * k, 700, 0.09, 0.55), thud(75, 0.09, 0.5), click(0.25)),
    slash: (k) => (noise("bandpass", 7000 * k, 2500, 0.13, 0.5, 0, 0.8), click(0.3)),
    thrust: (k) => (noise("bandpass", 3500 * k, 1800, 0.07, 0.45, 0, 1.2), thud(110, 0.05, 0.3), click(0.3)),
    arrow: (k) => (noise("bandpass", 2400 * k, 1900, 0.05, 0.6, 0, 4), thud(140, 0.04, 0.3), click(0.35)),
    kernel: (k) => (noise("bandpass", 1800 * k, 1400, 0.04, 0.5, 0, 3), click(0.4)),
    juice: (k) => (noise("lowpass", 2200 * k, 500, 0.12, 0.55), noise("bandpass", 900, 600, 0.08, 0.3, 0.02, 2)),
    fire: (k) => (noise("lowpass", 3500 * k, 700, 0.28, 0.55), [0.03, 0.08, 0.14].forEach((t) => click(0.2, t))),
    magic: (k) => (noise("highpass", 6000, 4000, 0.18, 0.25), tone("triangle", 1250 * k, 1200, 0.12, 0.12), click(0.3)),
  };
  // A shot leaving the shooter: short and quiet, so the impact is what is heard.
  const SHOOT = {
    arrow: () => (noise("highpass", 2500, 6000, 0.09, 0.22), tone("triangle", 196, 190, 0.07, 0.12)),
    kernel: () => (click(0.3), noise("bandpass", 1200, 1600, 0.03, 0.2, 0, 3)),
    juice: () => noise("bandpass", 700, 1600, 0.1, 0.22, 0, 1.2),
    fire: () => noise("bandpass", 500, 2500, 0.2, 0.3, 0, 0.9),
    magic: () => (noise("highpass", 4000, 7000, 0.16, 0.15), tone("sine", 900, 1300, 0.14, 0.08)),
  };
  // Weapon (WEAPON in tft-battle.js) → its file for a blow and for a shot.
  const HIT_FILE = { blunt: "blunt", slash: "slash", thrust: "thrust", arrow: "arrow", kernel: "kernel", juice: "splat", fire: "fire", magic: "magic" },
    SHOOT_FILE = { arrow: "bow", kernel: "throw", juice: "throw", fire: "fireball-cast", magic: "magic-cast" };
  const CUES = {
    // Blows are many: quieter than the events, an ability's blow a little louder and lower.
    hit: ({ kind, big }) =>
      sample(HIT_FILE[kind] || "blunt", big ? 0.75 : 0.5, big ? 0.9 : 1) || (HIT[kind] || HIT.blunt)(big ? 0.8 : 0.9 + Math.random() * 0.25),
    shoot: ({ kind }) => SHOOT_FILE[kind] && (sample(SHOOT_FILE[kind], 0.35) || SHOOT[kind]?.()),
    cast: () => sample("ability", 0.6) || [660, 880, 1320].forEach((f, i) => tone("sine", f, f, 0.16, 0.16, i * 0.05)),
    death: () => sample("death", 0.8) || (thud(65, 0.22, 0.55), noise("lowpass", 1800, 300, 0.35, 0.4), noise("lowpass", 900, 200, 0.2, 0.3, 0.12)),
    // Moving: steps are quiet and only some of them sound, a sprint's rush of air, the carrot's leap. Without the
    // files these stay silent.
    step: () => Math.random() < 0.4 && sample("step", 0.6),
    dash: () => sample("dash", 0.7),
    leap: () => sample("leap", 0.9),
    end: () => sample("round-end", 0.8, 1, 0, false) || (tone("sine", 98, 92, 1.4, 0.45), tone("sine", 196, 185, 1, 0.15)),
    win: () => sample("win", 0.9, 1, 0, false) || [523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, f, i === 3 ? 0.6 : 0.18, 0.22, i * 0.12)),
    loss: () =>
      sample("lose", 0.9, 1, 0, false) || [392, 349, 311, 262].forEach((f, i) => tone("triangle", f, f * (i === 3 ? 0.97 : 1), i === 3 ? 0.7 : 0.22, 0.2, i * 0.16)),
    // A draw has no tune of its own: the round-end drum, a little lower.
    draw: () => sample("round-end", 0.8, 0.85, 0, false) || [440, 440].forEach((f, i) => tone("triangle", f, f, 0.25, 0.18, i * 0.2)),
  };

  window.BattleSfx = {
    play(name, opts = {}) {
      if (muted || !ctx || ctx.state !== "running" || !CUES[name]) return;
      const key = name + (opts.kind || ""),
        now = ctx.currentTime;
      if (now - (last[key] ?? -1) < GAP) return;
      last[key] = now;
      CUES[name](opts);
    },
    get muted() {
      return muted;
    },
    toggle() {
      muted = !muted;
      try {
        localStorage.setItem("battle-sfx-muted", muted ? "1" : "0");
      } catch (e) {}
      init();
      if (master) master.gain.value = muted ? 0 : VOLUME;
      return muted;
    },
  };
})();
