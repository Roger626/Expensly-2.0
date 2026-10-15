import { Component, HostListener, AfterViewInit, OnDestroy, ElementRef, NgZone } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FlowFigureComponent } from './flow-figure/flow-figure.component';

type ScanMode = 'qr' | 'ia';
type RoleKey = 'empleado' | 'contador' | 'superadmin';

const SCAN_LOG: Record<ScanMode, string[]> = {
  qr: [
    'Código QR detectado en tu navegador',
    'Datos consultados en el portal de la DGI',
    'Factura validada y enviada al contador',
  ],
  ia: [
    'La foto no trae código QR',
    'La IA extrae emisor, RUC, ITBMS y total',
    'Campos listos para que el contador revise',
  ],
};

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, FormsModule, FlowFigureComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  scrolled = false;
  menuOpen = false;
  activeSection = '';
  email = '';
  emailError = false;
  readonly year = new Date().getFullYear();

  readonly navItems = [
    { id: 'como-funciona', label: 'Cómo funciona' },
    { id: 'roles', label: 'Roles' },
    { id: 'capacidades', label: 'Capacidades' },
    { id: 'precios', label: 'Precios' },
    { id: 'faq', label: 'Preguntas' },
  ];

  // Cómo funciona: la figura y la lista comparten la estación activa
  activeStep = 0;
  readonly flowSteps = [
    { title: 'El empleado toma la foto', text: 'Desde el navegador del celular, sin instalar nada. Puede adjuntar varias imágenes por factura.' },
    { title: 'Expensly lee los datos', text: 'Si la factura trae QR, los datos llegan de la DGI. Si no, la IA extrae emisor, RUC, fecha y montos.' },
    { title: 'El contador aprueba o rechaza', text: 'Revisa imágenes y datos lado a lado. Si rechaza, el motivo queda registrado y el empleado lo ve.' },
    { title: 'Exportas y auditas', text: 'Descarga el periodo a Excel y consulta en cualquier momento quién hizo qué con cada factura.' },
  ];

  // Demo del hero: dos facturas que se leen en bucle, sin intervención
  readonly scanLog = SCAN_LOG;
  phase: Record<ScanMode, number> = { qr: 0, ia: 0 }; // 0 idle · 1 leyendo · 2 campos · 3 resultado
  readonly demos = [
    {
      mode: 'qr' as ScanMode, title: 'Factura con código QR',
      store: 'FARMACIA LAS CUMBRES, S.A.', ruc: '155704412-2-2021 DV 31', address: 'Vía Ricardo J. Alfaro, Panamá',
      date: '14/10/2026 10:42',
      items: [['Acetaminofén 500mg x2', '12.40'], ['Alcohol 70% 250ml', '6.85'], ['Gasas estériles', '4.25']],
      subtotal: '23.50', itbms: '1.65', total: '25.15',
      cufe: 'FE0120000155704412-2-2021-3100022026101400000412630020118243729',
    },
    {
      mode: 'ia' as ScanMode, title: 'Factura sin código QR',
      store: 'FERRETERÍA EL PUENTE', ruc: '8-742-1190 DV 05', address: 'Calle 50, San Francisco, Panamá',
      date: '13/10/2026 16:05',
      items: [['Cinta métrica 5m', '7.90'], ['Tornillos 1/2" x50', '3.60'], ['Silicón transparente', '5.25']],
      subtotal: '16.75', itbms: '1.17', total: '17.92',
      cufe: '',
    },
  ];

  // Roles
  activeRole: RoleKey = 'empleado';
  readonly roles: { key: RoleKey; label: string; title: string; points: string[] }[] = [
    {
      key: 'empleado',
      label: 'Empleado',
      title: 'Registra un gasto sin llenar formularios',
      points: [
        'Toma la foto de la factura desde el celular o sube varias imágenes.',
        'Si tiene QR, los datos se completan solos con la información de la DGI.',
        'Ve el estado de cada factura: pendiente, aprobada o rechazada con su motivo.',
      ],
    },
    {
      key: 'contador',
      label: 'Contador',
      title: 'Revisa y aprueba en un solo lugar',
      points: [
        'Bandeja con todas las facturas de la organización, con filtros por fecha, estado y categoría.',
        'Abre cada factura con sus imágenes, su CUFE y el historial de auditoría.',
        'Exporta a Excel lo que necesitas para el cierre o una revisión fiscal.',
      ],
    },
    {
      key: 'superadmin',
      label: 'Administrador',
      title: 'Controla la organización completa',
      points: [
        'Invita usuarios y asigna roles de empleado o contador.',
        'Define las categorías y etiquetas contables de tu empresa.',
        'Sigue el gasto en el dashboard y compáralo con el periodo anterior.',
      ],
    },
  ];
  get role() { return this.roles.find(r => r.key === this.activeRole)!; }

  // ponytail: copia de PLAN_PRICES en backend/src/modules/suscripciones/controllers/suscripciones.controller.ts; mover a un endpoint público si los precios cambian seguido
  readonly plans = [
    { key: 'basic', name: 'Basic', price: 1, note: 'Para equipos pequeños que empiezan a ordenar sus facturas.' },
    { key: 'pro', name: 'Pro', price: 5, note: 'Para empresas con varios empleados registrando gastos cada semana.', featured: true },
    { key: 'premium', name: 'Premium', price: 10, note: 'Para organizaciones con más volumen de facturas y usuarios.' },
  ];

  private static readonly CYCLE = 6.4;                // s por vuelta completa
  private static readonly PHASES = [0.4, 1.5, 2.6];   // s en que entra la fase 1, 2 y 3
  private static readonly OFFSET: Record<ScanMode, number> = { qr: 0, ia: 1.1 };
  private loop?: ReturnType<typeof setInterval>;
  private heroVisible = true;

  private static readonly EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private observers: IntersectionObserver[] = [];
  private readonly reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private router: Router, private host: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.onScroll();
    this.startDemoLoop();

    if (!('IntersectionObserver' in window)) return;
    const spy = new IntersectionObserver(entries => {
      const hit = entries.find(e => e.isIntersecting);
      if (hit) this.zone.run(() => (this.activeSection = hit.target.id));
    }, { rootMargin: '-45% 0px -50% 0px' });
    for (const item of this.navItems) {
      const el = this.host.nativeElement.querySelector('#' + item.id);
      if (el) spy.observe(el);
    }
    this.observers.push(spy);
  }

  ngOnDestroy(): void {
    this.observers.forEach(o => o.disconnect());
    clearInterval(this.loop);
    document.documentElement.style.overflow = '';
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled = window.scrollY > 8;
    if (window.scrollY < 200) this.activeSection = '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuOpen) this.setMenu(false);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.menuOpen && window.innerWidth > 900) this.setMenu(false);
  }

  setMenu(open: boolean): void {
    this.menuOpen = open;
    document.documentElement.style.overflow = open ? 'hidden' : '';
  }

  goTo(id: string, event?: Event): void {
    event?.preventDefault();
    this.setMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: this.reduceMotion ? 'auto' : 'smooth' });
  }

  // ── Demo de escaneo ──────────────────────────────────────────
  private startDemoLoop(): void {
    if (this.reduceMotion) { this.phase = { qr: 3, ia: 3 }; return; }
    const hero = this.host.nativeElement.querySelector('.hero');
    if (hero && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => (this.heroVisible = e.isIntersecting));
      io.observe(hero);
      this.observers.push(io);
    }
    const start = performance.now();
    // ponytail: intervalo fuera de la zona; solo se entra a Angular cuando cambia una fase
    this.zone.runOutsideAngular(() => {
      this.loop = setInterval(() => {
        if (!this.heroVisible) return;
        const t = (performance.now() - start) / 1000;
        const next = { ...this.phase };
        for (const mode of ['qr', 'ia'] as ScanMode[]) {
          const local = (t + LandingComponent.CYCLE - LandingComponent.OFFSET[mode]) % LandingComponent.CYCLE;
          next[mode] = LandingComponent.PHASES.filter(p => local >= p).length;
        }
        if (next.qr !== this.phase.qr || next.ia !== this.phase.ia) this.zone.run(() => (this.phase = next));
      }, 100);
    });
  }

  // ── Roles (tabs con flechas) ─────────────────────────────────
  onRoleKey(event: KeyboardEvent): void {
    const dir = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    event.preventDefault();
    const i = this.roles.findIndex(r => r.key === this.activeRole);
    const next = this.roles[(i + dir + this.roles.length) % this.roles.length];
    this.activeRole = next.key;
    this.host.nativeElement.querySelector<HTMLElement>('#tab-' + next.key)?.focus();
  }

  // ── Registro con correo ──────────────────────────────────────
  onEmailSubmit(): void {
    const email = this.email.trim();
    this.emailError = !LandingComponent.EMAIL_RE.test(email);
    if (!this.emailError) {
      this.router.navigate(['/auth/onboarding'], { queryParams: { email } });
    }
  }
}
