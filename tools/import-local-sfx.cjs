// Copies sounds from a sound library on this computer into src/assets/audio/sfx-local, a folder git ignores: the
// game plays them instead of the bundled set on this computer only, and they never reach the published site.
//   node tools/import-local-sfx.cjs [library folder]
// Each sound is cut to its length with a fade and its loudness levelled (needs ffmpeg on the PATH). A cue with
// several files gets several takes (name-0.mp3, name-1.mp3, ...); the game picks one at random each time.
const fs = require("fs"),
  path = require("path"),
  { execFileSync } = require("child_process");

const lib = process.argv[2] || "D:/HomeProjects/sounds/dota2-main/sounds",
  out = path.join(__dirname, "../src/assets/audio/sfx-local"),
  H = "weapons/hero/";
// cue → [files in the library, seconds kept, loudness (LUFS) if not the blows' LOUDNESS]
const PICK = {
  // Blows, by weapon.
  blunt: [[H + "axe/attack01.wav", H + "axe/attack02.wav", H + "axe/attack03.wav"], 0.5],
  slash: [[H + "juggernaut/attack01.wav", H + "juggernaut/attack02.wav", H + "juggernaut/attack03.wav"], 0.5],
  thrust: [[H + "phantom_assassin/phantom_assassin_swing1.wav", H + "phantom_assassin/stifling_dagger_target.wav"], 0.5],
  arrow: [[H + "drow_ranger/arrow_impact_1.wav", H + "drow_ranger/arrow_impact_2.wav", H + "drow_ranger/arrow_impact_3.wav"], 0.5],
  kernel: [[H + "sniper/projectile_impact01.wav", H + "sniper/projectile_impact02.wav"], 0.5],
  splat: [[H + "venomancer/attack_impact1.wav", H + "venomancer/attack_impact2.wav", H + "venomancer/attack_impact3.wav"], 0.4],
  fire: [[H + "lina/projectile_impact.wav"], 0.6],
  magic: [[H + "lion/lion_attack_impact1.wav", H + "lion/lion_attack_impact2.wav"], 0.5],
  // Shots leaving the shooter.
  bow: [[H + "drow_ranger/arrow_1.wav", H + "drow_ranger/arrow_2.wav", H + "drow_ranger/arrow_3.wav", H + "drow_ranger/arrow_4.wav"], 0.5, -28],
  throw: [[H + "snapfire/attack.wav"], 0.5, -28],
  "fireball-cast": [[H + "lina/attack.wav"], 0.5, -28],
  "magic-cast": [[H + "lion/attack01.wav", H + "lion/attack02.wav", H + "lion/attack03.wav"], 0.5, -28],
  // Moving: steps (quiet, there are many), a sprint's rush of air, the carrot's leap.
  step: [["physics/footsteps/hero/axe/foley01.wav", "physics/footsteps/hero/axe/foley02.wav", "physics/footsteps/hero/axe/foley03.wav", "physics/footsteps/hero/axe/foley04.wav"], 0.3, -34],
  dash: [["weapons/creep/shared/whoosh01.wav", "weapons/creep/shared/whoosh02.wav", "weapons/creep/shared/whoosh03.wav", "weapons/creep/shared/whoosh04.wav"], 0.4, -28],
  leap: [[H + "mirana/leap1.wav", H + "mirana/leap2.wav", H + "mirana/leap3.wav", H + "mirana/leap4.wav"], 0.7, -24],
  death: [["physics/deaths/common/body_impact_heavy_01.wav", "physics/deaths/common/body_impact_heavy_02.wav"], 0.72],
  // Events: a drum and horns, no singing (the library's own round and result tunes sang and howled).
  ability: [["items/item_drum.wav"], 0.8, -24],
  "round-end": [["misc/drum_hit02.wav"], 0.95, -20],
  win: [["ambient/mega_horn_radiant.wav"], 3, -19],
  lose: [["ambient/horn_dire.wav"], 3, -20],
};
// Loudness each blow is levelled to (LUFS): quiet enough that a crowd of blows does not drown the rest.
const LOUDNESS = -26;
// A long horn cut short fades out over its last second; a blow over its last 0.12 s.
const fade = (secs) => Math.min(1, Math.max(0.12, secs * 0.35));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const takes = {};
for (const [name, [files, secs, loud = LOUDNESS]] of Object.entries(PICK)) {
  let n = 0;
  for (const file of files) {
    const src = path.join(lib, file);
    if (!fs.existsSync(src)) {
      console.log(`skip ${name}: no ${file}`);
      continue;
    }
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", src, "-t", String(secs), "-af", `afade=t=out:st=${secs - fade(secs)}:d=${fade(secs)},loudnorm=I=${loud}:TP=-6`, "-ar", "44100", "-ac", "1", "-b:a", "96k", path.join(out, `${name}-${n++}.mp3`)]);
  }
  if (n) takes[name] = n;
}
// The game reads this list to know which local sounds there are and how many takes each has.
fs.writeFileSync(path.join(out, "list.json"), JSON.stringify(takes) + "\n");
console.log(`${Object.keys(takes).length} cues, ${Object.values(takes).reduce((a, b) => a + b, 0)} takes in ${out}`);
