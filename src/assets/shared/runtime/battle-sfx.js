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

  // Phones only let a page sound from inside a tap: the audio is created and woken on every tap until it runs.
  function init() {
    if (ctx) return ctx.state !== "running" && unlock();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    // iPhone: play through the silent switch, as games do (Safari 16.4+); otherwise Web Audio is mute in silent mode.
    try {
      if (navigator.audioSession) navigator.audioSession.type = "playback";
    } catch (e) {}
    ctx = new AC();
    unlock();
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
  const buffers = {},
    // The last sounds played, newest last, with the hero who made them: shown on the battle page with ?sfx=debug.
    heard = [];
  let playing = "";
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
              .then((buf) => (buffers[name] ||= []).push(Object.assign(buf, { file: `${dir}/${name}-${i}.mp3` })))
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
    heard.push({ file: s.buffer.file, who: playing });
    if (heard.length > 8) heard.shift();
    s.playbackRate.value = vary ? rate * (0.94 + Math.random() * 0.12) : rate;
    g.gain.value = vol;
    s.connect(g).connect(master);
    s.start(ctx.currentTime + at);
    return true;
  }
  // Resume, and play one silent sample: older iPhones start the sound only once something has played in a tap.
  function unlock() {
    ctx.resume?.();
    const s = ctx.createBufferSource();
    s.buffer = ctx.createBuffer(1, 1, 22050);
    s.connect(ctx.destination);
    s.start(0);
  }
  for (const type of ["pointerdown", "touchend", "click", "keydown"]) addEventListener(type, init, true);

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
  };
  // Weapon (WEAPON in tft-battle.js) → its file for a blow. The eggplant's magic, abilities and falls are silent,
  // and of the shots only the bow sounds: their sounds were the worst.
  const HIT_FILE = { blunt: "blunt", slash: "slash", thrust: "thrust", arrow: "arrow", kernel: "kernel", juice: "splat", fire: "fire" };
  const CUES = {
    // Blows are many: quiet, an ability's blow a little louder and lower.
    hit: ({ kind, big }) =>
      HIT_FILE[kind] && (sample(HIT_FILE[kind], big ? 0.75 : 0.5, big ? 0.9 : 1) || HIT[kind](big ? 0.8 : 0.9 + Math.random() * 0.25)),
    // The bow's string as the arrow leaves.
    shoot: ({ kind }) => kind === "arrow" && (sample("bow", 0.35) || (noise("highpass", 2500, 6000, 0.09, 0.22), tone("triangle", 196, 190, 0.07, 0.12))),
    // Moving: steps are quiet and only some of them sound, and a sprint's rush of air. Without the files these stay
    // silent.
    step: () => Math.random() < 0.4 && sample("step", 0.6),
    dash: () => sample("dash", 0.7),
  };

  window.BattleSfx = {
    play(name, opts = {}) {
      if (muted || !ctx || ctx.state !== "running" || !CUES[name]) return;
      const key = name + (opts.kind || ""),
        now = ctx.currentTime;
      if (now - (last[key] ?? -1) < GAP) return;
      last[key] = now;
      playing = opts.who || "";
      CUES[name](opts);
    },
    heard,
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
