import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FacturaViewComponent } from '../factura-view/factura-view.component';
import { Factura } from '../../features/registro-factura/models/factura.model';

export interface AuditApproveEvent {
  facturaId: string;
}

export interface AuditRejectEvent {
  facturaId:     string;
  motivoRechazo: string;
}

@Component({
  selector: 'app-invoice-audit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FacturaViewComponent],
  templateUrl: './invoice-audit-modal.component.html',
  styleUrl:    './invoice-audit-modal.component.css',
})
export class InvoiceAuditModalComponent implements OnChanges {
  /** Lista completa de facturas visible en la tabla (para navegar prev/next). */
  @Input() invoices: Factura[] = [];
  /** Índice dentro de `invoices` de la factura actualmente abierta. */
  @Input() currentIndex = 0;
  /** Controla visibilidad del modal. */
  @Input() isOpen = false;

  @Output() close   = new EventEmitter<void>();
  @Output() approve = new EventEmitter<AuditApproveEvent>();
  @Output() reject  = new EventEmitter<AuditRejectEvent>();

  // ─ Estado interno ─────────────────────────────────────────────────────────
  showRejectForm  = false;
  motivoRechazo   = '';
  isSaving        = false;
  cufeCopied      = false;
  private cufeCopiedTimeout?: ReturnType<typeof setTimeout>;

  get invoice(): Factura | null {
    return this.invoices[this.currentIndex] ?? null;
  }

  get hasPrev(): boolean { return this.currentIndex > 0; }
  get hasNext(): boolean { return this.currentIndex < this.invoices.length - 1; }

  get imageUrls(): string[] {
    if (!this.invoice) return [];
    if (this.invoice.imagenes?.length) return this.invoice.imagenes.map(i => i.url);
    if (this.invoice.imageUrls?.length) return this.invoice.imageUrls;
    if (this.invoice.urlImagen)         return [this.invoice.urlImagen];
    return [];
  }

  get statusClass(): string {
    switch (this.invoice?.estado?.toUpperCase()) {
      case 'APROBADO':  return 'badge-approved';
      case 'RECHAZADO': return 'badge-rejected';
      default:          return 'badge-pending';
    }
  }

  get statusLabel(): string {
    switch (this.invoice?.estado?.toUpperCase()) {
      case 'APROBADO':  return 'Aprobado';
      case 'RECHAZADO': return 'Rechazado';
      default:          return 'Pendiente Auditoría';
    }
  }

  // ─ Lifecycle ──────────────────────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentIndex'] || changes['isOpen']) {
      this.resetRejectForm();
    }
    if (changes['isOpen'] && this.isOpen) {
      document.body.style.overflow = 'hidden';
    } else if (changes['isOpen'] && !this.isOpen) {
      document.body.style.overflow = '';
    }
  }

  // ─ Navigation ─────────────────────────────────────────────────────────────
  prev(): void {
    if (this.hasPrev) {
      this.currentIndex--;
      this.resetRejectForm();
    }
  }

  next(): void {
    if (this.hasNext) {
      this.currentIndex++;
      this.resetRejectForm();
    }
  }

  // ─ Actions ────────────────────────────────────────────────────────────────
  onApprove(): void {
    if (!this.invoice) return;
    this.isSaving = true;
    this.approve.emit({ facturaId: this.invoice.facturaId });
  }

  onRejectClick(): void {
    this.showRejectForm = true;
  }

  onRejectConfirm(): void {
    if (!this.invoice) return;
    if (!this.motivoRechazo.trim()) return;
    this.isSaving = true;
    this.reject.emit({
      facturaId:     this.invoice.facturaId,
      motivoRechazo: this.motivoRechazo.trim(),
    });
  }

  onCancelReject(): void {
    this.resetRejectForm();
  }

  onClose(): void {
    document.body.style.overflow = '';
    this.close.emit();
  }

  /** Copia el CUFE al portapapeles y muestra feedback breve ("Copiado ✓"). */
  async copyCufe(): Promise<void> {
    const cufe = this.invoice?.cufe;
    if (!cufe) return;

    try {
      await navigator.clipboard.writeText(cufe);
    } catch {
      // Fallback para navegadores/contextos sin permiso de Clipboard API.
      const textarea = document.createElement('textarea');
      textarea.value = cufe;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    this.cufeCopied = true;
    clearTimeout(this.cufeCopiedTimeout);
    this.cufeCopiedTimeout = setTimeout(() => (this.cufeCopied = false), 2000);
  }

  /** Reset saving flag after parent handles action */
  resetSaving(): void {
    this.isSaving = false;
  }

  // ─ Keyboard ───────────────────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.isOpen) return;
    if (event.key === 'Escape')     { this.onClose(); return; }
    if (event.key === 'ArrowLeft')  { this.prev();    return; }
    if (event.key === 'ArrowRight') { this.next();    return; }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!this.showRejectForm) this.onApprove();
    }
  }

  // ─ Helpers ────────────────────────────────────────────────────────────────
  private resetRejectForm(): void {
    this.showRejectForm = false;
    this.motivoRechazo  = '';
    this.isSaving       = false;
    this.cufeCopied     = false;
    clearTimeout(this.cufeCopiedTimeout);
  }
}
