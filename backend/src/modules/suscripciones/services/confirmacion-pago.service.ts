import { Inject, Injectable } from '@nestjs/common';
import { PAGO_SERVICE } from '../../../infrastructure/pagos/pagos.tokens';
import { IPagoService } from '../../../infrastructure/pagos/pagos.interface';
import {
  ISUSCRIPCIONES_REPOSITORY,
  ISuscripcionesRepository,
} from '../repositories/interfaces/isuscripciones.repository';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Orchestrates server-side polling confirmation for Paguelo Fácil transactions.
 * Replaces a webhook endpoint — design decision: polling only (design §5).
 */
@Injectable()
export class ConfirmacionPagoService {
  constructor(
    @Inject(PAGO_SERVICE) private readonly pagoService: IPagoService,
    @Inject(ISUSCRIPCIONES_REPOSITORY)
    private readonly suscripcionesRepo: ISuscripcionesRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Poll PF for the transaction status and update local state accordingly.
   *
   * @param organizacionId — tenant-scoped, from JWT
   * @param codOper — PF operation code (idempotency key)
   * @param _plan — plan name (unused here, passed by controller)
   * @param operationType — AUTH_CAPTURE or RECURRENT
   */
  async procesarCodOper(
    organizacionId: string,
    codOper: string,
    _plan: string,
    operationType: 'AUTH_CAPTURE' | 'RECURRENT',
  ): Promise<void> {
    // 1. Consult PF for the transaction status (outside tx — network call)
    const pfTx = await this.pagoService.consultarTransaccion(codOper);

    // 2. Run the state mutation inside a transaction for atomicity
    await this.prisma.$transaction(async (tx) => {
      // Idempotency pre-check: if this codOper was already processed, skip
      const existingPago = await this.suscripcionesRepo.findPagoByCodOper(codOper, tx);
      if (existingPago) {
        return; // Already processed — no duplicate, no re-extension
      }

      // Resolve the subscription UUID for the pagos.suscripcion_id FK.
      const sub = await tx.suscripciones.findUnique({
        where: { organizacion_id: organizacionId },
        select: { id: true },
      });
      if (!sub) {
        throw new Error(`No se encontró suscripción para la organización ${organizacionId}`);
      }

      if (pfTx.status === 1) {
        // Approved — upsert pago, save card, transition, extend period
        await this.suscripcionesRepo.upsertPagoByCodOper({
          suscripcionId: sub.id,
          codOper,
          monto: pfTx.monto, // PF-authoritative — never client-supplied
          estado: 'Aprobado',
          operationType,
          rawPayload: pfTx.raw,
        }, tx);

        const now = new Date();
        const nextPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        await this.suscripcionesRepo.transitionTo(organizacionId, 'Activa', {
          cardToken: pfTx.cardToken,
          displayNum: pfTx.displayNum,
          currentPeriodEnd: nextPeriodEnd,
        }, tx);
      } else {
        // Declined — upsert pago as Rechazado, transition to PendientePago
        await this.suscripcionesRepo.upsertPagoByCodOper({
          suscripcionId: sub.id,
          codOper,
          monto: pfTx.monto, // PF-authoritative — never client-supplied
          estado: 'Rechazado',
          operationType,
          rawPayload: pfTx.raw,
        }, tx);

        // TODO: dunning in slice 5
        await this.suscripcionesRepo.transitionTo(organizacionId, 'PendientePago', undefined, tx);
      }
    });
  }
}
