import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { longDate, money } from '../../../../shared/format/format';
import { FormsModule } from '@angular/forms';
import { FacturaViewComponent } from '../../../../shared/factura-view/factura-view.component';
import { Factura } from '../../models/factura.model';
import { CategoriaDto } from '../../models/categoria.model';
import { MisFacturasService } from '../../services/mis-facturas.service';

export interface EmpleadoFacturaUpdated {
  facturaId: string;
}

export interface EmpleadoFacturaDeleted {
  facturaId: string;
}

/** Formulario editable para facturas PENDIENTE. */
interface EditForm {
  nombreProveedor: string;
  rucProveedor:    string;
  dvProveedor:     string;
  numeroFactura:   string;
  cufe:            string;
  fechaEmision:    string;
  categoriaId:     string;
  monto:           number | null;
  subtotal:        number | null;
  itbms:           number | null;
}

@Component({
  selector: 'app-factura-empleado-modal',
  standalone: true,
  imports: [FormsModule, FacturaViewComponent, IconComponent],
  templateUrl: './factura-empleado-modal.component.html',
  styleUrl: './factura-empleado-modal.component.css',
})
export class FacturaEmpleadoModalComponent implements OnChanges {
  @Input() invoices: Factura[] = [];
  @Input() currentIndex = 0;
  @Input() isOpen = false;
  @Input() categorias: CategoriaDto[] = [];

  @Output() close   = new EventEmitter<void>();
  @Output() updated = new EventEmitter<EmpleadoFacturaUpdated>();
  @Output() deleted = new EventEmitter<EmpleadoFacturaDeleted>();

  // ── State ─────────────────────────────────────────────────────────────────
  editMode          = false;
  showDeleteConfirm = false;
  isSaving          = false;
  isDeleting        = false;
  errorMsg: string | null = null;

  /**
   * Internal navigation index — NEVER mutate @Input() currentIndex.
   * Synced from currentIndex each time the modal opens (isOpen → true).
   */
  private _activeIndex = 0;

  editForm: EditForm = this.emptyForm();

  constructor(private readonly svc: MisFacturasService) {}

  // ── Getters ───────────────────────────────────────────────────────────────

  get invoice(): Factura | null {
    return this.invoices[this._activeIndex] ?? null;
  }

  get hasPrev(): boolean { return this._activeIndex > 0; }
  get hasNext(): boolean { return this._activeIndex < this.invoices.length - 1; }

  /** Exposed to the template so the counter stays in sync with in-modal navigation. */
  get activeIndex(): number { return this._activeIndex; }

  get isPending(): boolean {
    return !this.invoice?.estado || this.invoice.estado === 'PENDIENTE';
  }

  get imageUrls(): string[] {
    if (!this.invoice) return [];
    if (this.invoice.imagenes?.length) return this.invoice.imagenes.map(i => i.url);
    if (this.invoice.imageUrls?.length) return this.invoice.imageUrls;
    if (this.invoice.urlImagen) return [this.invoice.urlImagen];
    return [];
  }

  readonly money = money;
  readonly longDate = longDate;

  get statusTone(): string {
    return this.invoice?.estado === 'APROBADO' ? 'ok' : this.invoice?.estado === 'RECHAZADO' ? 'danger' : 'warn';
  }

  get statusLabel(): string {
    switch (this.invoice?.estado) {
      case 'APROBADO':  return 'Aprobada';
      case 'RECHAZADO': return 'Rechazada';
      default:          return 'En revisión';
    }
  }

  get categoriaNombre(): string {
    const cat = this.categorias.find(c => c.id === this.invoice?.categoria);
    return cat?.nombre ?? this.invoice?.categoria ?? '—';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      // Always re-sync internal index from the parent @Input when (re)opening.
      // This is critical: the parent's modalIndex may not have changed between
      // two opens (Angular won't rebind the @Input), yet our internal
      // _activeIndex could be stale from in-modal prev/next navigation.
      this._activeIndex = this.currentIndex;
      this.resetState();
    }
    if (changes['isOpen']) {
      document.body.style.overflow = this.isOpen ? 'hidden' : '';
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  prev(): void {
    if (this.hasPrev) { this._activeIndex--; this.resetState(); }
  }

  next(): void {
    if (this.hasNext) { this._activeIndex++; this.resetState(); }
  }

  // ── Edit actions ──────────────────────────────────────────────────────────

  onEdit(): void {
    if (!this.invoice) return;
    this.editForm = {
      nombreProveedor: this.invoice.nombreProveedor ?? '',
      rucProveedor:    this.invoice.rucProveedor ?? '',
      dvProveedor:     this.invoice.dv ?? '',
      numeroFactura:   this.invoice.numeroFactura ?? '',
      cufe:            this.invoice.cufe ?? '',
      fechaEmision:    this.invoice.fechaEmision?.substring(0, 10) ?? '',
      categoriaId:     this.categorias.find(c => c.nombre === this.invoice?.categoria)?.id ?? '',
      monto:           this.invoice.montoTotal,
      subtotal:        this.invoice.subtotal ?? null,
      itbms:           this.invoice.itbms ?? null,
    };
    this.editMode = true;
    this.errorMsg = null;
  }

  onCancelEdit(): void {
    this.editMode = false;
    this.errorMsg = null;
  }

  onSave(): void {
    if (!this.invoice || this.isSaving) return;

    const dto: Record<string, any> = {
      nombreProveedor: this.editForm.nombreProveedor,
      rucProveedor:    this.editForm.rucProveedor,
      dvProveedor:     this.editForm.dvProveedor || undefined,
      numeroFactura:   this.editForm.numeroFactura,
      cufe:            this.editForm.cufe || undefined,
      fechaEmision:    this.editForm.fechaEmision,
      categoriaId:     this.editForm.categoriaId || undefined,
      monto:           this.editForm.monto ?? undefined,
      subtotal:        this.editForm.subtotal ?? undefined,
      impuesto:        this.editForm.itbms ?? undefined,
      // keep existing images
      imagenesFactura: this.invoice.imagenes?.map(i => ({ url: i.url, publicId: i.publicId })) ?? [],
    };

    this.isSaving = true;
    this.errorMsg = null;

    this.svc.updateFactura(this.invoice.facturaId, dto).subscribe({
      next: (updated) => {
        this.svc.replaceFactura(updated);
        this.isSaving = false;
        this.editMode = false;
        this.updated.emit({ facturaId: this.invoice!.facturaId });
      },
      error: (err) => {
        this.isSaving = false;
        const msg = err?.error?.message;
        this.errorMsg = Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Error al guardar los cambios.');
      },
    });
  }

  // ── Delete actions ────────────────────────────────────────────────────────

  onDeleteClick(): void {
    this.showDeleteConfirm = true;
  }

  onDeleteCancel(): void {
    this.showDeleteConfirm = false;
  }

  onDeleteConfirm(): void {
    if (!this.invoice || this.isDeleting) return;

    this.isDeleting = true;
    this.errorMsg   = null;

    this.svc.deleteFactura(this.invoice.facturaId).subscribe({
      next: () => {
        this.svc.removeFactura(this.invoice!.facturaId);
        this.isDeleting        = false;
        this.showDeleteConfirm = false;
        this.deleted.emit({ facturaId: this.invoice!.facturaId });
        this.onClose();
      },
      error: (err) => {
        this.isDeleting = false;
        const msg = err?.error?.message;
        this.errorMsg = Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Error al eliminar la factura.');
      },
    });
  }

  // ── Close ─────────────────────────────────────────────────────────────────

  onClose(): void {
    document.body.style.overflow = '';
    this.close.emit();
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.isOpen) return;
    if (event.key === 'Escape') {
      if (this.editMode) { this.onCancelEdit(); return; }
      if (this.showDeleteConfirm) { this.onDeleteCancel(); return; }
      this.onClose();
    }
    if (!this.editMode && !this.showDeleteConfirm) {
      if (event.key === 'ArrowLeft')  this.prev();
      if (event.key === 'ArrowRight') this.next();
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private resetState(): void {
    this.editMode          = false;
    this.showDeleteConfirm = false;
    this.isSaving          = false;
    this.isDeleting        = false;
    this.errorMsg          = null;
  }

  private emptyForm(): EditForm {
    return {
      nombreProveedor: '', rucProveedor: '', dvProveedor: '',
      numeroFactura: '', cufe: '', fechaEmision: '',
      categoriaId: '', monto: null, subtotal: null, itbms: null,
    };
  }
}
