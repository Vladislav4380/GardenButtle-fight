import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { KEEPERS, Keeper, loadProfile, saveProfile, telegramName } from '../../data/player';

// Choosing the keeper (the avatar) on the first entry: four looks from the first version, a name (Telegram's by
// default). The look only — it gives nothing in battle.
@Component({
  standalone: true,
  imports: [FormsModule],
  template: `<div class="gb-screen" [style.background-image]="'url(' + chosen.background + ')'">
    <div class="gb-body">
      <h1 class="gb-title">Выберите хранителя</h1>
      <p class="gb-sub">Выбор влияет только на внешний вид.</p>
      <div class="grid">
        @for (k of keepers; track k.code) {
          <button class="pick" [class.on]="k === chosen" (click)="chosen = k"><img [src]="k.preview" [alt]="k.name" /><span>{{ k.name }}</span></button>
        }
      </div>
      <section class="about gb-panel">
        <img [src]="chosen.image" alt="" />
        <div><h2>{{ chosen.name }}</h2><p>{{ chosen.text }}</p></div>
      </section>
      <label class="name gb-panel">Имя<input [(ngModel)]="name" maxlength="20" placeholder="Как вас зовут?" /></label>
      <button class="gb-btn" [disabled]="!name.trim()" (click)="confirm()">Выбрать</button>
    </div>
  </div>`,
  styles: [`.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0 10px}
    .pick{display:flex;flex-direction:column;align-items:center;gap:4px;padding:4px 2px 6px;border-radius:14px;border:2px solid var(--bronze);background:#0009;color:var(--parch);font:700 11px/1.15 system-ui}
    .pick img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:10px}.pick.on{border-color:var(--gold);box-shadow:0 0 0 2px var(--gold),0 0 16px #ffd56b88;transform:scale(1.04)}
    .about{flex:1;min-height:0;display:flex;gap:12px;padding:10px;margin-bottom:10px;overflow:hidden}
    .about img{height:100%;max-height:260px;aspect-ratio:3/4;object-fit:cover;border-radius:12px;border:2px solid var(--bronze)}
    .about h2{margin:0;font:900 18px system-ui;color:var(--gold)}.about p{margin:6px 0 0;font:500 14px/1.35 system-ui}
    .name{display:flex;align-items:center;gap:10px;padding:8px 12px;margin-bottom:10px;font:800 14px system-ui;color:var(--gold)}
    .name input{flex:1;min-width:0;height:36px;border-radius:10px;border:1px solid var(--bronze);background:#0006;color:var(--parch);font:600 16px system-ui;padding:0 10px}`],
})
export class KeeperPage {
  private readonly router = inject(Router);
  readonly keepers = KEEPERS;
  chosen: Keeper = KEEPERS[0];
  name = loadProfile()?.name || telegramName() || '';
  confirm(): void {
    saveProfile({ keeper: this.chosen.code, name: this.name.trim(), since: Date.now() });
    void this.router.navigateByUrl('/main', { replaceUrl: true });
  }
}
