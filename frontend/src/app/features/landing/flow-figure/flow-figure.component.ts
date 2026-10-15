import {
  AfterViewInit, Component, ElementRef, EventEmitter, NgZone, OnDestroy, Output, ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FLOW_GEO, FLOW_SVG } from './flow-figure.svg';

const DWELL = 2.6;   // s en cada estación durante el recorrido automático
const IDLE = 6;      // s sin interacción antes de retomar el recorrido
const PRESS = 0.7;   // s que dura bajar y subir el sello

/**
 * Figura isométrica de "Cómo funciona": la factura viaja por cuatro estaciones.
 * El SVG se genera en build (scripts/anatomy/build-flow.mjs); aquí solo se mueven grupos.
 */
@Component({
  selector: 'app-flow-figure',
  standalone: true,
  template: `<div class="flow-fig iso" data-theme="light" [innerHTML]="svg"></div>`,
  styleUrl: './flow-figure.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class FlowFigureComponent implements AfterViewInit, OnDestroy {
  @Output() stepChange = new EventEmitter<number>();
  goTo(value: number): void {
    this.target = value;
    this.idleSince = performance.now();
    this.touring = false;
    this.run();
  }

  // ponytail: SVG estático generado en build por nosotros, sin datos del usuario; por eso se confía
  readonly svg: SafeHtml;

  private x: number = FLOW_GEO.stations[0];
  private target = 0;
  private arrived = -1;
  private pressAt = -1;
  private approved = false;
  private touring = true;
  private dwell = 0;
  private idleSince = 0;
  private frame = 0;
  private last = 0;
  private visible = false;
  private observer?: IntersectionObserver;
  private readonly still = matchMedia('(prefers-reduced-motion: reduce)');
  private el!: {
    carriage: SVGGElement; stamp: SVGGElement; approved: SVGGElement;
    leds: SVGGElement[]; beams: SVGGElement[];
  };

  constructor(sanitizer: DomSanitizer, private host: ElementRef<HTMLElement>, private zone: NgZone) {
    this.svg = sanitizer.bypassSecurityTrustHtml(FLOW_SVG);
  }

  ngAfterViewInit(): void {
    const q = <T extends Element>(s: string) => this.host.nativeElement.querySelector<T>(s)!;
    const all = <T extends Element>(s: string) => Array.from(this.host.nativeElement.querySelectorAll<T>(s));
    this.el = {
      carriage: q('[data-part="carriage"]'),
      stamp: q('[data-part="stamp"]'),
      approved: q('[data-approved]'),
      leds: all<SVGGElement>('[data-led]'),
      beams: all<SVGGElement>('[data-beam]'),
    };
    if (this.still.matches) this.touring = false;
    this.draw(0);
    this.observer = new IntersectionObserver(entries => {
      this.visible = entries[entries.length - 1].isIntersecting;
      this.run();
    }, { rootMargin: '80px 0px' });
    this.observer.observe(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
  }

  private run(): void {
    if (this.frame || !this.visible || !this.el) return;
    this.last = 0;
    this.zone.runOutsideAngular(() => (this.frame = requestAnimationFrame(t => this.tick(t))));
  }

  private tick(now: number): void {
    const dt = this.last ? Math.min((now - this.last) / 1000, 1 / 30) : 1 / 60;
    this.last = now;
    const goal = FLOW_GEO.stations[this.target];

    // carro: seguimiento exponencial hacia la estación objetivo
    this.x = this.still.matches ? goal : this.x + (goal - this.x) * (1 - Math.exp(-dt / 0.32));
    if (Math.abs(goal - this.x) < 0.05) this.x = goal;

    const here = this.x === goal ? this.target : -1;
    if (here !== this.arrived) {
      this.arrived = here;
      if (here >= 0) {
        this.dwell = 0;
        if (here === 2 && !this.approved) this.pressAt = 0;
        if (here === 0) this.approved = false;
        this.zone.run(() => this.stepChange.emit(here));
      }
    }

    // sello: baja y sube una vez al llegar a la estación 3
    let press = 0;
    if (this.pressAt >= 0) {
      this.pressAt += dt;
      const t = this.still.matches ? PRESS : this.pressAt;
      press = Math.sin(Math.min(t / PRESS, 1) * Math.PI);
      if (t >= PRESS * 0.5) this.approved = true;
      if (t >= PRESS) this.pressAt = -1;
    }

    // recorrido automático y regreso al recorrido tras inactividad
    if (this.touring) {
      if (here >= 0 && this.pressAt < 0) {
        this.dwell += dt;
        if (this.dwell >= DWELL) this.target = (this.target + 1) % FLOW_GEO.stations.length;
      }
    } else if (!this.still.matches && now - this.idleSince >= IDLE * 1000) {
      this.touring = true;
    }

    this.draw(press);
    const settled = !this.touring && here >= 0 && this.pressAt < 0;
    this.frame = this.visible && !settled ? requestAnimationFrame(t => this.tick(t)) : 0;
    if (settled && !this.still.matches) setTimeout(() => this.run(), IDLE * 1000 - (now - this.idleSince) + 20);
  }

  private draw(press: number): void {
    const [ux, uy] = FLOW_GEO.unitX;
    const [zx, zy] = FLOW_GEO.unitZ;
    const drop = -press * FLOW_GEO.stampDrop;
    this.el.carriage.setAttribute('transform', `translate(${(this.x * ux).toFixed(2)} ${(this.x * uy).toFixed(2)})`);
    this.el.stamp.setAttribute('transform', `translate(${(drop * zx).toFixed(2)} ${(drop * zy).toFixed(2)})`);
    this.el.approved.style.opacity = this.approved ? '1' : '0';
    this.el.leds.forEach(led => led.classList.toggle('on', +led.dataset['led']! === this.arrived));
    this.el.beams.forEach(beam => (beam.style.opacity = +beam.dataset['beam']! === this.arrived ? '1' : '0'));
  }
}
