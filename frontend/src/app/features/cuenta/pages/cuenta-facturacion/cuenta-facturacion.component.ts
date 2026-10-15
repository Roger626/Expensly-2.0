import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { AdminFacadeService } from '../../../admin/services/admin.facade.service';
import { ToastService } from '../../../../shared/toast/toast.service';
import { ModalComponent } from '../../../../shared/modal/modal.component';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { SuscripcionDto } from '../../../admin/models/suscripcion.dto';
import { ESTADO_SUSCRIPCION, PLANES, planDe } from '../../../admin/models/planes';
import { HistorialPagosComponent } from '../historial-pagos/historial-pagos.component';
import { longDate, money } from '../../../../shared/format/format';

@Component({
  selector: 'app-cuenta-facturacion',
  standalone: true,
  imports: [ModalComponent, IconComponent, HistorialPagosComponent],
  templateUrl: './cuenta-facturacion.component.html',
  styleUrl: './cuenta-facturacion.component.css',
})
export class CuentaFacturacionComponent implements OnInit {
  private readonly facade = inject(AdminFacadeService);
  private readonly toast = inject(ToastService);

  readonly planes = PLANES;
  readonly money = money;
  readonly longDate = longDate;

  readonly suscripcion = signal<SuscripcionDto | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly confirmando = signal(false);
  readonly creandoEnlace = signal(false);

  readonly plan = computed(() => planDe(this.suscripcion()?.plan));
  readonly estado = computed(() => ESTADO_SUSCRIPCION[this.suscripcion()?.estado ?? ''] ?? { label: this.suscripcion()?.estado ?? '—', tone: 'plain' });
  /** Se puede pagar si aún no hay un periodo activo con tarjeta. */
  readonly puedePagar = computed(() => {
    const s = this.suscripcion();
    return !!s && s.estado !== 'Cancelada' && !(s.estado === 'Activa' && s.card_token);
  });
  readonly mailCambio = computed(() =>
    `mailto:hola@expensly.com?subject=${encodeURIComponent('Cambio de plan')}&body=${encodeURIComponent(`Hola, quiero cambiar el plan ${this.plan().nombre} de mi organización por: `)}`);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.facade.suscripciones.obtenerActual().subscribe({
      next: (s) => { this.suscripcion.set(s); this.loading.set(false); },
      error: (err) => { this.error.set(err?.error?.message || 'No se pudo cargar tu suscripción.'); this.loading.set(false); },
    });
  }

  /** Redirige al checkout seguro de PagueloFácil por el plan actual (el precio lo decide el servidor). */
  pagar(): void {
    this.creandoEnlace.set(true);
    this.facade.suscripciones.crearEnlacePago({}).subscribe({
      next: (r) => { window.location.href = r.checkoutUrl; },
      error: (err) => {
        this.creandoEnlace.set(false);
        this.confirmando.set(false);
        this.toast.error('No se pudo abrir el pago', err?.error?.message || 'Inténtalo de nuevo en unos minutos.');
      },
    });
  }
}
