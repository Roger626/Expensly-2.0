import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { AdminFacadeService } from '../../features/admin/services/admin.facade.service';
import { SuscripcionDto } from '../../features/admin/models/suscripcion.dto';

@Component({
  selector: 'app-suscripcion-banner',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './suscripcion-banner.component.html',
  styleUrl: './suscripcion-banner.component.css',
})
export class SuscripcionBannerComponent implements OnInit {
  private readonly facade = inject(AdminFacadeService);

  protected suscripcion: SuscripcionDto | null = null;
  protected visible = false;

  ngOnInit(): void {
    this.facade.suscripciones.obtenerActual().subscribe({
      next: (s: SuscripcionDto) => {
        this.suscripcion = s;
        this.visible =
          s.estado === 'Trial' ||
          s.estado === 'Suspendida' ||
          s.estado === 'PendientePago';
      },
      error: () => {
        this.visible = false;
      },
    });
  }
}
