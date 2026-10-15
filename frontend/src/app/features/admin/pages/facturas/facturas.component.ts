import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { take } from 'rxjs/operators';
import { InvoiceListComponent } from '../../components/invoice-list/invoice-list.component';
import { InvoiceFilterComponent } from '../../components/invoice-filter/invoice-filter.component';
import { InvoiceAuditModalComponent, AuditApproveEvent, AuditRejectEvent } from '../../../../shared/invoice-audit-modal/invoice-audit-modal.component';
import { SuscripcionBannerComponent } from '../../../../shared/suscripcion-banner/suscripcion-banner.component';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { AdminFacadeService } from '../../services/admin.facade.service';
import { InvoiceFilterState, DEFAULT_FILTER, InvoiceSortKey } from '../../models/invoice-filter-state.model';
import { Factura } from '../../../registro-factura/models/factura.model';
import { ToastService } from '../../../../shared/toast/toast.service';
import { money } from '../../../../shared/format/format';

type EstadoTab = 'TODAS' | 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

@Component({
  selector: 'app-facturas',
  standalone: true,
  imports: [AsyncPipe, RouterLink, InvoiceListComponent, InvoiceFilterComponent, InvoiceAuditModalComponent, SuscripcionBannerComponent, IconComponent],
  templateUrl: './facturas.component.html',
  styleUrl: './facturas.component.css',
})
export class FacturasComponent implements OnInit {
  private readonly facade = inject(AdminFacadeService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  readonly money = money;

  protected readonly invoices$ = this.facade.facturas.pagedFacturas$;
  protected readonly isLoading$ = this.facade.facturas.isLoading$;
  protected readonly error$ = this.facade.facturas.error$;
  protected readonly totalItems$ = this.facade.facturas.totalItems$;
  protected readonly currentPage$ = this.facade.facturas.currentPage$;
  protected readonly itemsPerPage$ = this.facade.facturas.itemsPerPage$;
  protected readonly categories$ = this.facade.facturas.availableCategories$;
  protected readonly sort$ = this.facade.facturas.sort$;

  private readonly all = toSignal(this.facade.facturas.facturas$, { initialValue: [] as Factura[] });
  protected readonly filtered = toSignal(this.facade.facturas.filteredFacturas$, { initialValue: [] as Factura[] });
  protected readonly filter = toSignal(this.facade.facturas.filter$, { initialValue: DEFAULT_FILTER });

  protected readonly tabs: { key: EstadoTab; label: string }[] = [
    { key: 'TODAS', label: 'Todas' },
    { key: 'PENDIENTE', label: 'Pendientes' },
    { key: 'APROBADO', label: 'Aprobadas' },
    { key: 'RECHAZADO', label: 'Rechazadas' },
  ];

  protected readonly counts = computed(() => {
    const c: Record<EstadoTab, number> = { TODAS: 0, PENDIENTE: 0, APROBADO: 0, RECHAZADO: 0 };
    for (const f of this.all()) { c.TODAS++; c[(f.estado ?? 'PENDIENTE') as EstadoTab]++; }
    return c;
  });

  protected readonly activeTab = computed<EstadoTab>(() => {
    const s = this.filter().selectedStatuses;
    return s.length === 1 ? (s[0] as EstadoTab) : 'TODAS';
  });

  protected readonly filteredTotal = computed(() => this.filtered().reduce((s, f) => s + f.montoTotal, 0));

  protected readonly hasFilters = computed(() => {
    const f = this.filter();
    return !!(f.searchTerm || f.dateFrom || f.dateTo || f.selectedCategories.length || f.selectedStatuses.length);
  });

  @ViewChild('invoiceFilter') private invoiceFilterRef?: InvoiceFilterComponent;
  @ViewChild(InvoiceAuditModalComponent) private auditRef?: InvoiceAuditModalComponent;

  // ── Selección y acciones en lote ─────────────────────────────
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly selectedPending = computed(() =>
    this.all().filter((f) => this.selected().has(f.facturaId) && (f.estado ?? 'PENDIENTE') === 'PENDIENTE'));
  protected isApprovingBulk = false;
  protected isExporting = false;

  // ── Modal de auditoría ───────────────────────────────────────
  protected modalOpen = false;
  protected modalInvoices: Factura[] = [];
  protected modalIndex = 0;

  ngOnInit(): void {
    // El servicio es singleton: se empieza sin filtros para que coincida con los campos vacíos.
    this.facade.facturas.setFilter(DEFAULT_FILTER);
    const estado = this.route.snapshot.queryParamMap.get('estado');
    if (estado && ['PENDIENTE', 'APROBADO', 'RECHAZADO'].includes(estado)) {
      this.facade.facturas.setStatusFilter([estado]);
    }
    this.facade.facturas.loadAll();
  }

  onTab(tab: EstadoTab): void {
    this.facade.facturas.setStatusFilter(tab === 'TODAS' ? [] : [tab]);
  }

  onFilterChange(state: InvoiceFilterState): void {
    const current = this.facade.facturas.getCurrentFilter();
    this.facade.facturas.setFilter({ ...state, selectedStatuses: current.selectedStatuses });
  }

  onClearFilters(): void {
    this.facade.facturas.setFilter(DEFAULT_FILTER);
    this.invoiceFilterRef?.clearFilters();
  }

  onSort(key: InvoiceSortKey): void {
    this.facade.facturas.toggleSort(key);
  }

  onPageChange(page: number): void {
    this.facade.facturas.goToPage(page);
  }

  onRefresh(): void {
    this.selected.set(new Set());
    this.facade.facturas.refresh();
  }

  onSelectionChange(ids: string[]): void {
    this.selected.set(new Set(ids));
  }

  clearSelection(): void {
    this.selected.set(new Set());
  }

  onApproveSelected(): void {
    const pending = this.selectedPending();
    if (!pending.length || this.isApprovingBulk) return;
    this.isApprovingBulk = true;
    forkJoin(pending.map((f) => this.facade.facturas.updateEstado(f.facturaId, 'APROBADO'))).subscribe({
      next: () => {
        this.isApprovingBulk = false;
        this.clearSelection();
        const n = pending.length;
        this.toast.success(`${n} ${n === 1 ? 'factura aprobada' : 'facturas aprobadas'}`, money(pending.reduce((s, f) => s + f.montoTotal, 0)));
      },
      error: (err) => {
        this.isApprovingBulk = false;
        this.facade.facturas.refresh();
        this.toast.error('No se pudieron aprobar todas', err?.error?.message ?? 'Revisa la lista e inténtalo de nuevo.');
      },
    });
  }

  // ── Exportación ─────────────────────────────────────────────
  onExportExcel(): void {
    if (this.isExporting) return;
    const ids = this.selected().size ? [...this.selected()] : this.filtered().map((f) => f.facturaId);
    if (!ids.length) {
      this.toast.warning('No hay facturas para exportar', 'Ninguna factura coincide con los filtros actuales.');
      return;
    }
    this.isExporting = true;
    this.facade.facturas.exportToExcel(ids).subscribe({
      next: (blob) => {
        this.isExporting = false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facturas_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.toast.success('Excel descargado', `${ids.length} ${ids.length === 1 ? 'factura' : 'facturas'} en el archivo.`);
      },
      error: async (err) => {
        this.isExporting = false;
        // con responseType blob el error llega como Blob
        let msg = 'No se pudo generar el archivo.';
        try { const body = JSON.parse(await (err?.error as Blob).text()); msg = [].concat(body.message).join(' ') || msg; } catch { /* sin cuerpo */ }
        this.toast.error('No se pudo exportar', msg);
      },
    });
  }

  // ── Modal ───────────────────────────────────────────────────
  onOpenInvoice(invoice: Factura): void {
    this.facade.facturas.filteredFacturas$.pipe(take(1)).subscribe((all) => {
      this.modalInvoices = [...all];
      this.modalIndex = Math.max(0, all.findIndex((f) => f.facturaId === invoice.facturaId));
      this.modalOpen = true;
    });
  }

  onModalClose(): void {
    this.modalOpen = false;
  }

  onModalApprove(event: AuditApproveEvent): void {
    this.facade.facturas.updateEstado(event.facturaId, 'APROBADO').subscribe({
      next: () => {
        this.modalOpen = false;
        this.toast.success('Factura aprobada');
      },
      error: (err) => {
        this.auditRef?.resetSaving();
        this.toast.error('No se pudo aprobar', err?.error?.message ?? 'Inténtalo de nuevo.');
      },
    });
  }

  onModalReject(event: AuditRejectEvent): void {
    this.facade.facturas.updateEstado(event.facturaId, 'RECHAZADO', event.motivoRechazo).subscribe({
      next: () => {
        this.modalOpen = false;
        this.toast.success('Factura rechazada', 'El empleado verá el motivo en su historial.');
      },
      error: (err) => {
        this.auditRef?.resetSaving();
        this.toast.error('No se pudo rechazar', err?.error?.message ?? 'Inténtalo de nuevo.');
      },
    });
  }
}
