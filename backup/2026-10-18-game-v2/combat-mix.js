// Cache a thin alpha-silhouette outline at display size; original PNGs stay intact.
const enemyOutlineCache=new WeakMap();
function drawEnemyOutline(image,x,y,width,height){
 const key=width.toFixed(2)+'x'+height.toFixed(2);
 let cache=enemyOutlineCache.get(image);if(!cache){cache=new Map();enemyOutlineCache.set(image,cache)}
 let outline=cache.get(key);const pad=4;
 if(!outline){
  const mask=document.createElement('canvas');mask.width=Math.ceil(width)+pad*2;mask.height=Math.ceil(height)+pad*2;
  const m=mask.getContext('2d');m.drawImage(image,pad,pad,width,height);m.globalCompositeOperation='source-in';m.fillStyle='#ff5b37';m.fillRect(0,0,mask.width,mask.height);
  outline=document.createElement('canvas');outline.width=mask.width;outline.height=mask.height;const o=outline.getContext('2d');
  for(let i=0;i<12;i++){const angle=i*Math.PI/6;o.drawImage(mask,Math.cos(angle)*1.6,Math.sin(angle)*1.6)}
  o.globalCompositeOperation='destination-out';o.drawImage(mask,0,0);
  if(cache.size>=8)cache.clear();cache.set(key,outline);
 }
 g.save();g.filter='none';g.drawImage(outline,x-pad,y-pad);g.restore();
}

const characterProfiles={},mixedSprites={pepper:{},tomato:{},carrot:{}};
const mixedReady=Promise.all(['pepper','tomato','carrot'].map(async id=>{
 const response=await fetch('/assets/characters/'+id+'/manifest.json');if(!response.ok)throw Error('Missing character '+id);
 const profile=characterProfiles[id]=await response.json();
 await Promise.all(Object.entries(profile.states).flatMap(([state,config])=>['front'].flatMap(view=>{
  const frames=mixedSprites[id][state+'/'+view]=[];
  return Array.from({length:config.files.length},(_,index)=>new Promise((resolve,reject)=>{const image=new Image;frames.push(image);image.onload=resolve;image.onerror=()=>reject(Error(id+'/'+state+'/'+view+'/'+index));image.src='/assets/characters/'+id+'/sprites/'+view+'/'+config.files[index]}));
 })));
}));
function mixedPose(f){const state=f.cast>0?'attack':f.moving?'walk':'idle',view='front',frames=mixedSprites[f.character][state+'/'+view];const index=state==='walk'?Math.floor((f.walk||0)%1*frames.length):state==='attack'?Math.min(frames.length-1,Math.floor((1-f.cast/.42)*frames.length)):0;return frames[index]}
function mixedFlip(f){return (f.facing||(f.team===0?1:-1))*(f.character==='tomato'?-1:1)}
function mixedSocket(f){const p=characterProfiles[f.character],socket=p.sockets.front.attack,z=baseScale()*1100*(p.scale||1)/p.visualHeight;return{x:f.x+mixedFlip(f)*(socket[0]-p.anchor.x)*z,y:f.y+(socket[1]-p.anchor.y)*z}}
function drawMixedFighter(f){if(f.hp<=0)return;const image=mixedPose(f),p=characterProfiles[f.character];if(!image||!image.complete||!image.naturalWidth)return;const z=baseScale()*1100*(p.scale||1)/p.visualHeight;g.save();g.translate(f.x,f.y);g.scale(mixedFlip(f),1);g.fillStyle=f.team?'#ff4b3044':'#48aaff44';g.beginPath();g.ellipse(0,3,baseScale()*230*(p.scale||1),baseScale()*55*(p.scale||1),0,0,7);g.fill();if(f.hit)g.filter='brightness(2.1)';if(f.character==='carrot'&&f.cast>0){const phase=Math.sin((1-f.cast/.42)*Math.PI);g.translate(phase*8,-phase);g.rotate(phase*.04)}if(!f.moving&&f.cast<=0)g.scale(1,1+.004*Math.sin(performance.now()/1000*2+f.lane));if(f.team===1)drawEnemyOutline(image,-p.anchor.x*z,-p.anchor.y*z,Math.max(p.canvas.width,image.naturalWidth)*z,p.canvas.height*z);g.drawImage(image,-p.anchor.x*z,-p.anchor.y*z,Math.max(p.canvas.width,image.naturalWidth)*z,p.canvas.height*z);g.restore();const y=f.y-baseScale()*1150*(p.scale||1),w=Math.max(24,Math.min(44,baseScale()*540));g.fillStyle='#050806cc';g.fillRect(f.x-w/2,y,w,6);g.fillStyle=f.team?'#ff3e2e':'#44a4ff';g.fillRect(f.x-w/2+1,y+1,(w-2)*f.hp/f.max,4);g.fillStyle='#fff';g.font='800 9px system-ui';g.textAlign='center';g.fillText(({pepper:'Перец',tomato:'Помидор',carrot:'Морковь'})[f.character]+' '+Math.ceil(f.hp),f.x,y-4)}




