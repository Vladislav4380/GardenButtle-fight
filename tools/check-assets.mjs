import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const root=process.cwd(),walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const poses=id=>id==='carrot'?['cast','cast-b','idle','walk-a','walk-b','walk-pass','walk-pass-2']:id==='tomato'?['cast','cast-b','idle','walk-a','walk-b','walk-pass','walk-pass-2']:['cast','idle','walk-a','walk-b'];const expectedFor=id=>['manifest.json',...['back','enemy','front'].flatMap(view=>poses(id).map(pose=>'sprites/'+view+'/'+pose+'.png'))].sort();
let characterCount=0;
for(const id of ['pepper','tomato','carrot']){
 const dir=path.join('src/assets/characters',id),actual=walk(dir).map(p=>path.relative(dir,p).replaceAll('\\','/')).filter(p=>!/^(source|reference)\//.test(p)).sort();const expected=expectedFor(id);assert.deepEqual(actual,expected,id+' resource tree differs');
 const m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));assert.deepEqual(m.canvas,{width:1024,height:1536});assert.deepEqual(m.anchor,{x:id==='tomato'?677:512,y:1360});assert.equal(m.visualHeight,1150);assert.deepEqual(Object.fromEntries(Object.entries(m.states).map(([state,c])=>[state,c.frameCount])),{idle:1,walk:id==='tomato'||id==='carrot'?4:2,attack:id==='carrot'||id==='tomato'?2:1});
 const listed=[];for(const view of m.views)for(const cfg of Object.values(m.states))for(const name of cfg.files){const p=path.join(dir,'sprites',view,name),b=fs.readFileSync(p);assert.ok(b.readUInt32BE(16)>=1024);assert.equal(b.readUInt32BE(20),1536);listed.push('sprites/'+view+'/'+name)}assert.deepEqual([...new Set(listed)].sort(),expected.filter(p=>p.endsWith('.png')&&!p.startsWith('sprites/enemy/')));characterCount++;
}
const files=[...walk('src/app'),...walk('src/scenes'),...walk('src/assets/shared')].filter(p=>/\.(ts|js|html|css|scss)$/.test(p));
let missing=[],obsolete=[],verified=0;
for(const file of files){const text=fs.readFileSync(file,'utf8');if(/animations\/legacy|sprites\/pack-v001|sprites\/combat-preview-v001|ezgif-frame|\/frame-[^;\n]*\.png|https?:\/\/(?:127\.0\.0\.1|localhost)/.test(text))obsolete.push(file);for(const m of text.matchAll(/(?:\/)?assets\/[a-zA-Z0-9_./-]+\.(?:png|json|glb|webp|jpg|js|css)/g)){const rel=m[0].replace(/^\//,'');verified++;if(!fs.existsSync(path.join('src',rel)))missing.push(file+': '+rel)}}
assert.deepEqual(obsolete,[],'Old asset references remain');assert.deepEqual(missing,[],'Missing resources');
const code=files.map(p=>fs.readFileSync(p,'utf8')).join('\n'),glbNames=new Set([...code.matchAll(/[\w-]+\.glb/g)].map(m=>m[0]));
for(const file of walk('src/assets/scenes/3d'))assert.ok(glbNames.has(path.basename(file)),'Unused model: '+file);
console.log('PASS: '+characterCount+' identical character trees; 8 PNG each; matching canvases and frame counts; '+verified+' asset references; no obsolete paths or unreferenced models.');

