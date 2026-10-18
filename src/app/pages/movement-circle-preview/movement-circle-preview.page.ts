import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

type Direction =
  | 'front'
  | 'front-left'
  | 'left'
  | 'back-left'
  | 'back'
  | 'back-right'
  | 'right'
  | 'front-right';

const ASSET_ROOT = 'assets/characters/tomato/sprites';
const MOVE_FRAME_COUNT = 2;
const TURN_FRAME_COUNT = 1;
const BASE_LAP_DURATION_MS = 16000;
// Existing turn clips are grounded pivots. They must not be played while the
// character is translating along an edge; walking turns will be added later.
const TURN_SHARE_OF_SECTOR = 0;

const CLOCKWISE_DIRECTIONS: Direction[] = [
  'right',
  'front-right',
  'front',
  'front-left',
  'left',
  'back-left',
  'back',
  'back-right'
];

const COUNTERCLOCKWISE_DIRECTIONS: Direction[] = [
  'front-left',
  'front',
  'front-right',
  'right',
  'back-right',
  'back',
  'back-left',
  'left'
];

const OCTAGON_POINTS = [
  { x: 35, y: 11 },
  { x: 65, y: 11 },
  { x: 84, y: 29 },
  { x: 84, y: 71 },
  { x: 65, y: 89 },
  { x: 35, y: 89 },
  { x: 16, y: 71 },
  { x: 16, y: 29 }
] as const;

const DIRECTION_LABELS: Record<Direction, string> = {
  front: 'вперёд',
  'front-left': 'вперёд-влево',
  left: 'влево',
  'back-left': 'назад-влево',
  back: 'назад',
  'back-right': 'назад-вправо',
  right: 'вправо',
  'front-right': 'вперёд-вправо'
};

// Generated source clips use different framing. These coefficients normalize
// the median visible character height to approximately 405 px in every view.
const DIRECTION_SCALES: Record<Direction, number> = {
  front: 0.96,
  'front-left': 1.1,
  left: 0.95,
  'back-left': 0.86,
  back: 0.88,
  'back-right': 0.99,
  right: 1.07,
  'front-right': 0.89
};

// The walking phase is shared by the whole route, so every direction uses
// exactly the same cadence regardless of the length of an octagon edge.
const WALK_CYCLES_PER_LAP = 16;

@Component({
  standalone: true,
  imports: [IonContent],
  templateUrl: './movement-circle-preview.page.html',
  styleUrl: './movement-circle-preview.page.scss'
})
export class MovementCirclePreviewPage implements OnInit, OnDestroy {
  @ViewChild('arena', { static: true }) private arena!: ElementRef<HTMLElement>;

  readonly isWalking = signal(false);
  readonly clockwise = signal(true);
  readonly speed = signal(1);
  readonly x = signal(50);
  readonly y = signal(13);
  readonly direction = signal<Direction>('right');
  readonly frameIndex = signal(0);
  readonly turnDirection = signal<'front-left' | 'front-right' | null>(null);
  readonly directionLabel = computed(() => DIRECTION_LABELS[this.direction()]);
  readonly directionScale = computed(() => DIRECTION_SCALES[this.direction()]);
  readonly currentFrame = computed(() => {
    const turnDirection = this.turnDirection();
    const folder = this.direction().startsWith('back') ? 'back' : 'front';
    const frame = this.frameIndex() + 1;
    return ASSET_ROOT + "/" + folder + (turnDirection ? "/idle.png" : frame % 2 ? "/walk-a.png" : "/walk-b.png");
  });

  private animationFrameId: number | null = null;
  private startedAt = 0;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.preloadAssets();
    (window as Window & { setMovementCaptureProgress?: (progress: number) => void })
      .setMovementCaptureProgress = (progress: number): void => {
        this.stop();
        const captureProgress = Math.max(0, Math.min(0.999999, progress));
        this.updatePosition(captureProgress);
        // The Seedance reference keeps the page's route and rendering, but uses
        // a calmer walking cadence: eight sprite cycles per complete lap.
        const captureCyclePhase = captureProgress * 8 % 1;
        this.frameIndex.set(Math.min(MOVE_FRAME_COUNT - 1, Math.floor(captureCyclePhase * MOVE_FRAME_COUNT)));
      };
    window.setTimeout(() => this.play(), 250);
  }

  ngOnDestroy(): void {
    this.stop();
    delete (window as Window & { setMovementCaptureProgress?: (progress: number) => void })
      .setMovementCaptureProgress;
  }

  play(): void {
    this.stop();
    this.startedAt = performance.now();
    this.isWalking.set(true);

    const update = (now: number): void => {
      const elapsed = (now - this.startedAt) * this.speed();
      const lapProgress = (elapsed % BASE_LAP_DURATION_MS) / BASE_LAP_DURATION_MS;
      this.updatePosition(lapProgress);
      this.animationFrameId = window.requestAnimationFrame(update);
    };

    this.animationFrameId = window.requestAnimationFrame(update);
  }

  togglePlay(): void {
    if (this.isWalking()) {
      this.stop();
    } else {
      this.play();
    }
  }

  setClockwise(clockwise: boolean): void {
    if (this.clockwise() === clockwise) return;
    this.clockwise.set(clockwise);
    this.play();
  }

  setSpeedFromInput(event: Event): void {
    this.speed.set(Number((event.target as HTMLInputElement).value));
  }

  goBack(): void {
    void this.router.navigateByUrl('/movement-preview');
  }

  private updatePosition(progress: number): void {
    const directions = this.clockwise() ? CLOCKWISE_DIRECTIONS : COUNTERCLOCKWISE_DIRECTIONS;
    const { sectorIndex, sectorPhase, vertexIndex, nextVertexIndex } = this.routePosition(progress);
    const currentDirection = directions[sectorIndex];
    const previousDirection = directions[(sectorIndex + directions.length - 1) % directions.length];
    const start = OCTAGON_POINTS[vertexIndex];
    const end = OCTAGON_POINTS[nextVertexIndex];
    this.x.set(start.x + (end.x - start.x) * sectorPhase);
    this.y.set(start.y + (end.y - start.y) * sectorPhase);

    this.direction.set(currentDirection);
    const turnDirection = this.resolveTurn(previousDirection, currentDirection, sectorPhase);
    this.turnDirection.set(turnDirection);

    if (turnDirection) {
      this.frameIndex.set(Math.min(TURN_FRAME_COUNT - 1, Math.floor(sectorPhase / TURN_SHARE_OF_SECTOR * TURN_FRAME_COUNT)));
      return;
    }

    const movementPhase = Math.max(0, (sectorPhase - TURN_SHARE_OF_SECTOR) / (1 - TURN_SHARE_OF_SECTOR));
    const cyclePhase = progress * WALK_CYCLES_PER_LAP % 1;
    this.frameIndex.set(Math.min(MOVE_FRAME_COUNT - 1, Math.floor(cyclePhase * MOVE_FRAME_COUNT)));
  }

  private routePosition(progress: number): {
    sectorIndex: number;
    sectorPhase: number;
    vertexIndex: number;
    nextVertexIndex: number;
  } {
    const width = this.arena.nativeElement.clientWidth;
    const height = this.arena.nativeElement.clientHeight;
    const segments = OCTAGON_POINTS.map((_, sectorIndex) => {
      const vertexIndex = this.clockwise()
        ? sectorIndex
        : (OCTAGON_POINTS.length - sectorIndex) % OCTAGON_POINTS.length;
      const nextVertexIndex = this.clockwise()
        ? (vertexIndex + 1) % OCTAGON_POINTS.length
        : (vertexIndex + OCTAGON_POINTS.length - 1) % OCTAGON_POINTS.length;
      const start = OCTAGON_POINTS[vertexIndex];
      const end = OCTAGON_POINTS[nextVertexIndex];
      const dx = (end.x - start.x) / 100 * width;
      const dy = (end.y - start.y) / 100 * height;
      return { sectorIndex, vertexIndex, nextVertexIndex, length: Math.hypot(dx, dy) };
    });
    const perimeter = segments.reduce((sum, segment) => sum + segment.length, 0);
    let remainingDistance = progress * perimeter;

    for (const segment of segments) {
      if (remainingDistance <= segment.length) {
        return {
          ...segment,
          sectorPhase: segment.length === 0 ? 0 : remainingDistance / segment.length
        };
      }
      remainingDistance -= segment.length;
    }

    const last = segments[segments.length - 1];
    return { ...last, sectorPhase: 1 };
  }

  private resolveTurn(
    previous: Direction,
    current: Direction,
    sectorPhase: number
  ): 'front-left' | 'front-right' | null {
    if (sectorPhase >= TURN_SHARE_OF_SECTOR) return null;
    if (previous === 'front' && current === 'front-left') return 'front-left';
    if (previous === 'front' && current === 'front-right') return 'front-right';
    return null;
  }

  private preloadAssets(): void {
    for (const direction of ['front', 'back']) {
      this.preload(`${ASSET_ROOT}/${direction}`, MOVE_FRAME_COUNT);
    }
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
