// Desynchronise attacks without changing their nominal average interval.
function attackReactionDelay(f){return .08+Math.random()*Math.min(.28,f.stats.attackInterval*.3)}
function nextAttackInterval(f){return Math.max(.44,f.stats.attackInterval*(.88+Math.random()*.24))}

// Front-only sprites need a readable horizontal angle before engaging.
function lateralAlignment(f,t,dx,dy,d){
 const unit=combatUnit();
 if(f.alignmentTarget!==t){f.alignmentTarget=t;f.aligning=false;f.alignSide=0}
 const near=d<=(f.stats.attackRange*rangeMultiplier()+f.stats.radius+t.stats.radius+40)*unit;
 const goal=Math.max((combatRadius(f)+combatRadius(t))*.9,Math.abs(dy)*.8);
 if(!near||Math.abs(dy)<8*unit||Math.abs(dx)>=goal){f.aligning=false;return 0}
 if(!f.aligning&&Math.abs(dx)<goal*.55){
  f.aligning=true;
  // Preserve each pair's left/right order; exact ties use a stable fighter ID.
  f.alignSide=Math.abs(dx)>.5*unit?(dx>0?-1:1):(F.indexOf(f)<F.indexOf(t)?-1:1);
 }
 return f.aligning?f.alignSide:0;
}

// Full gait-cycle distance in screen pixels; independent of sprite frame count.
function walkCycleDistance(f){const p=characterProfiles[f.character];return Math.max(.001,baseScale()*1100*(p.scale||1)*p.strideLength/p.visualHeight)}
function advanceWalkCycle(f,dx,dy,dt){
 const ownSpeed=Math.hypot(f.vx,f.vy);
 // Reject sideways/backward pushes and cap forward travel at self-propelled travel.
 const projected=ownSpeed>.001?(dx*f.vx+dy*f.vy)/ownSpeed:0;
 const ownTravel=Math.min(Math.max(0,projected),ownSpeed*Math.max(0,dt));
 f.moving=f.hp>0&&f.cast<=0&&ownTravel>.001;
 if(f.moving)f.walk=((f.walk||0)+ownTravel/walkCycleDistance(f))%1;
 return ownTravel;
}
// Death uses particles only: no sprite pieces or juice.
function beginDeathEffect(f,kind=['smoke','sparks'][Math.floor(Math.random()*2)]){
 if(f.deathPlayed)return;
 if(kind!=='smoke'&&kind!=='sparks')kind='sparks';
 f.deathPlayed=true;f.pendingFire=null;f.melee=null;f.moving=false;
 const profile=characterProfiles[f.character],z=baseScale()*1100*(profile.scale||1)/profile.visualHeight;
 const image=typeof mixedPose==='function'?mixedPose(f):null,flip=typeof mixedFlip==='function'?mixedFlip(f):(f.facing||1);
 const h=profile.visualHeight*z,e={kind,x:f.x,y:f.y,z,h,image,flip,profile,age:0,duration:1.3,parts:[]};
 for(let i=0;i<55;i++){
  const a=Math.random()*Math.PI*2,v=h*(.4+Math.random()*1.6);
  e.parts.push({x:f.x+(Math.random()-.5)*h*.55,y:f.y-h*(.08+Math.random()*.85),vx:kind==='smoke'?(Math.random()-.5)*h*.4:Math.cos(a)*v,vy:kind==='smoke'?-h*(.3+Math.random()*.7):Math.sin(a)*v-h*.4,size:h*(kind==='smoke'?.025+Math.random()*.055:.012+Math.random()*.02),tint:i%3});
 }
 deathEffects.push(e);
}
function advanceDeathEffects(dt){
 for(const e of deathEffects){e.age+=dt;for(const p of e.parts){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-1.6*dt);p.vy+=(e.kind==='smoke'?-e.h*.3:e.h*1.7)*dt}}
 deathEffects=deathEffects.filter(e=>e.age<e.duration);
}
function drawDeathEffects(){
 for(const e of deathEffects){
  g.save();const fade=Math.max(0,1-e.age/e.duration);
  // Fade the intact character briefly; never cut it into rectangular images.
  if(e.image&&e.age<.25){g.save();g.globalAlpha=Math.max(0,1-e.age/.25);g.translate(e.x,e.y);g.scale(e.flip,1);g.drawImage(e.image,-e.profile.anchor.x*e.z,-e.profile.anchor.y*e.z,Math.max(e.profile.canvas.width,e.image.naturalWidth)*e.z,e.profile.canvas.height*e.z);g.restore()}
  for(const p of e.parts){
   g.save();g.translate(p.x,p.y);
   if(e.kind==='smoke'){g.globalAlpha=fade*.38;g.fillStyle=['#77736d','#8c8984','#555451'][p.tint];g.beginPath();g.arc(0,0,Math.max(.5,p.size*(1+e.age*1.2)),0,Math.PI*2);g.fill()}
   else{g.globalCompositeOperation='lighter';g.globalAlpha=fade;g.rotate(Math.atan2(p.vy,p.vx));g.fillStyle=['#fff4bd','#ffc247','#ff7329'][p.tint];g.fillRect(-p.size*2,-p.size*.35,Math.max(1,p.size*4),Math.max(.7,p.size*.7))}
   g.restore();
  }
  g.restore();
 }
}

// Base profiles from the schematic battle; tomato range and carrot targeting are customized.
const COMBAT_SPECS = {
 tomato:{role:'Страж',max:240,power:22,defense:12,attackInterval:1.15,moveSpeed:38,mass:3,attackRange:100,preferredRange:80,minimumRange:30,radius:23},
 pepper:{role:'Стрелок',max:145,power:31,defense:6,attackInterval:.95,moveSpeed:55,mass:1.7,attackRange:125,preferredRange:100,minimumRange:35,radius:20},
 carrot:{role:'Быстрый боец',max:120,power:43,defense:3,attackInterval:.8,moveSpeed:78,mass:1.2,attackRange:27,preferredRange:0,minimumRange:0,radius:19}
};
function combatUnit(){return layout==='mobile-horizontal'?Math.min(W/700,H/390):Math.min(W/390,H/700)}
function combatRadius(f){return (f.stats?.radius||20)*combatUnit()}
function rangeMultiplier(){return +document.querySelector('#attackRange').value/100}
function speedMultiplier(){return +document.querySelector('#moveSpeed').value/100}
function attackDistance(f,t){return Math.hypot(t.x-f.x,t.y-f.y)-combatRadius(f)-combatRadius(t)}
function chooseCombatTarget(f){return alive(1-f.team).reduce((best,q)=>{if(!best)return q;if(f.character==='pepper'&&q.hp!==best.hp)return q.hp>best.hp?q:best;return Math.hypot(q.x-f.x,q.y-f.y)<Math.hypot(best.x-f.x,best.y-f.y)?q:best},null)}
function inAttackRange(f,t){return t&&t.hp>0&&attackDistance(f,t)<=f.stats.attackRange*rangeMultiplier()*combatUnit()+.1}
function clampFighter(f){const r=combatRadius(f);f.x=Math.max(r,Math.min(W-r,f.x));f.y=Math.max(Math.max(r,baseScale()*1150+10),Math.min(H-Math.max(12,r),f.y))}
function resetCombatStats(){for(const f of F){f.stats={...COMBAT_SPECS[f.character]};f.max=f.stats.max;f.hp=f.max;f.vx=0;f.vy=0}renderCombatSettings()}
function renderCombatSettings(){const host=document.querySelector('#fighterStats');if(!host)return;host.innerHTML=F.map((f,i)=>`<fieldset><legend>${f.team?'Красные':'Синие'} · ${{pepper:'Перец',tomato:'Помидор',carrot:'Морковь'}[f.character]} · ${f.stats.role}</legend>${[['attackRange','Дальность',0,350,1],['attackInterval','Интервал, с',.45,5,.05],['moveSpeed','Скорость',1,150,1],['mass','Масса',.1,10,.1]].map(([key,label,min,max,step])=>`<label>${label}<input type="number" data-fighter="${i}" data-stat="${key}" aria-label="${f.team?'Красные':'Синие'} ${f.character} ${label}" min="${min}" max="${max}" step="${step}" value="${f.stats[key]}"></label>`).join('')}<small>Давление: <output data-momentum="${i}">${(f.stats.mass*f.stats.moveSpeed).toFixed(1)}</output> · масса × скорость</small></fieldset>`).join('');host.onchange=e=>{const i=Number(e.target.dataset.fighter),key=e.target.dataset.stat;if(!key||!F[i])return;const n=Number(e.target.value),min=Number(e.target.min),max=Number(e.target.max);if(!Number.isFinite(n))return;F[i].stats[key]=Math.max(min,Math.min(max,n));e.target.value=F[i].stats[key];host.querySelector(`[data-momentum="${i}"]`).textContent=(F[i].stats.mass*F[i].stats.moveSpeed*speedMultiplier()).toFixed(1)}}
function separateFighters(dt=0){
 const unit=combatUnit();if(!unit)return;
 const living=F.filter(f=>f.hp>0),heroes=living.map(f=>({id:String(F.indexOf(f)),team:f.team===0?'blue':'red',hp:f.hp,mass:f.stats.mass,moveSpeed:f.stats.moveSpeed*speedMultiplier(),radius:f.stats.radius,position:{x:f.x/unit,y:f.y/unit}}));
 FigurePhysics.resolveOverlaps({heroes,width:W/unit,height:H/unit,orientation:layout==='mobile-horizontal'?'landscape':'portrait'},dt*1000);
 heroes.forEach((h,i)=>{living[i].x=h.position.x*unit;living[i].y=h.position.y*unit;clampFighter(living[i])});
 // The sprite's head imposes a higher top boundary than the abstract circles.
 // Re-solve at that boundary without another pressure step.
 for(let pass=0;pass<4;pass++){
  heroes.forEach((h,i)=>{h.position.x=living[i].x/unit;h.position.y=living[i].y/unit});
  FigurePhysics.resolveOverlaps({heroes,width:W/unit,height:H/unit,orientation:layout==='mobile-horizontal'?'landscape':'portrait'},0);
  heroes.forEach((h,i)=>{living[i].x=h.position.x*unit;living[i].y=h.position.y*unit;clampFighter(living[i])});
 }
}

const layout=document.documentElement.dataset.layout||'mobile-arena';

const c=document.querySelector('#cv'),g=c.getContext('2d'),arena=document.querySelector('#arena');let W=0,H=0,last=performance.now(),energy=5,time=120,auto=false,rate=1,shots=[],sparks=[],floaters=[],deathEffects=[],battleEnding=false;
const F=[];for(let i=0;i<3;i++){F.push({team:0,lane:i,hp:100,max:100,cool:0,state:'idle',hit:0,cast:0});F.push({team:1,lane:i,hp:100,max:100,cool:0,state:'idle',hit:0,cast:0})}function assignTeamCharacters(){let order=['pepper','tomato','carrot'];for(let i=2;i>0;i--){let j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}let offset=1+Math.floor(Math.random()*2);for(const f of F)f.character=order[(f.lane+(f.team?offset:0))%3];resetCombatStats()}assignTeamCharacters();function resize(){let r=arena.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);W=r.width;H=r.height;c.width=W*d;c.height=H*d;g.setTransform(d,0,0,d,0,0);place()}function place(){for(const f of F){if(layout==='mobile-vertical'){f.x=W*(.20+f.lane*.30);f.y=H*(f.team===0?.40:.88)}else if(layout==='mobile-horizontal'){f.x=W*(f.team===0?.22:.78);f.y=H*(.36+f.lane*.29)}else{f.x=f.team?W*.76:W*.24;f.y=H*(.34+f.lane*.27)+(f.team?8:-8)}}}addEventListener('resize',resize);resize();
function alive(team){return F.filter(f=>f.team===team&&f.hp>0)}function glow(x,y,r,col,a){let q=g.createRadialGradient(x,y,0,x,y,r);q.addColorStop(0,col.replace('A',a));q.addColorStop(1,col.replace('A','0'));g.fillStyle=q;g.beginPath();g.arc(x,y,r,0,7);g.fill()}function burst(x,y,col='rgba(255,122,26,A)'){for(let i=0;i<22;i++){let a=Math.random()*7,v=35+Math.random()*150;sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:.25+Math.random()*.35,max:.6,col})}}function baseScale(){return layout==='mobile-horizontal'?.85*Math.min(W*.18/1100,H*.25/1100):layout==='mobile-vertical'?.85*Math.min(W/4600,H*.23/1100):.85*Math.min(W/3900,H*.24/1100)}function worldUnit(){return layout==='mobile-arena'?W/941:Math.min(W/941,H/950)}function socket(f){return mixedSocket(f)}function spawnProjectile(from,to,mult){if(from.hp<=0||to.hp<=0)return;const p=socket(from);shots.push({x:p.x,y:p.y,to,from,kind:from.character,dmg:Math.max(1,Math.round(from.stats.power*mult-to.stats.defense)),trail:[],spin:Math.random()*7})}function fire(from,to,mult=1){if(from.hp<=0||!inAttackRange(from,to)||from.cast>0)return;from.cast=.42;if(from.character==='carrot'){from.melee={target:to,t:.2,dmg:Math.max(1,Math.round(from.stats.power*mult-to.stats.defense))};return}from.pendingFire={to,mult,t:.16}}function hurt(f,d){if(f.hp<=0)return;f.hp=Math.max(0,f.hp-d);if(f.hp===0)beginDeathEffect(f);f.hit=.22;burst(f.x,f.y-45);floaters.push({x:f.x,y:f.y-85,text:'-'+d,t:.8});sync()}function sync(){let a=alive(0).reduce((s,f)=>s+100*f.hp/f.max,0)/3,b=alive(1).reduce((s,f)=>s+100*f.hp/f.max,0)/3;redHp.style.width=a+'%';blueHp.style.width=b+'%';energyText.textContent=Math.floor(energy)+'/10';cells.innerHTML=Array.from({length:10},(_,i)=>`<i class="cell ${i<Math.floor(energy)?'on':''}"></i>`).join('');document.querySelectorAll('.skill').forEach(x=>x.disabled=!auto||+x.dataset.cost>energy)}
function act(kind){if(!auto)return;let cost=kind==='blast'||kind==='heal'?4:3;if(energy<cost)return;energy-=cost;if(kind==='heal'){for(const f of alive(0))f.hp=Math.min(f.max,f.hp+24);for(const f of alive(0))burst(f.x,f.y-45,'rgba(131,255,84,A)')}else if(kind==='rush'){for(const f of alive(1))hurt(f,10)}else{let targets=alive(1);for(const f of alive(0)){let t=targets[f.lane%targets.length];if(t)fire(f,t,kind==='blast'?1.7:1)}}sync()}document.querySelectorAll('.skill').forEach(x=>x.onclick=()=>act(x.dataset.kind));document.querySelector('#auto').onclick=()=>{if(battleEnding)return;if(!alive(0).length||!alive(1).length||time<=0){document.querySelector('#restartMotion').click();return}auto=!auto;if(auto){battleStarted=true;selectedFighter=null;positionDrag=null;document.querySelector('#positionHint').hidden=true}for(const f of F)f.moving=false;document.querySelector('#auto').classList.toggle('active',auto);document.querySelector('#auto').textContent=auto?'Пауза':'Продолжить';sync()};speed.onclick=()=>{rate=rate===1?2:1;speed.textContent=`×${rate} ▶`};
function finishCombat(){
 auto=false;shots=[];sparks=[];floaters=[];
 for(const f of F){f.pendingFire=null;f.melee=null;f.cast=0;f.hit=0;f.moving=false;f.retreating=false;f.vx=0;f.vy=0;f.stepStart=null}
 battleEnding=deathEffects.length>0;
 if(battleEnding){document.querySelector('#battleResult').hidden=true;document.querySelector('#auto').disabled=true;document.querySelector('#auto').textContent='Завершение…';document.querySelector('#auto').classList.remove('active');sync()}
 else showBattleResult();
}
function showBattleResult(){
 battleEnding=false;document.querySelector('#auto').disabled=false;
 const win=alive(0).length>0&&alive(1).length===0,loss=alive(0).length===0&&alive(1).length>0;
 const result=document.querySelector('#battleResult');result.dataset.outcome=win?'win':loss?'loss':'draw';
 document.querySelector('#battleResultText').textContent=win?'Вы победили':loss?'Вы проиграли':'Ничья';
 document.querySelector('#battleResultDetail').textContent=win?'Отряд противника побеждён':loss?'Ваш отряд побеждён':time<=0?'Время боя истекло':'Оба отряда побеждены';
 result.hidden=false;
 document.querySelector('#auto').classList.remove('active');document.querySelector('#auto').textContent='Новый бой';sync();
}
function update(dt){
 if(battleEnding){advanceDeathEffects(dt*rate);if(!deathEffects.length)showBattleResult();return}
 if(!auto)return;dt*=rate;
 // Short physics steps keep contact pressure stable at both playback speeds.
 const count=Math.max(1,Math.ceil(dt/.016));
 for(let i=0;i<count;i++)stepCombat(dt/count);
 advanceDeathEffects(dt);
 timer.textContent=`${String(Math.floor(time/60)).padStart(2,'0')}:${String(Math.floor(time%60)).padStart(2,'0')}`;sync();
 if(!alive(0).length||!alive(1).length||time<=0)finishCombat();
}
function stepCombat(dt){
 if(!alive(0).length||!alive(1).length||time<=0)return;
 time=Math.max(0,time-dt);energy=Math.min(10,energy+dt*.35);
 for(const f of F){f.stepStart={x:f.x,y:f.y};f.moving=false;f.retreating=false;f.vx=0;f.vy=0;f.cool-=dt;f.hit=Math.max(0,f.hit-dt);f.cast=Math.max(0,f.cast-dt)}
 // Plan from one snapshot, then integrate together: neither team moves first.
 for(const f of F){
  if(f.hp<=0)continue;
  const t=chooseCombatTarget(f);
  if(!t)continue;f.target=t;
  const dx=t.x-f.x,dy=t.y-f.y,d=Math.max(.001,Math.hypot(dx,dy)),gap=attackDistance(f,t),unit=combatUnit(),range=f.stats.attackRange*rangeMultiplier()*unit;
  let nx=dx/d,ny=dy/d,move=false,retreat=false;
  if(f.stats.preferredRange>0){
   const preferred=Math.min(f.stats.preferredRange*rangeMultiplier()*unit,range),tolerance=8*unit;
   if(gap<Math.max(f.stats.minimumRange*unit,preferred-tolerance)){nx=-nx;ny=-ny;move=true;retreat=true}
   else if(gap>preferred+tolerance)move=true;
  }else move=gap>0;
  const lateral=lateralAlignment(f,t,dx,dy,d);
  if(lateral){const lx=lateral+(retreat?nx:0),ly=retreat?ny:0,len=Math.hypot(lx,ly);nx=lx/len;ny=ly/len;move=true}
  if(f.cast>0)move=false;
  if(move){f.vx=nx*f.stats.moveSpeed*speedMultiplier()*unit;f.vy=ny*f.stats.moveSpeed*speedMultiplier()*unit;f.retreating=retreat;const lookX=retreat||f.aligning?dx/d:nx,lookY=retreat||f.aligning?dy/d:ny;f.back=lookY<0;if(Math.abs(lookX)>.001)f.facing=lookX>=0?1:-1;else if(f.aligning)f.facing=-f.alignSide}
  if(!move){f.back=dy<0;if(Math.abs(dx)>.1)f.facing=dx>=0?1:-1}
  const engagement=!f.aligning&&inAttackRange(f,t);
  if(engagement&&(!f.attackEngaged||f.attackTarget!==t))f.cool=Math.max(f.cool,attackReactionDelay(f));
  f.attackEngaged=engagement;f.attackTarget=engagement?t:null;
  if(engagement&&f.cool<=0&&f.cast<=0){fire(f,t);f.cool=nextAttackInterval(f)}
 }
 for(const f of F)if(f.hp>0){f.x+=f.vx*dt;f.y+=f.vy*dt;clampFighter(f)}
 separateFighters(dt);
 for(const f of F){
  if(f.hp<=0){f.pendingFire=null;f.melee=null;continue}
  const dx=f.x-f.stepStart.x,dy=f.y-f.stepStart.y;
  advanceWalkCycle(f,dx,dy,dt)
  if(f.pendingFire){f.pendingFire.t-=dt;if(f.pendingFire.t<=0){const shot=f.pendingFire;f.pendingFire=null;if(inAttackRange(f,shot.to))spawnProjectile(f,shot.to,shot.mult)}}
  if(f.melee){f.melee.t-=dt;if(f.melee.t<=0){const hit=f.melee;f.melee=null;if(inAttackRange(f,hit.target))hurt(hit.target,hit.dmg)}}
 }
 for(const s of shots){
  if(!s.to||s.to.hp<=0){s.dead=1;continue}
  s.trail.push({x:s.x,y:s.y,t:.22});if(s.trail.length>8)s.trail.shift();
  const dx=s.to.x-s.x,dy=s.to.y-baseScale()*500-s.y,d=Math.hypot(dx,dy),step=340*dt;
  if(d<=Math.max(combatRadius(s.to),step)){s.dead=1;if(s.kind==='tomato')burst(s.x,s.y,'rgba(225,28,18,A)');hurt(s.to,s.dmg);continue}
  s.x+=dx/d*step;s.y+=dy/d*step;s.spin+=dt*13;for(const q of s.trail)q.t-=dt;
 }
 shots=shots.filter(s=>!s.dead);
 for(const p of sparks){p.t-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-4*dt);p.vy*=Math.exp(-4*dt)}sparks=sparks.filter(p=>p.t>0);
 for(const p of floaters){p.t-=dt;p.y-=35*dt}floaters=floaters.filter(p=>p.t>0);
}

function drawTomatoShot(s){const r=6;g.save();g.translate(s.x,s.y);g.rotate(s.spin);let q=g.createRadialGradient(-r*.35,-r*.35,1,0,0,r);q.addColorStop(0,'#ff7a5c');q.addColorStop(.55,'#e3241a');q.addColorStop(1,'#9c1109');g.fillStyle=q;g.beginPath();g.ellipse(0,0,r,r*.88,0,0,7);g.fill();g.fillStyle='#3f8a22';g.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5,l=i%2?r*.18:r*.62;g.lineTo(Math.cos(a)*l,-r*.55+Math.sin(a)*l*.5)}g.closePath();g.fill();g.fillStyle='rgba(255,255,255,.55)';g.beginPath();g.ellipse(-r*.4,-r*.15,r*.18,r*.1,-.6,0,7);g.fill();g.restore()}function fighter(f){drawMixedFighter(f)}function render(){g.clearRect(0,0,W,H);if(selectedFighter&&!battleStarted){g.strokeStyle='#ffe167';g.lineWidth=2;g.beginPath();g.ellipse(selectedFighter.x,selectedFighter.y+3,baseScale()*350,baseScale()*95,0,0,7);g.stroke()}for(const f of [...F].sort((a,b)=>a.y-b.y))fighter(f);drawDeathEffects();g.globalCompositeOperation='lighter';for(const s of shots){if(s.kind==='tomato')continue;for(const q of s.trail)glow(q.x,q.y,12,'rgba(255,65,8,A)',Math.max(0,q.t/.22)*.4);glow(s.x,s.y,18,'rgba(255,60,8,A)',.9);glow(s.x,s.y,11,'rgba(255,210,55,A)',1);glow(s.x,s.y,5,'rgba(255,255,225,A)',1)}for(const p of sparks)glow(p.x,p.y,8,p.col,Math.max(0,p.t/p.max));g.globalCompositeOperation='source-over';for(const s of shots)if(s.kind==='tomato')drawTomatoShot(s);for(const p of floaters){g.globalAlpha=Math.max(0,p.t/.8);g.fillStyle='#ff472c';g.font='1000 24px system-ui';g.textAlign='center';g.fillText(p.text,p.x,p.y)}g.globalAlpha=1}function frame(n){let dt=Math.min(.04,(n-last)/1000);last=n;update(dt);render();requestAnimationFrame(frame)}mixedReady.then(()=>{sync();requestAnimationFrame(frame)});
function physicalRadius(){return layout==='mobile-horizontal'?Math.min(W*.04,H*.09):layout==='mobile-vertical'?Math.min(W*.06,H*.07):W*.065}document.querySelector('#attackRange').oninput=e=>document.querySelector('#rangeValue').textContent=e.target.value+'%';
document.querySelector('#moveSpeed').oninput=e=>{document.querySelector('#speedValue').textContent=e.target.value+'%';renderCombatSettings()};
document.querySelector('#restartMotion').onclick=()=>{assignTeamCharacters();place();shots=[];sparks=[];floaters=[];deathEffects=[];battleEnding=false;document.querySelector('#auto').disabled=false;time=120;energy=5;for(const f of F){f.hp=f.max;f.attackEngaged=false;f.attackTarget=null;f.alignmentTarget=null;f.aligning=false;f.alignSide=0;f.deathPlayed=false;f.melee=null;f.pendingFire=null;f.stepStart=null;f.cast=0;f.hit=0;f.cool=0;f.moving=false;f.back=false;f.walk=0;f.facing=f.team===0?1:-1}auto=false;battleStarted=false;selectedFighter=null;positionDrag=null;document.querySelector('#positionHint').hidden=false;document.querySelector('#battleResult').hidden=true;document.querySelector('#auto').classList.remove('active');document.querySelector('#auto').textContent='Начать бой';sync()};
document.querySelector('#shuffleTeams').onclick=()=>document.querySelector('#restartMotion').click();
let battleStarted=false,selectedFighter=null,positionDrag=null;
function positionAt(e){let r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
function boundPosition(f){clampFighter(f);separateFighters()}
c.addEventListener('pointerdown',e=>{if(battleStarted)return;e.preventDefault();let p=positionAt(e),h=baseScale()*1100,hit=F.filter(f=>f.hp>0&&Math.abs(p.x-f.x)<Math.max(24,h*.42)&&p.y>=f.y-h-8&&p.y<=f.y+15).sort((a,b)=>Math.hypot(p.x-a.x,p.y-(a.y-h*.5))-Math.hypot(p.x-b.x,p.y-(b.y-h*.5)))[0];if(hit){selectedFighter=hit;positionDrag={f:hit,ox:p.x-hit.x,oy:p.y-hit.y};c.setPointerCapture(e.pointerId)}else if(selectedFighter){selectedFighter.x=p.x;selectedFighter.y=p.y;boundPosition(selectedFighter);selectedFighter=null}});
c.addEventListener('pointermove',e=>{if(battleStarted||!positionDrag)return;e.preventDefault();let p=positionAt(e),f=positionDrag.f;f.x=p.x-positionDrag.ox;f.y=p.y-positionDrag.oy;boundPosition(f)});
c.addEventListener('pointerup',()=>positionDrag=null);c.addEventListener('pointercancel',()=>positionDrag=null);

document.querySelector('#restartBattle').onclick=()=>document.querySelector('#restartMotion').click();













