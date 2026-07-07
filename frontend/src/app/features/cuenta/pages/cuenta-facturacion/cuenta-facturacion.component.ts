import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { AdminFacadeService } from '../../../admin/services/admin.facade.service';
import { ToastService } from '../../../../shared/toast/toast.service';
import { ModalComponent } from '../../../../shared/modal/modal.component';
import { SuscripcionDto } from '../../../admin/models/suscripcion.dto';

@Component({
  selector: 'app-cuenta-facturacion',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ModalComponent,
  ],
  templateUrl: './cuenta-facturacion.component.html',
  styleUrl: './cuenta-facturacion.component.css',
})
export class CuentaFacturacionComponent implements OnInit {
  private readonly facade = inject(AdminFacadeService);
  private readonly toast = inject(ToastService);

  protected suscripcion: SuscripcionDto | null = null;
  protected loading = true;
  protected error: string | null = null;

  protected selectedPlan: 'basic' | 'pro' | 'premium' = 'pro';
  protected planPrice = 5;
  protected showCardForm = false;
  protected showUpgradeModal = false;
  protected creatingEnlace = false;

  private readonly PLAN_PRICES: Record<string, number> = {
    basic: 1,
    pro: 5,
    premium: 10,
  };

  ngOnInit(): void {
    this.cargarSuscripcion();
  }

  private cargarSuscripcion(): void {
    this.loading = true;
    this.error = null;

    this.facade.suscripciones.obtenerActual().subscribe({
      next: (s) => {
        this.suscripcion = s;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error al cargar la suscripción';
        this.loading = false;
      },
    });
  }

  protected selectPlan(plan: 'basic' | 'pro' | 'premium'): void {
    this.selectedPlan = plan;
    this.planPrice = this.PLAN_PRICES[plan];
  }

  protected getPrice(plan: string): string {
    return '$' + (this.PLAN_PRICES[plan] ?? 0);
  }

  protected openUpgradeModal(): void {
    this.showUpgradeModal = true;
  }

  protected confirmUpgrade(): void {
    this.showUpgradeModal = false;
    this.iniciarPago();
  }

  protected cancelUpgrade(): void {
    this.showUpgradeModal = false;
  }

  /** Initiates the Enlace de Pago redirect flow. */
  protected iniciarPago(): void {
    this.creatingEnlace = true;

    this.facade.suscripciones
      .crearEnlacePago({})
      .subscribe({
        next: (result) => {
          this.creatingEnlace = false;
          window.location.href = result.checkoutUrl;
        },
        error: (err) => {
          this.creatingEnlace = false;
          this.toast.error(
            err?.error?.message || 'Error al crear el enlace de pago',
          );
        },
      });
  }

  protected get estadoClass(): string {
    const map: Record<string, string> = {
      Trial: 'badge-info',
      Activa: 'badge-success',
      PendientePago: 'badge-warning',
      Suspendida: 'badge-danger',
      Cancelada: 'badge-secondary',
    };
    return map[this.suscripcion?.estado || ''] || 'badge-secondary';
  }

  protected get planName(): string {
    const map: Record<string, string> = {
      basic: 'Basic',
      pro: 'Pro',
      premium: 'Premium',
    };
    return map[this.suscripcion?.plan || ''] || this.suscripcion?.plan || '—';
  }
}
