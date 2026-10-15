import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Factura } from '../../../registro-factura/models/factura.model';
import { InvoiceSort, InvoiceSortKey } from '../../models/invoice-filter-state.model';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { initials, longDate, money } from '../../../../shared/format/format';

/** Tabla de facturas: presentacional. La selección y el orden los controla la página. */
@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './invoice-list.component.html',
  styleUrl: './invoice-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceListComponent {
  @Input() invoices: Factura[] = [];
  @Input() totalItems = 0;
  @Input() itemsPerPage = 10;
  @Input() currentPage = 1;
  @Input() selected: ReadonlySet<string> = new Set();
  @Input() sort: InvoiceSort | null = null;
  @Input() hasFilters = false;
  /** Casillas para acciones en lote (vista del admin). */
  @Input() selectable = true;
  /** Columna de empleado (se oculta en "Mis facturas"). */
  @Input() showEmployee = true;
  /** Texto del estado vacío cuando no hay filtros. */
  @Input() emptyTitle = 'Aún no hay facturas';
  @Input() emptyText = 'Cuando tu equipo registre gastos aparecerán aquí para revisarlos.';

  @Output() pageChange = new EventEmitter<number>();
  @Output() selectionChange = new EventEmitter<string[]>();
  @Output() openInvoice = new EventEmitter<Factura>();
  @Output() sortChange = new EventEmitter<InvoiceSortKey>();
  @Output() clearFilters = new EventEmitter<void>();

  get colspan(): number {
    return 6 + (this.selectable ? 1 : 0) + (this.showEmployee ? 1 : 0);
  }

  readonly money = money;
  readonly longDate = longDate;
  readonly initials = initials;

  get allSelected(): boolean {
    return this.invoices.length > 0 && this.invoices.every((i) => this.selected.has(i.facturaId));
  }

  get someSelected(): boolean {
    return !this.allSelected && this.invoices.some((i) => this.selected.has(i.facturaId));
  }

  toggle(invoice: Factura): void {
    const next = new Set(this.selected);
    next.has(invoice.facturaId) ? next.delete(invoice.facturaId) : next.add(invoice.facturaId);
    this.selectionChange.emit([...next]);
  }

  toggleAll(): void {
    const next = new Set(this.selected);
    const all = this.allSelected;
    this.invoices.forEach((i) => (all ? next.delete(i.facturaId) : next.add(i.facturaId)));
    this.selectionChange.emit([...next]);
  }

  ariaSort(key: InvoiceSortKey): string | null {
    if (this.sort?.key !== key) return 'none';
    return this.sort.dir === 'asc' ? 'ascending' : 'descending';
  }

  // ── Paginación ───────────────────────────────────────────────
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.itemsPerPage));
  }
  get startItem(): number {
    return this.totalItems === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
  }
  get endItem(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
  }
  get pageNumbers(): (number | null)[] {
    const total = this.totalPages, cur = this.currentPage;
    const pages = new Set([1, total, cur - 1, cur, cur + 1].filter((p) => p >= 1 && p <= total));
    const sorted = [...pages].sort((a, b) => a - b);
    const out: (number | null)[] = [];
    sorted.forEach((p, i) => { if (i && p - sorted[i - 1] > 1) out.push(null); out.push(p); });
    return out;
  }
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) this.pageChange.emit(page);
  }

  estadoTone(e?: string): string {
    return e === 'APROBADO' ? 'ok' : e === 'RECHAZADO' ? 'danger' : 'warn';
  }
  estadoLabel(e?: string): string {
    return e === 'APROBADO' ? 'Aprobada' : e === 'RECHAZADO' ? 'Rechazada' : 'Pendiente';
  }
}
