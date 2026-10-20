import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import Phaser from 'phaser';

import { BattleRewardResponse } from '../../models/contracts';

const IDLE_FRAME_FILES = ["idle.png"];

const SIDE_MOVE_FRAME_FILES = ["walk-a.png","walk-b.png"];

const BACK_MOVE_FRAME_FILES = ["walk-a.png","walk-b.png"];

const FRONT_MOVE_FRAME_FILES = ["walk-a.png","walk-b.png"];

const SIDE_SHOOT_FRAME_FILES = ["cast.png"];

const BACK_SHOOT_FRAME_FILES = ["cast.png"];

const FRONT_SHOOT_FRAME_FILES = ["cast.png"];

const FRAME_ASSET_VERSION = 'controlled-unit-v4';
const ATTACK_RANGE_BUFFER = 18;
const ATTACK_COOLDOWN_MS = 550;
const MOVE_STEP_DELAY_MS = 90;

type MoveDirection = 'side' | 'back' | 'front';
type FighterTeam = 'player' | 'enemy';
type FighterStatus = 'idle' | 'moving' | 'attacking' | 'dead';
type FightResult = 'victory' | 'defeat';

type MoveFrameSet = {
  direction: MoveDirection;
  frameCount: number;
  flipX: boolean;
};

type FighterUnit = {
  id: string;
  team: FighterTeam;
  status: FighterStatus;
  hp: number;
  maxHp: number;
  attack: number;
  attackRange: number;
  tint: number;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  selection: Phaser.GameObjects.Ellipse;
  rangeMarker: Phaser.GameObjects.Ellipse;
  healthBackground: Phaser.GameObjects.Rectangle;
  healthFill: Phaser.GameObjects.Rectangle;
  healthText: Phaser.GameObjects.Text;
  defeatedText: Phaser.GameObjects.Text;
  moveEvent: Phaser.Time.TimerEvent | null;
  attackTarget: FighterUnit | null;
  isAttacking: boolean;
  nextAttackAt: number;
};

class FightMoveScene extends Phaser.Scene {
  private pressedUnit: FighterUnit | null = null;
  private selectedUnit: FighterUnit | null = null;
  private units: FighterUnit[] = [];
  private battleFinished = false;

  constructor(private readonly onBattleFinished?: (result: FightResult) => void) {
    super('FightMoveScene');
  }

  preload(): void {
    this.load.image('battle-background', 'assets/shared/backgrounds/battle.png');

    IDLE_FRAME_FILES.forEach((fileName, index) => {
      this.load.image(this.idleFrameKey(index), `assets/characters/tomato/sprites/front/${fileName}?v=${FRAME_ASSET_VERSION}`);
    });

    SIDE_MOVE_FRAME_FILES.forEach((fileName, index) => {
      this.load.image(this.sideMoveFrameKey(index), `assets/characters/tomato/sprites/front/${fileName}?v=${FRAME_ASSET_VERSION}`);
    });

    BACK_MOVE_FRAME_FILES.forEach((fileName, index) => {
      this.load.image(this.backMoveFrameKey(index), `assets/characters/tomato/sprites/back/${fileName}?v=${FRAME_ASSET_VERSION}`);
    });

    FRONT_MOVE_FRAME_FILES.forEach((fileName, index) => {
      this.load.image(this.frontMoveFrameKey(index), `assets/characters/tomato/sprites/front/${fileName}?v=${FRAME_ASSET_VERSION}`);
    });

    SIDE_SHOOT_FRAME_FILES.forEach((fileName, index) => {
      this.load.image(this.sideShootFrameKey(index), `assets/characters/tomato/sprites/front/${fileName}?v=${FRAME_ASSET_VERSION}`);
    });

    BACK_SHOOT_FRAME_FILES.forEach((fileName, index) => {
      this.load.image(this.backShootFrameKey(index), `assets/characters/tomato/sprites/back/${fileName}?v=${FRAME_ASSET_VERSION}`);
    });

    FRONT_SHOOT_FRAME_FILES.forEach((fileName, index) => {
      this.load.image(this.frontShootFrameKey(index), `assets/characters/tomato/sprites/front/${fileName}?v=${FRAME_ASSET_VERSION}`);
    });
  }

  create(): void {
    const { width, height } = this.scale;
    this.pressedUnit = null;
    this.selectedUnit = null;
    this.units = [];
    this.battleFinished = false;

    this.cameras.main.setBackgroundColor('#11170d');
    this.addCoverImage('battle-background', width / 2, height / 2, width, height);

    this.anims.create({
      key: 'tomato-idle',
      frames: IDLE_FRAME_FILES.map((_, index) => ({ key: this.idleFrameKey(index) })),
      frameRate: 2,
      repeat: -1
    });

    this.anims.create({
      key: 'tomato-move',
      frames: SIDE_MOVE_FRAME_FILES.map((_, index) => ({ key: this.sideMoveFrameKey(index) })),
      frameRate: 5,
      repeat: -1
    });

    this.anims.create({
      key: 'tomato-side-shoot',
      frames: SIDE_SHOOT_FRAME_FILES.map((_, index) => ({ key: this.sideShootFrameKey(index) })),
      frameRate: 12,
      repeat: 0
    });

    this.anims.create({
      key: 'tomato-back-shoot',
      frames: BACK_SHOOT_FRAME_FILES.map((_, index) => ({ key: this.backShootFrameKey(index) })),
      frameRate: 12,
      repeat: 0
    });

    this.anims.create({
      key: 'tomato-front-shoot',
      frames: FRONT_SHOOT_FRAME_FILES.map((_, index) => ({ key: this.frontShootFrameKey(index) })),
      frameRate: 12,
      repeat: 0
    });

    const rangedFighter = this.createFighterUnit({
      id: 'player',
      team: 'player',
      x: width * 0.16,
      y: height * 0.58,
      attackRange: 190,
      maxHp: 180,
      attack: 24,
      tint: 0xffffff
    });
    const meleeFighter = this.createFighterUnit({
      id: 'enemy',
      team: 'enemy',
      x: width * 0.72,
      y: height * 0.45,
      attackRange: 78,
      maxHp: 120,
      attack: 14,
      tint: 0x99d7ff
    });

    meleeFighter.sprite.setFlipX(true);
    this.units = [rangedFighter, meleeFighter];
    this.selectUnit(rangedFighter);
    this.input.setTopOnly(false);
    meleeFighter.attackTarget = rangedFighter;
    this.time.delayedCall(5000, () => {
      if (!this.battleFinished && meleeFighter.status !== 'dead') {
        this.commandAttack(meleeFighter, rangedFighter);
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[]) => {
      if (this.battleFinished) {
        return;
      }

      const clickedUnit = this.findClickedUnit(gameObjects);

      if (clickedUnit) {
        this.pressedUnit = clickedUnit;
        return;
      }

      this.pressedUnit = null;

      if (!this.selectedUnit || this.selectedUnit.status === 'dead') {
        return;
      }

      const targetX = Phaser.Math.Clamp(pointer.x, 58, width - 58);
      const targetY = Phaser.Math.Clamp(pointer.y, 130, height - 58);
      this.playSteppedMove(this.selectedUnit, targetX, targetY);
    });

    this.input.on('pointerup', () => {
      if (!this.pressedUnit) {
        return;
      }

      const clickedUnit = this.pressedUnit;
      this.pressedUnit = null;
      this.handleUnitTap(clickedUnit);
    });
  }

  update(time: number): void {
    this.evaluateCombat(time);
  }

  private createFighterUnit(config: {
    id: string;
    team: FighterTeam;
    x: number;
    y: number;
    attackRange: number;
    maxHp: number;
    attack: number;
    tint: number;
  }): FighterUnit {
    const shadow = this.add.ellipse(config.x, config.y + 22, 92, 24, 0x000000, 0.34);
    shadow.setDepth(1);

    const rangeMarker = this.add.ellipse(config.x, config.y, config.attackRange * 2, config.attackRange * 2);
    rangeMarker.setStrokeStyle(1, 0xff7043, 0.34);
    rangeMarker.setDepth(1.2);
    rangeMarker.setVisible(false);

    const selection = this.add.ellipse(config.x, config.y + 8, 108, 34);
    selection.setStrokeStyle(2, 0xffd45a, 0.9);
    selection.setDepth(1.5);
    selection.setVisible(false);

    const sprite = this.add.sprite(config.x, config.y, this.sideMoveFrameKey(0));
    sprite.setOrigin(0.5, 1360 / 1536);
    sprite.setDepth(2);
    sprite.setTint(config.tint);
    sprite.setInteractive({ useHandCursor: true });
    sprite.play('tomato-idle');

    const healthBackground = this.add.rectangle(config.x - 46, config.y - 86, 92, 12, 0x211b16, 0.92);
    healthBackground.setOrigin(0, 0.5);
    healthBackground.setDepth(5);

    const healthFill = this.add.rectangle(config.x - 43, config.y - 86, 86, 8, 0x67c85f, 1);
    healthFill.setOrigin(0, 0.5);
    healthFill.setDepth(5.1);

    const healthText = this.add.text(config.x, config.y - 86, `${config.maxHp}/${config.maxHp}`, {
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      fontStyle: 'bold'
    });
    healthText.setOrigin(0.5);
    healthText.setDepth(5.2);

    const defeatedText = this.add.text(config.x, config.y - 50, 'ПОВЕРЖЕН', {
      color: '#ffdc8a',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      stroke: '#3b170d',
      strokeThickness: 4
    });
    defeatedText.setOrigin(0.5);
    defeatedText.setDepth(6);
    defeatedText.setVisible(false);

    const unit: FighterUnit = {
      id: config.id,
      team: config.team,
      status: 'idle',
      hp: config.maxHp,
      maxHp: config.maxHp,
      attack: config.attack,
      attackRange: config.attackRange,
      tint: config.tint,
      sprite,
      shadow,
      selection,
      rangeMarker,
      healthBackground,
      healthFill,
      healthText,
      defeatedText,
      moveEvent: null,
      attackTarget: null,
      isAttacking: false,
      nextAttackAt: 0
    };

    this.syncGroundMarkers(unit);
    this.applyDepthScale(unit);

    return unit;
  }

  private selectUnit(unit: FighterUnit): void {
    if (unit.team !== 'player' || unit.status === 'dead') {
      return;
    }

    this.selectedUnit = unit;
    this.units.forEach((fighterUnit) => {
      const isSelected = fighterUnit === unit && fighterUnit.status !== 'dead';
      fighterUnit.selection.setVisible(isSelected);
      fighterUnit.rangeMarker.setVisible(isSelected);
    });
  }

  private findClickedUnit(gameObjects: Phaser.GameObjects.GameObject[]): FighterUnit | null {
    const clickedUnits = this.units.filter((unit) => gameObjects.includes(unit.sprite));
    const clickedEnemy = clickedUnits.find((unit) => unit.team === 'enemy' && unit.status !== 'dead');
    return clickedEnemy ?? clickedUnits.find((unit) => unit.status !== 'dead') ?? null;
  }

  private handleUnitTap(unit: FighterUnit): void {
    if (unit.team === 'player') {
      this.selectUnit(unit);
      return;
    }

    const selectedUnit = this.selectedUnit;
    if (selectedUnit && selectedUnit.status !== 'dead') {
      this.commandAttack(selectedUnit, unit);
    }
  }

  private commandAttack(attacker: FighterUnit, target: FighterUnit): void {
    if (this.battleFinished || attacker.status === 'dead' || target.status === 'dead' || attacker === target) {
      return;
    }

    attacker.attackTarget = target;

    const deltaX = target.sprite.x - attacker.sprite.x;
    const deltaY = target.sprite.y - attacker.sprite.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (this.isTargetInAttackRange(attacker, target)) {
      this.faceTargetAndAttack(attacker, target);
      return;
    }

    const stopDistance = Math.max(8, attacker.attackRange - ATTACK_RANGE_BUFFER);
    const approachDistance = Math.max(0, distance - stopDistance);
    const safeDistance = Math.max(distance, 0.001);
    const targetX = attacker.sprite.x + (deltaX / safeDistance) * approachDistance;
    const targetY = attacker.sprite.y + (deltaY / safeDistance) * approachDistance;
    this.playSteppedMove(attacker, targetX, targetY, target);
  }

  private idleFrameKey(index: number): string {
    return `tomato-idle-${index + 1}`;
  }

  private sideMoveFrameKey(index: number): string {
    return `tomato-side-move-${index + 1}`;
  }

  private backMoveFrameKey(index: number): string {
    return `tomato-back-move-${index + 1}`;
  }

  private frontMoveFrameKey(index: number): string {
    return `tomato-front-move-${index + 1}`;
  }

  private sideShootFrameKey(index: number): string {
    return `tomato-side-shoot-${index + 1}`;
  }

  private backShootFrameKey(index: number): string {
    return `tomato-back-shoot-${index + 1}`;
  }

  private frontShootFrameKey(index: number): string {
    return `tomato-front-shoot-${index + 1}`;
  }

  private playSteppedMove(
    unit: FighterUnit,
    targetX: number,
    targetY: number,
    attackTarget: FighterUnit | null = null
  ): void {
    if (this.battleFinished || unit.status === 'dead') {
      return;
    }

    unit.moveEvent?.remove(false);
    unit.moveEvent = null;
    unit.attackTarget = attackTarget;
    unit.isAttacking = false;
    unit.status = 'moving';

    const deltaX = targetX - unit.sprite.x;
    const deltaY = targetY - unit.sprite.y;
    const frameSet = this.resolveMoveFrameSet(deltaX, deltaY);
    const distance = Math.hypot(deltaX, deltaY);
    const totalSteps = Math.max(1, Math.round(distance / 10));
    const stepX = deltaX / totalSteps;
    const stepY = deltaY / totalSteps;
    let step = 0;

    unit.sprite.stop();
    unit.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
    unit.sprite.setFlipX(frameSet.flipX);

    unit.moveEvent = this.time.addEvent({
      delay: MOVE_STEP_DELAY_MS,
      repeat: totalSteps - 1,
      callback: () => {
        if (this.battleFinished || unit.status === 'dead') {
          unit.moveEvent?.remove(false);
          unit.moveEvent = null;
          return;
        }

        const frameIndex = step % frameSet.frameCount;
        unit.sprite.setTexture(this.moveFrameTextureKey(frameSet.direction, frameIndex));
        unit.sprite.x += stepX;
        unit.sprite.y += stepY;
        this.syncGroundMarkers(unit);
        this.applyDepthScale(unit);
        step += 1;

        if (attackTarget?.status === 'dead') {
          unit.attackTarget = null;
          unit.status = 'idle';
          unit.sprite.play('tomato-idle');
          unit.moveEvent?.remove(false);
          unit.moveEvent = null;
          return;
        }

        if (attackTarget && this.isTargetInAttackRange(unit, attackTarget)) {
          this.faceTargetAndAttack(unit, attackTarget);
          unit.moveEvent?.remove(false);
          unit.moveEvent = null;
          return;
        }

        if (step >= totalSteps) {
          unit.sprite.x = targetX;
          unit.sprite.y = targetY;
          this.syncGroundMarkers(unit);
          this.applyDepthScale(unit);
          unit.moveEvent = null;
          if (attackTarget) {
            this.faceTargetAndAttack(unit, attackTarget);
          } else {
            unit.status = 'idle';
            unit.sprite.play('tomato-idle');
          }
        }
      }
    });
  }

  private resolveMoveFrameSet(deltaX: number, deltaY: number): MoveFrameSet {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absY > absX * 0.6) {
      return {
        direction: deltaY < 0 ? 'back' : 'front',
        frameCount: deltaY < 0 ? BACK_MOVE_FRAME_FILES.length : FRONT_MOVE_FRAME_FILES.length,
        flipX: deltaX < -3
      };
    }

    return {
      direction: 'side',
      frameCount: SIDE_MOVE_FRAME_FILES.length,
      flipX: deltaX < 0
    };
  }

  private moveFrameTextureKey(direction: MoveDirection, index: number): string {
    if (direction === 'back') {
      return this.backMoveFrameKey(index);
    }

    if (direction === 'front') {
      return this.frontMoveFrameKey(index);
    }

    return this.sideMoveFrameKey(index);
  }

  private syncGroundMarkers(unit: FighterUnit): void {
    unit.shadow.setPosition(unit.sprite.x, unit.sprite.y + 22);
    unit.selection.setPosition(unit.sprite.x, unit.sprite.y + 8);
    unit.rangeMarker.setPosition(unit.sprite.x, unit.sprite.y);
    unit.healthBackground.setPosition(unit.sprite.x - 46, unit.sprite.y - 86);
    unit.healthFill.setPosition(unit.sprite.x - 43, unit.sprite.y - 86);
    unit.healthText.setPosition(unit.sprite.x, unit.sprite.y - 86);
    unit.defeatedText.setPosition(unit.sprite.x, unit.sprite.y - 50);
  }

  private applyDepthScale(unit: FighterUnit): void {
    const scale = Phaser.Math.Clamp(0.78 + ((unit.sprite.y - 130) / (this.scale.height - 188)) * 0.34, 0.78, 1.12);

    unit.sprite.setScale(scale * 0.105);
    unit.shadow.setScale(scale, scale);
    unit.selection.setScale(scale, scale);
    unit.sprite.setDepth(2 + unit.sprite.y / 1000);
    unit.shadow.setDepth(1 + unit.sprite.y / 1000);
    unit.selection.setDepth(1.5 + unit.sprite.y / 1000);
    unit.rangeMarker.setDepth(1.1 + unit.sprite.y / 1000);
    unit.healthBackground.setDepth(5 + unit.sprite.y / 1000);
    unit.healthFill.setDepth(5.1 + unit.sprite.y / 1000);
    unit.healthText.setDepth(5.2 + unit.sprite.y / 1000);
    unit.defeatedText.setDepth(6 + unit.sprite.y / 1000);
  }

  private faceTargetAndAttack(attacker: FighterUnit, target: FighterUnit): void {
    if (this.battleFinished || attacker.status === 'dead' || target.status === 'dead') {
      return;
    }

    attacker.moveEvent?.remove(false);
    attacker.moveEvent = null;
    attacker.status = 'idle';

    const deltaX = target.sprite.x - attacker.sprite.x;
    const deltaY = target.sprite.y - attacker.sprite.y;
    const frameSet = this.resolveMoveFrameSet(deltaX, deltaY);
    this.playShoot(attacker, frameSet);
  }

  private playShoot(unit: FighterUnit, frameSet: MoveFrameSet): void {
    const target = unit.attackTarget;
    if (!target || target.status === 'dead' || unit.status === 'dead' || unit.isAttacking || this.time.now < unit.nextAttackAt) {
      return;
    }

    unit.isAttacking = true;
    unit.status = 'attacking';
    unit.sprite.setFlipX(frameSet.flipX);
    unit.sprite.play(this.shootAnimationKey(frameSet.direction));
    unit.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, (animation: Phaser.Animations.Animation) => {
      if (animation.key === this.shootAnimationKey(frameSet.direction)) {
        unit.isAttacking = false;
        unit.nextAttackAt = this.time.now + ATTACK_COOLDOWN_MS;
        if (!this.battleFinished && unit.status !== 'dead' && target.status !== 'dead' && this.isTargetInAttackRange(unit, target)) {
          this.applyDamage(unit, target);
        }
        if (!this.battleFinished && unit.status !== 'dead') {
          unit.status = 'idle';
          unit.sprite.play('tomato-idle');
        }
      }
    });
  }

  private distanceBetween(first: FighterUnit, second: FighterUnit): number {
    return Math.hypot(first.sprite.x - second.sprite.x, first.sprite.y - second.sprite.y);
  }

  private isTargetInAttackRange(attacker: FighterUnit, target: FighterUnit): boolean {
    return this.distanceBetween(attacker, target) <= attacker.attackRange;
  }

  private evaluateCombat(time: number): void {
    if (this.battleFinished) {
      return;
    }

    this.units.forEach((unit) => {
      if (unit.status === 'dead' || unit.moveEvent || unit.isAttacking) {
        return;
      }

      const target = unit.attackTarget;
      if (!target || target.status === 'dead') {
        unit.attackTarget = null;
        return;
      }

      if (!this.isTargetInAttackRange(unit, target)) {
        this.commandAttack(unit, target);
        return;
      }

      if (time >= unit.nextAttackAt) {
        this.faceTargetAndAttack(unit, target);
      }
    });
  }

  private applyDamage(attacker: FighterUnit, target: FighterUnit): void {
    target.hp = Math.max(0, target.hp - attacker.attack);
    this.updateHealthBar(target);

    target.sprite.setTint(0xff7777);
    this.time.delayedCall(130, () => {
      if (target.status !== 'dead') {
        target.sprite.setTint(target.tint);
      }
    });

    const damageText = this.add.text(target.sprite.x, target.sprite.y - 112, `-${attacker.attack}`, {
      color: '#ffdc72',
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      stroke: '#3d170c',
      strokeThickness: 4
    });
    damageText.setOrigin(0.5);
    damageText.setDepth(10);
    this.tweens.add({
      targets: damageText,
      y: damageText.y - 28,
      alpha: 0,
      duration: 650,
      onComplete: () => damageText.destroy()
    });

    if (target.hp === 0) {
      this.defeatUnit(target);
    }
  }

  private updateHealthBar(unit: FighterUnit): void {
    const ratio = Phaser.Math.Clamp(unit.hp / unit.maxHp, 0, 1);
    unit.healthFill.displayWidth = Math.max(0.01, 86 * ratio);
    unit.healthFill.setFillStyle(ratio > 0.55 ? 0x67c85f : ratio > 0.25 ? 0xe0ad42 : 0xe05c4e);
    unit.healthText.setText(`${unit.hp}/${unit.maxHp}`);
  }

  private defeatUnit(unit: FighterUnit): void {
    unit.status = 'dead';
    unit.isAttacking = false;
    unit.attackTarget = null;
    unit.moveEvent?.remove(false);
    unit.moveEvent = null;
    unit.sprite.stop();
    unit.sprite.disableInteractive();
    unit.selection.setVisible(false);
    unit.rangeMarker.setVisible(false);
    unit.defeatedText.setVisible(true);
    unit.sprite.setTint(0x777777);
    this.tweens.add({ targets: [unit.sprite, unit.shadow], alpha: 0.28, duration: 350 });

    this.units.forEach((candidate) => {
      if (candidate.attackTarget === unit) {
        candidate.attackTarget = null;
      }
    });

    this.finishBattle(unit.team === 'enemy' ? 'victory' : 'defeat');
  }

  private finishBattle(result: FightResult): void {
    if (this.battleFinished) {
      return;
    }

    this.battleFinished = true;
    this.selectedUnit = null;
    this.units.forEach((unit) => {
      unit.moveEvent?.remove(false);
      unit.moveEvent = null;
      unit.attackTarget = null;
      unit.selection.setVisible(false);
      unit.rangeMarker.setVisible(false);
      if (unit.status !== 'dead') {
        unit.status = 'idle';
        unit.isAttacking = false;
        unit.sprite.play('tomato-idle');
      }
    });
    this.time.delayedCall(600, () => this.onBattleFinished?.(result));
  }

  private shootAnimationKey(direction: MoveDirection): string {
    if (direction === 'back') {
      return 'tomato-back-shoot';
    }

    if (direction === 'front') {
      return 'tomato-front-shoot';
    }

    return 'tomato-side-shoot';
  }

  private addCoverImage(key: string, x: number, y: number, width: number, height: number): Phaser.GameObjects.Image {
    const image = this.add.image(x, y, key);
    const texture = this.textures.get(key).getSourceImage() as HTMLImageElement;
    const scale = Math.max(width / texture.width, height / texture.height);

    image.setScale(scale);
    image.setDepth(-10);

    return image;
  }
}

@Component({
  standalone: true,
  imports: [IonContent],
  templateUrl: './fight.page.html',
  styleUrl: './fight.page.scss'
})
export class FightPage implements AfterViewInit, OnDestroy {
  @ViewChild('phaserHost', { static: true })
  private readonly phaserHost!: ElementRef<HTMLDivElement>;

  private readonly router = inject(Router);

  readonly result = signal<FightResult | null>(null);
  readonly reward = signal<BattleRewardResponse | null>(null);
  readonly rewardNotice = signal<string | null>(null);

  private game: Phaser.Game | null = null;
  private refreshTimerId: ReturnType<typeof window.setTimeout> | null = null;

  ngAfterViewInit(): void {
    this.createGame();
  }

  restartBattle(): void {
    this.result.set(null);
    this.reward.set(null);
    this.rewardNotice.set(null);
    this.destroyGame();
    this.createGame();
  }

  goToGarden(): void {
    void this.router.navigateByUrl('/catalog');
  }

  ngOnDestroy(): void {
    this.destroyGame();
  }

  private createGame(): void {
    const scene = new FightMoveScene((result) => this.handleBattleFinished(result));
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.phaserHost.nativeElement,
      width: 430,
      height: 620,
      backgroundColor: '#11170d',
      scene,
      render: {
        transparent: false,
        antialias: true
      }
    });

    this.refreshTimerId = window.setTimeout(() => {
      this.game?.scale.refresh();
    }, 0);
  }

  private handleBattleFinished(result: FightResult): void {
    this.result.set(result);
    this.reward.set(null);
    this.rewardNotice.set('Локальный бой завершён. Серверная награда не начисляется.');
  }

  private destroyGame(): void {
    if (this.refreshTimerId) {
      window.clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }

    this.game?.destroy(true);
    this.game = null;
  }
}
