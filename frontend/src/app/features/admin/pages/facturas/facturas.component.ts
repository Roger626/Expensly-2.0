import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { take } from 'rxjs/operators';
import { InvoiceListComponent } from '../../components/invoice-list/invoice-list.component';
import { InvoiceFilterComponent } from '../../components/invoice-filter/invoice-filter.component';
import { InvoiceAuditModalComponent, AuditApproveEvent, AuditRejectEvent } from '../../../../shared/invoice-audit-modal/invoice-audit-modal.component';
import { SuscripcionBannerComponent } from '../../../../shared/suscripcion-banner/suscripcion-banner.component';
import { AdminFacadeService } from '../../services/admin.facade.service';
import { InvoiceFilterState, DEFAULT_FILTER } from '../../models/invoice-filter-state.model';
import { Factura } from '../../../registro-factura/models/factura.model';
import { ToastService } from '../../../../shared/toast/toast.service';

@Component({
  selector: 'app-facturas',
  standalone: true,
  imports: [CommonModule, InvoiceListComponent, InvoiceFilterComponent, InvoiceAuditModalComponent, SuscripcionBannerComponent],
  templateUrl: './facturas.component.html',
  styleUrl: './facturas.component.css',
})
export class FacturasComponent implements OnInit {

  private readonly facade = inject(AdminFacadeService);
  private readonly toast  = inject(ToastService);

  // ── Observables para el template ─────────────────────────────────────────
  protected readonly invoices$          = this.facade.facturas.pagedFacturas$;
  protected readonly allFilteredInvs$   = this.facade.facturas.filteredFacturas$;
  protected readonly isLoading$         = this.facade.facturas.isLoading$;
  protected readonly error$             = this.facade.facturas.error$;
  protected readonly totalItems$        = this.facade.facturas.totalItems$;
  protected readonly currentPage$       = this.facade.facturas.currentPage$;
  protected readonly itemsPerPage$      = this.facade.facturas.itemsPerPage$;
  protected readonly categories$        = this.facade.facturas.availableCategories$;
  protected readonly stats$             = this.facade.facturas.stats$;
  protected readonly filter$            = this.facade.facturas.filter$;

  protected readonly statuses = ['PENDIENTE', 'APROBADO', 'RECHAZADO'] as const;

  @ViewChild('invoiceFilter') private invoiceFilterRef?: InvoiceFilterComponent;

  // ── Selection + bulk actions ─────────────────────────────────────────────
  protected selectedIds: string[] = [];
  protected isApprovingBulk = false;
  protected isExporting     = false;

  // ── Modal state ──────────────────────────────────────────────────────────
  protected modalOpen       = false;
  protected modalInvoices:  Factura[] = [];
  protected modalIndex      = 0;

  ngOnInit(): void {
    this.facade.facturas.loadAll();
  }

  onFilterChange(state: InvoiceFilterState): void {
    // Preserve active status chips when text/date/category filters change
    const current = this.facade.facturas.getCurrentFilter();
    this.facade.facturas.setFilter({ ...state, selectedStatuses: current.selectedStatuses });
  }

  onStatusToggle(status: string, current: InvoiceFilterState): void {
    const set = new Set(current.selectedStatuses);
    set.has(status) ? set.delete(status) : set.add(status);
    this.facade.facturas.setStatusFilter([...set]);
  }

  onClearFilters(): void {
    this.facade.facturas.setFilter(DEFAULT_FILTER);
    // Also reset the filter component's own visual state (search input, dates, categories)
    this.invoiceFilterRef?.clearFilters();
  }

  onPageChange(page: number): void {
    this.facade.facturas.goToPage(page);
  }

  onRefresh(): void {
    this.facade.facturas.refresh();
  }

  onSelectionChange(ids: string[]): void {
    this.selectedIds = ids;
  }

  // ── Bulk approve ─────────────────────────────────────────────────────────
  onApproveSelected(): void {
    if (this.selectedIds.length === 0 || this.isApprovingBulk) return;
    this.isApprovingBulk = true;
    const count = this.selectedIds.length;
    const calls = this.selectedIds.map(id =>
      this.facade.facturas.updateEstado(id, 'APROBADO')
    );
    forkJoin(calls).subscribe({
      next: () => {
        this.selectedIds     = [];
        this.isApprovingBulk = false;
        this.facade.facturas.refresh();
        this.toast.success(
          `${count} factura${count === 1 ? '' : 's'} aprobada${count === 1 ? '' : 's'}`,
          'El estado se actualizó correctamente.',
        );
      },
      error: (err) => {
        this.isApprovingBulk = false;
        this.facade.facturas.refresh();
        const msg = err?.error?.message ?? 'Ocurrió un error al aprobar las facturas.';
        this.toast.error('Error al aprobar', msg);
      },
    });
  }

  // ── Excel export ──────────────────────────────────────────────────
  onExportExcel(): void {
    if (this.isExporting) return;

    const doExport = (ids: string[]) => {
      if (ids.length === 0) {
        this.toast.warning(
          'Sin facturas para exportar',
          'No hay facturas que coincidan con los filtros actuales.',
        );
        return;
      }

      this.isExporting = true;
      const scope = this.selectedIds.length > 0
        ? `${ids.length} seleccionada${ids.length === 1 ? '' : 's'}`
        : `${ids.length} filtrada${ids.length === 1 ? '' : 's'}`;

      this.facade.facturas.exportToExcel(ids).subscribe({
        next: (blob) => {
          this.isExporting = false;
          const url    = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href    = url;
          anchor.download = `facturas_${new Date().toISOString().slice(0, 10)}.xlsx`;
          anchor.click();
          URL.revokeObjectURL(url);
          this.toast.success(
            'Excel generado correctamente',
            `Se exportaron ${scope} al archivo .xlsx.`,
          );
        },
        error: (err) => {
          this.isExporting = false;
          const raw = err?.error;
          const msg = Array.isArray(raw?.message)
            ? raw.message.join(' ')
            : (raw?.message ?? 'Verifica que las facturas seleccionadas estén aprobadas.');
          this.toast.error('Error al exportar', msg);
        },
      });
    };

    if (this.selectedIds.length > 0) {
      doExport(this.selectedIds);
    } else {
      this.facade.facturas.filteredFacturas$.subscribe(all => {
        doExport(all.map(f => f.facturaId));
      }).unsubscribe();
    }
  }

  // ── Modal handlers ───────────────────────────────────────────────────────
  onOpenInvoice(invoice: Factura): void {
    // Use the full filtered list so prev/next navigates across all pages
    this.facade.facturas.filteredFacturas$.pipe(take(1)).subscribe(all => {
      this.modalInvoices = [...all];
      this.modalIndex    = all.findIndex(f => f.facturaId === invoice.facturaId);
      if (this.modalIndex === -1) this.modalIndex = 0;
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
        this.toast.success('Factura aprobada', 'El estado se actualizó correctamente.');
        this.facade.facturas.refresh();
      },
      error: (err) => {
        this.modalOpen = false;
        this.toast.error('Error al aprobar', err?.error?.message ?? 'No se pudo aprobar la factura.');
      },
    });
  }

  onModalReject(event: AuditRejectEvent): void {
    this.facade.facturas.updateEstado(event.facturaId, 'RECHAZADO', event.motivoRechazo).subscribe({
      next: () => {
        this.modalOpen = false;
        this.toast.warning('Factura rechazada', `Motivo: ${event.motivoRechazo}`);
        this.facade.facturas.refresh();
      },
      error: (err) => {
        this.modalOpen = false;
        this.toast.error('Error al rechazar', err?.error?.message ?? 'No se pudo rechazar la factura.');
      },
    });
  }
}

