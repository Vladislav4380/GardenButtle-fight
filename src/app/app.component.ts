import { Component } from '@angular/core';
import { RouterLink, RouterOutlet, Router } from '@angular/router';

// The link at the top left: from the garden and the battle back to the main screen; on the game's own screens
// none; on the test pages (for development) back to their catalog.
@Component({selector:'gbf-root',standalone:true,imports:[RouterOutlet,RouterLink],template:`@switch(place()){@case('game'){<a class="top-back" routerLink="/main">← Главная</a>}@case('dev'){<a class="top-back" routerLink="/catalog">← Каталог боёв</a>}}<router-outlet />`,styles:[`.top-back{position:fixed;z-index:1000;top:calc(2px + var(--safe-top));left:calc(8px + env(safe-area-inset-left));padding:2px 12px;min-height:22px;line-height:18px;border:1px solid #8a6a2a;border-radius:8px;background:#2b2013ec;color:#ffd56b;text-decoration:none;font-size:11px;font-weight:700} :host{display:block;height:100%}`]})
export class AppComponent {
  constructor(public router:Router){}
  place():'game'|'dev'|'none'{
    const path=this.router.url.split(/[?#]/)[0];
    if(['/','/splash','/welcome','/keeper','/main','/glory','/catalog'].includes(path))return 'none';
    if(path==='/garden'||path.startsWith('/duels/'))return 'game';
    return 'dev';
  }
}
