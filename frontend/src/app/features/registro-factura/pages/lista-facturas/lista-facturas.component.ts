import { Component, OnInit, ViewChild, computed, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { take } from 'rxjs/operators';

import { MisFacturasService } from '../../services/mis-facturas.service';
import { RegistroFacturaService } from '../../services/registro-factura.service';
import { FacturaEmpleadoModalComponent } from '../../components/factura-empleado-modal/factura-empleado-modal.component';
import { InvoiceFilterComponent } from '../../../admin/components/invoice-filter/invoice-filter.component';
import { InvoiceListComponent } from '../../../admin/components/invoice-list/invoice-list.component';
import { InvoiceFilterState, DEFAULT_FILTER, InvoiceSortKey } from '../../../admin/models/invoice-filter-state.model';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { Factura } from '../../models/factura.model';
import { money } from '../../../../shared/format/format';
import { AuthService } from '../../../auth/services/auth.service';

type EstadoTab = 'TODAS' | 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

@Component({
  selector: 'app-lista-facturas',
  standalone: true,
  imports: [AsyncPipe, RouterLink, FacturaEmpleadoModalComponent, InvoiceFilterComponent, InvoiceListComponent, IconComponent],
  templateUrl: './lista-facturas.component.html',
  styleUrl: './lista-facturas.component.css',
})
export class ListaFacturasComponent implements OnInit {
  private readonly svc = inject(MisFacturasService);
  private readonly regSvc = inject(RegistroFacturaService);
  private readonly auth = inject(AuthService);
  readonly money = money;

  protected readonly paged$ = this.svc.pagedFacturas$;
  protected readonly totalItems$ = this.svc.totalItems$;
  protected readonly currentPage$ = this.svc.currentPage$;
  protected readonly itemsPerPage$ = this.svc.itemsPerPage$;
  protected readonly isLoading$ = this.svc.isLoading$;
  protected readonly error$ = this.svc.error$;
  protected readonly sort$ = this.svc.sort$;
  protected readonly categories$ = this.svc.availableCategories$;
  protected readonly categorias = toSignal(this.regSvc.categorias$, { initialValue: [] });

  private readonly all = toSignal(this.svc.facturas$, { initialValue: [] as Factura[] });
  protected readonly filter = toSignal(this.svc.filter$, { initialValue: DEFAULT_FILTER });
  protected readonly nombre = computed(() => (this.auth.currentUser()?.name ?? '').split(' ')[0]);

  protected readonly tabs: { key: EstadoTab; label: string }[] = [
    { key: 'TODAS', label: 'Todas' },
    { key: 'PENDIENTE', label: 'En revisión' },
    { key: 'APROBADO', label: 'Aprobadas' },
    { key: 'RECHAZADO', label: 'Rechazadas' },
  ];

  protected readonly resumen = computed(() => {
    const r = { TODAS: 0, PENDIENTE: 0, APROBADO: 0, RECHAZADO: 0, montoAprobado: 0, montoPendiente: 0 };
    for (const f of this.all()) {
      const e = (f.estado ?? 'PENDIENTE') as EstadoTab;
      r.TODAS++; r[e]++;
      if (e === 'APROBADO') r.montoAprobado += f.montoTotal;
      if (e === 'PENDIENTE') r.montoPendiente += f.montoTotal;
    }
    return r;
  });

  protected readonly activeTab = computed<EstadoTab>(() => {
    const s = this.filter().selectedStatuses;
    return s.length === 1 ? (s[0] as EstadoTab) : 'TODAS';
  });

  protected readonly hasFilters = computed(() => {
    const f = this.filter();
    return !!(f.searchTerm || f.dateFrom || f.dateTo || f.selectedCategories.length || f.selectedStatuses.length);
  });

  @ViewChild(InvoiceFilterComponent) private filterRef?: InvoiceFilterComponent;

  protected modalOpen = false;
  protected modalInvoices: Factura[] = [];
  protected modalIndex = 0;

  ngOnInit(): void {
    this.svc.setFilter(DEFAULT_FILTER);
    this.svc.loadMine();
    this.regSvc.cargarCategorias();
  }

  onTab(tab: EstadoTab): void {
    this.svc.setStatusFilter(tab === 'TODAS' ? [] : [tab]);
  }

  onFilterChange(state: InvoiceFilterState): void {
    this.svc.setFilter({ ...state, selectedStatuses: this.svc.getCurrentFilter().selectedStatuses });
  }

  onClearFilters(): void {
    this.svc.setFilter(DEFAULT_FILTER);
    this.filterRef?.clearFilters();
  }

  onSort(key: InvoiceSortKey): void {
    this.svc.toggleSort(key);
  }

  onPageChange(page: number): void {
    this.svc.goToPage(page);
  }

  onRefresh(): void {
    this.svc.refresh();
  }

  onOpenFactura(invoice: Factura): void {
    this.svc.filteredFacturas$.pipe(take(1)).subscribe((all) => {
      this.modalInvoices = [...all];
      this.modalIndex = Math.max(0, all.findIndex((f) => f.facturaId === invoice.facturaId));
      this.modalOpen = true;
    });
  }

  onModalClose(): void {
    this.modalOpen = false;
  }
}
