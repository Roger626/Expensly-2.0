import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, forkJoin, interval } from 'rxjs';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
  DoughnutController,
  ArcElement,
  ChartConfiguration,
} from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { AdminFacadeService } from '../../services/admin.facade.service';
import { AuthService } from '../../../auth/services/auth.service';
import { SuscripcionBannerComponent } from '../../../../shared/suscripcion-banner/suscripcion-banner.component';
import { LucideAngularModule } from 'lucide-angular';

Chart.register(
  LineController, LineElement, PointElement, LinearScale, CategoryScale,
  Filler, Tooltip, Legend, DoughnutController, ArcElement,
);

const REFRESH_INTERVAL_MS = 60_000;
const TICK_INTERVAL_MS = 10_000;

const CATEGORY_COLORS = [
  '#4f46e5', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#64748b', // slate
];

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, SuscripcionBannerComponent, LucideAngularModule, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class AdminDashboardPageComponent implements OnInit, OnDestroy {
  private readonly facade = inject(AdminFacadeService);
  private readonly authService = inject(AuthService);

  private subs = new Subscription();
  /** Subscription de la carga de datos en curso — se resetea en cada llamada
   *  para que un refresh cancele limpiamente cualquier request anterior aún
   *  en vuelo (evita condiciones de carrera entre polling y filtros). */
  private dataSubs = new Subscription();

  // Filters state
  preset = '30d'; // '7d' | '30d' | 'mes' | 'custom'
  startDate = '';
  endDate = '';
  categoriaId = '';
  usuarioId = '';

  // Data lists
  categories: any[] = [];
  employees: any[] = [];
  showEmployeeFilter = false;

  // Loading / error / freshness state
  isLoading = signal(false);
  loadError = signal<string | null>(null);
  lastUpdated = signal<Date | null>(null);
  private tick = signal(0);

  lastUpdatedLabel = computed(() => {
    this.tick(); // fuerza recomputar cada TICK_INTERVAL_MS
    const updated = this.lastUpdated();
    if (!updated) return '';
    const secs = Math.floor((Date.now() - updated.getTime()) / 1000);
    if (secs < 5) return 'Actualizado justo ahora';
    if (secs < 60) return `Actualizado hace ${secs}s`;
    const mins = Math.floor(secs / 60);
    return `Actualizado hace ${mins} min`;
  });

  // KPI summary data
  summary: any = {
    gastoTotal: 0,
    itbmsRecuperable: 0,
    tasaRecuperacion: 0,
    variacionGastoTotal: null,
    variacionItbmsRecuperable: null,
    aprobacionesPendientes: 0,
    reportesVencidos: 0,
    ultimasTransacciones: []
  };

  // Line chart (Chart.js) — tendencia mensual
  trendData: any[] = [];
  trendChartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  trendChartOptions: ChartConfiguration<'line'>['options'] = {};

  // Doughnut chart (Chart.js) — desglose por categorías
  categoriesData: any[] = [];
  categorySegments: any[] = []; // para la leyenda HTML custom (nombre, color, monto, %)
  categoryChartData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  categoryChartOptions: ChartConfiguration<'doughnut'>['options'] = {};

  ngOnInit(): void {
    // Set initial date inputs based on 30 days preset
    this.updateDatesByPreset();
    this.buildStaticChartOptions();

    const orgId = this.authService.organizationId();
    if (orgId) {
      // 1. Fetch categories
      this.subs.add(
        this.facade.dashboard.getCategorias(orgId).subscribe({
          next: (cats) => (this.categories = cats),
          error: (err) => console.error('Error al cargar categorías:', err)
        })
      );
    }

    // 2. Fetch employees (users)
    this.facade.usuarios.loadAll();
    this.subs.add(
      this.facade.usuarios.usuarios$.subscribe({
        next: (users) => {
          this.employees = users;
          this.showEmployeeFilter = users.length > 1;
        },
        error: (err) => console.error('Error al cargar empleados:', err)
      })
    );

    // 3. Load dashboard data
    this.loadAllDashboardData();

    // 4. Auto-refresh periódico (pausado si la pestaña no está visible)
    this.subs.add(
      interval(REFRESH_INTERVAL_MS).subscribe(() => {
        if (!document.hidden) this.loadAllDashboardData();
      })
    );

    // 5. Tick para refrescar el texto "Actualizado hace Xs" sin recargar datos
    this.subs.add(
      interval(TICK_INTERVAL_MS).subscribe(() => this.tick.update(v => v + 1))
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.dataSubs.unsubscribe();
  }

  onPresetChange(): void {
    if (this.preset !== 'custom') {
      this.updateDatesByPreset();
      this.loadAllDashboardData();
    }
  }

  onFilterChange(): void {
    this.loadAllDashboardData();
  }

  /** Refresco manual explícito (botón "Actualizar"). */
  onRefreshClick(): void {
    this.loadAllDashboardData();
  }

  loadAllDashboardData(): void {
    if (!this.startDate || !this.endDate) return;

    // Cancela cualquier carga anterior aún en vuelo antes de lanzar una nueva.
    this.dataSubs.unsubscribe();
    this.dataSubs = new Subscription();

    this.isLoading.set(true);
    this.loadError.set(null);

    const resumen$ = this.facade.dashboard.getDashboardResumen(
      this.startDate,
      this.endDate,
      this.categoriaId || undefined,
      this.usuarioId || undefined
    );
    const tendencia$ = this.facade.dashboard.getDashboardTendencia(
      this.categoriaId || undefined,
      this.usuarioId || undefined,
      this.startDate,
      this.endDate
    );
    const categorias$ = this.facade.dashboard.getDashboardCategorias(
      this.startDate,
      this.endDate,
      this.usuarioId || undefined
    );

    this.dataSubs.add(
      forkJoin({ resumen: resumen$, tendencia: tendencia$, categorias: categorias$ }).subscribe({
        next: ({ resumen, tendencia, categorias }) => {
          this.summary = resumen;
          this.trendData = tendencia;
          this.buildTrendChartData();
          this.categoriesData = categorias;
          this.buildCategoryChartData();
          this.isLoading.set(false);
          this.lastUpdated.set(new Date());
        },
        error: (err) => {
          console.error('Error al cargar datos del dashboard:', err);
          this.isLoading.set(false);
          this.loadError.set('No se pudieron cargar los datos del dashboard. Verifica tu conexión e intenta de nuevo.');
        }
      })
    );
  }

  private updateDatesByPreset(): void {
    const today = new Date();
    let start = new Date();

    if (this.preset === '7d') {
      start.setDate(today.getDate() - 6);
    } else if (this.preset === '30d') {
      start.setDate(today.getDate() - 29);
    } else if (this.preset === 'mes') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    this.startDate = start.toISOString().split('T')[0];
    this.endDate = today.toISOString().split('T')[0];
  }

  // ========= Chart.js config =========

  private buildStaticChartOptions(): void {
    this.trendChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false }, // se usa la leyenda HTML custom
        tooltip: {
          backgroundColor: '#0f172a',
          padding: 10,
          cornerRadius: 8,
          titleFont: { family: 'Quicksand', weight: 600 },
          bodyFont: { family: 'Quicksand' },
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: $${Number(ctx.parsed.y).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Quicksand', size: 11 }, color: '#94a3b8' } },
        y: {
          beginAtZero: true,
          grid: { color: '#e2e8f0' },
          ticks: {
            font: { family: 'Quicksand', size: 11 },
            color: '#94a3b8',
            callback: (val) => this.getYLabel(Number(val)),
          },
        },
      },
    };

    this.categoryChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false }, // se usa la leyenda HTML custom
        tooltip: {
          backgroundColor: '#0f172a',
          padding: 10,
          cornerRadius: 8,
          titleFont: { family: 'Quicksand', weight: 600 },
          bodyFont: { family: 'Quicksand' },
          callbacks: {
            label: (ctx) => {
              const seg = this.categorySegments[ctx.dataIndex];
              return `${ctx.label}: $${Number(ctx.parsed).toFixed(2)} (${seg?.percentage ?? 0}%)`;
            },
          },
        },
      },
    };
  }

  private buildTrendChartData(): void {
    const labels = this.trendData.map(d => this.formatMonthLabel(d.mes));

    this.trendChartData = {
      labels,
      datasets: [
        {
          label: 'Gasto Total',
          data: this.trendData.map(d => d.montoTotal),
          borderColor: '#4f46e5',
          backgroundColor: (ctx) => this.buildGradient(ctx, 'rgba(79,70,229,0.25)', 'rgba(79,70,229,0)'),
          borderWidth: 3,
          tension: 0.35,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#4f46e5',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointHoverRadius: 6,
        },
        {
          label: 'ITBMS',
          data: this.trendData.map(d => d.itbms),
          borderColor: '#10b981',
          backgroundColor: (ctx) => this.buildGradient(ctx, 'rgba(16,185,129,0.20)', 'rgba(16,185,129,0)'),
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointHoverRadius: 6,
        },
      ],
    };
  }

  /** Gradiente vertical bajo la línea — requiere el contexto del canvas, solo disponible tras el primer render. */
  private buildGradient(context: any, colorTop: string, colorBottom: string): CanvasGradient | string {
    const { ctx, chartArea } = context.chart;
    if (!chartArea) return colorTop; // fallback antes del primer layout
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, colorTop);
    gradient.addColorStop(1, colorBottom);
    return gradient;
  }

  private buildCategoryChartData(): void {
    let totalGasto = 0;
    for (const cat of this.categoriesData) totalGasto += Number(cat.montoTotal) || 0;

    this.categorySegments = this.categoriesData.map((cat, i) => ({
      ...cat,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      percentage: totalGasto > 0 ? Number(((cat.montoTotal / totalGasto) * 100).toFixed(1)) : 0,
    }));

    this.categoryChartData = {
      labels: this.categorySegments.map(s => s.name),
      datasets: [{
        data: this.categorySegments.map(s => s.montoTotal),
        backgroundColor: this.categorySegments.map(s => s.color),
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 6,
      }],
    };
  }

  // ========= Helpers =========

  getAvatarInitials(name?: string): string {
    if (!name) return 'EX';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }

  getAvatarColor(name?: string): string {
    const palette = ['#4285f4', '#ea4335', '#fbbc04', '#34a853', '#ff6d00', '#46bdc6', '#7c4dff', '#e91e63'];
    if (!name) return palette[0];
    const idx = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % palette.length;
    return palette[idx];
  }

  getStatusClass(estado?: string): string {
    switch (estado?.toUpperCase()) {
      case 'APROBADO':  return 'badge-status-approved';
      case 'RECHAZADO': return 'badge-status-rejected';
      default:          return 'badge-status-pending';
    }
  }

  getStatusLabel(estado?: string): string {
    switch (estado?.toUpperCase()) {
      case 'APROBADO':  return 'Aprobado';
      case 'RECHAZADO': return 'Rechazado';
      default:          return 'Pendiente';
    }
  }

  getYLabel(tick: number): string {
    if (tick >= 1000) {
      return `$${(tick / 1000).toFixed(1)}k`;
    }
    return `$${tick.toFixed(0)}`;
  }

  formatMonthLabel(monthStr: string): string {
    if (!monthStr) return '';
    const parts = monthStr.split('-');
    if (parts.length < 2) return monthStr;
    const monthIndex = parseInt(parts[1], 10) - 1;
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${months[monthIndex]} ${parts[0].slice(-2)}`;
  }
}
