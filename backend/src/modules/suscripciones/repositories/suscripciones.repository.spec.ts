import { Test, TestingModule } from '@nestjs/testing';
import { SuscripcionesRepository } from './suscripciones.repository';
import { ISUSCRIPCIONES_REPOSITORY } from './interfaces/isuscripciones.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '../../../../generated/prisma/client';

/**
 * TDD Task 3.1 — transitionTo state machine with adjacency map guard.
 *
 * Allowed transitions (design §4):
 *   Trial         → Activa, Suspendida
 *   Activa        → PendientePago, Cancelada
 *   PendientePago → Activa, Suspendida, Cancelada
 *   Suspendida    → Activa, Cancelada
 *   Cancelada     → (none)
 *
 * TDD Task 3.2 — upsertPagoByCodOper idempotency.
 */

describe('SuscripcionesRepository — transitionTo + upsertPagoByCodOper', () => {
  let repo: SuscripcionesRepository;
  let prisma: PrismaService;

  // ── Helpers ─────────────────────────────────────────────────────────────
  const ORG_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const SUB_ID = '00000000-0000-0000-0000-000000000001';

  function createMockSubscription(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: SUB_ID,
      organizacion_id: ORG_ID,
      plan: 'pro',
      estado: 'Trial',
      card_token: null,
      display_num: null,
      current_period_end: null,
      cancelled_at: null,
      dunning_step: 0,
      last_dunning_at: null,
      last_cron_at: null,
      fecha_creacion: new Date(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    const mockPrisma = {
      suscripciones: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      pagos: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation((fnOrArray: unknown) => {
          if (typeof fnOrArray === 'function') {
            return fnOrArray(mockPrisma);
          }
          return Promise.resolve(fnOrArray);
        }),
    } as unknown as PrismaService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuscripcionesRepository,
        { provide: ISUSCRIPCIONES_REPOSITORY, useClass: SuscripcionesRepository },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<SuscripcionesRepository>(SuscripcionesRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  // ── transitionTo: Legal transitions ────────────────────────────────────────

  describe('transitionTo: legal transitions', () => {
    it('Trial → Activa (first AUTH_CAPTURE success)', async () => {
      const sub = createMockSubscription({ estado: 'Trial' });
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);
      (prisma.suscripciones.update as jest.Mock).mockResolvedValue({ ...sub, estado: 'Activa' });

      await expect(
        repo.transitionTo(ORG_ID, 'Activa', { currentPeriodEnd: new Date() }),
      ).resolves.toBeUndefined();

      expect(prisma.suscripciones.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizacion_id: ORG_ID } }),
      );
      expect(prisma.suscripciones.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizacion_id: ORG_ID },
          data: expect.objectContaining({ estado: 'Activa' }),
        }),
      );
    });

    it('Trial → Suspendida (trial expired, no card_token)', async () => {
      const sub = createMockSubscription({ estado: 'Trial' });
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);
      (prisma.suscripciones.update as jest.Mock).mockResolvedValue({ ...sub, estado: 'Suspendida' });

      await expect(repo.transitionTo(ORG_ID, 'Suspendida')).resolves.toBeUndefined();
    });

    it('Activa → PendientePago (RECURRENT fail)', async () => {
      const sub = createMockSubscription({ estado: 'Activa' });
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);
      (prisma.suscripciones.update as jest.Mock).mockResolvedValue({ ...sub, estado: 'PendientePago' });

      await expect(repo.transitionTo(ORG_ID, 'PendientePago')).resolves.toBeUndefined();
    });

    it('PendientePago → Activa (RECURRENT success)', async () => {
      const sub = createMockSubscription({ estado: 'PendientePago' });
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);
      (prisma.suscripciones.update as jest.Mock).mockResolvedValue({ ...sub, estado: 'Activa' });

      await expect(repo.transitionTo(ORG_ID, 'Activa')).resolves.toBeUndefined();
    });

    it('PendientePago → Suspendida (3rd dunning + 24h)', async () => {
      const sub = createMockSubscription({ estado: 'PendientePago' });
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);
      (prisma.suscripciones.update as jest.Mock).mockResolvedValue({ ...sub, estado: 'Suspendida' });

      await expect(repo.transitionTo(ORG_ID, 'Suspendida')).resolves.toBeUndefined();
    });

    it('Suspendida → Activa (user adds valid card)', async () => {
      const sub = createMockSubscription({ estado: 'Suspendida' });
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);
      (prisma.suscripciones.update as jest.Mock).mockResolvedValue({ ...sub, estado: 'Activa' });

      await expect(repo.transitionTo(ORG_ID, 'Activa')).resolves.toBeUndefined();
    });

    it('Activa → Cancelada (user cancels)', async () => {
      const sub = createMockSubscription({ estado: 'Activa' });
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);
      (prisma.suscripciones.update as jest.Mock).mockResolvedValue({ ...sub, estado: 'Cancelada' });

      await expect(repo.transitionTo(ORG_ID, 'Cancelada')).resolves.toBeUndefined();
    });

    it('PendientePago → Cancelada (user cancels)', async () => {
      const sub = createMockSubscription({ estado: 'PendientePago' });
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);
      (prisma.suscripciones.update as jest.Mock).mockResolvedValue({ ...sub, estado: 'Cancelada' });

      await expect(repo.transitionTo(ORG_ID, 'Cancelada')).resolves.toBeUndefined();
    });

    it('Suspendida → Cancelada (user cancels)', async () => {
      const sub = createMockSubscription({ estado: 'Suspendida' });
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);
      (prisma.suscripciones.update as jest.Mock).mockResolvedValue({ ...sub, estado: 'Cancelada' });

      await expect(repo.transitionTo(ORG_ID, 'Cancelada')).resolves.toBeUndefined();
    });

    it('sets current_period_end when ctx provided', async () => {
      const sub = createMockSubscription({ estado: 'Trial' });
      const future = new Date('2027-01-01T00:00:00Z');
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);
      (prisma.suscripciones.update as jest.Mock).mockResolvedValue({
        ...sub, estado: 'Activa', current_period_end: future,
      });

      await repo.transitionTo(ORG_ID, 'Activa', { currentPeriodEnd: future });

      expect(prisma.suscripciones.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ current_period_end: future }),
        }),
      );
    });

    it('saves card_token and display_num when ctx provided', async () => {
      const sub = createMockSubscription({ estado: 'Trial' });
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);
      (prisma.suscripciones.update as jest.Mock).mockResolvedValue({
        ...sub, estado: 'Activa', card_token: 'CT-123', display_num: '7001',
      });

      await repo.transitionTo(ORG_ID, 'Activa', {
        cardToken: 'CT-123',
        displayNum: '7001',
      });

      expect(prisma.suscripciones.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            card_token: 'CT-123',
            display_num: '7001',
          }),
        }),
      );
    });
  });

  // ── transitionTo: Illegal transitions ────────────────────────────────────

  describe('transitionTo: illegal transitions', () => {
    it('rejects Cancelada → Activa with SUBSCRIPTION_ILLEGAL_TRANSITION', async () => {
      const sub = createMockSubscription({ estado: 'Cancelada' });
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);

      await expect(repo.transitionTo(ORG_ID, 'Activa')).rejects.toThrow(
        /SUBSCRIPTION_ILLEGAL_TRANSITION/,
      );
    });

    it('rejects Cancelada → PendientePago with SUBSCRIPTION_ILLEGAL_TRANSITION', async () => {
      const sub = createMockSubscription({ estado: 'Cancelada' });
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);

      await expect(repo.transitionTo(ORG_ID, 'PendientePago')).rejects.toThrow(
        /SUBSCRIPTION_ILLEGAL_TRANSITION/,
      );
    });

    it('rejects Activa → Suspendida (not allowed directly)', async () => {
      const sub = createMockSubscription({ estado: 'Activa' });
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);

      await expect(repo.transitionTo(ORG_ID, 'Suspendida')).rejects.toThrow(
        /SUBSCRIPTION_ILLEGAL_TRANSITION/,
      );
    });

    it('rejects Suspendida → PendientePago (not allowed)', async () => {
      const sub = createMockSubscription({ estado: 'Suspendida' });
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);

      await expect(repo.transitionTo(ORG_ID, 'PendientePago')).rejects.toThrow(
        /SUBSCRIPTION_ILLEGAL_TRANSITION/,
      );
    });

    it('rejects Trial → Cancelada (not allowed without intermediate state)', async () => {
      const sub = createMockSubscription({ estado: 'Trial' });
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);

      await expect(repo.transitionTo(ORG_ID, 'Cancelada')).rejects.toThrow(
        /SUBSCRIPTION_ILLEGAL_TRANSITION/,
      );
    });

    it('rejects self-transition (Activa → Activa)', async () => {
      const sub = createMockSubscription({ estado: 'Activa' });
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);

      await expect(repo.transitionTo(ORG_ID, 'Activa')).rejects.toThrow(
        /SUBSCRIPTION_ILLEGAL_TRANSITION/,
      );
    });
  });

  // ── transitionTo: Edge cases ─────────────────────────────────────────────

  describe('transitionTo: edge cases', () => {
    it('throws if suscripcion not found for organizacionId', async () => {
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(repo.transitionTo(ORG_ID, 'Activa')).rejects.toThrow(
        /No se encontró suscripción/,
      );
    });

    it('runs inside prisma.$transaction (atomicity)', async () => {
      const sub = createMockSubscription({ estado: 'Trial' });
      (prisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(sub);
      (prisma.suscripciones.update as jest.Mock).mockResolvedValue({ ...sub, estado: 'Activa' });
      const txnSpy = prisma.$transaction as jest.Mock;

      await repo.transitionTo(ORG_ID, 'Activa');

      expect(txnSpy).toHaveBeenCalled();
    });
  });

  // ── Task 3.2: upsertPagoByCodOper ──────────────────────────────────────

  describe('upsertPagoByCodOper', () => {
    it('creates a new pago row when cod_oper does not exist', async () => {
      const newPago = {
        id: 'pago-1',
        suscripcion_id: SUB_ID,
        cod_oper: 'COD-001',
        monto: 5,
        estado: 'Aprobado',
        operation_type: 'AUTH_CAPTURE',
        raw_payload: { status: 1 },
        fecha: new Date(),
      };
      (prisma.pagos.upsert as jest.Mock).mockResolvedValue(newPago);

      const result = await repo.upsertPagoByCodOper({
        suscripcionId: SUB_ID,
        codOper: 'COD-001',
        monto: 5,
        estado: 'Aprobado',
        operationType: 'AUTH_CAPTURE',
        rawPayload: { status: 1 },
      });

      expect(result).toEqual(newPago);
      expect(prisma.pagos.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cod_oper: 'COD-001' },
          create: expect.objectContaining({
            cod_oper: 'COD-001',
            monto: 5,
            estado: 'Aprobado',
            operation_type: 'AUTH_CAPTURE',
          }),
        }),
      );
    });

    it('returns existing row without modifying when cod_oper exists (idempotency)', async () => {
      const existingPago = {
        id: 'pago-1',
        suscripcion_id: SUB_ID,
        cod_oper: 'COD-001',
        monto: 5,
        estado: 'Aprobado',
        operation_type: 'AUTH_CAPTURE',
        raw_payload: { status: 1 },
        fecha: new Date(),
      };
      // upsert should return existing on conflict (update: {} does nothing)
      (prisma.pagos.upsert as jest.Mock).mockResolvedValue(existingPago);

      const result = await repo.upsertPagoByCodOper({
        suscripcionId: SUB_ID,
        codOper: 'COD-001',
        monto: 10, // different amount — should be ignored on conflict
        estado: 'Rechazado', // different estado — should be ignored on conflict
        operationType: 'RECURRENT',
        rawPayload: { status: 0 },
      });

      // Returns existing row unchanged
      expect(result).toEqual(existingPago);
      // The upsert was called with cod_oper as the unique key
      expect(prisma.pagos.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cod_oper: 'COD-001' },
          update: {}, // no-op on conflict
        }),
      );
    });

    it('stores raw_payload as JSON', async () => {
      const rawPayload = { headerStatus: { code: 200 }, data: { status: 1 } };
      (prisma.pagos.upsert as jest.Mock).mockResolvedValue({
        id: 'pago-2',
        suscripcion_id: SUB_ID,
        cod_oper: 'COD-002',
        raw_payload: rawPayload,
      });

      await repo.upsertPagoByCodOper({
        suscripcionId: SUB_ID,
        codOper: 'COD-002',
        monto: 1,
        estado: 'Aprobado',
        operationType: 'AUTH_CAPTURE',
        rawPayload,
      });

      expect(prisma.pagos.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            raw_payload: rawPayload,
          }),
        }),
      );
    });
  });

  // ── Task 3.4 support: findPagoByCodOper ──────────────────────────────────

  describe('findPagoByCodOper', () => {
    it('returns null when no pago exists with given cod_oper', async () => {
      (prisma.pagos.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repo.findPagoByCodOper('NONEXISTENT');

      expect(result).toBeNull();
      expect(prisma.pagos.findUnique).toHaveBeenCalledWith({
        where: { cod_oper: 'NONEXISTENT' },
      });
    });

    it('returns the pago row when found', async () => {
      const pago = {
        id: 'pago-found',
        cod_oper: 'EXISTING-001',
        estado: 'Aprobado',
      };
      (prisma.pagos.findUnique as jest.Mock).mockResolvedValue(pago);

      const result = await repo.findPagoByCodOper('EXISTING-001');

      expect(result).toEqual(pago);
    });
  });

  // ── Transaction client propagation ──────────────────────────────────────

  describe('transaction client propagation', () => {
    it('transitionTo uses the provided tx client directly (no nested $transaction)', async () => {
      const sub = createMockSubscription({ estado: 'Trial' });
      const mockTx = {
        suscripciones: {
          findUnique: jest.fn().mockResolvedValue(sub),
          update: jest.fn().mockResolvedValue({ ...sub, estado: 'Activa' }),
        },
      } as unknown as Prisma.TransactionClient;

      await repo.transitionTo(ORG_ID, 'Activa', undefined, mockTx);

      // The provided tx client should be used, not prisma.$transaction
      expect(mockTx.suscripciones.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizacion_id: ORG_ID } }),
      );
      expect(mockTx.suscripciones.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizacion_id: ORG_ID },
          data: expect.objectContaining({ estado: 'Activa' }),
        }),
      );
      // prisma.$transaction should NOT have been called
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('upsertPagoByCodOper uses the provided tx client', async () => {
      const mockTx = {
        pagos: {
          upsert: jest.fn().mockResolvedValue({ id: 'pago-1' }),
        },
      } as unknown as Prisma.TransactionClient;

      await repo.upsertPagoByCodOper({
        suscripcionId: SUB_ID,
        codOper: 'COD-TX',
        monto: 5,
        estado: 'Aprobado',
        operationType: 'AUTH_CAPTURE',
      }, mockTx);

      expect(mockTx.pagos.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { cod_oper: 'COD-TX' } }),
      );
      expect(prisma.pagos.upsert).not.toHaveBeenCalled();
    });

    it('findPagoByCodOper uses the provided tx client', async () => {
      const mockTx = {
        pagos: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      } as unknown as Prisma.TransactionClient;

      await repo.findPagoByCodOper('COD-TX', mockTx);

      expect(mockTx.pagos.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { cod_oper: 'COD-TX' } }),
      );
      expect(prisma.pagos.findUnique).not.toHaveBeenCalled();
    });
  });
});
