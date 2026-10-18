const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=process.argv[2]||path.resolve(__dirname,'..');
(async()=>{
 const requests=[];
 class FakeImage{constructor(){this.complete=true;this.naturalWidth=1024;this.naturalHeight=1536}set src(url){this.url=url;requests.push(url);this.onload()}get src(){return this.url}}
 const context=vm.createContext({Image:FakeImage,baseScale:()=>1,fetch:async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,'src',url),'utf8'))})});
 vm.runInContext(fs.readFileSync(path.join(root,'src/assets/shared/runtime/combat-mix.js'),'utf8'),context);
 await vm.runInContext('mixedReady',context);
 assert(requests.length>0&&requests.every(url=>url.includes('/sprites/front/')),'only front sprites should load');
 for(const character of ['pepper','tomato','carrot'])for(const state of ['idle','walk','attack']){
  context.actor={character,team:0,facing:1,back:true,x:100,y:200,walk:.75,moving:state==='walk',cast:state==='attack'?.15:0};
  const image=vm.runInContext('mixedPose(actor)',context);assert(image.url.includes('/front/'));
  const backSocket=JSON.stringify(vm.runInContext('mixedSocket(actor)',context));
  context.actor.back=false;assert.equal(vm.runInContext('mixedPose(actor)',context),image);assert.equal(JSON.stringify(vm.runInContext('mixedSocket(actor)',context)),backSocket);
  const flip=vm.runInContext('mixedFlip(actor)',context);context.actor.facing=-1;assert.equal(vm.runInContext('mixedFlip(actor)',context),-flip);
 }
 console.log('PASS: only front images load; idle/walk/attack and projectile sockets ignore back; horizontal mirroring preserved');
})().catch(error=>{console.error(error);process.exitCode=1});
