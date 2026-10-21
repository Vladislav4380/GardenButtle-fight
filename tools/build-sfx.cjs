// Builds the game's bundled battle sounds, src/assets/audio/sfx, from the CC0 files in art/sfx-cc0 (see its
// SOURCES.md). Each sound is cut to its length with a fade and its loudness
// levelled (needs ffmpeg on the PATH). A cue with several files gets several takes (name-0.mp3, name-1.mp3, ...);
// the game picks one at random each time. list.json gives each cue's number of takes.
//   node tools/build-sfx.cjs
const fs = require("fs"),
  path = require("path"),
  { execFileSync } = require("child_process");

const root = path.join(__dirname, ".."),
  out = path.join(root, "src/assets/audio/sfx"),
  C = "art/sfx-cc0/",
  takes = (pattern, ns) => ns.map((n) => C + pattern.replace("#", n));
// cue → [files, seconds kept, loudness (LUFS) if not the blows' LOUDNESS, extra ffmpeg filter]
const PICK = {
  // Blows, by weapon.
  blunt: [takes("wood_0#.ogg", [1, 2, 3]), 0.4],
  slash: [takes("sword_#.ogg", [1, 2, 3, 4]), 0.45],
  thrust: [takes("blade_0#.ogg", [1, 2, 3]), 0.35],
  arrow: [[...takes("wood_0#.ogg", [4, 5]), C + "item_wood_01.ogg"], 0.35],
  kernel: [takes("item_stone_0#.ogg", [1, 2, 3]), 0.35],
  splat: [takes("squish_0#.mp3", [1, 2, 3, 4]), 0.45],
  fire: [takes("spell_fire_0#.ogg", [1, 2, 3]), 0.6],
  // The bow's string as an arrow leaves: quieter than the blows. Other shots, the eggplant's magic, abilities and
  // falls have no sound.
  bow: [takes("swish_#.wav", [1, 2, 3, 4]), 0.25, -30],
  // Moving: steps (quiet, there are many) and a sprint's rush of air. The leap, the round's end and the result
  // have no sound.
  step: [takes("footstep_grass_#.ogg", [0, 1, 2, 3, 4]), 0.3, -34],
  dash: [takes("swish_#.wav", [8, 9, 10]), 0.3, -28],
};
// Loudness each blow is levelled to (LUFS): quiet enough that a crowd of blows does not drown the rest.
const LOUDNESS = -24;
// A sound cut short fades out over its last 0.1–0.2 s.
const fade = (secs) => Math.min(1, Math.max(0.1, secs * 0.3));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const list = {};
for (const [name, [files, secs, loud = LOUDNESS, extra]] of Object.entries(PICK)) {
  files.forEach((file, i) => {
    const filters = [extra, `afade=t=out:st=${(secs - fade(secs)).toFixed(3)}:d=${fade(secs).toFixed(3)}`, `loudnorm=I=${loud}:TP=-4`].filter(Boolean).join(",");
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", path.join(root, file), "-t", String(secs), "-af", filters, "-ar", "44100", "-ac", "1", "-b:a", "96k", path.join(out, `${name}-${i}.mp3`)]);
  });
  list[name] = files.length;
}
fs.writeFileSync(path.join(out, "list.json"), JSON.stringify(list) + "\n");
console.log(`${Object.keys(list).length} cues, ${Object.values(list).reduce((a, b) => a + b, 0)} takes in ${out}`);
