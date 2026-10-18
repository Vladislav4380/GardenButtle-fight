import { Component, OnDestroy } from '@angular/core';import { ActivatedRoute } from '@angular/router';import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';import { Subscription } from 'rxjs';
@Component({standalone:true,template:`@if(src){<iframe [src]="src" title="Игровая сцена" allow="fullscreen"></iframe>}`,styles:[`:host{display:block;height:100dvh}iframe{display:block;border:0;width:100%;height:100%;padding-top:25px;background:#050b08}`]})
export class CanvasScenePage implements OnDestroy {
 src?:SafeResourceUrl; private sub:Subscription;
 constructor(route:ActivatedRoute,sanitizer:DomSanitizer){const ids=['mobile-arena','mobile-vertical','mobile-horizontal','pepper-1v1','pepper-3v3'];this.sub=route.paramMap.subscribe(p=>{const id=p.get('id');this.src=id&&ids.includes(id)?sanitizer.bypassSecurityTrustResourceUrl('/scenes/'+id+'/index.html'):undefined;});}
 ngOnDestroy(){this.sub.unsubscribe();}
}

