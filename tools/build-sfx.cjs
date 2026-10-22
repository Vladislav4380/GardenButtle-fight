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
// Each hero's own blow: art/sfx-cc0/heroes/<hero>_0…2 (see SOURCES.md for how they were chosen), how long it is
// and, where it differs from the blows' LOUDNESS, how loud. The pepper's fire is short and quieter: it was too much.
const HEROES = { potato: 0.45, walnut: 0.45, zucchini: 0.4, cucumber: 0.35, beet: 0.45, peach: 0.5, carrot: 0.35, onion: 0.35, corn: 0.35, tomato: 0.45, pepper: [0.35, -34], eggplant: 0.5 };
const heroFiles = (hero) =>
  fs
    .readdirSync(path.join(root, C, "heroes"))
    .filter((f) => f.startsWith(hero + "_"))
    .sort()
    .map((f) => C + "heroes/" + f);
// cue → [files, seconds kept, loudness (LUFS) if not the blows' LOUDNESS, extra ffmpeg filter]
const PICK = {
  ...Object.fromEntries(Object.entries(HEROES).map(([hero, how]) => [`hero-${hero}`, [heroFiles(hero), ...[how].flat()]])),
  // The bow's string as an arrow leaves: quieter than the blows. Other shots, abilities, falls, moving and the
  // round's events have no sound.
  bow: [takes("swish_#.wav", [1, 2, 3, 4]), 0.25, -32],
};
// Loudness each blow is levelled to (LUFS): quiet, so a crowd of blows does not drown the rest. The low end is
// cut (below 150 Hz): no booming bass.
const LOUDNESS = -28,
  LOW_CUT = "highpass=f=150";
// A sound cut short fades out over its last 0.1–0.2 s.
const fade = (secs) => Math.min(1, Math.max(0.1, secs * 0.3));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const list = {};
for (const [name, [files, secs, loud = LOUDNESS, extra]] of Object.entries(PICK)) {
  files.forEach((file, i) => {
    const filters = [LOW_CUT, extra, `afade=t=out:st=${(secs - fade(secs)).toFixed(3)}:d=${fade(secs).toFixed(3)}`, `loudnorm=I=${loud}:TP=-4`].filter(Boolean).join(",");
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", path.join(root, file), "-t", String(secs), "-af", filters, "-ar", "44100", "-ac", "1", "-b:a", "96k", path.join(out, `${name}-${i}.mp3`)]);
  });
  list[name] = files.length;
}
fs.writeFileSync(path.join(out, "list.json"), JSON.stringify(list) + "\n");
console.log(`${Object.keys(list).length} cues, ${Object.values(list).reduce((a, b) => a + b, 0)} takes in ${out}`);
