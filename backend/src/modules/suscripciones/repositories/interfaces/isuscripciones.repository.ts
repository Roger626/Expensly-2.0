/**
 * Token for the suscripciones repository.
 */
export const ISUSCRIPCIONES_REPOSITORY = 'ISUSCRIPCIONES_REPOSITORY';

/** Valid subscription states (design §4). */
export type EstadoSuscripcion =
  | 'Trial'
  | 'Activa'
  | 'PendientePago'
  | 'Suspendida'
  | 'Cancelada';

/** Optional context for a transition (card data, period extension). */
export interface TransitionContext {
  currentPeriodEnd?: Date;
  cardToken?: string;
  displayNum?: string;
}

/** Input for upserting a pago row by codOper. */
export interface UpsertPagoInput {
  suscripcionId: string;
  codOper: string;
  monto: number;
  estado: string;
  operationType: string;
  rawPayload?: unknown;
}

import { Prisma } from '../../../../../generated/prisma/client';

/**
 * Repository interface for suscripciones data access.
 * All methods are tenant-scoped via organizacionId.
 */
export interface ISuscripcionesRepository {
  /**
   * Transition a subscription from its current estado to the target estado.
   * Throws SubscriptionIllegalTransitionException if the transition is not
   * allowed by the adjacency map (design §4).
   *
   * When called without `tx`, wraps the operation in prisma.$transaction for atomicity.
   * When `tx` is provided, reuses the caller's transaction client (no nested tx).
   */
  transitionTo(
    organizacionId: string,
    target: EstadoSuscripcion,
    ctx?: TransitionContext,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;

  /**
   * Idempotently upsert a pagos row by cod_oper (@unique).
   * On conflict (codOper already exists), returns the existing row without modifying.
   */
  upsertPagoByCodOper(input: UpsertPagoInput, tx?: Prisma.TransactionClient): Promise<unknown>;

  /**
   * Find a pago by its cod_oper for idempotency pre-check.
   * Returns null if no pago exists with this cod_oper.
   */
  findPagoByCodOper(codOper: string, tx?: Prisma.TransactionClient): Promise<unknown | null>;
}
