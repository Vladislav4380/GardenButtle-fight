import { Component } from '@angular/core';
import { RouterLink, RouterOutlet, Router } from '@angular/router';
@Component({selector:'gbf-root',standalone:true,imports:[RouterOutlet,RouterLink],template:`@if(router.url!=='/'){<a class="catalog-back" routerLink="/">← Каталог боёв</a>}<router-outlet />`,styles:[`.catalog-back{position:fixed;z-index:1000;top:4px;left:8px;padding:4px 9px;border:1px solid #53785d;border-radius:8px;background:#08160dec;color:#e4f2e4;text-decoration:none;font-size:11px} :host{display:block;height:100%}`]})
export class AppComponent { constructor(public router:Router){} }

