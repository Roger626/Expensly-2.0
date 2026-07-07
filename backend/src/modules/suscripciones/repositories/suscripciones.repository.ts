import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';
import {
  ISuscripcionesRepository,
  EstadoSuscripcion,
  TransitionContext,
  UpsertPagoInput,
} from './interfaces/isuscripciones.repository';
import { SubscriptionIllegalTransitionException } from '../exceptions/illegal-transition.exception';

/**
 * Adjacency map for subscription state machine (design §4).
 * Self-transitions and unlisted targets are rejected.
 */
const ALLOWED_TRANSITIONS: Record<EstadoSuscripcion, EstadoSuscripcion[]> = {
  Trial: ['Activa', 'Suspendida'],
  Activa: ['PendientePago', 'Cancelada'],
  PendientePago: ['Activa', 'Suspendida', 'Cancelada'],
  Suspendida: ['Activa', 'Cancelada'],
  Cancelada: [],
};

@Injectable()
export class SuscripcionesRepository implements ISuscripcionesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Transition a subscription from its current estado to target.
   * When `tx` is provided, uses the caller's transaction client directly.
   * Otherwise, opens its own prisma.$transaction for atomicity (design §4).
   */
  async transitionTo(
    organizacionId: string,
    target: EstadoSuscripcion,
    ctx?: TransitionContext,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const run = async (client: Prisma.TransactionClient) => {
      const sub = await client.suscripciones.findUnique({
        where: { organizacion_id: organizacionId },
      });

      if (!sub) {
        throw new Error(
          `No se encontró suscripción para la organización ${organizacionId}`,
        );
      }

      const current = sub.estado as EstadoSuscripcion;
      const allowed = ALLOWED_TRANSITIONS[current] ?? [];

      if (!allowed.includes(target)) {
        throw new SubscriptionIllegalTransitionException(current, target);
      }

      const data: Record<string, unknown> = { estado: target };

      if (ctx?.currentPeriodEnd) {
        data.current_period_end = ctx.currentPeriodEnd;
      }
      if (ctx?.cardToken) {
        data.card_token = ctx.cardToken;
      }
      if (ctx?.displayNum) {
        data.display_num = ctx.displayNum;
      }

      await client.suscripciones.update({
        where: { organizacion_id: organizacionId },
        data,
      });
    };

    if (tx) {
      await run(tx);
    } else {
      await this.prisma.$transaction(async (innerTx) => run(innerTx));
    }
  }

  /**
   * Idempotent upsert for a pagos row.
   * cod_oper is @unique — on conflict the existing row is returned unchanged.
   */
  async upsertPagoByCodOper(input: UpsertPagoInput, tx?: Prisma.TransactionClient): Promise<unknown> {
    const client = tx ?? this.prisma;
    return client.pagos.upsert({
      where: { cod_oper: input.codOper },
      create: {
        suscripcion_id: input.suscripcionId,
        cod_oper: input.codOper,
        monto: input.monto,
        estado: input.estado,
        operation_type: input.operationType,
        raw_payload: input.rawPayload as object | undefined,
      },
      update: {},
    });
  }

  /**
   * Find a pago by cod_oper for idempotency pre-check.
   */
  async findPagoByCodOper(codOper: string, tx?: Prisma.TransactionClient): Promise<unknown | null> {
    const client = tx ?? this.prisma;
    return client.pagos.findUnique({
      where: { cod_oper: codOper },
    });
  }
}
