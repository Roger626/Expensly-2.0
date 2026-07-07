import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AdminFacadeService } from '../../services/admin.facade.service';
import { AuthService } from '../../../auth/services/auth.service';
import { SuscripcionBannerComponent } from '../../../../shared/suscripcion-banner/suscripcion-banner.component';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, SuscripcionBannerComponent, LucideAngularModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class AdminDashboardPageComponent implements OnInit, OnDestroy {
  private readonly facade = inject(AdminFacadeService);
  private readonly authService = inject(AuthService);

  private subs = new Subscription();

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

  // KPI summary data
  summary: any = {
    gastoTotal: 0,
    itbmsRecuperable: 0,
    tasaRecuperacion: 0,
    aprobacionesPendientes: 0,
    reportesVencidos: 0,
    ultimasTransacciones: []
  };

  // SVG Trend Chart variables
  trendData: any[] = [];
  maxTrendVal = 100;
  totalPath = '';
  itbmsPath = '';
  totalAreaPath = '';
  itbmsAreaPath = '';
  trendPointsTotal: any[] = [];
  trendPointsItbms: any[] = [];
  yGridTicks: number[] = [];

  // SVG Donut Chart variables
  categoriesData: any[] = [];
  categorySegments: any[] = [];

  // Chart sizes
  lineWidth = 600;
  lineHeight = 220;
  paddingLeft = 55;
  paddingRight = 20;
  paddingTop = 20;
  paddingBottom = 30;

  ngOnInit(): void {
    // Set initial date inputs based on 30 days preset
    this.updateDatesByPreset();

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
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
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

  loadAllDashboardData(): void {
    if (!this.startDate || !this.endDate) return;

    // Resumen KPIs and Transactions
    this.subs.add(
      this.facade.dashboard.getDashboardResumen(
        this.startDate,
        this.endDate,
        this.categoriaId || undefined,
        this.usuarioId || undefined
      ).subscribe({
        next: (res) => {
          this.summary = res;
        },
        error: (err) => console.error('Error al cargar resumen de dashboard:', err)
      })
    );

    // Trend analysis
    this.subs.add(
      this.facade.dashboard.getDashboardTendencia(
        this.categoriaId || undefined,
        this.usuarioId || undefined
      ).subscribe({
        next: (data) => {
          this.trendData = data;
          this.calculateLineChartPaths();
        },
        error: (err) => console.error('Error al cargar tendencia mensual:', err)
      })
    );

    // Categories breakdown
    this.subs.add(
      this.facade.dashboard.getDashboardCategorias(
        this.startDate,
        this.endDate,
        this.usuarioId || undefined
      ).subscribe({
        next: (data) => {
          this.categoriesData = data;
          this.calculateDonutSegments();
        },
        error: (err) => console.error('Error al cargar desglose por categorías:', err)
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

  private calculateLineChartPaths(): void {
    if (!this.trendData || this.trendData.length === 0) return;

    this.maxTrendVal = Math.max(
      ...this.trendData.map((d) => Math.max(d.montoTotal, d.itbms)),
      100
    );
    // Add 10% spacing at the top
    this.maxTrendVal = Math.ceil(this.maxTrendVal * 1.1);

    const chartWidth = this.lineWidth - this.paddingLeft - this.paddingRight;
    const chartHeight = this.lineHeight - this.paddingTop - this.paddingBottom;

    // Grid ticks (4 steps)
    this.yGridTicks = [0, 0.25, 0.5, 0.75, 1.0].map((p) => p * this.maxTrendVal);

    this.trendPointsTotal = this.trendData.map((d, i) => {
      const x = this.paddingLeft + (i * chartWidth) / (this.trendData.length - 1);
      const y = this.paddingTop + chartHeight - (d.montoTotal / this.maxTrendVal) * chartHeight;
      return { x, y, val: d.montoTotal, label: d.mes };
    });

    this.trendPointsItbms = this.trendData.map((d, i) => {
      const x = this.paddingLeft + (i * chartWidth) / (this.trendData.length - 1);
      const y = this.paddingTop + chartHeight - (d.itbms / this.maxTrendVal) * chartHeight;
      return { x, y, val: d.itbms };
    });

    // Line Paths
    this.totalPath = 'M ' + this.trendPointsTotal.map((p) => `${p.x},${p.y}`).join(' L ');
    this.itbmsPath = 'M ' + this.trendPointsItbms.map((p) => `${p.x},${p.y}`).join(' L ');

    // Area Paths (for gradient fill under the line)
    const bottomY = this.paddingTop + chartHeight;
    const firstX = this.trendPointsTotal[0]?.x ?? this.paddingLeft;
    const lastX = this.trendPointsTotal[this.trendPointsTotal.length - 1]?.x ?? (this.paddingLeft + chartWidth);

    this.totalAreaPath = `${this.totalPath} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
    this.itbmsAreaPath = `${this.itbmsPath} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
  }

  private calculateDonutSegments(): void {
    let accumulated = 0;
    const colors = [
      '#4f46e5', // indigo
      '#10b981', // emerald
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#64748b'  // slate
    ];

    this.categorySegments = this.categoriesData.map((cat, i) => {
      const color = colors[i % colors.length];
      const percentage = Number(cat.percentage);
      const dashArray = `${percentage} ${100 - percentage}`;
      const dashOffset = 100 - accumulated;
      accumulated += percentage;

      return {
        ...cat,
        color,
        dashArray,
        dashOffset
      };
    });
  }

  getAvatarInitials(name: string): string {
    if (!name) return 'EX';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }

  getStatusClass(status: string): string {
    const st = (status || '').toUpperCase();
    if (st === 'APROBADO') return 'badge-status-approved';
    if (st === 'RECHAZADO') return 'badge-status-rejected';
    return 'badge-status-pending';
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
