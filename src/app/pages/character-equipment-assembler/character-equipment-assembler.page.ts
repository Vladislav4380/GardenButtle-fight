import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

type ItemKind = 'spear' | 'shield';
type Axis = 'x' | 'y' | 'z';
interface TransformValues { x: number; y: number; z: number; rx: number; ry: number; rz: number; scale: number; }

const ROOT = 'assets/scenes/3d/carrot';

@Component({
  standalone: true,
  imports: [IonContent, FormsModule],
  templateUrl: './character-equipment-assembler.page.html',
  styleUrl: './character-equipment-assembler.page.scss'
})
export class CharacterEquipmentAssemblerPage implements AfterViewInit, OnDestroy {
  @ViewChild('viewport', { static: true }) private viewport!: ElementRef<HTMLDivElement>;
  readonly status = signal('Загрузка трёх моделей…');
  readonly ready = signal(false);
  readonly playing = signal(true);
  selectedItem: ItemKind = 'spear';
  selectedBone = 'mixamorig:RightArm';
  boneRx = 0; boneRy = 0; boneRz = 0;
  readonly items: Record<ItemKind, TransformValues> = {
    spear: { x: -0.02, y: 8.2, z: 1.41, rx: 90, ry: 0, rz: 90, scale: 1.15 },
    shield: { x: 0, y: 0.07, z: -5, rx: 180, ry: 0, rz: 0, scale: 1 }
  };
  readonly armBones = [
    'mixamorig:RightArm', 'mixamorig:RightForeArm', 'mixamorig:RightHand',
    'mixamorig:LeftArm', 'mixamorig:LeftForeArm', 'mixamorig:LeftHand'
  ];

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private controls?: OrbitControls;
  private root?: THREE.Group;
  private frameId?: number;
  private mixer?: THREE.AnimationMixer;
  private idleAction?: THREE.AnimationAction;
  private walkAction?: THREE.AnimationAction;
  private attackAction?: THREE.AnimationAction;
  private deathAction?: THREE.AnimationAction;
  private sequencePhase: 'idle-before' | 'walk-before' | 'attack' | 'walk-after' | 'death' | 'dead-hold' = 'idle-before';
  private phaseElapsed = 0;
  private readonly timer = new THREE.Timer();
  private clips: THREE.AnimationClip[] = [];
  private bodyHeight = 1;
  private readonly bones = new Map<string, THREE.Bone>();
  private readonly boneBase = new Map<string, THREE.Euler>();
  private readonly itemNodes = new Map<ItemKind, { node: THREE.Group; baseScale: number }>();

  constructor(private readonly router: Router) {}
  get item(): TransformValues { return this.items[this.selectedItem]; }
  togglePlay(): void { this.playing.update(value => !value); }

  ngAfterViewInit(): void { this.createScene(); void this.load(); }
  ngOnDestroy(): void { if (this.frameId !== undefined) cancelAnimationFrame(this.frameId); this.controls?.dispose(); this.renderer?.dispose(); }
  goBack(): void { void this.router.navigateByUrl('/movement-octagon-3d-preview'); }

  selectBone(): void { this.boneRx = this.boneRy = this.boneRz = 0; this.applyBone(); }
  applyBone(): void {
    const bone = this.bones.get(this.selectedBone); const base = this.boneBase.get(this.selectedBone);
    if (!bone || !base) return;
    bone.rotation.set(base.x + THREE.MathUtils.degToRad(this.boneRx), base.y + THREE.MathUtils.degToRad(this.boneRy), base.z + THREE.MathUtils.degToRad(this.boneRz));
  }
  applyItem(): void {
    const entry = this.itemNodes.get(this.selectedItem); if (!entry) return;
    const v = this.item;
    entry.node.position.set(v.x * this.bodyHeight, v.y * this.bodyHeight, v.z * this.bodyHeight);
    const baseRy = this.selectedItem === 'spear' ? 180 : 0;
    entry.node.rotation.set(THREE.MathUtils.degToRad(v.rx), THREE.MathUtils.degToRad(v.ry + baseRy), THREE.MathUtils.degToRad(v.rz));
    entry.node.scale.setScalar(entry.baseScale * v.scale);
  }
  resetBone(): void { this.boneRx = this.boneRy = this.boneRz = 0; this.applyBone(); }
  resetItem(): void {
    Object.assign(this.item, this.selectedItem === 'spear'
      ? { x: -0.02, y: 8.2, z: 1.41, rx: 90, ry: 0, rz: 90, scale: 1.15 }
      : { x: 0, y: 0.07, z: -5, rx: 180, ry: 0, rz: 0, scale: 1 });
    this.applyItem();
  }
  async exportGlb(): Promise<void> {
    if (!this.root) return;
    this.status.set('Экспорт carrot-combat.glb…');
    try {
      const data = await new GLTFExporter().parseAsync(this.root, { binary: true, animations: this.clips, onlyVisible: true });
      const blob = new Blob([data as ArrayBuffer], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = 'carrot-combat.glb'; link.click(); URL.revokeObjectURL(url);
      this.status.set('carrot-combat.glb сохранён');
    } catch (error) { console.error(error); this.status.set('Ошибка экспорта GLB'); }
  }

  downloadParameters(): void {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      units: { position: 'body-height multiplier', rotation: 'degrees' },
      spear: {
        ...this.items.spear,
        baseRotation: { rx: 0, ry: 180, rz: 0 },
        effectiveRotation: {
          rx: this.items.spear.rx,
          ry: this.items.spear.ry + 180,
          rz: this.items.spear.rz
        }
      },
      shield: {
        ...this.items.shield,
        baseRotation: { rx: 0, ry: 0, rz: 0 },
        effectiveRotation: {
          rx: this.items.shield.rx,
          ry: this.items.shield.ry,
          rz: this.items.shield.rz
        }
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'carrot-equipment-parameters.json';
    link.click();
    URL.revokeObjectURL(url);
    this.status.set('Текущие параметры копья и щита сохранены');
  }

  private createScene(): void {
    const host = this.viewport.nativeElement; const scene = new THREE.Scene(); scene.background = new THREE.Color(0x142218); this.scene = scene;
    const camera = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight, .01, 100); camera.position.set(4.8, 4.2, 7.0); this.camera = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(host.clientWidth, host.clientHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; host.appendChild(renderer.domElement); this.renderer = renderer;
    scene.add(new THREE.HemisphereLight(0xfff6db, 0x1c3520, 2.4)); const sun = new THREE.DirectionalLight(0xffffff, 3.2); sun.position.set(4, 7, 5); scene.add(sun);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.target.set(0, 1.35, 0); this.controls = controls;
    const resize = new ResizeObserver(() => { if (!host.clientWidth || !host.clientHeight) return; camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); }); resize.observe(host);
    const render = () => {
      this.timer.update();
      if (this.playing()) this.updateSequence(this.timer.getDelta());
      controls.update(); renderer.render(scene, camera); this.frameId = requestAnimationFrame(render);
    }; render();
  }

  private async load(): Promise<void> {
    if (!this.scene) return;
    try {
      const loader = new GLTFLoader(); const [bodyGltf, idleGltf, attackGltf, deathGltf, spearGltf, shieldGltf] = await Promise.all([
        loader.loadAsync(`${ROOT}/carrot-walk.glb`), loader.loadAsync(`${ROOT}/carrot-idle.glb`), loader.loadAsync(`${ROOT}/bodyFronRefVideo.glb`), loader.loadAsync(`${ROOT}/carrot-died.glb`), loader.loadAsync(`${ROOT}/spear-source.glb`), loader.loadAsync(`${ROOT}/shield-source.glb`)
      ]);
      const root = new THREE.Group(); root.name = 'CarrotCombat'; const body = bodyGltf.scene; root.add(body); this.root = root;
      const walkClip = bodyGltf.animations[0]?.clone(); const idleClip = idleGltf.animations[0]?.clone(); const attackSource = attackGltf.animations[0]; const deathClip = deathGltf.animations[0]?.clone();
      if (!walkClip || !idleClip || !attackSource || !deathClip) throw new Error('Клипы idle, ходьбы, атаки или смерти не найдены');
      const attackClip = THREE.AnimationUtils.subclip(attackSource, 'attack', 0, 180, 30);
      idleClip.name = 'idle'; walkClip.name = 'walk'; deathClip.name = 'death'; this.clips = [idleClip, walkClip, attackClip, deathClip];
      this.mixer = new THREE.AnimationMixer(body);
      this.idleAction = this.mixer.clipAction(idleClip).setLoop(THREE.LoopRepeat, Infinity);
      this.walkAction = this.mixer.clipAction(walkClip).setLoop(THREE.LoopRepeat, Infinity);
      this.attackAction = this.mixer.clipAction(attackClip).setLoop(THREE.LoopOnce, 1);
      this.attackAction.clampWhenFinished = true;
      this.deathAction = this.mixer.clipAction(deathClip).setLoop(THREE.LoopOnce, 1);
      this.deathAction.clampWhenFinished = true;
      this.startIdleBefore();
      body.traverse(o => { if (o instanceof THREE.Bone) { this.bones.set(o.name, o); this.boneBase.set(o.name, o.rotation.clone()); } if (o instanceof THREE.Mesh) o.castShadow = true; });
      const box = new THREE.Box3().setFromObject(body); this.bodyHeight = box.getSize(new THREE.Vector3()).y || 1; const scale = 2.8 / this.bodyHeight; root.scale.setScalar(scale); body.position.sub(new THREE.Vector3(box.getCenter(new THREE.Vector3()).x, box.min.y, box.getCenter(new THREE.Vector3()).z)); this.scene.add(root);
      const right = this.findBone('righthand'); const left = this.findBone('lefthand'); if (!right || !left) throw new Error('Кости кистей не найдены');
      this.attach('spear', spearGltf.scene, right, .92, .18); this.attach('shield', shieldGltf.scene, left, .42, 0);
      this.ready.set(true); this.status.set('Готово: настройте руки и снаряжение');
    } catch (error) { console.error(error); this.status.set('Не удалось собрать модели'); }
  }
  private findBone(suffix: string): THREE.Bone | undefined { return [...this.bones.values()].find(b => b.name.toLowerCase().replace(/[^a-z0-9]/g, '').endsWith(suffix)); }

  private updateSequence(delta: number): void {
    if (!this.mixer) return;
    this.mixer.update(delta);
    this.phaseElapsed += delta;
    if (this.sequencePhase === 'idle-before' && this.phaseElapsed >= 2) this.startWalkBefore();
    else if (this.sequencePhase === 'walk-before' && this.phaseElapsed >= 2.2) this.startAttack();
    else if (this.sequencePhase === 'attack' && this.attackAction && this.phaseElapsed >= this.attackAction.getClip().duration) this.startWalkAfter();
    else if (this.sequencePhase === 'walk-after' && this.phaseElapsed >= 2.2) this.startDeath();
    else if (this.sequencePhase === 'death' && this.deathAction && this.phaseElapsed >= this.deathAction.getClip().duration) this.startDeadHold();
    else if (this.sequencePhase === 'dead-hold' && this.phaseElapsed >= 2) this.startIdleBefore();
  }

  private startIdleBefore(): void {
    this.sequencePhase = 'idle-before'; this.phaseElapsed = 0;
    this.walkAction?.stop(); this.attackAction?.stop(); this.deathAction?.stop(); this.idleAction?.reset().fadeIn(.12).play();
  }
  private startWalkBefore(): void {
    this.sequencePhase = 'walk-before'; this.phaseElapsed = 0;
    this.idleAction?.fadeOut(.12); this.attackAction?.stop(); this.walkAction?.reset().fadeIn(.12).play();
  }
  private startAttack(): void {
    this.sequencePhase = 'attack'; this.phaseElapsed = 0;
    this.walkAction?.fadeOut(.12); this.attackAction?.reset().fadeIn(.12).play();
  }
  private startWalkAfter(): void {
    this.sequencePhase = 'walk-after'; this.phaseElapsed = 0;
    this.attackAction?.fadeOut(.12); this.walkAction?.reset().fadeIn(.12).play();
  }
  private startDeath(): void {
    this.sequencePhase = 'death'; this.phaseElapsed = 0;
    this.walkAction?.fadeOut(.12); this.deathAction?.reset().fadeIn(.12).play();
  }
  private startDeadHold(): void {
    this.sequencePhase = 'dead-hold'; this.phaseElapsed = 0;
  }
  private attach(kind: ItemKind, model: THREE.Group, hand: THREE.Bone, ratio: number, grip: number): void {
    const box = new THREE.Box3().setFromObject(model); const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3()); model.position.sub(center); if (kind === 'spear') model.position.y += size.y * grip;
    const node = new THREE.Group(); node.name = kind === 'spear' ? 'Weapon_Spear' : 'Shield'; node.add(model); hand.add(node);
    hand.updateWorldMatrix(true, false); const handScale = hand.getWorldScale(new THREE.Vector3()); const inherited = Math.max(Math.abs(handScale.x), Math.abs(handScale.y), Math.abs(handScale.z), .0001);
    const baseScale = 2.8 * ratio / Math.max(size.x, size.y, size.z, .0001) / inherited;
    this.itemNodes.set(kind, { node, baseScale }); const old = this.selectedItem; this.selectedItem = kind; this.applyItem(); this.selectedItem = old;
  }
}
