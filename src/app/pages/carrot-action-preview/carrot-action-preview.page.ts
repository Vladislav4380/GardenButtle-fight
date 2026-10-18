import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

type Mode = 'walk' | 'attack' | 'sequence';

@Component({ standalone: true, imports: [IonContent, FormsModule], templateUrl: './carrot-action-preview.page.html', styleUrl: './carrot-action-preview.page.scss' })
export class CarrotActionPreviewPage implements AfterViewInit, OnDestroy {
  @ViewChild('viewport', { static: true }) private viewport!: ElementRef<HTMLDivElement>;
  readonly status = signal('Загрузка ходьбы и атаки…');
  readonly playing = signal(true);
  readonly phase = signal('ходьба');
  speed = .7;
  selected: Mode = 'sequence';
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private controls?: OrbitControls;
  private mixer?: THREE.AnimationMixer;
  private walk?: THREE.AnimationAction;
  private attack?: THREE.AnimationAction;
  private active?: THREE.AnimationAction;
  private readonly equipment: Array<{ node: THREE.Group; hand: THREE.Bone }> = [];
  private frameId?: number;
  private previous = performance.now();
  private sequenceElapsed = 0;

  constructor(private readonly router: Router) {}
  ngAfterViewInit(): void { this.createScene(); void this.load(); }
  ngOnDestroy(): void { if (this.frameId !== undefined) cancelAnimationFrame(this.frameId); this.controls?.dispose(); this.renderer?.dispose(); }
  goBack(): void { void this.router.navigateByUrl('/movement-octagon-3d-preview'); }
  toggle(): void { this.playing.update(v => !v); }
  select(mode: Mode): void { this.selected = mode; this.sequenceElapsed = 0; mode === 'attack' ? this.playAttack() : this.playWalk(); this.playing.set(true); }

  private playWalk(): void {
    if (!this.walk) return;
    this.phase.set('ходьба');
    this.walk.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    if (this.active && this.active !== this.walk) this.walk.crossFadeFrom(this.active, .16, false);
    this.active = this.walk;
  }
  private playAttack(): void {
    if (!this.attack) return;
    this.phase.set('атака');
    this.attack.reset().setLoop(THREE.LoopOnce, 1);
    this.attack.clampWhenFinished = true;
    this.attack.play();
    if (this.active && this.active !== this.attack) this.attack.crossFadeFrom(this.active, .14, false);
    this.active = this.attack;
  }
  private createScene(): void {
    const host = this.viewport.nativeElement;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x16271a); this.scene = scene;
    const camera = new THREE.PerspectiveCamera(32, host.clientWidth / host.clientHeight, .01, 100); camera.position.set(3.4, 2.8, 5.2);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(host.clientWidth, host.clientHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; host.appendChild(renderer.domElement); this.renderer = renderer;
    scene.add(new THREE.HemisphereLight(0xfff3d7, 0x1e3823, 2.5));
    const sun = new THREE.DirectionalLight(0xffffff, 3.4); sun.position.set(4, 7, 5); scene.add(sun);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.MeshStandardMaterial({ color: 0x3b5839, roughness: 1 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.target.set(0, 1.3, 0); this.controls = controls;
    new ResizeObserver(() => { if (!host.clientWidth || !host.clientHeight) return; camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); }).observe(host);
    const render = () => {
      const now = performance.now(), delta = Math.min((now - this.previous) / 1000, .05); this.previous = now;
      if (this.playing() && this.mixer) {
        const scaled = delta * this.speed; this.mixer.update(scaled);
        if (this.selected === 'sequence') {
          this.sequenceElapsed += scaled;
          if (this.phase() === 'ходьба' && this.sequenceElapsed >= 5.5) { this.sequenceElapsed = 0; this.playAttack(); }
          else if (this.phase() === 'атака' && this.sequenceElapsed >= 3.82) { this.sequenceElapsed = 0; this.playWalk(); }
        } else if (this.selected === 'attack' && this.attack && this.attack.time >= 3.9) this.playing.set(false);
      }
      this.updateEquipment();
      controls.update(); renderer.render(scene, camera); this.frameId = requestAnimationFrame(render);
    };
    render();
  }
  private async load(): Promise<void> {
    if (!this.scene) return;
    try {
      const loader = new GLTFLoader();
      const [walkGltf, attackGltf, spearGltf, shieldGltf] = await Promise.all([
        loader.loadAsync('assets/scenes/3d/carrot/combat-walk.glb'),
        loader.loadAsync('assets/scenes/3d/carrot/combat-attack.glb'),
        loader.loadAsync('assets/scenes/3d/carrot/spear.glb'),
        loader.loadAsync('assets/scenes/3d/carrot/shield.glb')
      ]);
      const model = walkGltf.scene;
      model.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });
      const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
      model.scale.setScalar(2.8 / Math.max(size.x, size.y, size.z));
      box.setFromObject(model); const center = box.getCenter(new THREE.Vector3()); model.position.set(-center.x, -box.min.y, -center.z); this.scene.add(model);
      const walkClip = this.removeTravel(walkGltf.animations[0], 'walk'), attackClip = this.removeTravel(attackGltf.animations[0], 'attack');
      if (!walkClip || !attackClip) throw new Error('Animation clip missing');
      this.mixer = new THREE.AnimationMixer(model); this.walk = this.mixer.clipAction(walkClip); this.attack = this.mixer.clipAction(attackClip);
      const rightHand = this.findBone(model, 'righthand'), leftHand = this.findBone(model, 'lefthand');
      if (!rightHand || !leftHand) throw new Error('Hand bones missing');
      this.attachEquipment(spearGltf.scene, rightHand, 'spear', .92);
      this.attachEquipment(shieldGltf.scene, leftHand, 'shield', .42);
      this.playWalk(); this.status.set(`Ходьба ${walkClip.duration.toFixed(2)} с · атака ${attackClip.duration.toFixed(2)} с · оружие добавлено`);
    } catch (error) { console.error(error); this.status.set('Не удалось загрузить два GLB'); }
  }
  private removeTravel(clip: THREE.AnimationClip | undefined, name: string): THREE.AnimationClip | undefined {
    if (!clip) return undefined;
    const tracks = clip.tracks.map(track => {
      const copy = track.clone();
      if (!(copy instanceof THREE.VectorKeyframeTrack) || !/hips.*position/i.test(copy.name)) return copy;
      const values = copy.values, x = values[0], z = values[2];
      for (let i = 0; i < values.length; i += 3) { values[i] = x; values[i + 2] = z; }
      return copy;
    });
    return new THREE.AnimationClip(name, clip.duration, tracks);
  }

  private findBone(root: THREE.Object3D, suffix: string): THREE.Bone | undefined {
    let found: THREE.Bone | undefined;
    root.traverse(object => {
      if (found || !(object instanceof THREE.Bone)) return;
      if (object.name.toLowerCase().replace(/[^a-z0-9]/g, '').endsWith(suffix)) found = object;
    });
    return found;
  }

  private attachEquipment(model: THREE.Group, hand: THREE.Bone, kind: 'spear' | 'shield', bodyRatio: number): void {
    model.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = true; });
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    if (kind === 'spear') model.position.y += size.y * .18;
    const node = new THREE.Group(); node.add(model);
    node.scale.setScalar(2.8 * bodyRatio / Math.max(size.x, size.y, size.z, .0001));
    if (kind === 'spear') node.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, .68, .73).normalize());
    this.scene!.add(node);
    this.equipment.push({ node, hand });
  }

  private updateEquipment(): void {
    const position = new THREE.Vector3();
    for (const item of this.equipment) {
      item.hand.getWorldPosition(position);
      item.node.position.copy(position);
    }
  }
}
