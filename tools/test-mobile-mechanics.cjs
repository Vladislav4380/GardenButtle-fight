const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=process.argv[2]||require('node:path').resolve(__dirname,'..');
const physics=fs.readFileSync(root+'/src/assets/shared/runtime/figure-physics.js','utf8');
const mobile=fs.readFileSync(root+'/src/assets/shared/runtime/mobile-battle.js','utf8');
const profiles=Object.fromEntries(['pepper','carrot','tomato'].map(id=>[id,JSON.parse(fs.readFileSync(root+'/src/assets/characters/'+id+'/manifest.json','utf8'))]));
function context(layout='mobile-horizontal'){
 const elements=new Map();
 function el(id){if(!elements.has(id))elements.set(id,{value:'100',textContent:'',innerHTML:'',hidden:false,style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},getContext(){return {setTransform(){}}},getBoundingClientRect(){return {width:layout==='mobile-horizontal'?900:390,height:layout==='mobile-horizontal'?420:600,left:0,top:0}},addEventListener(){},setPointerCapture(){},querySelector(){return {textContent:''}},click(){this.onclick?.()}});return elements.get(id)}
 const sandbox={console,performance:{now:()=>0},Math,devicePixelRatio:1,addEventListener(){},requestAnimationFrame(){},characterProfiles:profiles,mixedReady:{then(){}},mixedSocket:f=>({x:f.x,y:f.y-20}),drawMixedFighter(){},document:{documentElement:{dataset:{layout}},querySelector:el,querySelectorAll:()=>[]}};
 for(const id of ['redHp','blueHp','energyText','cells','speed','timer'])sandbox[id]=el('#'+id);
 const ctx=vm.createContext(sandbox);vm.runInContext(physics+'\n'+mobile,ctx);return {ctx,el,run:code=>vm.runInContext(code,ctx)};
}
{
 const {run}=context();
 run(`globalThis.contact=(ma,sa,mb,sb)=>{const a={team:'blue',hp:100,mass:ma,moveSpeed:sa,radius:20,position:{x:200,y:200}},b={team:'red',hp:100,mass:mb,moveSpeed:sb,radius:20,position:{x:242,y:200}};FigurePhysics.resolveOverlaps({heroes:[a,b],width:700,height:390,orientation:'landscape'},100);return [a.position.x,b.position.x]}`);
 assert(run('contact(3,60,1,40)[1]>242'));assert.equal(run('contact(3,60,1,40)[0]'),200);
 assert(run('contact(1,150,2,40)[1]>242'),'speed must contribute to pressure');
 assert(run('contact(1,30,3,60)[0]<200'));
 assert.equal(run('contact(2,50,2,50)[0]'),200);
 run(`globalThis.group=[{team:'blue',hp:100,mass:1,moveSpeed:60,radius:20,position:{x:200,y:200}},{team:'blue',hp:100,mass:1,moveSpeed:60,radius:20,position:{x:158,y:200}},{team:'red',hp:100,mass:1,moveSpeed:100,radius:20,position:{x:242,y:200}}];FigurePhysics.resolveOverlaps({heroes:group,width:700,height:390,orientation:'landscape'},100)`);
 assert(run('group[2].position.x>242'),'supporting ally must add momentum');
 console.log('PASS: mass, speed, group support and equal pressure');
}
for(const axis of ['x','y']){
 const {run}=context();
 run('lateralAlignment=()=>0;engageSlotDirection=()=>null'); // Isolate involuntary push from intentional sidestepping and slot approach.
 run(`for(const f of F)f.hp=0;globalThis.light=F[0];globalThis.heavy=F[1];light.character='carrot';heavy.character='tomato';light.stats={...COMBAT_SPECS.carrot};heavy.stats={...COMBAT_SPECS.tomato,preferredRange:0,minimumRange:0};light.hp=heavy.hp=100;light.cool=heavy.cool=10;light.x=heavy.x=W*.5;light.y=heavy.y=H*.6;globalThis.contactGap=combatRadius(light)+combatRadius(heavy)+2*combatUnit()`);
 if(axis==='x')run('heavy.x=light.x+contactGap;light.facing=1;light.back=false');
 else run('heavy.y=light.y-contactGap;light.facing=1;light.back=true');
 run('globalThis.beforePush={x:light.x,y:light.y};stepCombat(.016)');
 if(axis==='x'){assert(run('light.x<beforePush.x'),'light must be pushed backward');assert.equal(run('light.facing'),1);assert.equal(run('light.back'),false)}
 else{assert(run('light.y>beforePush.y'),'light must be pushed downward');assert.equal(run('light.back'),true)}
 assert.equal(run('light.moving'),false,'involuntary push must not drive the walk cycle');
 console.log('PASS: collision preserves facing on axis',axis);
}
{
 const {run}=context();
 run(`for(const f of F)f.hp=0;globalThis.hunter=F[0];hunter.character='carrot';hunter.hp=100;hunter.x=100;hunter.y=200;globalThis.nearEnemy=F[1];nearEnemy.character='tomato';nearEnemy.stats={...COMBAT_SPECS.tomato};nearEnemy.hp=100;nearEnemy.x=130;nearEnemy.y=200;globalThis.rangedEnemy=F[3];rangedEnemy.character='pepper';rangedEnemy.stats={...COMBAT_SPECS.pepper};rangedEnemy.hp=100;rangedEnemy.x=600;rangedEnemy.y=200`);
 assert.equal(run('COMBAT_SPECS.tomato.attackRange'),100);
 assert(run('COMBAT_SPECS.tomato.attackRange<COMBAT_SPECS.pepper.attackRange'));
 assert(run('chooseCombatTarget(hunter)===nearEnemy'),'carrot chooses nearest even if distant enemy has more range');
 run('nearEnemy.hp=0');assert(run('chooseCombatTarget(hunter)===rangedEnemy'),'carrot ignores dead nearest enemy');
 run('nearEnemy.hp=100;nearEnemy.x=650');assert(run('chooseCombatTarget(hunter)===rangedEnemy'),'carrot reselects when relative distances change');
 run('nearEnemy.x=130;rangedEnemy.stats.attackRange=300');assert(run('chooseCombatTarget(hunter)===nearEnemy'),'attack range must not affect carrot priority');
 run("hunter.character='tomato';nearEnemy.stats.attackRange=1;rangedEnemy.stats.power=200");assert(run('chooseCombatTarget(hunter)===nearEnemy'),'tomato must target nearest regardless of strength');
 run("hunter.character='pepper';nearEnemy.hp=80;nearEnemy.max=500;nearEnemy.stats.power=90;rangedEnemy.hp=150;rangedEnemy.max=160;rangedEnemy.stats.power=10");assert(run('chooseCombatTarget(hunter)===rangedEnemy'),'pepper chooses highest current HP, not attack, maximum HP or distance');
 run('rangedEnemy.hp=0');assert(run('chooseCombatTarget(hunter)===nearEnemy'),'pepper ignores dead target');
 run('rangedEnemy.hp=50');assert(run('chooseCombatTarget(hunter)===nearEnemy'),'pepper retargets after HP changes');
 run('rangedEnemy.hp=nearEnemy.hp');assert(run('chooseCombatTarget(hunter)===nearEnemy'),'equal current HP: nearest enemy');
 console.log('PASS: carrot and tomato nearest-target priority; pepper highest HP; death and tie-break');
}
{
 const {run}=context();
 run(`globalThis.walker=F[0];walker.character='carrot';walker.hp=100;walker.cast=0;walker.vx=10;walker.vy=0;walker.walk=0;globalThis.cycle=walkCycleDistance(walker);walker.vx=cycle*.1;advanceWalkCycle(walker,cycle*.1,0,1);globalThis.slowPhase=walker.walk;walker.walk=0;walker.vx=cycle*.2;advanceWalkCycle(walker,cycle*.2,0,1);globalThis.fastPhase=walker.walk`);
 assert(Math.abs(run('fastPhase-2*slowPhase'))<1e-10,'double movement speed must double gait speed');
 run(`walker.walk=.25;walker.vx=0;walker.vy=0;advanceWalkCycle(walker,30,0,1)`);assert.equal(run('walker.walk'),.25);assert.equal(run('walker.moving'),false,'external push must not walk');
 run(`walker.vx=10;advanceWalkCycle(walker,-20,0,1)`);assert.equal(run('walker.walk'),.25,'backward push must not walk');
 run('advanceWalkCycle(walker,0,0,1)');assert.equal(run('walker.walk'),.25,'blocked fighter must not walk');
 assert.equal(run('advanceWalkCycle(walker,50,0,1)'),10,'forward push cannot accelerate gait');
 run(`globalThis.originalScale=characterProfiles.carrot.scale;characterProfiles.carrot.scale=1;globalThis.cycleOne=walkCycleDistance(walker);characterProfiles.carrot.scale=1.15;globalThis.cycleBig=walkCycleDistance(walker);characterProfiles.carrot.scale=originalScale`);
 assert(Math.abs(run('cycleBig/cycleOne-1.15'))<1e-10,'render scale must affect stride');
 run(`walker.walk=0;walker.vx=cycle*.4;for(let i=0;i<60;i++)advanceWalkCycle(walker,walker.vx/60,0,1/60);globalThis.phase60=walker.walk;walker.walk=0;for(let i=0;i<30;i++)advanceWalkCycle(walker,walker.vx/30,0,1/30);globalThis.phase30=walker.walk`);
 assert(Math.abs(run('phase60-phase30'))<1e-10,'gait must not depend on frame rate');
 console.log('PASS: distance-driven gait, speed, scale, blocked/pushed motion and frame-rate independence');
}
for(const kind of ['smoke','sparks']){
 const {run,el}=context();
 run(`globalThis.mixedPose=()=>({naturalWidth:1024,naturalHeight:1536});globalThis.mixedFlip=()=>1;globalThis.drawCalls=0;for(const method of ['save','restore','translate','scale','rotate','beginPath','arc','ellipse','fill','fillRect'])g[method]=()=>{};g.drawImage=()=>drawCalls++;globalThis.victim=F[1];victim.hp=0;beginDeathEffect(victim,'${kind}');drawDeathEffects()`);
 assert.equal(run('deathEffects.length'),1);assert.equal(run('deathEffects[0].kind'),kind);
 assert(run('deathEffects[0].parts.length>30&&drawCalls>0'));
 assert(run('deathEffects[0].parts.every(p=>p.sx===undefined&&p.sy===undefined&&p.sw===undefined)'), 'death must not contain sprite fragments');
 run('beginDeathEffect(victim)');assert.equal(run('deathEffects.length'),1,'death effect must not repeat');
 run('advanceDeathEffects(.2)');assert(run('deathEffects[0].parts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))'));
 run('advanceDeathEffects(2)');assert.equal(run('deathEffects.length'),0);
 el('#restartMotion').click();assert(run('F.every(f=>!f.deathPlayed)'));
 console.log('PASS: death mode',kind,'renders, animates, expires and resets');
}
{
 const {run,el}=context();
 run(`for(const f of F)f.hp=0;F[0].hp=100;F[1].hp=1;auto=true;document.querySelector('#battleResult').hidden=true;hurt(F[1],5);globalThis.deathCount=deathEffects.length;hurt(F[1],5);update(.016)`);
 assert.equal(run('deathCount'),1);assert.equal(run('deathEffects.length'),1);
 assert(run('battleEnding&&!auto&&shots.length===0'));
 assert.equal(el('#battleResult').hidden,true,'result waits for final death');
 assert.equal(el('#auto').disabled,true);
 run('update(.5)');assert(run('deathEffects[0].age>.4'),'effect must advance after combat stops');
 assert.equal(el('#battleResult').hidden,true);
 run('update(2)');assert.equal(run('battleEnding'),false);assert.equal(el('#battleResultText').textContent,'Вы победили');
 assert.equal(el('#battleResult').hidden,false);assert.equal(el('#auto').disabled,false);
 el('#restartMotion').click();assert(run('deathEffects.length===0&&!battleEnding'));assert.equal(el('#battleResult').hidden,true);
 console.log('PASS: lethal hit triggers death once; final effect finishes before result, without frozen shots');
}
for(const outcome of ['win','loss','draw']){
 const {run,el}=context();
 run(`for(const f of F){f.hp=0;f.moving=true;f.cast=.3;f.hit=.1;f.vx=10;f.vy=5;f.pendingFire={t:1};f.melee={t:1}};shots=[{x:1,y:2}];sparks=[{t:1}];floaters=[{t:1}];auto=true;time=100`);
 if(outcome==='win')run('F[0].hp=100');
 if(outcome==='loss')run('F[1].hp=100');
 if(outcome==='draw')run('F[0].hp=F[0].max;F[1].hp=F[1].max;F[2].hp=F[2].max;F[3].hp=F[3].max;F[4].hp=F[4].max;F[5].hp=F[5].max;time=0');
 run('update(.016)');
 assert.equal(run('auto'),false);assert(run('shots.length===0&&sparks.length===0&&floaters.length===0'));
 assert(run('F.every(f=>!f.moving&&f.cast===0&&f.hit===0&&!f.pendingFire&&!f.melee&&f.vx===0&&f.vy===0)'),'finish must leave fighters idle');
 assert.equal(el('#battleResult').hidden,false);assert.equal(el('#battleResult').dataset.outcome,outcome);
 assert.equal(el('#battleResultText').textContent,{win:'Вы победили',loss:'Вы проиграли',draw:'Ничья'}[outcome]);
 el('#restartMotion').click();assert.equal(el('#battleResult').hidden,true);
 console.log('PASS: result',outcome,'clears shots, idles fighters and resets banner');
}
{
 const {run}=context();
 run(`for(const f of F)f.hp=0;globalThis.tomA=F[0];globalThis.tomB=F[1];for(const f of [tomA,tomB]){f.character='tomato';f.stats={...COMBAT_SPECS.tomato};f.hp=f.max=240;f.cool=100;f.y=H*.6}tomA.x=W*.25;tomB.x=W*.75;for(let i=0;i<500;i++)stepCombat(.016)`);
 assert(run('attackDistance(tomA,tomB)>60*combatUnit()&&inAttackRange(tomA,tomB)'),'two tomatoes must stop apart within shooting range');
 assert(run('!tomA.moving&&!tomB.moving'),'tomatoes must stop closing at preferred range');
 run(`tomB.x=tomA.x+combatRadius(tomA)+combatRadius(tomB)+10*combatUnit();tomA.facing=1;globalThis.tomOldX=tomA.x;stepCombat(.016)`);
 assert(run('tomA.retreating&&tomA.x<tomOldX&&tomA.facing===1'),'close tomato must backpedal while facing enemy');
 console.log('PASS: tomatoes retain visible shooting gap and backpedal when crowded');
}
for(const edge of ['center','left','right']){
 const {run}=context();
 run(`for(const f of F)f.hp=0;globalThis.leftActor=F[0];globalThis.rightActor=F[1];for(const f of [leftActor,rightActor]){f.character='tomato';f.stats={...COMBAT_SPECS.tomato};f.hp=f.max=240;f.cool=100;f.x=W*.5}leftActor.y=H*.30;rightActor.y=H*.70`);
 if(edge==='left')run('leftActor.x=rightActor.x=combatRadius(leftActor)+1');
 if(edge==='right')run('leftActor.x=rightActor.x=W-combatRadius(leftActor)-1');
 run('for(let i=0;i<500;i++)stepCombat(.016)');
 assert(run('Math.abs(leftActor.x-rightActor.x)>combatRadius(leftActor)'), 'vertical opponents must separate laterally');
 assert(run('leftActor.facing===1&&rightActor.facing===-1'),'opponents must face each other, not their sidestep');
 assert(run('F.filter(f=>f.hp>0).every(f=>f.x>=combatRadius(f)-.01&&f.x<=W-combatRadius(f)+.01)'),'sidestep must stay inside arena');
 assert(run('attackDistance(leftActor,rightActor)>0'),'sidestep must preserve solid bodies');
 console.log('PASS: vertical alignment resolves with stable facing at',edge);
}
{
 const {run}=context();
 run('Math=Object.create(Math);globalThis.randomValue=0;Math.random=()=>randomValue;globalThis.clockFighter=F[0];clockFighter.stats.attackInterval=1');
 assert(Math.abs(run('attackReactionDelay(clockFighter)')-.08)<1e-10);
 assert(Math.abs(run('nextAttackInterval(clockFighter)')-.88)<1e-10);
 run('randomValue=1');
 assert(Math.abs(run('attackReactionDelay(clockFighter)')-.36)<1e-10);
 assert(Math.abs(run('nextAttackInterval(clockFighter)')-1.12)<1e-10);
 run('randomValue=.5');assert.equal(run('nextAttackInterval(clockFighter)'),1,'nominal interval is preserved at midpoint');
 run(`globalThis.rngIndex=0;Math.random=()=>rngIndex++%2?1:0;for(const f of F)f.hp=0;globalThis.shooterA=F[0];globalThis.shooterB=F[1];for(const f of [shooterA,shooterB]){f.character='tomato';f.stats={...COMBAT_SPECS.tomato,attackInterval:1,moveSpeed:0,power:1,defense:0};f.hp=f.max=10000;f.cool=-10;f.cast=0;f.y=H*.6;f.attackEngaged=false;f.attackTarget=null}shooterA.x=W*.3;shooterB.x=shooterA.x+combatRadius(shooterA)+combatRadius(shooterB)+80*combatUnit();globalThis.timesA=[];globalThis.timesB=[];for(let i=0;i<350;i++){const a=shooterA.cast,b=shooterB.cast;stepCombat(.01);if(a<=0&&shooterA.cast>0)timesA.push(i*.01);if(b<=0&&shooterB.cast>0)timesB.push(i*.01)}`);
 assert(run('timesA.length>=3&&timesB.length>=3'),'both fighters must keep firing');
 assert(run('timesA[0]>=.07&&timesB[0]-timesA[0]>.15'),'first shots must be staggered even after cooldown expired during approach');
 assert(run('[timesA,timesB].every(ts=>ts.slice(1).every((t,i)=>t-ts[i]>=.87&&t-ts[i]<=1.14))'),'jitter must stay small and not re-arm reaction every shot');
 console.log('PASS: random engagement delay, bounded cadence jitter and desynchronised continuous fire');
}
for(const direction of ['right','left','up','down']){
 const {run}=context();
 run(`for(const f of F)f.hp=0;globalThis.archer=F[0];globalThis.foe=F[1];archer.character='pepper';foe.character='carrot';archer.stats={...COMBAT_SPECS.pepper};foe.stats={...COMBAT_SPECS.carrot,moveSpeed:0};archer.hp=foe.hp=100;archer.cool=foe.cool=10;archer.x=foe.x=W*.5;archer.y=foe.y=H*.6;globalThis.nearGap=combatRadius(archer)+combatRadius(foe)+20*combatUnit()`);
 const axis=direction==='left'||direction==='right'?'x':'y';
 const sign=direction==='right'||direction==='down'?1:-1;
 run(`foe.${axis}=archer.${axis}+nearGap*${sign};globalThis.beforeRetreat=archer.${axis};stepCombat(.016)`);
 assert(run('archer.retreating&&archer.moving'),'ranged fighter must retreat');
 assert(run(`(archer.${axis}-beforeRetreat)*${sign}<0`),'must move away from enemy');
 if(axis==='x')assert.equal(run('archer.facing'),sign,'must keep facing the enemy');
 assert.equal(run('archer.back'),direction==='up','back/front must face enemy, not retreat direction');
 console.log('PASS: backpedal facing enemy',direction);
}
for(const layout of ['mobile-horizontal','mobile-vertical','mobile-arena']){
 const {run,el}=context(layout);
 assert.equal(run('F.length'),6);assert(run('F.every(f=>f.hp===f.stats.max&&f.stats.mass>0)'));
 run(`globalThis.pauseState=JSON.stringify(F);update(.5)`);assert(run('JSON.stringify(F)===pauseState'),'pause must freeze combat');
 run(`for(const f of F)f.hp=0;globalThis.a=F[0];globalThis.b=F[1];a.hp=b.hp=100;a.x=W*.3;a.y=H*.6;b.y=a.y;b.x=a.x+combatRadius(a)+combatRadius(b)+a.stats.attackRange*combatUnit()+1`);
 assert(!run('inAttackRange(a,b)'));run('b.x-=2');assert(run('inAttackRange(a,b)'));
 run(`a.character='carrot';a.stats={...COMBAT_SPECS.carrot};a.cast=0;b.x=a.x+combatRadius(a)+combatRadius(b)+10*combatUnit();fire(a,b);b.x=W*2;auto=true;stepCombat(.25)`);
 assert.equal(run('b.hp'),100,'melee must miss if target leaves during windup');
 el('#restartMotion').click();el('#auto').click();assert(run('auto'));
 for(let i=0;i<1500;i++)run('update(.08)');
 assert(run('F.every(f=>Number.isFinite(f.x)&&Number.isFinite(f.y)&&f.hp>=0&&f.hp<=f.max)'),'invalid battle state');
 assert(run('time<BATTLE_TIME'));assert(!run('auto'),'battle must finish');
 assert(run('!shots.some(s=>!Number.isFinite(s.x)||!Number.isFinite(s.y))'));
 el('#restartMotion').click();assert(!run('auto'));assert.equal(run('time'),run('BATTLE_TIME'));assert(run('F.every(f=>f.hp===f.max&&!f.pendingFire&&!f.melee)'));
 console.log('PASS:',layout,'range, melee miss, pause, complete fight and reset');
}







