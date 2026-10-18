import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

const BASE_WALK_CYCLES_PER_ROUTE = 5;
const TOMATO_MOVEMENT_SPEED = 1;
const TOMATO_STRIDE_LENGTH = 1;

type CharacterId = 'tomato' | 'tomato-front' | 'carrot';

type MovementCharacter = {
  id: CharacterId;
  name: string;
  frameCount: number;
  assetRoot: string;
  directionLabel: string;
  directionArrow: string;
};

const MOVEMENT_CHARACTERS: MovementCharacter[] = [
  { id: 'tomato', name: 'Помидор 3/4', frameCount: 2, assetRoot: 'assets/characters/tomato/sprites/front', directionLabel: 'вперёд-влево', directionArrow: '↙' },
  { id: 'tomato-front', name: 'Помидор вперёд', frameCount: 2, assetRoot: 'assets/characters/tomato/sprites/front', directionLabel: 'вперёд', directionArrow: '↓' },
  { id: 'carrot', name: 'Морковь', frameCount: 2, assetRoot: 'assets/characters/carrot/sprites/front', directionLabel: 'вперёд-вправо', directionArrow: '↘' }
];

@Component({
  standalone: true,
  imports: [IonContent],
  templateUrl: './movement-preview.page.html',
  styleUrl: './movement-preview.page.scss'
})
export class MovementPreviewPage implements OnInit, OnDestroy {
  readonly characters = MOVEMENT_CHARACTERS;
  readonly characterId = signal<CharacterId>('tomato-front');
  readonly frameIndex = signal(0);
  readonly isWalking = signal(false);
  readonly speed = signal(TOMATO_MOVEMENT_SPEED);
  readonly strideLength = signal(TOMATO_STRIDE_LENGTH);
  readonly character = computed(
    () => MOVEMENT_CHARACTERS.find(({ id }) => id === this.characterId()) ?? MOVEMENT_CHARACTERS[0]
  );
  readonly currentFrame = computed(() =>
    this.character().assetRoot + (this.frameIndex() % 2 ? "/walk-b.png" : "/walk-a.png")
  );
  readonly durationMs = computed(() => Math.round(6000 / this.speed()));

  private animationFrameId: number | null = null;

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    MOVEMENT_CHARACTERS.forEach(({ assetRoot, frameCount }) => {
      for (let index = 0; index < frameCount; index += 1) {
        const image = new Image();
        image.src = assetRoot + (index % 2 ? "/walk-b.png" : "/walk-a.png");
      }
    });
    window.setTimeout(() => this.play(), 280);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  play(): void {
    this.stop();
    this.frameIndex.set(0);

    window.requestAnimationFrame(() => {
      this.isWalking.set(true);
      const startedAt = performance.now();
      const duration = this.durationMs();
      const walkCycles = BASE_WALK_CYCLES_PER_ROUTE / this.strideLength();
      const frameCount = this.character().frameCount;

      const updateWalk = (now: number): void => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const absoluteFrame = Math.floor(progress * frameCount * walkCycles);
        this.frameIndex.set(absoluteFrame % frameCount);

        if (progress < 1) {
          this.animationFrameId = window.requestAnimationFrame(updateWalk);
        } else {
          this.stop();
        }
      };

      this.animationFrameId = window.requestAnimationFrame(updateWalk);
    });
  }

  setSpeedFromInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.speed.set(Number(input.value));
  }

  setStrideFromInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.strideLength.set(Number(input.value));
  }

  selectCharacter(characterId: CharacterId): void {
    this.stop();
    this.characterId.set(characterId);
    this.frameIndex.set(0);
    this.speed.set(1);
    this.strideLength.set(1);
    this.play();
  }

  goBack(): void {
    void this.router.navigateByUrl('/fight');
  }

  openRoutePreview(): void {
    void this.router.navigateByUrl('/movement-route-preview');
  }

  openCirclePreview(): void {
    void this.router.navigateByUrl('/movement-circle-preview');
  }

  private stop(): void {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isWalking.set(false);
  }
}
