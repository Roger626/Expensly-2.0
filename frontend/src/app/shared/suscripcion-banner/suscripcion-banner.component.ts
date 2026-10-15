import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AdminFacadeService } from '../../features/admin/services/admin.facade.service';
import { SuscripcionDto } from '../../features/admin/models/suscripcion.dto';
import { AuthService } from '../../features/auth/services/auth.service';
import { Role } from '../../core/models/roles.enum';
import { IconComponent } from '../icon/icon.component';
import { longDate } from '../format/format';

/** Aviso del estado de la suscripción (prueba, pago pendiente o suspendida). */
@Component({
  selector: 'app-suscripcion-banner',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './suscripcion-banner.component.html',
  styleUrl: './suscripcion-banner.component.css',
})
export class SuscripcionBannerComponent implements OnInit {
  private readonly facade = inject(AdminFacadeService);
  private readonly auth = inject(AuthService);

  readonly s = signal<SuscripcionDto | null>(null);
  readonly canManage = computed(() => this.auth.userRole() === Role.SUPERADMIN);
  readonly longDate = longDate;

  readonly diasRestantes = computed(() => {
    const fin = this.s()?.trial_termina_en;
    return fin ? Math.max(0, Math.ceil((new Date(fin).getTime() - Date.now()) / 86_400_000)) : null;
  });

  readonly visible = computed(() => ['Trial', 'Suspendida', 'PendientePago'].includes(this.s()?.estado ?? ''));

  ngOnInit(): void {
    this.facade.suscripciones.obtenerActual().subscribe({
      next: (s) => this.s.set(s),
      error: () => this.s.set(null),
    });
  }
}
