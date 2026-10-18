import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

type AttackDirection = 'front-left' | 'front' | 'front-right' | 'left' | 'right';

type DirectionOption = {
  id: AttackDirection;
  label: string;
  shortLabel: string;
  targetClass: string;
};

const FRAME_COUNT = 1;
const FRAME_DURATION_MS = 550;
const ASSET_ROOT = 'assets/characters/tomato/sprites/front';

@Component({
  standalone: true,
  imports: [IonContent],
  templateUrl: './attack-preview.page.html',
  styleUrl: './attack-preview.page.scss'
})
export class AttackPreviewPage implements OnInit, OnDestroy {
  readonly directions: DirectionOption[] = [
    { id: 'left', label: 'Влево', shortLabel: '←', targetClass: 'target-left' },
    { id: 'front-left', label: 'Вниз-влево', shortLabel: '↙', targetClass: 'target-front-left' },
    { id: 'front', label: 'Вниз', shortLabel: '↓', targetClass: 'target-front' },
    { id: 'front-right', label: 'Вниз-вправо', shortLabel: '↘', targetClass: 'target-front-right' },
    { id: 'right', label: 'Вправо', shortLabel: '→', targetClass: 'target-right' }
  ];

  readonly direction = signal<AttackDirection>('front');
  readonly frameIndex = signal(0);
  readonly isPlaying = signal(false);
  readonly currentFrame = computed(() => this.frameUrl(this.direction(), this.frameIndex()));
  readonly showMuzzleFlash = computed(() => this.isPlaying() && this.frameIndex() === 0);
  readonly currentDirection = computed(
    () => this.directions.find((option) => option.id === this.direction()) ?? this.directions[2]
  );

  private animationTimer: ReturnType<typeof window.setInterval> | null = null;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.preloadFrames();
    window.setTimeout(() => this.playAttack(), 260);
  }

  ngOnDestroy(): void {
    this.stopAnimation();
  }

  selectDirection(direction: AttackDirection): void {
    this.direction.set(direction);
    this.playAttack();
  }

  playAttack(): void {
    this.stopAnimation();
    this.frameIndex.set(0);
    this.isPlaying.set(true);

    this.animationTimer = window.setInterval(() => {
      const nextFrame = this.frameIndex() + 1;
      if (nextFrame >= FRAME_COUNT) {
        this.stopAnimation();
        this.frameIndex.set(0);
        return;
      }

      this.frameIndex.set(nextFrame);
    }, FRAME_DURATION_MS);
  }

  goBack(): void {
    void this.router.navigateByUrl('/fight');
  }

  private stopAnimation(): void {
    if (this.animationTimer) {
      window.clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
    this.isPlaying.set(false);
  }

  private preloadFrames(): void {
    this.directions.forEach(({ id }) => {
      for (let index = 0; index < FRAME_COUNT; index += 1) {
        const image = new Image();
        image.src = this.frameUrl(id, index);
      }
    });
  }

  private frameUrl(direction: AttackDirection, index: number): string {
    return ASSET_ROOT + "/cast.png";
  }
}
