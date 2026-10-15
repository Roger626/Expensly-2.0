import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminFacadeService } from '../../../admin/services/admin.facade.service';
import { PagoDto } from '../../../admin/models/suscripcion.dto';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { longDate, money } from '../../../../shared/format/format';

/** Cobros de la suscripción. Se usa solo (ruta /historial) o embebido en Facturación. */
@Component({
  selector: 'app-historial-pagos',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './historial-pagos.component.html',
  styleUrl: './historial-pagos.component.css',
})
export class HistorialPagosComponent implements OnInit {
  private readonly facade = inject(AdminFacadeService);
  @Input() embedded = false;

  readonly money = money;
  readonly longDate = longDate;
  readonly pagos = signal<PagoDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = 10;

  ngOnInit(): void {
    this.cargar(1);
  }

  cargar(page: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.facade.suscripciones.obtenerHistorial(page, this.limit).subscribe({
      next: (res) => {
        this.pagos.set(res.items);
        this.total.set(res.total);
        this.page.set(res.page);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo cargar el historial de pagos.');
        this.loading.set(false);
      },
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.limit));
  }

  tone(estado: string): string {
    const e = (estado ?? '').toLowerCase();
    return e.startsWith('aprob') || e === 'completado' || e === 'exitoso' ? 'ok' : e.startsWith('deneg') || e.startsWith('rechaz') || e === 'fallido' ? 'danger' : 'warn';
  }
}
