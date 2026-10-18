import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

type EquipmentKind = 'spear' | 'shield';

interface EquipmentControls {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  scale: number;
}

const ASSET_ROOT = 'assets/scenes/3d/carrot';
const BASE_LAP_SECONDS = 18;
const BODY_RENDER_HEIGHT = 1.8;
const ROUTE_RADIUS = 2.85;
const OCTAGON_POINTS = Array.from({ length: 8 }, (_, index) => {
  const angle = Math.PI / 8 + index * Math.PI / 4;
  return new THREE.Vector3(Math.sin(angle) * ROUTE_RADIUS, 0, Math.cos(angle) * ROUTE_RADIUS);
});

@Component({
  standalone: true,
  imports: [IonContent, FormsModule],
  templateUrl: './movement-octagon-3d-preview.page.html',
  styleUrl: './movement-octagon-3d-preview.page.scss'
})
export class MovementOctagon3dPreviewPage implements AfterViewInit, OnDestroy {
  @ViewChild('viewport', { static: true }) private viewport!: ElementRef<HTMLDivElement>;

  readonly status = signal('Загрузка трёх GLB…');
  readonly isPlaying = signal(true);
  readonly speed = signal(1);
  readonly equipmentReady = signal(false);

  selectedEquipment: EquipmentKind = 'spear';
  readonly equipment: Record<EquipmentKind, EquipmentControls> = {
    spear: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
    shield: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 }
  };

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.OrthographicCamera;
  private mixer?: THREE.AnimationMixer;
  private actor?: THREE.Group;
  private frameId?: number;
  private resizeObserver?: ResizeObserver;
  private previousTime = performance.now();
  private routeElapsed = 0;
  private bodyHeight = 1;
  private readonly equipmentNodes = new Map<EquipmentKind, {
    node: THREE.Group;
    hand: THREE.Object3D;
    baseRotation: THREE.Quaternion;
    baseScale: number;
  }>();

  constructor(private readonly router: Router) {}

  get currentEquipment(): EquipmentControls {
    return this.equipment[this.selectedEquipment];
  }

  ngAfterViewInit(): void {
    this.createScene();
    void this.loadAssets();
  }

  ngOnDestroy(): void {
    if (this.frameId !== undefined) cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.renderer?.dispose();
  }

  goBack(): void {
    void this.router.navigateByUrl('/movement-circle-preview');
  }

  togglePlay(): void {
    this.isPlaying.update(value => !value);
  }

  setSpeed(event: Event): void {
    this.speed.set(Number((event.target as HTMLInputElement).value));
  }

  applyEquipmentTransform(): void {
    this.updateEquipmentTransforms();
  }

  resetEquipment(): void {
    Object.assign(
      this.currentEquipment,
      this.selectedEquipment === 'spear'
        ? { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 }
        : { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 }
    );
    this.applyEquipmentTransform();
  }

  private createScene(): void {
    const host = this.viewport.nativeElement;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x17281a);
    scene.fog = new THREE.Fog(0x17281a, 9, 16);
    this.scene = scene;

    const camera = new THREE.OrthographicCamera(-4.6, 4.6, 4.7, -4.7, 0.1, 30);
    camera.position.set(0, 7.5, 9.5);
    camera.lookAt(0, 0, 0);
    this.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(renderer.domElement);
    this.renderer = renderer;

    scene.add(new THREE.HemisphereLight(0xfff4cf, 0x18301c, 2.4));
    const sun = new THREE.DirectionalLight(0xfff0c2, 3.6);
    sun.position.set(-4, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -6;
    sun.shadow.camera.right = 6;
    sun.shadow.camera.top = 6;
    sun.shadow.camera.bottom = -6;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(5.7, 64),
      new THREE.MeshStandardMaterial({ color: 0x355537, roughness: 0.96 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const pathGeometry = new THREE.BufferGeometry().setFromPoints(OCTAGON_POINTS.map(point => point.clone().setY(0.012)));
    const path = new THREE.LineLoop(
      pathGeometry,
      new THREE.LineDashedMaterial({ color: 0xf2d36e, dashSize: 0.16, gapSize: 0.11, transparent: true, opacity: 0.65 })
    );
    path.computeLineDistances();
    scene.add(path);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.animate();
  }

  private async loadAssets(): Promise<void> {
    if (!this.scene) return;
    try {
      const loader = new GLTFLoader();
      const [bodyGltf, spearGltf, shieldGltf] = await Promise.all([
        loader.loadAsync(`${ASSET_ROOT}/carrot-body.glb`),
        loader.loadAsync(`${ASSET_ROOT}/spear.glb`),
        loader.loadAsync(`${ASSET_ROOT}/shield.glb`)
      ]);

      const actor = new THREE.Group();
      const body = bodyGltf.scene;
      body.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      const bodyBox = new THREE.Box3().setFromObject(body);
      this.bodyHeight = bodyBox.getSize(new THREE.Vector3()).y || 1;
      const bodyScale = BODY_RENDER_HEIGHT / this.bodyHeight;
      body.position.sub(new THREE.Vector3(bodyBox.getCenter(new THREE.Vector3()).x, bodyBox.min.y, bodyBox.getCenter(new THREE.Vector3()).z));
      actor.scale.setScalar(bodyScale);
      actor.add(body);
      this.scene.add(actor);
      this.actor = actor;

      const rightHand = this.findBone(body, 'righthand');
      const leftHand = this.findBone(body, 'lefthand');
      if (!rightHand || !leftHand) throw new Error('Не найдены кости кистей Mixamo');

      this.attachEquipment('spear', spearGltf.scene, rightHand, 0.92);
      this.attachEquipment('shield', shieldGltf.scene, leftHand, 0.38);
      this.equipmentReady.set(true);

      if (bodyGltf.animations.length) {
        const clip = this.removeHorizontalRootMotion(bodyGltf.animations[0]);
        this.mixer = new THREE.AnimationMixer(body);
        this.mixer.clipAction(clip).play();
        this.status.set(`Готово · ${clip.duration.toFixed(2)} с · оружие прикреплено к кистям`);
      } else {
        this.status.set('Модель загружена, но анимация в GLB не найдена');
      }
    } catch (error) {
      console.error(error);
      this.status.set('Не удалось загрузить или собрать 3D-персонажа');
    }
  }

  private attachEquipment(
    kind: EquipmentKind,
    equipmentScene: THREE.Group,
    hand: THREE.Object3D,
    targetLengthInBodyHeights: number
  ): void {
    equipmentScene.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(equipmentScene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const wrapper = new THREE.Group();
    equipmentScene.position.sub(center);
    // The spear is authored along local +Y. Its grip lies below the centre.
    if (kind === 'spear') equipmentScene.position.y += size.y * 0.18;
    wrapper.add(equipmentScene);
    this.actor?.add(wrapper);

    // Equipment follows the hand position, but not the hand bone's arbitrary
    // twist. Thus its planes remain meaningful relative to travel direction.
    const baseRotation = kind === 'spear'
      ? new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0.68, 0.73).normalize()
        )
      : new THREE.Quaternion(); // Shield is authored in XY; its face points +Z.
    const baseScale = this.bodyHeight * targetLengthInBodyHeights
      / Math.max(size.x, size.y, size.z, 0.0001);
    this.equipmentNodes.set(kind, { node: wrapper, hand, baseRotation, baseScale });
    this.applyEquipmentTransformFor(kind);
  }

  private updateEquipmentTransforms(): void {
    if (!this.actor) return;
    this.actor.updateWorldMatrix(true, false);
    const handPosition = new THREE.Vector3();
    const adjustment = new THREE.Quaternion();
    const euler = new THREE.Euler();
    for (const [kind, entry] of this.equipmentNodes) {
      const value = this.equipment[kind];
      entry.hand.getWorldPosition(handPosition);
      this.actor.worldToLocal(handPosition);
      entry.node.position.copy(handPosition).add(
        new THREE.Vector3(value.x, value.y, value.z).multiplyScalar(this.bodyHeight)
      );
      euler.set(
        THREE.MathUtils.degToRad(value.rx),
        THREE.MathUtils.degToRad(value.ry),
        THREE.MathUtils.degToRad(value.rz)
      );
      adjustment.setFromEuler(euler);
      entry.node.quaternion.copy(entry.baseRotation).multiply(adjustment);
      entry.node.scale.setScalar(entry.baseScale * value.scale);
    }
  }

  private findBone(root: THREE.Object3D, normalizedSuffix: string): THREE.Bone | undefined {
    let result: THREE.Bone | undefined;
    root.traverse(object => {
      if (result || !(object instanceof THREE.Bone)) return;
      const normalized = object.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalized.endsWith(normalizedSuffix)) result = object;
    });
    return result;
  }

  private applyEquipmentTransformFor(kind: EquipmentKind): void {
    const previous = this.selectedEquipment;
    this.selectedEquipment = kind;
    this.applyEquipmentTransform();
    this.selectedEquipment = previous;
  }

  private removeHorizontalRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
    const tracks = clip.tracks.map(track => {
      const clone = track.clone();
      if (!clone.name.includes('mixamorig:Hips.position') || !(clone instanceof THREE.VectorKeyframeTrack)) return clone;
      const values = clone.values;
      const startX = values[0];
      const startZ = values[2];
      for (let index = 0; index < values.length; index += 3) {
        values[index] = startX;
        values[index + 2] = startZ;
      }
      return clone;
    });
    return new THREE.AnimationClip(`${clip.name}-in-place`, clip.duration, tracks);
  }

  private animate(): void {
    const now = performance.now();
    const delta = Math.min((now - this.previousTime) / 1000, 0.05);
    this.previousTime = now;
    if (this.isPlaying()) {
      const scaledDelta = delta * this.speed();
      this.routeElapsed += scaledDelta;
      this.mixer?.update(scaledDelta);
      this.updateActorOnRoute(this.routeElapsed / BASE_LAP_SECONDS % 1);
      this.updateEquipmentTransforms();
    }
    if (this.scene && this.camera && this.renderer) this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(() => this.animate());
  }

  private updateActorOnRoute(progress: number): void {
    if (!this.actor) return;
    const scaled = progress * OCTAGON_POINTS.length;
    const segment = Math.floor(scaled) % OCTAGON_POINTS.length;
    const phase = scaled - Math.floor(scaled);
    const start = OCTAGON_POINTS[segment];
    const end = OCTAGON_POINTS[(segment + 1) % OCTAGON_POINTS.length];
    this.actor.position.lerpVectors(start, end, phase);

    const currentAngle = Math.atan2(end.x - start.x, end.z - start.z);
    const next = OCTAGON_POINTS[(segment + 2) % OCTAGON_POINTS.length];
    const nextAngle = Math.atan2(next.x - end.x, next.z - end.z);
    const turnStart = 0.82;
    const blend = THREE.MathUtils.smoothstep(phase, turnStart, 1);
    const deltaAngle = Math.atan2(Math.sin(nextAngle - currentAngle), Math.cos(nextAngle - currentAngle));
    this.actor.rotation.y = currentAngle + deltaAngle * blend;
  }

  private resize(): void {
    if (!this.camera || !this.renderer) return;
    const host = this.viewport.nativeElement;
    if (!host.clientWidth || !host.clientHeight) return;
    const aspect = host.clientWidth / host.clientHeight;
    const vertical = 4.7;
    this.camera.left = -vertical * aspect;
    this.camera.right = vertical * aspect;
    this.camera.top = vertical;
    this.camera.bottom = -vertical;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(host.clientWidth, host.clientHeight);
  }
}
