import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

type Direction = 'front' | 'front-left';
type DisplayMode = Direction | 'stop-front' | 'attack-front' | 'turn-left' | 'turn-front';

type RoutePoint = {
  progress: number;
  x: number;
  y: number;
  direction: Direction;
};

const FRONT_ROOT = 'assets/characters/tomato/sprites/front';
const FRONT_LEFT_ROOT = 'assets/characters/tomato/sprites/front';
const TURN_ROOT = 'assets/characters/tomato/sprites/front';
const ATTACK_FRONT_ROOT = 'assets/characters/tomato/sprites/front';
const FRONT_FRAMES = 2;
const FRONT_LEFT_FRAMES = 2;
const TURN_FRAMES = 1;
const ATTACK_FRONT_FRAMES = 1;
const WALK_CYCLES = 10;
const BASE_ROUTE_DURATION_MS = 12000;
const ATTACK_DURATION_MS = 700;
const ATTACK_POINTS = [0.1, 0.44, 0.74] as const;
const FRONT_LOOP_FRAMES = [1, 2] as const;
const FRONT_STOP_FRAME = 1;
const FRONT_PHASE_OFFSET = 0.07;
const FRONT_LEFT_PHASE_OFFSET = 0.15;
const INITIAL_FRONT_FRAME_PROGRESS = 1 / (WALK_CYCLES * FRONT_FRAMES);
const STOP_FRAME_PROGRESS = INITIAL_FRONT_FRAME_PROGRESS;

const TURNS = [
  { enter: 0.19, enterEnd: 0.23, exit: 0.33, exitEnd: 0.39, distance: 17 },
  { enter: 0.49, enterEnd: 0.53, exit: 0.63, exitEnd: 0.69, distance: 17 },
  { enter: 0.79, enterEnd: 0.83, exit: 0.93, exitEnd: 0.99, distance: 15 }
] as const;

const ROUTE: RoutePoint[] = [
  { progress: 0, x: 72, y: 5, direction: 'front' },
  { progress: 0.16, x: 72, y: 20, direction: 'front-left' },
  { progress: 0.31, x: 55, y: 34, direction: 'front' },
  { progress: 0.47, x: 55, y: 49, direction: 'front-left' },
  { progress: 0.62, x: 38, y: 63, direction: 'front' },
  { progress: 0.78, x: 38, y: 77, direction: 'front-left' },
  { progress: 0.9, x: 23, y: 87, direction: 'front' },
  { progress: 1, x: 23, y: 96, direction: 'front' }
];

@Component({
  standalone: true,
  imports: [IonContent],
  templateUrl: './movement-route-preview.page.html',
  styleUrl: './movement-route-preview.page.scss'
})
export class MovementRoutePreviewPage implements OnInit, OnDestroy {
  readonly isWalking = signal(false);
  readonly speed = signal(1);
  readonly x = signal(ROUTE[0].x);
  readonly y = signal(ROUTE[0].y);
  readonly direction = signal<Direction>('front');
  readonly displayMode = signal<DisplayMode>('front');
  readonly walkPhase = signal(0);
  readonly routeProgress = signal(0);
  readonly turnFrame = signal(0);
  readonly attackFrame = signal(0);
  readonly durationMs = computed(() =>
    Math.round((BASE_ROUTE_DURATION_MS + ATTACK_POINTS.length * ATTACK_DURATION_MS) / this.speed())
  );
  readonly currentFrame = computed(() => {
    const mode = this.displayMode();
    if (mode === 'attack-front') {
      return ATTACK_FRONT_ROOT + "/cast.png";
    }
    if (mode === 'turn-left' || mode === 'turn-front') {
      return TURN_ROOT + "/idle.png";
    }
    if (mode === 'stop-front') {
      return FRONT_ROOT + "/idle.png";
    }
    return mode === 'front'
      ? this.frontFrameUrl()
      : this.frameUrl(FRONT_LEFT_ROOT, FRONT_LEFT_FRAMES, FRONT_LEFT_PHASE_OFFSET);
  });

  private animationFrameId: number | null = null;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.preload(FRONT_ROOT, FRONT_FRAMES);
    this.preload(FRONT_LEFT_ROOT, FRONT_LEFT_FRAMES);
    this.preload(TURN_ROOT, TURN_FRAMES);
    this.preload(ATTACK_FRONT_ROOT, ATTACK_FRONT_FRAMES);
    window.setTimeout(() => this.play(), 280);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  play(): void {
    this.stop();
    this.setPosition(0);

    window.requestAnimationFrame(() => {
      this.isWalking.set(true);
      const startedAt = performance.now();
      const speed = this.speed();
      const timelineDuration = BASE_ROUTE_DURATION_MS + ATTACK_POINTS.length * ATTACK_DURATION_MS;

      const update = (now: number): void => {
        const timelineTime = Math.min(timelineDuration, (now - startedAt) * speed);
        const progress = this.setTimelinePosition(timelineTime);

        this.walkPhase.set((progress * WALK_CYCLES) % 1);

        if (timelineTime < timelineDuration) {
          this.animationFrameId = window.requestAnimationFrame(update);
        } else {
          this.stop();
        }
      };

      this.animationFrameId = window.requestAnimationFrame(update);
    });
  }

  setSpeedFromInput(event: Event): void {
    this.speed.set(Number((event.target as HTMLInputElement).value));
  }

  goBack(): void {
    void this.router.navigateByUrl('/movement-preview');
  }

  private setPosition(progress: number): void {
    this.routeProgress.set(progress);
    let x = 72;
    let mode: DisplayMode = 'front';
    let turnFrame = 0;

    for (const turn of TURNS) {
      x -= turn.distance * this.smoothStep(turn.enter, turn.exitEnd, progress);

      if (progress >= turn.enter - STOP_FRAME_PROGRESS && progress < turn.enter) {
        mode = 'stop-front';
        break;
      }
      if (progress >= turn.enter && progress < turn.enterEnd) {
        const phase = (progress - turn.enter) / (turn.enterEnd - turn.enter);
        mode = 'turn-left';
        turnFrame = Math.min(TURN_FRAMES - 1, Math.floor(phase * TURN_FRAMES));
        break;
      }
      if (progress >= turn.enterEnd && progress < turn.exit) {
        mode = 'front-left';
        break;
      }
      if (progress >= turn.exit && progress < turn.exitEnd) {
        const phase = (progress - turn.exit) / (turn.exitEnd - turn.exit);
        mode = 'turn-front';
        turnFrame = Math.max(0, TURN_FRAMES - 1 - Math.floor(phase * TURN_FRAMES));
        break;
      }
      if (progress >= turn.exitEnd && progress < turn.exitEnd + STOP_FRAME_PROGRESS) {
        mode = 'stop-front';
        break;
      }
    }

    this.x.set(x);
    this.y.set(5 + 91 * progress);
    this.displayMode.set(mode);
    this.turnFrame.set(turnFrame);
    this.direction.set(mode === 'front-left' ? 'front-left' : 'front');
  }

  private setTimelinePosition(timelineTime: number): number {
    let accumulatedAttackTime = 0;

    for (const attackPoint of ATTACK_POINTS) {
      const attackStart = attackPoint * BASE_ROUTE_DURATION_MS + accumulatedAttackTime;
      const attackEnd = attackStart + ATTACK_DURATION_MS;

      if (timelineTime < attackStart) {
        const progress = (timelineTime - accumulatedAttackTime) / BASE_ROUTE_DURATION_MS;
        this.setPosition(progress);
        return progress;
      }

      if (timelineTime < attackEnd) {
        const phase = (timelineTime - attackStart) / ATTACK_DURATION_MS;
        this.setPosition(attackPoint);
        this.displayMode.set('attack-front');
        this.attackFrame.set(
          Math.min(ATTACK_FRONT_FRAMES - 1, Math.floor(phase * ATTACK_FRONT_FRAMES))
        );
        return attackPoint;
      }

      accumulatedAttackTime += ATTACK_DURATION_MS;
    }

    const progress = Math.min(
      1,
      (timelineTime - accumulatedAttackTime) / BASE_ROUTE_DURATION_MS
    );
    this.setPosition(progress);
    return progress;
  }

  private frameUrl(root: string, count: number, phaseOffset = 0): string {
    const phase = (this.walkPhase() + phaseOffset) % 1;
    const frame = Math.floor(phase * count) % count + 1;
    return root + (frame % 2 ? "/walk-a.png" : "/walk-b.png");
  }

  private frontFrameUrl(): string {
    if (this.routeProgress() < INITIAL_FRONT_FRAME_PROGRESS) {
      return FRONT_ROOT + "/walk-a.png";
    }

    const loopFrameCount = FRONT_LOOP_FRAMES.length;
    const phase = (this.walkPhase() + FRONT_PHASE_OFFSET) % 1;
    const frame = FRONT_LOOP_FRAMES[Math.floor(phase * loopFrameCount) % loopFrameCount];
    return FRONT_ROOT + (frame % 2 ? "/walk-a.png" : "/walk-b.png");
  }

  private smoothStep(start: number, end: number, value: number): number {
    const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
    return t * t * (3 - 2 * t);
  }

  private preload(root: string, count: number): void {
    for (let index = 1; index <= count; index += 1) {
      const image = new Image();
      image.src = root + (index % 2 ? "/walk-a.png" : "/walk-b.png");
    }
  }

  private stop(): void {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isWalking.set(false);
  }
}
