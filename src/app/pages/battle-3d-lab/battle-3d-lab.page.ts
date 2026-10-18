import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { ActivatedRoute } from '@angular/router';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

type Team = 'blue' | 'red';
type FighterState = 'idle' | 'walk' | 'attack' | 'death';
interface Fighter { root: THREE.Group; body: THREE.Group; mixer: THREE.AnimationMixer; actions: Map<FighterState, THREE.AnimationAction>; state: FighterState; team: Team; lane: number; hp: number; maxHp: number; attackPower: number; defense: number; attackRange: number; attackInterval: number; moveSpeed: number; attackClock: number; forwardAngle: number; target?: Fighter; slotTarget?:Fighter; attackSlot?:number; startPosition: THREE.Vector3; deadVisual: boolean; materials: Array<{material:THREE.Material;opacity:number;transparent:boolean;depthWrite:boolean}>; }

const ROOT = 'assets/scenes/3d/carrot';
const MODEL_FORWARD_OFFSET = 0;

@Component({ standalone:true, imports:[IonContent], templateUrl:'./battle-3d-lab.page.html', styleUrl:'./battle-3d-lab.page.scss' })
export class Battle3dLabPage implements AfterViewInit, OnDestroy {
  private readonly route=inject(ActivatedRoute);
  @ViewChild('viewport', { static:true }) private viewport!: ElementRef<HTMLElement>;
  readonly status = signal('Загрузка моделей…'); readonly ready = signal(false); readonly paused = signal(false);
  readonly teamSize=this.route.snapshot.data['teamSize']===3?3:1;readonly title=this.teamSize===3?'Полноценный бой 3 × 3':'Поединок 1 × 1';speed=1;
  private destroyed = false;
  private renderer?: THREE.WebGLRenderer; private scene?: THREE.Scene; private camera?: THREE.OrthographicCamera;
  private resize?: ResizeObserver; private frame = 0; private last = performance.now(); private elapsed = 0; private running = false; private ending = false;
  private dragged?:Fighter;private dragPointer?:number;private dragOffset=new THREE.Vector2();private raycaster=new THREE.Raycaster();private groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  fighters: Fighter[] = []; private clips = new Map<FighterState, THREE.AnimationClip>();

  ngAfterViewInit(): void { this.createScene(); void this.load(); }
  ngOnDestroy(): void { this.destroyed=true; cancelAnimationFrame(this.frame); this.resize?.disconnect();const canvas=this.renderer?.domElement;canvas?.removeEventListener('pointerdown',this.onPointerDown);canvas?.removeEventListener('pointermove',this.onPointerMove);canvas?.removeEventListener('pointerup',this.onPointerUp);canvas?.removeEventListener('pointercancel',this.onPointerUp);this.renderer?.dispose(); }
  start(): void { if (!this.ready()) return; this.running = true; this.paused.set(false); }
  togglePause(): void { if (!this.running) return; this.paused.update(v => !v); }
  reset(): void {this.running=false;this.ending=false;this.paused.set(false);this.elapsed=0;for(const f of this.fighters){f.hp=f.maxHp;f.target=undefined;f.slotTarget=undefined;f.attackSlot=undefined;this.setDeadAppearance(f,false);f.attackClock=(f.team==='red'?.25:.7)+f.lane*.12;f.root.position.copy(f.startPosition);this.play(f,'idle');}this.faceOpponents();this.status.set(`Готово: перетащите бойцов или нажмите «Старт»`);}
  teamAlive(team:Team):number{return this.fighters.filter(f=>f.team===team&&f.hp>0).length;}
  setStat(f:Fighter,key:'maxHp'|'attackPower'|'defense'|'attackRange'|'attackInterval'|'moveSpeed',value:string):void{const n=Number(value);if(!Number.isFinite(n))return;f[key]=Math.max(key==='attackInterval'?.2:key==='attackRange'?.3:0,n);if(key==='maxHp')f.hp=Math.min(f.hp,f.maxHp);}

  private createScene(): void {
    const host=this.viewport.nativeElement; const scene=new THREE.Scene(); scene.background=new THREE.Color(0x122418); scene.fog=new THREE.Fog(0x122418,12,22); this.scene=scene;
    const camera=new THREE.OrthographicCamera(-6,6,5,-5,.1,40); camera.position.set(0,9.2,11.5); camera.lookAt(0,0,0); this.camera=camera;
    const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1; renderer.shadowMap.enabled=true; renderer.setPixelRatio(Math.min(devicePixelRatio,2)); host.appendChild(renderer.domElement); this.renderer=renderer;renderer.domElement.addEventListener('pointerdown',this.onPointerDown);renderer.domElement.addEventListener('pointermove',this.onPointerMove);renderer.domElement.addEventListener('pointerup',this.onPointerUp);renderer.domElement.addEventListener('pointercancel',this.onPointerUp);
    scene.add(new THREE.HemisphereLight(0xfff1cf,0x17301d,2.4)); const sun=new THREE.DirectionalLight(0xfff5dc,3.4); sun.position.set(-5,10,6); sun.castShadow=true; scene.add(sun);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(13,10),new THREE.MeshStandardMaterial({color:0x29452e,roughness:.95})); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
    const grid=new THREE.GridHelper(12,12,0x66856a,0x3b5940); grid.position.y=.01; scene.add(grid);
    this.resize=new ResizeObserver(()=>this.onResize()); this.resize.observe(host); this.onResize(); this.animate();
  }

  private async load(): Promise<void> {
    try {
      const loader=new GLTFLoader(); const [walk,idle,attack,death,spear,shield]=await Promise.all([
        loader.loadAsync(`${ROOT}/carrot-walk.glb`),loader.loadAsync(`${ROOT}/carrot-idle.glb`),loader.loadAsync(`${ROOT}/bodyFronRefVideo.glb`),loader.loadAsync(`${ROOT}/carrot-died.glb`),loader.loadAsync(`${ROOT}/spear-source.glb`),loader.loadAsync(`${ROOT}/shield-source.glb`)
      ]);
      const anchor=this.rootAnchor(walk.animations[0]),facing=this.rootQuaternion(walk.animations[0]),walkClip=this.lockFacing(this.fixRoot(walk.animations[0],anchor),facing);
      this.clips.set('walk',walkClip); this.clips.set('idle',this.staticPose(walkClip));
      this.clips.set('attack',this.lockFacing(this.fixRoot(THREE.AnimationUtils.subclip(attack.animations[0],'attack',0,180,30),anchor),facing)); this.clips.set('death',this.fixRoot(death.animations[0],anchor));
      if(this.destroyed)return;
      for(const team of ['red','blue'] as Team[])for(let lane=0;lane<this.teamSize;lane++){
        if(this.destroyed)return;
        await this.addFighter(team,lane-(this.teamSize-1)/2,spear.scene,shield.scene);
      }
      if(this.destroyed)return;
      this.ready.set(true); this.reset();
    } catch(error){ console.error(error); this.status.set('Ошибка загрузки 3D-комплекта моркови'); }
  }

  private async addFighter(team:Team,lane:number,spearSource:THREE.Group,shieldSource:THREE.Group): Promise<void> {
    if(this.destroyed||!this.scene) return; const gltf=await new GLTFLoader().loadAsync(`${ROOT}/carrot-walk.glb`);if(this.destroyed)return; const body=gltf.scene; body.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
    const box=new THREE.Box3().setFromObject(body), height=box.getSize(new THREE.Vector3()).y||1, center=box.getCenter(new THREE.Vector3()); body.position.sub(new THREE.Vector3(center.x,box.min.y,center.z));
    const root=new THREE.Group();root.scale.setScalar(this.teamSize===3?1.42/height:1.65/height);root.add(body);root.position.set(lane*1.55,0,team==='red'?-3.2:3.2);root.rotation.y=0;this.scene.add(root);
    const mixer=new THREE.AnimationMixer(body), actions=new Map<FighterState,THREE.AnimationAction>(); for(const [name,clip] of this.clips){const action=mixer.clipAction(this.fitClipToBody(clip,body)); if(name==='idle'||name==='attack'||name==='death'){action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;}if(name==='attack')action.setDuration(2.2);actions.set(name,action);}
    const bones:THREE.Bone[]=[]; body.traverse(o=>{if(o instanceof THREE.Bone)bones.push(o);}); const find=(s:string)=>bones.find(b=>b.name.toLowerCase().replace(/[^a-z0-9]/g,'').endsWith(s));
    const fighter:Fighter={root,body,mixer,actions,state:'walk',team,lane,hp:100,maxHp:100,attackPower:34,defense:4,attackRange:1.1,attackInterval:2.4,moveSpeed:.72,attackClock:(team==='red'?.25:.7)+lane*.12,forwardAngle:0,startPosition:root.position.clone(),deadVisual:false,materials:[]};this.play(fighter,'idle');mixer.update(0);root.updateWorldMatrix(true,true);const hips=find('hips'),chest=find('spine2'),shieldHand=find('lefthand');if(hips){const hipsLocal=root.worldToLocal(hips.getWorldPosition(new THREE.Vector3()));body.position.x-=hipsLocal.x;body.position.z-=hipsLocal.z;root.updateWorldMatrix(true,true);}if(chest&&shieldHand){const chestLocal=root.worldToLocal(chest.getWorldPosition(new THREE.Vector3())),handLocal=root.worldToLocal(shieldHand.getWorldPosition(new THREE.Vector3())),forward=handLocal.sub(chestLocal);if(forward.x*forward.x+forward.z*forward.z>.000001)fighter.forwardAngle=Math.atan2(forward.x,forward.z);}
    const right=find('righthand'),left=find('lefthand');if(right)this.attach(spearSource.clone(true),right,height,'spear');if(left)this.attach(shieldSource.clone(true),left,height,'shield');
    const teamColor=new THREE.Color(team==='red'?0xff3030:0x2474ff);
    root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const list=Array.isArray(o.material)?o.material:[o.material];for(const material of list){if(material instanceof THREE.MeshStandardMaterial){material.emissive.copy(teamColor);material.emissiveIntensity=.16;}else if('color'in material&&(material as THREE.MeshBasicMaterial).color)(material as THREE.MeshBasicMaterial).color.lerp(teamColor,.14);fighter.materials.push({material,opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite});}});
    this.fighters.push(fighter);
  }

  private attach(model:THREE.Group,hand:THREE.Bone,height:number,kind:'spear'|'shield'):void {model.traverse(o=>{if(o instanceof THREE.Mesh)o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();});const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()); model.position.sub(center); if(kind==='spear')model.position.y+=size.y*.18; const node=new THREE.Group();node.add(model);hand.add(node);hand.updateWorldMatrix(true,false);const hs=hand.getWorldScale(new THREE.Vector3()), inherited=Math.max(Math.abs(hs.x),Math.abs(hs.y),Math.abs(hs.z),.0001);const ratio=kind==='spear'?.92:.27,base=2.8*ratio/Math.max(size.x,size.y,size.z,.0001)/inherited;if(kind==='spear'){node.position.set(-.02*height,8.2*height,1.41*height);node.rotation.set(Math.PI/2,Math.PI,Math.PI/2);node.scale.setScalar(base*.55);}else{node.position.set(0,.07*height,-5*height);node.rotation.set(Math.PI,0,Math.PI/2);node.scale.setScalar(base);} }
  private play(f:Fighter,state:FighterState):void {if(f.state===state&&(f.actions.get(state)?.isRunning()||state==='idle'||state==='death'))return;const next=f.actions.get(state);if(!next)return;const previous=f.state,current=f.actions.get(previous);f.state=state;if(state==='idle'){f.mixer.stopAllAction();next.reset();next.enabled=true;next.setEffectiveWeight(1);next.play();next.time=0;f.mixer.update(0);next.paused=true;}else if(previous==='idle'&&state==='walk'){current?.stop();next.paused=false;next.reset().setEffectiveWeight(1).play();}else{current?.fadeOut(.12);next.paused=false;next.reset().fadeIn(.12).play();}}
  private update(dt:number):void {if(!this.running||this.paused())return;dt*=this.speed;this.elapsed+=dt;for(const fighter of this.fighters)fighter.mixer.update(dt);if(this.ending){const deathsFinished=this.fighters.filter(f=>f.hp<=0).every(f=>!f.actions.get('death')?.isRunning());if(deathsFinished)this.running=false;return;}for(const f of this.fighters){if(f.hp<=0){this.setDeadAppearance(f,true);this.play(f,'death');continue;}f.attackClock=Math.max(0,f.attackClock-dt);const enemy=this.targetFor(f);if(!enemy){this.play(f,'idle');continue;}const enemyDx=enemy.root.position.x-f.root.position.x,enemyDz=enemy.root.position.z-f.root.position.z,enemyDistance=Math.hypot(enemyDx,enemyDz);if(enemyDistance>f.attackRange){const destination=this.combatPosition(f,enemy),dx=destination.x-f.root.position.x,dz=destination.y-f.root.position.z,distance=Math.hypot(dx,dz);this.play(f,'walk');const direction=this.movementDirection(f,dx,dz,distance),step=Math.min(dt*f.moveSpeed,distance);f.root.position.x+=direction.x*step;f.root.position.z+=direction.y*step;}else{const attackRunning=f.state==='attack'&&f.actions.get('attack')?.isRunning()===true;if(f.attackClock<=0&&!attackRunning){this.play(f,'attack');f.attackClock=f.attackInterval;enemy.hp-=Math.max(1,f.attackPower-enemy.defense);}else if(!attackRunning)this.play(f,'idle');}}this.faceOpponents();
    const aliveBlue=this.fighters.some(f=>f.team==='blue'&&f.hp>0),aliveRed=this.fighters.some(f=>f.team==='red'&&f.hp>0);if(!aliveBlue||!aliveRed){for(const fighter of this.fighters)if(fighter.hp<=0){this.setDeadAppearance(fighter,true);this.play(fighter,'death');}this.ending=true;this.status.set(aliveBlue?'Победила нижняя команда':'Победила верхняя команда');}}
  private animate():void {const now=performance.now(),dt=Math.min((now-this.last)/1000,.05);this.last=now;this.update(dt);if(this.scene&&this.camera&&this.renderer)this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(()=>this.animate());}
  private targetFor(fighter:Fighter):Fighter|undefined{
    if(fighter.target&&fighter.target.hp>0)return fighter.target;
    const previous=fighter.target;
    const enemies=this.fighters.filter(candidate=>candidate.team!==fighter.team&&candidate.hp>0);
    const next=enemies.sort((a,b)=>{
      const sameA=a.lane===fighter.lane?0:1,sameB=b.lane===fighter.lane?0:1;
      return sameA-sameB||fighter.root.position.distanceTo(a.root.position)-fighter.root.position.distanceTo(b.root.position);
    })[0];
    fighter.target=next;
    if(next&&next!==previous){fighter.attackClock=0;fighter.slotTarget=undefined;fighter.attackSlot=undefined;}
    return next;
  }
  private movementDirection(fighter:Fighter,dx:number,dz:number,distance:number):THREE.Vector2{
    const forward=new THREE.Vector2(dx/distance,dz/distance);
    const direction=forward.clone();
    const fighterIndex=this.fighters.indexOf(fighter);
    for(const ally of this.fighters){
      if(ally===fighter||ally.team!==fighter.team||ally.hp<=0)continue;
      const offset=new THREE.Vector2(ally.root.position.x-fighter.root.position.x,ally.root.position.z-fighter.root.position.z);
      const ahead=offset.dot(forward);
      const side=forward.x*offset.y-forward.y*offset.x;
      if(ahead<=0||ahead>=2.25||Math.abs(side)>=1.05)continue;
      const allyIndex=this.fighters.indexOf(ally);
      const passSide=fighter.lane!==ally.lane?(fighter.lane<ally.lane?-1:1):(fighterIndex<allyIndex?-1:1);
      const strength=(1-ahead/2.25)*(1-Math.abs(side)/1.05);
      direction.x+=forward.y*passSide*strength*3.2;
      direction.y-=forward.x*passSide*strength*3.2;
    }
    return direction.lengthSq()>.000001?direction.normalize():forward;
  }
  private combatPosition(fighter:Fighter,enemy:Fighter):THREE.Vector2{
    const radius=Math.max(.72,fighter.attackRange*.82);
    if(fighter.slotTarget!==enemy||fighter.attackSlot===undefined){
      const occupied=new Set(this.fighters.filter(f=>f!==fighter&&f.hp>0&&f.team===fighter.team&&f.slotTarget===enemy&&f.attackSlot!==undefined).map(f=>f.attackSlot!));
      const available=[-1,0,1].filter(slot=>!occupied.has(slot));
      const candidates=available.length?available:[-1,0,1];
      fighter.attackSlot=candidates.reduce((best,slot)=>this.slotRouteScore(fighter,enemy,slot,radius)<this.slotRouteScore(fighter,enemy,best,radius)?slot:best,candidates[0]);
      fighter.slotTarget=enemy;
    }
    return this.slotPosition(fighter,enemy,fighter.attackSlot,radius);
  }
  private slotPosition(fighter:Fighter,enemy:Fighter,slot:number,radius:number):THREE.Vector2{
    const offset=new THREE.Vector2(0,fighter.team==='red'?-1:1).rotateAround(new THREE.Vector2(),slot*.72);
    return new THREE.Vector2(enemy.root.position.x+offset.x*radius,enemy.root.position.z+offset.y*radius);
  }
  private slotRouteScore(fighter:Fighter,enemy:Fighter,slot:number,radius:number):number{
    const destination=this.slotPosition(fighter,enemy,slot,radius),start=new THREE.Vector2(fighter.root.position.x,fighter.root.position.z),path=destination.clone().sub(start),lengthSq=path.lengthSq();
    let score=lengthSq;
    if(lengthSq<.000001)return score;
    for(const ally of this.fighters){
      if(ally===fighter||ally.team!==fighter.team||ally.hp<=0)continue;
      const point=new THREE.Vector2(ally.root.position.x,ally.root.position.z),t=THREE.MathUtils.clamp(point.clone().sub(start).dot(path)/lengthSq,0,1),nearest=start.clone().addScaledVector(path,t);
      if(t>.05&&t<.95&&nearest.distanceTo(point)<.72)score+=12;
    }
    return score;
  }
  private setDeadAppearance(fighter:Fighter,dead:boolean):void{if(fighter.deadVisual===dead)return;fighter.deadVisual=dead;for(const state of fighter.materials){state.material.transparent=dead||state.transparent;state.material.opacity=dead?.38:state.opacity;state.material.depthWrite=dead?false:state.depthWrite;state.material.needsUpdate=true;}}
  private faceOpponents():void{for(const fighter of this.fighters){const enemy=this.targetFor(fighter);if(!enemy)continue;const dx=enemy.root.position.x-fighter.root.position.x,dz=enemy.root.position.z-fighter.root.position.z,attackTurn=fighter.state==='attack'?Math.PI/6:0;fighter.root.rotation.y=Math.atan2(dx,dz)-fighter.forwardAngle+MODEL_FORWARD_OFFSET+attackTurn;}}
  private rootAnchor(clip:THREE.AnimationClip):[number,number,number]{const t=this.rootPositionTrack(clip);return t?[t.values[0],t.values[1],t.values[2]]:[0,0,0];}
  private fixRoot(clip:THREE.AnimationClip,anchor:[number,number,number]):THREE.AnimationClip {const out=clip.clone(),t=this.rootPositionTrack(out);if(t)for(let i=0;i<t.values.length;i+=3){t.values[i]=anchor[0];t.values[i+1]=anchor[1];}return out;}
  private rootPositionTrack(clip:THREE.AnimationClip):THREE.VectorKeyframeTrack|undefined{return clip.tracks.find((t):t is THREE.VectorKeyframeTrack=>t instanceof THREE.VectorKeyframeTrack&&t.name.toLowerCase().endsWith('.position')&&t.name.slice(0,t.name.lastIndexOf('.')).toLowerCase().replace(/[^a-z0-9]/g,'').endsWith('hips'));}
  private staticPose(source:THREE.AnimationClip):THREE.AnimationClip{const tracks=source.tracks.map(track=>{const stride=track.getValueSize(),values=new Float32Array(stride*2);for(let i=0;i<stride;i++){values[i]=track.values[i];values[i+stride]=track.values[i]}return new (track.constructor as new(name:string,times:ArrayLike<number>,values:ArrayLike<number>)=>THREE.KeyframeTrack)(track.name,[0,1],values)});return new THREE.AnimationClip('idle-static',1,tracks);}
  private rootQuaternion(source:THREE.AnimationClip):[number,number,number,number]{const track=source.tracks.find(t=>t instanceof THREE.QuaternionKeyframeTrack&&t.name.slice(0,t.name.lastIndexOf('.')).toLowerCase().replace(/[^a-z0-9]/g,'').endsWith('hips'))as THREE.QuaternionKeyframeTrack|undefined;return track?[track.values[0],track.values[1],track.values[2],track.values[3]]:[0,0,0,1];}
  private lockFacing(source:THREE.AnimationClip,q:[number,number,number,number]):THREE.AnimationClip{const out=source.clone(),track=out.tracks.find(t=>t instanceof THREE.QuaternionKeyframeTrack&&t.name.slice(0,t.name.lastIndexOf('.')).toLowerCase().replace(/[^a-z0-9]/g,'').endsWith('hips'))as THREE.QuaternionKeyframeTrack|undefined;if(track)for(let i=0;i<track.values.length;i+=4){track.values[i]=q[0];track.values[i+1]=q[1];track.values[i+2]=q[2];track.values[i+3]=q[3];}return out;}
  private fitClipToBody(clip:THREE.AnimationClip,body:THREE.Object3D):THREE.AnimationClip {
    const result=clip.clone();
    for(const track of result.tracks){
      const separator=track.name.lastIndexOf('.'); if(separator<0)continue;
      const nodeName=track.name.slice(0,separator),property=track.name.slice(separator+1),node=body.getObjectByName(nodeName);
      if(!node||!(track instanceof THREE.VectorKeyframeTrack))continue;
      if(property==='position'&&!nodeName.toLowerCase().includes('hips')){
        for(let i=0;i<track.values.length;i+=3){track.values[i]=node.position.x;track.values[i+1]=node.position.y;track.values[i+2]=node.position.z;}
      }else if(property==='scale'){
        for(let i=0;i<track.values.length;i+=3){track.values[i]=node.scale.x;track.values[i+1]=node.scale.y;track.values[i+2]=node.scale.z;}
      }
    }
    return result;
  }
  private readonly onPointerDown=(event:PointerEvent):void=>{
    if(this.running||this.ending||!this.ready()||!this.renderer||!this.camera)return;
    const rect=this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),this.camera);
    let selected:Fighter|undefined,nearest=Infinity;
    for(const fighter of this.fighters){
      const hit=this.raycaster.intersectObject(fighter.root,true)[0];
      if(hit&&hit.distance<nearest){nearest=hit.distance;selected=fighter;}
    }
    if(!selected)return;
    const point=new THREE.Vector3();if(!this.raycaster.ray.intersectPlane(this.groundPlane,point))return;
    this.dragged=selected;this.dragPointer=event.pointerId;
    this.dragOffset.set(selected.root.position.x-point.x,selected.root.position.z-point.z);
    this.renderer.domElement.setPointerCapture(event.pointerId);this.status.set('Перетащите бойца на новую стартовую точку');event.preventDefault();
  };
  private readonly onPointerMove=(event:PointerEvent):void=>{
    if(!this.dragged||event.pointerId!==this.dragPointer||!this.renderer||!this.camera)return;
    const rect=this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),this.camera);
    const point=new THREE.Vector3();if(!this.raycaster.ray.intersectPlane(this.groundPlane,point))return;
    const x=THREE.MathUtils.clamp(point.x+this.dragOffset.x,-5.4,5.4),z=THREE.MathUtils.clamp(point.z+this.dragOffset.y,-4.35,4.35);
    this.dragged.root.position.set(x,0,z);this.dragged.startPosition.copy(this.dragged.root.position);this.dragged.target=undefined;this.dragged.slotTarget=undefined;this.dragged.attackSlot=undefined;this.faceOpponents();event.preventDefault();
  };
  private readonly onPointerUp=(event:PointerEvent):void=>{
    if(event.pointerId!==this.dragPointer)return;
    if(this.renderer?.domElement.hasPointerCapture(event.pointerId))this.renderer.domElement.releasePointerCapture(event.pointerId);
    this.dragged=undefined;this.dragPointer=undefined;this.status.set('Расстановка сохранена. Можно начинать бой');
  };
  private onResize():void {
    if(!this.camera||!this.renderer)return;
    const host=this.viewport.nativeElement,w=host.clientWidth||1,hh=host.clientHeight||1,aspect=w/hh;
    const mobile=aspect<.72;
    const vertical=mobile?5.75:5;
    this.camera.left=-vertical*aspect;this.camera.right=vertical*aspect;this.camera.top=vertical;this.camera.bottom=-vertical;this.camera.updateProjectionMatrix();
    this.renderer.setSize(w,hh);
  }
}
