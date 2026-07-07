import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminFacadeService } from '../../../admin/services/admin.facade.service';
import { ToastService } from '../../../../shared/toast/toast.service';

/**
 * Callback page after PF Enlace de Pago redirect.
 * Reads query params ?Oper, ?Estado, ?PARM_1 from Paguelo Fácil return URL,
 * then calls POST /suscripciones/cobrar to confirm server-side.
 */
@Component({
  selector: 'app-checkout-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checkout-callback.component.html',
  styleUrl: './checkout-callback.component.css',
})
export class CheckoutCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly facade = inject(AdminFacadeService);
  private readonly toast = inject(ToastService);

  protected loading = true;
  protected error: string | null = null;
  protected denegada = false;
  protected pendiente = false;
  protected razon: string | null = null;

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;

    const oper = query.get('Oper');
    const estado = query.get('Estado');
    const parm1 = query.get('PARM_1');
    const razon = query.get('Razon');

    // No Oper — cannot proceed
    if (!oper) {
      this.loading = false;
      this.denegada = true;
      this.razon = 'No se recibió el código de operación.';
      return;
    }

    // PF returns three Estado values: Aprobada, Denegada/Denegado, Pendiente (CASH).
    // Only explicit positive match on "Aprobada" triggers /cobrar.
    if (estado === 'Aprobada') {
      const plan =
        parm1 === 'basic' || parm1 === 'pro' || parm1 === 'premium'
          ? parm1
          : 'pro';

      this.facade.suscripciones.confirmarCobro({ plan, codOper: oper }).subscribe({
        next: () => {
          this.loading = false;
          this.toast.success(`Plan ${this.planLabel(plan)} activo`);
          this.router.navigate(['/cuenta/facturacion']);
        },
        error: (err) => {
          this.loading = false;
          this.error =
            err?.error?.message || 'Error al confirmar la transacción';
        },
      });
      return;
    }

    // Pendiente — CASH payments, don't call /cobrar
    if (estado === 'Pendiente') {
      this.loading = false;
      this.pendiente = true;
      return;
    }

    // Denegada, Denegado, or any unknown value — denial
    this.loading = false;
    this.denegada = true;
    this.razon = razon || 'Pago denegado por el banco emisor.';
  }

  protected volver(): void {
    this.router.navigate(['/cuenta/facturacion']);
  }

  private planLabel(plan: string): string {
    const map: Record<string, string> = {
      basic: 'Basic',
      pro: 'Pro',
      premium: 'Premium',
    };
    return map[plan] || plan;
  }
}
