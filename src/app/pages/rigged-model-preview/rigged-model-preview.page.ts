import { Component, ElementRef, OnDestroy, AfterViewInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

type EquipmentKind = 'spear' | 'shield';
type DragTarget = 'hand' | 'shield' | 'bone';
interface EquipmentTransform { x: number; y: number; z: number; rx: number; ry: number; rz: number; scale: number; }

@Component({
  standalone: true,
  imports: [IonContent, FormsModule],
  templateUrl: './rigged-model-preview.page.html',
  styleUrl: './rigged-model-preview.page.scss'
})
export class RiggedModelPreviewPage implements AfterViewInit, OnDestroy {
  @ViewChild('viewport', { static: true }) private viewport!: ElementRef<HTMLDivElement>;

  readonly status = signal('Загрузка модели…');
  readonly boneNames = signal<string[]>([]);
  readonly playing = signal(true);
  readonly currentTime = signal(0);
  readonly duration = signal(0);
  readonly calibrationStatus = signal('');
  selectedBone = 'left_hip';
  rotationX = 0;
  rotationY = 0;
  rotationZ = 0;
  skeletonVisible = false;
  selectedEquipment: EquipmentKind = 'spear';
  selectedDragTarget: DragTarget = 'hand';
  dragMode: 'translate' | 'rotate' = 'translate';
  bodyPoseOnly = false;
  readonly equipment: Record<EquipmentKind, EquipmentTransform> = {
    spear: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
    shield: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 }
  };

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private controls?: OrbitControls;
  private transformControls?: TransformControls;
  private handTarget?: THREE.Mesh;
  private leftArm?: THREE.Bone;
  private leftForeArm?: THREE.Bone;
  private leftHand?: THREE.Bone;
  private loadedModel?: THREE.Group;
  private bonePickHandler?: (event: PointerEvent) => void;
  private boneMoveHandler?: (event: PointerEvent) => void;
  private boneUpHandler?: (event: PointerEvent) => void;
  private transformDragging = false;
  private directBoneDragging = false;
  private directPointerId?: number;
  private directLastX = 0;
  private directLastY = 0;
  private readonly directTarget = new THREE.Vector3();
  private directEffector?: THREE.Bone;
  private boneSelectionMarker?: THREE.Mesh;
  private releaseTransformHandler?: () => void;
  private skeletonHelper?: THREE.SkeletonHelper;
  private frameId?: number;
  private mixer?: THREE.AnimationMixer;
  private readonly timer = new THREE.Timer();
  private readonly bones = new Map<string, THREE.Bone>();
  private readonly initialRotations = new Map<string, THREE.Euler>();
  private readonly equipmentObjects = new Map<EquipmentKind, THREE.Object3D>();
  private readonly equipmentAxes = new Map<EquipmentKind, THREE.AxesHelper>();
  private readonly equipmentBaseScales = new Map<EquipmentKind, THREE.Vector3>();
  private readonly appliedEquipmentPositions = new Map<EquipmentKind, THREE.Vector3>();
  private readonly appliedEquipmentRotations = new Map<EquipmentKind, THREE.Quaternion>();

  constructor(private readonly router: Router, private readonly route: ActivatedRoute) {}

  ngAfterViewInit(): void {
    this.createScene();
    this.loadModel();
  }

  ngOnDestroy(): void {
    if (this.frameId !== undefined) cancelAnimationFrame(this.frameId);
    this.controls?.dispose();
    this.transformControls?.dispose();
    if (this.renderer && this.bonePickHandler) this.renderer.domElement.removeEventListener('pointerdown', this.bonePickHandler);
    if (this.renderer && this.boneMoveHandler) this.renderer.domElement.removeEventListener('pointermove', this.boneMoveHandler);
    if (this.boneUpHandler) {
      window.removeEventListener('pointerup', this.boneUpHandler, true);
      window.removeEventListener('pointercancel', this.boneUpHandler, true);
    }
    if (this.releaseTransformHandler) {
      window.removeEventListener('pointerup', this.releaseTransformHandler, true);
      window.removeEventListener('pointercancel', this.releaseTransformHandler, true);
      window.removeEventListener('blur', this.releaseTransformHandler);
    }
    this.renderer?.dispose();
  }

  goBack(): void {
    void this.router.navigateByUrl('/movement-circle-preview');
  }

  selectBone(): void {
    const initial = this.initialRotations.get(this.selectedBone);
    this.rotationX = initial ? THREE.MathUtils.radToDeg(initial.x) : 0;
    this.rotationY = initial ? THREE.MathUtils.radToDeg(initial.y) : 0;
    this.rotationZ = initial ? THREE.MathUtils.radToDeg(initial.z) : 0;
    if (this.selectedDragTarget === 'bone') {
      const bone = this.directEffector;
      if (bone) this.transformControls?.attach(bone);
    }
  }

  applyRotation(): void {
    const bone = this.bones.get(this.selectedBone);
    if (!bone) return;
    bone.rotation.set(
      THREE.MathUtils.degToRad(this.rotationX),
      THREE.MathUtils.degToRad(this.rotationY),
      THREE.MathUtils.degToRad(this.rotationZ)
    );
  }

  resetPose(): void {
    this.initialRotations.forEach((rotation, name) => {
      this.bones.get(name)?.rotation.copy(rotation);
    });
    this.selectBone();
  }

  toggleSkeleton(): void {
    this.skeletonVisible = !this.skeletonVisible;
    if (this.skeletonHelper) this.skeletonHelper.visible = this.skeletonVisible;
  }

  get selectedEquipmentTransform(): EquipmentTransform { return this.equipment[this.selectedEquipment]; }

  togglePlay(): void { this.playing.update(value => !value); }

  seek(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.currentTime.set(value);
    this.clearEquipmentCorrections();
    this.mixer?.setTime(value);
    this.applyEquipmentCorrections();
  }

  applyEquipment(): void {
    this.clearEquipmentCorrections();
    this.mixer?.setTime(this.currentTime());
    this.applyEquipmentCorrections();
  }

  selectEquipment(kind: EquipmentKind): void {
    this.selectedEquipment = kind;
    this.equipmentAxes.forEach((axes, key) => axes.visible = key === kind);
  }

  resetEquipment(): void {
    Object.assign(this.selectedEquipmentTransform, { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 });
    this.applyEquipment();
  }

  setCamera(view: 'front' | 'side' | 'top'): void {
    if (!this.camera || !this.controls) return;
    const target = this.controls.target;
    const distance = 5.5;
    if (view === 'front') this.camera.position.set(target.x, target.y + 0.4, target.z + distance);
    if (view === 'side') this.camera.position.set(target.x + distance, target.y + 0.4, target.z);
    if (view === 'top') this.camera.position.set(target.x, target.y + distance, target.z + 0.001);
    this.camera.lookAt(target);
    this.controls.update();
  }

  selectDragTarget(target: DragTarget): void {
    this.selectedDragTarget = target;
    if (!this.transformControls) return;
    const object = target === 'hand'
      ? (this.dragMode === 'rotate' ? this.leftHand : this.handTarget)
      : target === 'bone'
        ? this.bones.get(this.selectedBone)
        : this.equipmentObjects.get('shield');
    if (object) this.transformControls.attach(object);
    this.transformControls.setMode(this.dragMode);
    this.transformControls.setSpace(this.dragMode === 'rotate' ? 'local' : 'world');
  }

  setDragMode(mode: 'translate' | 'rotate'): void {
    if (this.selectedDragTarget === 'bone' && mode === 'translate') return;
    this.dragMode = mode;
    if (!this.transformControls) return;
    const object = this.selectedDragTarget === 'hand'
      ? (mode === 'rotate' ? this.leftHand : this.handTarget)
      : this.selectedDragTarget === 'bone'
        ? this.bones.get(this.selectedBone)
        : this.equipmentObjects.get('shield');
    if (object) this.transformControls.attach(object);
    this.transformControls.setMode(mode);
    // The wrist must rotate around its own joint axes relative to the forearm.
    // Movement of the IK target remains in world/screen-oriented axes.
    this.transformControls.setSpace(mode === 'rotate' ? 'local' : 'world');
  }

  async copyCalibration(): Promise<void> {
    const boneData = (bone: THREE.Bone | undefined) => bone ? {
      name: bone.name,
      quaternion: [bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w].map(value => Number(value.toFixed(6)))
    } : null;
    const shield = this.equipmentObjects.get('shield');
    const changedBones = [...this.bones.entries()].flatMap(([name, bone]) => {
      const initial = this.initialRotations.get(name);
      if (!initial || initial.equals(bone.rotation)) return [];
      return [{
        name,
        quaternion: [bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w].map(value => Number(value.toFixed(6)))
      }];
    });
    const payload = {
      frameSeconds: Number(this.currentTime().toFixed(4)),
      leftArm: boneData(this.leftArm),
      leftForeArm: boneData(this.leftForeArm),
      leftHand: boneData(this.leftHand),
      changedBones,
      shield: shield ? {
        position: [shield.position.x, shield.position.y, shield.position.z].map(value => Number(value.toFixed(6))),
        quaternion: [shield.quaternion.x, shield.quaternion.y, shield.quaternion.z, shield.quaternion.w].map(value => Number(value.toFixed(6))),
        scale: [shield.scale.x, shield.scale.y, shield.scale.z].map(value => Number(value.toFixed(6)))
      } : null
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      this.calibrationStatus.set('Настройки скопированы. Вставьте их в сообщение мне.');
    } catch {
      this.calibrationStatus.set(text);
    }
  }

  boneLabel(name: string): string {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const labels: Array<[string, string]> = [
      ['righthand', 'Правая кисть'], ['rightforearm', 'Правое предплечье'], ['rightarm', 'Правое плечо'],
      ['lefthand', 'Левая кисть'], ['leftforearm', 'Левое предплечье'], ['leftarm', 'Левое плечо'],
      ['rightfoot', 'Правая стопа'], ['rightleg', 'Правая голень'], ['rightupleg', 'Правое бедро'],
      ['leftfoot', 'Левая стопа'], ['leftleg', 'Левая голень'], ['leftupleg', 'Левое бедро'],
      ['head', 'Голова'], ['neck', 'Шея'], ['spine2', 'Грудь'], ['spine1', 'Корпус'], ['spine', 'Поясница'], ['hips', 'Таз']
    ];
    const label = labels.find(([suffix]) => normalized.endsWith(suffix))?.[1];
    return label ? `${label} — ${name}` : name;
  }

  private createScene(): void {
    const host = this.viewport.nativeElement;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x18251b);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(35, host.clientWidth / host.clientHeight, 0.01, 100);
    camera.position.set(3.8, 3.4, 5.4);
    this.camera = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);
    this.renderer = renderer;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x263820, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.5, 64),
      new THREE.MeshStandardMaterial({ color: 0x31442c, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(6, 24, 0xd8bd63, 0x526b49);
    grid.position.y = 0.006;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach(material => { material.transparent = true; material.opacity = 0.38; });
    scene.add(grid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1.25, 0);
    this.controls = controls;

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setSize(0.72);
    transformControls.addEventListener('dragging-changed', event => {
      this.transformDragging = (event as unknown as { value: boolean }).value;
      controls.enabled = !this.transformDragging;
      if (this.transformDragging) this.playing.set(false);
    });
    transformControls.addEventListener('objectChange', () => {
      if (this.selectedDragTarget === 'hand' && this.dragMode === 'translate') this.solveLeftArmToTarget();
    });
    // A pointer released outside the canvas may never reach TransformControls.
    // Always clear the drag lock at the window boundary so body picking cannot
    // become permanently disabled after several edits.
    this.releaseTransformHandler = (): void => {
      this.transformDragging = false;
      controls.enabled = true;
    };
    window.addEventListener('pointerup', this.releaseTransformHandler, true);
    window.addEventListener('pointercancel', this.releaseTransformHandler, true);
    window.addEventListener('blur', this.releaseTransformHandler);
    scene.add(transformControls.getHelper());
    this.transformControls = transformControls;

    const render = (): void => {
      this.timer.update();
      if (this.playing()) {
        this.clearEquipmentCorrections();
        this.mixer?.update(this.timer.getDelta());
        const duration = this.duration();
        if (this.mixer && duration > 0) this.currentTime.set(this.mixer.time % duration);
        this.applyEquipmentCorrections();
      }
      const selected = this.bones.get(this.selectedBone);
      if (selected && this.boneSelectionMarker?.visible) selected.getWorldPosition(this.boneSelectionMarker.position);
      controls.update();
      renderer.render(scene, camera);
      this.frameId = requestAnimationFrame(render);
    };
    render();

    const resize = new ResizeObserver(() => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    });
    resize.observe(host);
  }

  private loadModel(): void {
    if (!this.scene || !this.controls) return;
    const modelKind = this.route.snapshot.queryParamMap.get('model');
    const carrotCombat = modelKind === 'carrot-combat';
    const carrotMasterWalk = modelKind === 'carrot-master-walk';
    const carrotLudoWalk = modelKind === 'carrot-ludo-walk';
    const carrotBodyCape = modelKind === 'carrot-body-cape';
    const carrotCombatComplete = modelKind === 'carrot-combat-complete';
    this.bodyPoseOnly = carrotCombatComplete;
    if (carrotCombatComplete && this.transformControls) {
      this.transformControls.enabled = false;
      this.transformControls.getHelper().visible = false;
    }
    const modelUrl = carrotCombatComplete
      ? 'assets/scenes/3d/carrot/carrot-master-combat-walk-v1.glb'
      : carrotBodyCape
      ? 'assets/scenes/3d/carrot/carrot-body-cape-rigged.glb'
      : carrotLudoWalk
      ? 'assets/scenes/3d/carrot/carrot-ludo-walk.glb'
      : carrotMasterWalk
      ? 'assets/scenes/3d/carrot/carrot-master-combat-walk-v2.glb'
      : carrotCombat
        ? 'assets/scenes/3d/carrot/carrot-combat-blender-v1.glb'
        : 'assets/scenes/3d/tomato/tomato-rigged-equipment-fixed.glb';
    new GLTFLoader().load(
      modelUrl,
      gltf => {
        const model = gltf.scene;
        this.loadedModel = model;
        model.traverse(object => {
          if (object instanceof THREE.Bone) {
            this.bones.set(object.name, object);
            this.initialRotations.set(object.name, object.rotation.clone());
          }
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });

        this.leftArm = this.findBone('leftarm');
        this.leftForeArm = this.findBone('leftforearm');
        this.leftHand = this.findBone('lefthand');

        if (carrotCombat || carrotCombatComplete) {
          this.createEquipmentAdjustment(model, 'spear', 'Weapon_Spear');
          this.createEquipmentAdjustment(model, 'shield', 'Shield');
          if (carrotCombatComplete) {
            // Pose calibration is intentionally body-only. Equipment is added
            // after the body pose has been approved.
            const spear = this.equipmentObjects.get('spear');
            if (spear) spear.visible = true;
            const shield = this.equipmentObjects.get('shield');
            if (shield) shield.visible = true;
            this.equipmentAxes.forEach(axes => { axes.visible = false; });
          }
        }

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const scale = 2.8 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);
        box.setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.set(-center.x, -box.min.y, -center.z);
        this.scene!.add(model);
        this.installBonePicking(model);

        if (gltf.animations.length) {
          this.mixer = new THREE.AnimationMixer(model);
          // Blender stores the body and rigid equipment tracks as separate
          // clips. Playing them together reconstructs one synchronized take.
          gltf.animations.forEach(clip => this.mixer!.clipAction(clip).play());
          this.duration.set(Math.max(...gltf.animations.map(clip => clip.duration)));
        }


        if (carrotCombatComplete) {
          this.playing.set(true);
          this.mixer?.setTime(0);
          this.selectedDragTarget = 'bone';
          this.dragMode = 'rotate';
        }

        const helper = new THREE.SkeletonHelper(model);
        helper.visible = this.skeletonVisible;
        this.scene!.add(helper);
        this.skeletonHelper = helper;

        const names = [...this.bones.keys()].filter(name => {
          const normalized = name.toLowerCase();
          return !normalized.includes('end') && !normalized.includes('helper');
        });
        this.boneNames.set(names);
        if (!this.bones.has(this.selectedBone)) this.selectedBone = names[0] ?? '';
        this.selectBone();
        this.controls!.target.set(0, 1.35, 0);
        this.status.set(`Модель загружена · ${names.length} костей · ${gltf.animations.length} клипа`);
      },
      undefined,
      error => {
        console.error(error);
        this.status.set('Не удалось загрузить GLB');
      }
    );
  }

  private findBone(suffix: string): THREE.Bone | undefined {
    return [...this.bones.entries()].find(([name]) =>
      name.toLowerCase().replace(/[^a-z0-9]/g, '').endsWith(suffix)
    )?.[1];
  }

  private installBonePicking(model: THREE.Group): void {
    if (!this.renderer || !this.camera) return;
    const canvas = this.renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    this.bonePickHandler = (event: PointerEvent): void => {
      const activeAxis = (this.transformControls as unknown as { axis?: string | null })?.axis;
      // Ignore only a real manipulation that currently owns an axis. Any click
      // on the body forcibly recovers from a stale drag state.
      if (this.transformDragging && activeAxis) return;
      this.transformDragging = false;
      if (this.controls) this.controls.enabled = true;
      if (this.transformControls) this.transformControls.enabled = true;
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, this.camera!);
      const hits = raycaster.intersectObject(model, true);
      if (this.bodyPoseOnly && hits.some(item => item.object instanceof THREE.Mesh)) {
        const leftHand = this.findBone('lefthand');
        if (leftHand) {
          this.activateBone(leftHand);
          this.beginDirectBoneDrag(event, leftHand);
        }
        return;
      }
      const hit = hits.find(item =>
        item.object instanceof THREE.SkinnedMesh && item.face
      );
      if (!hit || !(hit.object instanceof THREE.SkinnedMesh) || !hit.face) {
        const surfaceHit = hits.find(item => item.object instanceof THREE.Mesh);
        if (surfaceHit) {
          const nearest = this.selectNearestBone(surfaceHit.point);
          if (nearest && this.bodyPoseOnly) this.beginDirectBoneDrag(event, nearest);
        }
        return;
      }
      const mesh = hit.object;
      const skinIndex = mesh.geometry.getAttribute('skinIndex');
      const skinWeight = mesh.geometry.getAttribute('skinWeight');
      const position = mesh.geometry.getAttribute('position');
      if (!skinIndex || !skinWeight || !position) return;

      // Accumulate skin influence over all three vertices of the clicked face.
      // This is much more stable than choosing only one triangle vertex.
      const influence = new Map<number, number>();
      for (const vertexIndex of [hit.face.a, hit.face.b, hit.face.c]) {
        const indices = [skinIndex.getX(vertexIndex), skinIndex.getY(vertexIndex), skinIndex.getZ(vertexIndex), skinIndex.getW(vertexIndex)];
        const weights = [skinWeight.getX(vertexIndex), skinWeight.getY(vertexIndex), skinWeight.getZ(vertexIndex), skinWeight.getW(vertexIndex)];
        indices.forEach((boneIndex, slot) => influence.set(boneIndex, (influence.get(boneIndex) ?? 0) + weights[slot]));
      }
      const strongest = [...influence.entries()].sort((a, b) => b[1] - a[1])[0];
      const bone = strongest ? mesh.skeleton.bones[strongest[0]] : undefined;
      if (bone) {
        this.activateBone(bone);
        if (this.bodyPoseOnly) this.beginDirectBoneDrag(event, bone);
      } else {
        const nearest = this.selectNearestBone(hit.point);
        if (nearest && this.bodyPoseOnly) this.beginDirectBoneDrag(event, nearest);
      }
    };
    canvas.addEventListener('pointerdown', this.bonePickHandler);

    this.boneMoveHandler = (event: PointerEvent): void => {
      if (!this.directBoneDragging || event.pointerId !== this.directPointerId || !this.camera) return;
      const bone = this.bones.get(this.selectedBone);
      if (!bone) return;
      const dx = event.clientX - this.directLastX;
      const dy = event.clientY - this.directLastY;
      this.directLastX = event.clientX;
      this.directLastY = event.clientY;
      if (dx === 0 && dy === 0) return;

      const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).normalize();
      const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion).normalize();
      this.directTarget.addScaledVector(cameraRight, dx * 0.0045);
      this.directTarget.addScaledVector(cameraUp, -dy * 0.0045);
      this.solveBoneChain(bone, this.directTarget);
      this.showSelectedJoint(bone);
    };
    canvas.addEventListener('pointermove', this.boneMoveHandler);

    this.boneUpHandler = (event: PointerEvent): void => {
      if (event.pointerId !== this.directPointerId) return;
      this.directBoneDragging = false;
      this.directPointerId = undefined;
      this.directEffector = undefined;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (this.controls) this.controls.enabled = true;
    };
    window.addEventListener('pointerup', this.boneUpHandler, true);
    window.addEventListener('pointercancel', this.boneUpHandler, true);
  }

  private selectNearestBone(worldPoint: THREE.Vector3): THREE.Bone | undefined {
    let selected: THREE.Bone | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    const position = new THREE.Vector3();
    for (const bone of this.bones.values()) {
      bone.getWorldPosition(position);
      const distance = position.distanceToSquared(worldPoint);
      if (distance < bestDistance) { bestDistance = distance; selected = bone; }
    }
    if (selected) this.activateBone(selected);
    return selected;
  }

  private beginDirectBoneDrag(event: PointerEvent, bone: THREE.Bone): void {
    if (!this.renderer) return;
    const effector = this.resolveLimbEffector(bone);
    this.directBoneDragging = true;
    this.directPointerId = event.pointerId;
    this.directLastX = event.clientX;
    this.directLastY = event.clientY;
    this.directEffector = effector;
    effector.getWorldPosition(this.directTarget);
    this.controls!.enabled = false;
    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.status.set(`Тяните: ${this.boneLabel(effector.name)}`);
  }

  private resolveLimbEffector(selected: THREE.Bone): THREE.Bone {
    const name = selected.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (name.includes('leftarm') || name.includes('leftforearm') || name.includes('lefthand')) {
      return this.findBone('lefthand') ?? selected;
    }
    if (name.includes('rightarm') || name.includes('rightforearm') || name.includes('righthand')) {
      return this.findBone('righthand') ?? selected;
    }
    if (name.includes('leftupleg') || name.includes('leftleg') || name.includes('leftfoot')) {
      return this.findBone('leftfoot') ?? selected;
    }
    if (name.includes('rightupleg') || name.includes('rightleg') || name.includes('rightfoot')) {
      return this.findBone('rightfoot') ?? selected;
    }
    return selected;
  }

  private solveBoneChain(effector: THREE.Bone, target: THREE.Vector3): void {
    const joints: THREE.Bone[] = [];
    let parent = effector.parent;
    while (parent instanceof THREE.Bone && joints.length < 2) {
      if (parent.name.toLowerCase().includes('hips')) break;
      joints.push(parent);
      parent = parent.parent;
    }
    if (!joints.length) return;

    const jointPosition = new THREE.Vector3();
    const effectorPosition = new THREE.Vector3();
    const toEffector = new THREE.Vector3();
    const toTarget = new THREE.Vector3();
    const worldDelta = new THREE.Quaternion();
    const parentWorld = new THREE.Quaternion();

    for (let pass = 0; pass < 12; pass++) {
      for (const joint of joints) {
        joint.updateWorldMatrix(true, true);
        effector.getWorldPosition(effectorPosition);
        joint.getWorldPosition(jointPosition);
        toEffector.subVectors(effectorPosition, jointPosition);
        toTarget.subVectors(target, jointPosition);
        if (toEffector.lengthSq() < 1e-10 || toTarget.lengthSq() < 1e-10) continue;
        worldDelta.setFromUnitVectors(toEffector.normalize(), toTarget.normalize());
        joint.parent?.getWorldQuaternion(parentWorld);
        const localDelta = parentWorld.clone().invert().multiply(worldDelta).multiply(parentWorld);
        joint.quaternion.premultiply(localDelta).normalize();
        joint.updateWorldMatrix(true, true);
      }
    }
  }

  private activateBone(bone: THREE.Bone): void {
    this.playing.set(false);
    this.selectedBone = bone.name;
    this.selectedDragTarget = 'bone';
    this.dragMode = 'rotate';
    this.selectBone();
    if (!this.bodyPoseOnly) {
      this.transformControls?.attach(bone);
      this.transformControls?.setMode('rotate');
      this.transformControls?.setSpace('local');
    }
    this.showSelectedJoint(bone);
    this.status.set(`Выбрана кость: ${this.boneLabel(bone.name)}`);
  }

  private showSelectedJoint(bone: THREE.Bone): void {
    if (!this.scene) return;
    if (!this.boneSelectionMarker) {
      this.boneSelectionMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 16, 10),
        new THREE.MeshBasicMaterial({ color: 0x00e5ff, depthTest: false })
      );
      this.boneSelectionMarker.renderOrder = 2500;
      this.scene.add(this.boneSelectionMarker);
    }
    bone.getWorldPosition(this.boneSelectionMarker.position);
    this.boneSelectionMarker.visible = true;
  }

  private createHandDragTarget(): void {
    if (!this.scene || !this.leftHand) return;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 20, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd84d, depthTest: false })
    );
    marker.name = 'LeftHandDragTarget';
    marker.renderOrder = 2000;
    this.leftHand.getWorldPosition(marker.position);
    this.scene.add(marker);
    this.handTarget = marker;
  }

  private solveLeftArmToTarget(): void {
    if (!this.handTarget || !this.leftArm || !this.leftForeArm || !this.leftHand) return;
    this.leftForeArm.updateWorldMatrix(true, true);
    const forearmBefore = this.leftForeArm.matrixWorld.clone();
    const shield = this.equipmentObjects.get('shield');
    shield?.updateWorldMatrix(true, false);
    const shieldBefore = shield?.matrixWorld.clone();
    // CCD works in world space and therefore does not depend on the unusual
    // local-axis convention of this imported rig.
    const joints = [this.leftForeArm, this.leftArm];
    const jointPosition = new THREE.Vector3();
    const effectorPosition = new THREE.Vector3();
    const toEffector = new THREE.Vector3();
    const toTarget = new THREE.Vector3();
    const worldDelta = new THREE.Quaternion();
    const parentWorld = new THREE.Quaternion();
    const localDelta = new THREE.Quaternion();

    for (let pass = 0; pass < 10; pass++) {
      for (const joint of joints) {
        joint.updateWorldMatrix(true, true);
        this.leftHand.getWorldPosition(effectorPosition);
        joint.getWorldPosition(jointPosition);
        toEffector.subVectors(effectorPosition, jointPosition).normalize();
        toTarget.subVectors(this.handTarget.position, jointPosition).normalize();
        if (!Number.isFinite(toEffector.x) || !Number.isFinite(toTarget.x)) continue;
        worldDelta.setFromUnitVectors(toEffector, toTarget);
        joint.parent?.getWorldQuaternion(parentWorld);
        localDelta.copy(parentWorld).invert().multiply(worldDelta).multiply(parentWorld);
        joint.quaternion.premultiply(localDelta).normalize();
        joint.updateWorldMatrix(true, true);
      }
    }

    // Carry the shield with the forearm while the arm is dragged. It remains a
    // rigid object; its own drag handle can then fine-tune the strap position.
    if (shield && shieldBefore) {
      this.leftForeArm.updateWorldMatrix(true, true);
      const forearmDelta = this.leftForeArm.matrixWorld.clone().multiply(forearmBefore.invert());
      const desiredWorld = forearmDelta.multiply(shieldBefore);
      const parentInverse = shield.parent
        ? shield.parent.matrixWorld.clone().invert()
        : new THREE.Matrix4();
      shield.matrix.copy(parentInverse.multiply(desiredWorld));
      shield.matrix.decompose(shield.position, shield.quaternion, shield.scale);
      shield.updateWorldMatrix(false, true);
    }
  }

  private createEquipmentAdjustment(model: THREE.Group, kind: EquipmentKind, objectName: string): void {
    const equipment = model.getObjectByName(objectName);
    if (!equipment) return;
    this.equipmentObjects.set(kind, equipment);
    this.equipmentBaseScales.set(kind, equipment.scale.clone());
    const axes = new THREE.AxesHelper(0.65);
    axes.name = `${objectName}_Axes`;
    axes.visible = kind === this.selectedEquipment;
    axes.renderOrder = 1000;
    const materials = Array.isArray(axes.material) ? axes.material : [axes.material];
    materials.forEach(material => { material.depthTest = false; material.transparent = true; material.opacity = 0.95; });
    equipment.add(axes);
    this.equipmentAxes.set(kind, axes);
  }

  private applyEquipmentCorrections(): void {
    const correction = new THREE.Quaternion();
    for (const [kind, object] of this.equipmentObjects) {
      const value = this.equipment[kind];
      const baseScale = this.equipmentBaseScales.get(kind);
      const position = new THREE.Vector3(value.x, value.y, value.z);
      object.position.add(position);
      correction.setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(value.rx),
        THREE.MathUtils.degToRad(value.ry),
        THREE.MathUtils.degToRad(value.rz)
      ));
      object.quaternion.premultiply(correction);
      if (baseScale) object.scale.copy(baseScale).multiplyScalar(value.scale);
      this.appliedEquipmentPositions.set(kind, position);
      this.appliedEquipmentRotations.set(kind, correction.clone());
    }
  }

  private clearEquipmentCorrections(): void {
    for (const [kind, object] of this.equipmentObjects) {
      const position = this.appliedEquipmentPositions.get(kind);
      const rotation = this.appliedEquipmentRotations.get(kind);
      if (position) object.position.sub(position);
      if (rotation) object.quaternion.premultiply(rotation.clone().invert());
    }
    this.appliedEquipmentPositions.clear();
    this.appliedEquipmentRotations.clear();
  }
}
