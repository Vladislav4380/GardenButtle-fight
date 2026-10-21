import { Component, OnDestroy } from '@angular/core';import { ActivatedRoute } from '@angular/router';import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';import { Subscription } from 'rxjs';
@Component({standalone:true,template:`@if(src){<iframe [src]="src" title="Игровая сцена" allow="fullscreen; autoplay"></iframe>}`,styles:[`:host{display:block;height:var(--visible-h,100dvh);box-sizing:border-box;padding:0 env(safe-area-inset-right) 0 env(safe-area-inset-left);background:#050b08}iframe{display:block;box-sizing:border-box;border:0;width:100%;height:100%;padding-top:25px;background:#050b08}`]})
export class CanvasScenePage implements OnDestroy {
 src?:SafeResourceUrl; private sub:Subscription;
 constructor(route:ActivatedRoute,sanitizer:DomSanitizer){const m=/[?&]team=(\d)/.exec(location.search),team=m?'?team='+m[1]:'';const ids=['mobile-arena','mobile-vertical','mobile-horizontal','pepper-1v1','pepper-3v3','treasure','tft-6x6'];this.sub=route.paramMap.subscribe(p=>{const id=p.get('id');this.src=id&&ids.includes(id)?sanitizer.bypassSecurityTrustResourceUrl('/scenes/'+id+'/index.html'+team):undefined;});}
 ngOnDestroy(){this.sub.unsubscribe();}
}

