import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { loadProfile } from '../../data/player';

// The splash, as in the first version of the game (its splash.page.html / .scss): the picture as tall as the screen,
// at the top, a warm glow and darkening below, a green striped loading bar, a big percent and «Подготавливаем
// грядки…» with the garden mark. The only change: the picture's English logo is covered by a wooden board with the
// game's name (the board is placed in the picture's own measure, so it covers the logo on any screen).
@Component({
  standalone: true,
  template: `<div class="splash-page">
    <div class="gb-art">
      <div class="logo-board"><b>Овощные войны</b><small>Расти · Сражайся · Побеждай</small></div>
    </div>
    <div class="splash-overlay"></div>
    <div class="splash-content">
      <div class="loading-block">
        <div class="loading-text"><img class="loading-icon" src="assets/ui/hud/hud-nav-garden.png" alt="" aria-hidden="true" />Подготавливаем грядки...</div>
        <div class="progress"><div class="progress-fill" [style.width.%]="progress"></div></div>
        <div class="progress-value">{{ progress }}%</div>
      </div>
    </div>
  </div>`,
  styles: [`:host{display:block;width:100%;height:100%}
    .splash-page{position:relative;height:var(--visible-h,100dvh);overflow:hidden;color:#fff;
      background:radial-gradient(circle at 50% 33%,rgba(255,219,99,.24),transparent 28%),
        linear-gradient(180deg,rgba(26,58,104,.08) 0%,rgba(255,171,46,.04) 38%,rgba(4,8,4,.24) 74%,rgba(0,0,0,.68) 100%),
        url('/assets/ui/startup-bg.webp') center top / auto 100% no-repeat,#0a1208}
    .splash-overlay{position:absolute;inset:0;z-index:1;pointer-events:none;
      background:radial-gradient(circle at 50% 32%,rgba(255,227,122,.1),transparent 34%),
        linear-gradient(90deg,rgba(0,0,0,.18),transparent 18%,transparent 82%,rgba(0,0,0,.18)),
        linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.08) 58%,rgba(0,0,0,.7))}
    .splash-content{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
      width:min(100vw,430px);height:100%;margin:0 auto;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom);box-sizing:border-box}
    .loading-block{width:min(84%,340px);margin-bottom:clamp(28px,5vh,48px);text-align:center}
    .loading-text{display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px;font-size:clamp(17px,4.6vw,21px);white-space:nowrap;font-weight:800;letter-spacing:.01em;text-shadow:0 3px 8px rgba(0,0,0,.82)}
    .loading-icon{display:block;width:32px;height:32px;object-fit:contain;filter:drop-shadow(0 2px 2px rgba(0,0,0,.62))}
    .progress{width:100%;height:22px;overflow:hidden;border:2px solid rgba(255,227,166,.96);border-radius:999px;background:rgba(24,16,9,.86);box-shadow:0 5px 14px rgba(0,0,0,.55),inset 0 2px 6px rgba(0,0,0,.65)}
    .progress-fill{height:100%;border-radius:999px;background:repeating-linear-gradient(135deg,rgba(255,255,255,.16) 0 8px,transparent 8px 16px),linear-gradient(90deg,#57bd27,#b8f153);box-shadow:inset 0 2px 7px rgba(255,255,255,.28);transition:width .3s ease}
    .progress-value{margin-top:10px;font-size:clamp(28px,8vw,38px);font-weight:800;text-shadow:0 4px 8px rgba(0,0,0,.8)}
    @media (max-width:370px){.loading-text{font-size:17px}}`],
})
export class SplashPage implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private timer?: number;
  private redirect?: number;
  progress = 0;

  // As in the first version: +2% every 120 ms, a short pause at 100%, then on.
  ngOnInit(): void {
    for (const src of ['assets/ui/welcome/grow.webp', 'assets/ui/avatars/bg-garden.webp']) new Image().src = src;
    this.timer = window.setInterval(() => {
      this.progress = Math.min(100, this.progress + 2);
      if (this.progress >= 100) {
        window.clearInterval(this.timer);
        this.redirect = window.setTimeout(() => void this.router.navigateByUrl(loadProfile() ? '/main' : '/welcome', { replaceUrl: true }), 700);
      }
    }, 120);
  }

  ngOnDestroy(): void {
    window.clearInterval(this.timer);
    window.clearTimeout(this.redirect);
  }
}
