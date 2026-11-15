import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

// The welcome, on the first entry only: what the game is about in three cards (the layout and pictures of the first
// version, the words for this one), then on to choosing a keeper.
@Component({
  standalone: true,
  template: `<div class="gb-screen start" style="background-image:url(assets/ui/startup-bg.webp)">
    <div class="gb-art"><div class="logo-board"><b>Овощные войны</b><small>Расти · Сражайся · Побеждай</small></div></div>
    <div class="gb-body">
      <span class="sp"></span>
      <p class="gb-sub lead">Здесь растут не овощи. Здесь растёт армия.</p>
      @for (c of cards; track c.title) {
        <article class="card gb-panel">
          <img [src]="c.image" alt="" />
          <div><h2>{{ c.title }}</h2><p>{{ c.text }}</p></div>
        </article>
      }
      <button class="gb-btn" (click)="start()">Начать</button>
    </div>
  </div>`,
  styles: [`.sp{flex:1}.start{background-size:auto 100%;background-position:center top}.lead{margin:0 0 10px;font-size:16px;font-weight:800}.card{display:flex;align-items:center;gap:12px;margin-bottom:10px;padding:8px 12px 8px 8px}
    .card img{width:64px;height:64px;object-fit:cover;border-radius:12px;border:2px solid var(--bronze)}
    .card h2{margin:0;font:900 16px system-ui;color:var(--gold)}.card p{margin:2px 0 0;font:500 14px/1.3 system-ui;color:var(--parch)}
    .gb-btn{margin-top:6px}`],
})
export class WelcomePage {
  private readonly router = inject(Router);
  readonly cards = [
    { image: 'assets/ui/welcome/grow.webp', title: 'Выращивай', text: 'Бойцы растут на грядках: посади семя — собери отряд.' },
    { image: 'assets/ui/welcome/team.png', title: 'Собирай отряд', text: 'Шесть бойцов из своего амбара. Разные герои — сильнее бонусы.' },
    { image: 'assets/ui/welcome/battle.png', title: 'Сражайся', text: 'Бой честный: у всех одинаковые бойцы. Решают тактика и твой огород.' },
  ];
  start(): void {
    void this.router.navigateByUrl('/keeper', { replaceUrl: true });
  }
}
