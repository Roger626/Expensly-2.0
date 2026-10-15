import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, forkJoin, interval } from 'rxjs';
import {
  CategoryScale, Chart, ChartConfiguration, Filler, LineController, LineElement, LinearScale, PointElement, Tooltip,
} from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import { AdminFacadeService } from '../../services/admin.facade.service';
import { AuthService } from '../../../auth/services/auth.service';
import { Role } from '../../../../core/models/roles.enum';
import { ToastService } from '../../../../shared/toast/toast.service';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { SuscripcionBannerComponent } from '../../../../shared/suscripcion-banner/suscripcion-banner.component';
import { Factura } from '../../../registro-factura/models/factura.model';
import {
  DashboardCategoria, DashboardFiltros, DashboardResumen, DashboardTendencia, EMPTY_RESUMEN,
} from '../../models/dashboard.model';
import { ageLabel, daysSince, initials, isoDay, money, moneyShort, monthLabel, shortDate } from '../../../../shared/format/format';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

type Preset = '7d' | '30d' | 'mes' | '6m' | 'custom';

const REFRESH_MS = 60_000;
const ITBMS_RATE = 7;           // % de ITBMS general en Panamá: techo de la tasa recuperable
const QUEUE_SIZE = 6;

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink, BaseChartDirective, IconComponent, SuscripcionBannerComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class AdminDashboardPageComponent implements OnInit {
  private readonly facade = inject(AdminFacadeService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  // helpers para la plantilla
  readonly money = money;
  readonly shortDate = shortDate;
  readonly ageLabel = ageLabel;
  readonly initials = initials;
  readonly ITBMS_RATE = ITBMS_RATE;

  readonly presets: { key: Preset; label: string }[] = [
    { key: '7d', label: '7 días' },
    { key: '30d', label: '30 días' },
    { key: 'mes', label: 'Este mes' },
    { key: '6m', label: '6 meses' },
    { key: 'custom', label: 'Fechas' },
  ];

  // ── Filtros ──────────────────────────────────────────────────
  readonly preset = signal<Preset>('30d');
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly categoriaId = signal('');
  readonly usuarioId = signal('');

  readonly filtros = computed<DashboardFiltros>(() => ({
    startDate: this.startDate(),
    endDate: this.endDate(),
    categoriaId: this.categoriaId() || undefined,
    usuarioId: this.usuarioId() || undefined,
  }));

  // ── Datos ────────────────────────────────────────────────────
  readonly resumen = signal<DashboardResumen>(EMPTY_RESUMEN);
  readonly tendencia = signal<DashboardTendencia[]>([]);
  readonly categoriasGasto = signal<DashboardCategoria[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal<Date | null>(null);
  private readonly now = signal(Date.now());

  readonly categorias = this.facade.categorias.sorted;
  readonly usuarios = toSignal(this.facade.usuarios.usuarios$, { initialValue: [] });
  readonly facturas = toSignal(this.facade.facturas.facturas$, { initialValue: [] as Factura[] });

  readonly userName = computed(() => (this.auth.currentUser()?.name ?? '').split(' ')[0]);
  readonly isAdmin = computed(() => this.auth.userRole() === Role.SUPERADMIN);
  readonly empleados = computed(() => this.usuarios().filter((u) => u.estado !== 'Desactivado'));

  readonly periodLabel = computed(() => {
    const p = this.preset();
    if (p === '7d') return 'los últimos 7 días';
    if (p === '30d') return 'los últimos 30 días';
    if (p === 'mes') return 'este mes';
    if (p === '6m') return 'los últimos 6 meses';
    return `${shortDate(this.startDate())} – ${shortDate(this.endDate())}`;
  });

  readonly updatedLabel = computed(() => {
    const at = this.lastUpdated();
    if (!at) return '';
    const s = Math.floor((this.now() - at.getTime()) / 1000);
    return s < 10 ? 'Actualizado ahora' : s < 60 ? `Actualizado hace ${s} s` : `Actualizado hace ${Math.floor(s / 60)} min`;
  });

  /** Facturas del periodo con los mismos filtros que el resumen. */
  private readonly enPeriodo = computed(() => {
    const { startDate, endDate } = this.filtros();
    const catName = this.categorias().find((c) => c.id === this.categoriaId())?.nombre;
    const user = this.usuarioId();
    return this.facturas().filter((f) => {
      const d = f.fechaEmision.slice(0, 10);
      return d >= startDate && d <= endDate
        && (!catName || f.categoria === catName)
        && (!user || f.usuarioId === user);
    });
  });

  /** Reparto del monto del periodo por estado (barra apilada). */
  readonly porEstado = computed(() => {
    const rows = [
      { key: 'APROBADO', label: 'Aprobado', tone: 'ok', count: 0, amount: 0 },
      { key: 'PENDIENTE', label: 'Pendiente', tone: 'warn', count: 0, amount: 0 },
      { key: 'RECHAZADO', label: 'Rechazado', tone: 'danger', count: 0, amount: 0 },
    ];
    for (const f of this.enPeriodo()) {
      const r = rows.find((x) => x.key === (f.estado ?? 'PENDIENTE'))!;
      r.count++;
      r.amount += f.montoTotal;
    }
    const total = rows.reduce((s, r) => s + r.amount, 0);
    return { total, rows: rows.map((r) => ({ ...r, pct: total ? (r.amount / total) * 100 : 0 })) };
  });

  /** Cola de revisión: pendientes más antiguas primero. */
  readonly cola = computed(() =>
    this.enPeriodo()
      .filter((f) => (f.estado ?? 'PENDIENTE') === 'PENDIENTE')
      .sort((a, b) => a.fechaEmision.localeCompare(b.fechaEmision))
      .slice(0, QUEUE_SIZE));

  readonly categoriasOrdenadas = computed(() => {
    const list = [...this.categoriasGasto()].sort((a, b) => b.montoTotal - a.montoTotal);
    const max = list[0]?.montoTotal || 1;
    return list.map((c) => ({ ...c, width: (c.montoTotal / max) * 100 }));
  });

  /** Tasa de recuperación sobre el 7 % máximo, para la barra tipo bullet. */
  readonly recuperacionPct = computed(() => Math.min(100, (this.resumen().tasaRecuperacion / ITBMS_RATE) * 100));

  // ── Gráfica de tendencia ─────────────────────────────────────
  readonly trendData = computed<ChartConfiguration<'line'>['data']>(() => {
    const t = this.tendencia();
    return {
      labels: t.map((m) => monthLabel(m.mes)),
      datasets: [
        {
          label: 'Gasto',
          data: t.map((m) => m.montoTotal),
          borderColor: '#1D58EF',
          backgroundColor: (ctx) => gradient(ctx, 'rgba(29,88,239,.16)'),
          fill: true,
          tension: 0.32,
          borderWidth: 2.5,
          pointRadius: 3.5,
          pointHoverRadius: 6,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#1D58EF',
          pointBorderWidth: 2,
        },
        {
          label: 'ITBMS',
          data: t.map((m) => m.itbms),
          borderColor: '#1E8E3E',
          backgroundColor: 'transparent',
          borderDash: [5, 4],
          tension: 0.32,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: '#1E8E3E',
        },
      ],
    };
  });

  readonly trendOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#202124',
        padding: 12,
        cornerRadius: 10,
        boxPadding: 4,
        titleFont: { family: 'Plus Jakarta Sans', weight: 700 },
        bodyFont: { family: 'Plus Jakarta Sans' },
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${money(Number(ctx.parsed.y))}` },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { family: 'Plus Jakarta Sans', size: 12 }, color: '#8A9099' } },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: '#EEF1F5' },
        ticks: { font: { family: 'Plus Jakarta Sans', size: 12 }, color: '#8A9099', maxTicksLimit: 5, callback: (v) => moneyShort(Number(v)) },
      },
    },
  };

  // ── Rechazo en línea ─────────────────────────────────────────
  readonly rechazandoId = signal<string | null>(null);
  readonly motivo = signal('');
  readonly procesandoId = signal<string | null>(null);

  private dataSub?: Subscription;

  ngOnInit(): void {
    this.applyPreset('30d');
    this.facade.categorias.load();
    this.facade.facturas.loadAll();
    if (this.isAdmin()) this.facade.usuarios.loadAll();

    interval(REFRESH_MS).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!document.hidden) this.load();
    });
    interval(10_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.now.set(Date.now()));
    this.destroyRef.onDestroy(() => this.dataSub?.unsubscribe());
  }

  applyPreset(p: Preset): void {
    this.preset.set(p);
    if (p === 'custom') return;
    const today = new Date();
    const start = new Date(today);
    if (p === '7d') start.setDate(today.getDate() - 6);
    if (p === '30d') start.setDate(today.getDate() - 29);
    if (p === 'mes') start.setDate(1);
    if (p === '6m') { start.setMonth(today.getMonth() - 5); start.setDate(1); }
    this.startDate.set(isoDay(start));
    this.endDate.set(isoDay(today));
    this.load();
  }

  setRange(which: 'start' | 'end', value: string): void {
    (which === 'start' ? this.startDate : this.endDate).set(value);
    if (this.startDate() && this.endDate() && this.startDate() <= this.endDate()) this.load();
  }

  setCategoria(id: string): void {
    this.categoriaId.set(this.categoriaId() === id ? '' : id);
    this.load();
  }

  setUsuario(id: string): void {
    this.usuarioId.set(id);
    this.load();
  }

  clearFilters(): void {
    this.categoriaId.set('');
    this.usuarioId.set('');
    this.load();
  }

  refresh(): void {
    this.facade.facturas.refresh();
    this.load();
  }

  load(): void {
    const f = this.filtros();
    if (!f.startDate || !f.endDate) return;
    // La tendencia siempre muestra 6 meses hasta el fin del rango, para dar contexto.
    const end = new Date(`${f.endDate}T00:00:00`);
    const trendStart = isoDay(new Date(end.getFullYear(), end.getMonth() - 5, 1));

    this.dataSub?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.dataSub = forkJoin({
      resumen: this.facade.dashboard.getResumen(f),
      tendencia: this.facade.dashboard.getTendencia({ ...f, startDate: trendStart }),
      categorias: this.facade.dashboard.getCategorias(f),
    }).subscribe({
      next: ({ resumen, tendencia, categorias }) => {
        this.resumen.set(resumen);
        this.tendencia.set(tendencia);
        this.categoriasGasto.set(categorias);
        this.lastUpdated.set(new Date());
        this.now.set(Date.now());
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudieron cargar los datos. Revisa tu conexión y vuelve a intentarlo.');
      },
    });
  }

  // ── Acciones de la cola ──────────────────────────────────────
  aprobar(f: Factura): void {
    this.procesandoId.set(f.facturaId);
    this.facade.facturas.updateEstado(f.facturaId, 'APROBADO').subscribe({
      next: () => {
        this.procesandoId.set(null);
        this.toast.success('Factura aprobada', `${f.nombreProveedor} · ${money(f.montoTotal)}`);
        this.load();
      },
      error: () => {
        this.procesandoId.set(null);
        this.toast.error('No se pudo aprobar la factura', 'Inténtalo de nuevo en unos segundos.');
      },
    });
  }

  empezarRechazo(f: Factura): void {
    this.rechazandoId.set(f.facturaId);
    this.motivo.set('');
  }

  confirmarRechazo(f: Factura): void {
    const motivo = this.motivo().trim();
    if (motivo.length < 3) return;
    this.procesandoId.set(f.facturaId);
    this.facade.facturas.updateEstado(f.facturaId, 'RECHAZADO', motivo).subscribe({
      next: () => {
        this.procesandoId.set(null);
        this.rechazandoId.set(null);
        this.toast.success('Factura rechazada', 'El empleado verá el motivo en su historial.');
        this.load();
      },
      error: () => {
        this.procesandoId.set(null);
        this.toast.error('No se pudo rechazar la factura', 'Inténtalo de nuevo en unos segundos.');
      },
    });
  }

  vencida(f: Factura): boolean {
    return daysSince(f.fechaEmision) > 2;
  }

  estadoTone(e: string | null | undefined): string {
    return e === 'APROBADO' ? 'ok' : e === 'RECHAZADO' ? 'danger' : 'warn';
  }

  estadoLabel(e: string | null | undefined): string {
    return e === 'APROBADO' ? 'Aprobada' : e === 'RECHAZADO' ? 'Rechazada' : 'Pendiente';
  }

  variacion(v: number | null): { text: string; up: boolean } | null {
    if (v === null || !isFinite(v)) return null;
    return { text: `${Math.abs(v).toFixed(1)} %`, up: v >= 0 };
  }
}

function gradient(ctx: { chart: Chart }, top: string): CanvasGradient | string {
  const { ctx: c, chartArea } = ctx.chart;
  if (!chartArea) return top;
  const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  g.addColorStop(0, top);
  g.addColorStop(1, 'rgba(29,88,239,0)');
  return g;
}
