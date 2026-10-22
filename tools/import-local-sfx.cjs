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
const from = (dir, names) => names.map((n) => H + dir + "/" + n);
const PICK = {
  // Each hero's own blow (cue hero-<id>): a hero of the library with a like weapon.
  "hero-potato": [from("tiny", ["tiny_attack.wav", "tiny_attack2.wav", "tiny_attack3.wav"]), 0.5],
  "hero-walnut": [from("earthshaker", ["fist_swing_impact1.wav", "fist_swing_impact2.wav", "fist_swing_impact3.wav"]), 0.5],
  "hero-zucchini": [from("axe", ["attack01.wav", "attack02.wav", "attack03.wav"]), 0.5],
  "hero-cucumber": [from("ursa", ["ursa_attack_01.wav", "ursa_attack_02.wav", "ursa_attack_03.wav"]), 0.45],
  "hero-beet": [from("juggernaut", ["attack01.wav", "attack02.wav", "attack03.wav"]), 0.5],
  "hero-peach": [from("sven", ["attack01.wav", "attack02.wav", "attack03.wav"]), 0.5],
  "hero-carrot": [from("phantom_lancer", ["attack01.wav", "attack02.wav", "attack03.wav"]), 0.5],
  "hero-onion": [from("drow_ranger", ["arrow_impact_1.wav", "arrow_impact_2.wav", "arrow_impact_3.wav"]), 0.5],
  "hero-corn": [from("sniper", ["projectile_impact01.wav", "projectile_impact02.wav"]), 0.5],
  "hero-tomato": [from("venomancer", ["attack_impact1.wav", "attack_impact2.wav", "attack_impact3.wav"]), 0.4],
  "hero-pepper": [from("lina", ["projectile_impact.wav"]), 0.6],
  "hero-eggplant": [from("witch_doctor", ["projectile_impact.wav"]), 0.5],
  // The bow's string as an arrow leaves. Other shots, the eggplant's magic, abilities, falls, moving and the round's
  // events have no sound.
  bow: [[H + "drow_ranger/arrow_1.wav", H + "drow_ranger/arrow_2.wav", H + "drow_ranger/arrow_3.wav", H + "drow_ranger/arrow_4.wav"], 0.5, -28],
};
// Loudness each blow is levelled to (LUFS): quiet, so a crowd of blows does not drown the rest.
const LOUDNESS = -30;
// A sound cut short fades out over its last 0.12–0.3 s.
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
