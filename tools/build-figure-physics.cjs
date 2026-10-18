// The mobile sprite scenes use the same contact solver as the schematic battle.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
const source = fs.readFileSync(path.join(root, 'src/app/pages/figures/battle-engine.ts'), 'utf8');
const helpers = source.slice(source.indexOf('export const distance ='), source.indexOf('function score('));
const solver = source.slice(source.indexOf('function keepInsideField('), source.indexOf('export function createBattle('));
if (!helpers || !solver.includes('export function resolveOverlaps')) throw Error('Schematic solver not found');
const code = ts.transpileModule(helpers + solver, {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext}}).outputText.replace(/export /g, '');
const output = '// Generated from pages/figures/battle-engine.ts by tools/build-figure-physics.cjs.\nconst FigurePhysics = (() => {\n' + code + '\nreturn { resolveOverlaps };\n})();\n';
fs.writeFileSync(path.join(root, 'src/assets/shared/runtime/figure-physics.js'), output);
