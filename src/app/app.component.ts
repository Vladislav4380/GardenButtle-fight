import { Component } from '@angular/core';
import { RouterLink, RouterOutlet, Router } from '@angular/router';
@Component({selector:'gbf-root',standalone:true,imports:[RouterOutlet,RouterLink],template:`@if(router.url!=='/catalog'){<a class="catalog-back" routerLink="/catalog">← Каталог боёв</a>}<router-outlet />`,styles:[`.catalog-back{position:fixed;z-index:1000;top:calc(2px + env(safe-area-inset-top));left:calc(8px + env(safe-area-inset-left));padding:2px 12px;min-height:22px;line-height:18px;border:1px solid #53785d;border-radius:8px;background:#08160dec;color:#e4f2e4;text-decoration:none;font-size:11px} :host{display:block;height:100%}`]})
export class AppComponent { constructor(public router:Router){} }

