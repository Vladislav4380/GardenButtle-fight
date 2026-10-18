import {
  AfterViewInit,
  Directive,
  ElementRef,
  Renderer2,
  RendererStyleFlags2,
} from '@angular/core';

const TYPE_COLORS: Record<string, string> = {
  GUA: '#4f9b66',
  BRW: '#d58a2c',
  SNP: '#795dbb',
  ASN: '#b93f78',
  HNT: '#2e9b91',
};

@Directive({ selector: 'button.hero', standalone: true })
export class HeroColorDirective implements AfterViewInit {
  constructor(
    private element: ElementRef<HTMLButtonElement>,
    private renderer: Renderer2,
  ) {}
  ngAfterViewInit() {
    const code = this.element.nativeElement.querySelector('span')?.textContent?.trim() ?? '';
    this.renderer.setStyle(
      this.element.nativeElement,
      '--hero-color',
      TYPE_COLORS[code] ?? '#777',
      RendererStyleFlags2.DashCase,
    );
  }
}
