import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AdminFacadeService } from '../../../admin/services/admin.facade.service';
import { PagoDto, PaginatedDto } from '../../../admin/models/suscripcion.dto';

@Component({
  selector: 'app-historial-pagos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './historial-pagos.component.html',
  styleUrl: './historial-pagos.component.css',
})
export class HistorialPagosComponent implements OnInit {
  private readonly facade = inject(AdminFacadeService);

  protected pagos: PagoDto[] = [];
  protected loading = true;
  protected error: string | null = null;
  protected total = 0;
  protected currentPage = 1;
  protected limit = 20;

  ngOnInit(): void {
    this.cargarHistorial();
  }

  private cargarHistorial(page: number = 1): void {
    this.loading = true;
    this.error = null;

    this.facade.suscripciones.obtenerHistorial(page, this.limit).subscribe({
      next: (res: PaginatedDto<PagoDto>) => {
        this.pagos = res.items;
        this.total = res.total;
        this.currentPage = res.page;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al cargar el historial';
        this.loading = false;
      },
    });
  }

  protected cambiarPagina(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.cargarHistorial(page);
  }

  protected get totalPages(): number {
    return Math.ceil(this.total / this.limit);
  }
}
