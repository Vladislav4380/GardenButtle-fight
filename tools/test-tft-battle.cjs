// Battle 6×6 with TFT rules: hex placement, hex movement, targets, mana, assassin run, battle end (node tools/test-tft-battle.cjs).
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=process.argv[2]||require('node:path').resolve(__dirname,'..');
const code=fs.readFileSync(root+'/src/assets/shared/runtime/tft-battle.js','utf8');
function context(){
 const ctx=vm.createContext({console,Math,performance:{now:()=>0},characterProfiles:{},document:{querySelector:()=>null}});
 vm.runInContext(code,ctx);return code2=>vm.runInContext(code2,ctx);
}
// Only the listed units are alive, each on the given hex.
const setup=(units)=>`newBattle(false);for(const f of F)f.hp=0;${units.map(([name,i,ch,col,row])=>`globalThis.${name}=F[${i}];${name}.character='${ch}';${name}.stats={...TFT_SPECS.${ch}};${name}.hp=${name}.max=TFT_SPECS.${ch}.max;${name}.mana=0;placeOnHex(${name},${col},${row});`).join('')}running=battleStarted=true;`;
{
 const run=context();
 run('newBattle(false)');
 assert.equal(run('F.length'),12);
 assert(run('F.filter(f=>f.team===0).every(f=>ownRows(0).includes(f.row))&&F.filter(f=>f.team===1).every(f=>ownRows(1).includes(f.row))'),'each team starts on its own half');
 assert.equal(run('new Set(F.map(f=>f.col+":"+f.row)).size'),12,'one unit per hex');
 assert.equal(run('hexDist({col:3,row:4},{col:3,row:3})'),1);assert.equal(run('hexDist({col:0,row:0},{col:0,row:7})'),7);
 assert(run('neighbors(3,4).every(n=>hexDist(n,{col:3,row:4})===1)&&neighbors(3,4).length===6'),'six neighbours at distance 1');
 run("setLineupSlot(0,'carrot')");assert.equal(run('F[0].character'),'carrot');
 console.log('PASS: hex placement, hex distance, lineup slots');
}
for(let i=0;i<20;i++){
 const run=context();
 run('newBattle(false);startBattle();globalThis.clash=0;for(let k=0;k<60*50&&running;k++){step(1/60);const live=F.filter(f=>f.hp>0);if(new Set(live.map(f=>f.col+":"+f.row)).size!==live.length)clash++}');
 assert(run('!!result'),'battle '+i+' must end');
 assert.equal(run('clash'),0,'two units never share a hex');
 assert(run('F.every(f=>onBoard(f.col,f.row))'),'units stay on the board');
}
console.log('PASS: 20 random 6×6 battles end, never two units in one hex');
for(let i=0;i<10;i++){
 const run=context();
 run('setBoard(6,6);newBattle(false);startBattle();globalThis.clash=0;for(let k=0;k<60*50&&running;k++){step(1/60);const live=F.filter(f=>f.hp>0);if(new Set(live.map(f=>f.col+":"+f.row)).size!==live.length)clash++}');
 assert(run('!!result')&&run('clash')===0,'the phone board (6 × 6 per side) plays the same way');
}
console.log('PASS: phone board 6 × 6 per side');
{
 const run=context();
 run(setup([['t',0,'tomato',3,6],['a',6,'tomato',3,1],['b',7,'tomato',0,0]]));
 run('step(1/60)');
 assert(run('t.target===a'),'a unit takes the closest enemy');
 run('globalThis.from=t.row;for(let k=0;k<60;k++)step(1/60)');
 assert(run('t.row<from'),'it steps hex by hex toward the target');
 run(setup([['p',0,'pepper',3,6],['a',6,'tomato',3,2],['b',7,'tomato',6,3]]));
 run('for(let k=0;k<90;k++)step(1/60)');
 assert(run('p.col===3&&p.row===6&&p.target===a'),'a pepper with range 4 shoots from where it stands');
 run('a.hp=0;step(1/60)');
 assert(run('p.target===b'),'when the target dies it takes the closest enemy');
 console.log('PASS: closest target, hex steps, ranged units stand, retarget on death');
}
{
 const run=context();
 run(setup([['p',0,'pepper',3,6],['a',6,'tomato',3,3]]));
 run('p.cool=0;step(1/60)');
 assert.equal(run('p.mana'),10,'each attack gives 10 mana');
 run('p.mana=p.stats.mana;p.cool=0;p.cast=0;p.pending=null;step(1/60)');
 assert(run('p.mana===0&&p.pending&&p.pending.big'),'full mana casts the ability and resets mana');
 run('globalThis.m0=a.mana;hurt(a,100,p)');
 assert(run('a.mana>m0'),'taking damage gives mana');
 console.log('PASS: mana from attacks and damage, ability at full mana');
}
{
 const run=context();
 run(setup([['c',0,'carrot',1,6],['front',6,'tomato',1,3],['back',7,'pepper',5,0]]));
 run('front.cool=back.cool=100;running=battleStarted=false;startBattle()');
 assert(run('c.target===back&&c.hunt===back'),'the assassin runs for the farthest enemy');
 run('for(let k=0;k<60*5&&hexDist(c,back)>1;k++)step(1/60)');
 assert(run('hexDist(c,back)===1&&c.target===back'),'it gets round the front and reaches that enemy');
 run(setup([['c',0,'carrot',6,7],['a',6,'tomato',1,0],['b',7,'tomato',0,1],['back',8,'pepper',0,0]]));
 run('a.cool=b.cool=back.cool=100;running=battleStarted=false;startBattle()');
 assert(run('c.hunt===back'));
 run('for(let k=0;k<60*4;k++)step(1/60)');
 assert(run('!c.hunt&&(c.target===a||c.target===b)'),'with no free way it fights the first enemy it reached');
 console.log('PASS: assassin runs round the front to the back line, or fights whoever blocks the way');
}
{
 const run=context();
 assert.equal(run("teamTraits(['tomato','tomato','tomato','tomato','tomato','tomato']).guard.tier"),0,'six tomatoes are one guard: no synergy');
 assert.equal(run("teamTraits(['tomato','zucchini','pepper','corn','carrot','beet']).guard.tier"),1,'two different guards switch the guard synergy on');
 assert.equal(run("teamTraits(['tomato','zucchini','pepper']).fruit.tier"),2,'three different fruits reach the second fruit tier');
 run("lineup=['tomato','zucchini','pepper','corn','carrot','beet'];newBattle(false);globalThis.armor0=F[0].stats.armor;globalThis.range0=F[2].stats.range;startBattle()");
 assert(run('F[0].stats.armor===armor0+20&&F[2].stats.range===range0+1'),'synergy bonuses are applied at the start of the battle');
 console.log('PASS: synergies count different heroes and apply their bonuses');
}
