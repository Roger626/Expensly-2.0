import { Test, TestingModule } from '@nestjs/testing';
import { ConfirmacionPagoService } from './confirmacion-pago.service';
import { ISUSCRIPCIONES_REPOSITORY } from '../repositories/interfaces/isuscripciones.repository';
import { PAGO_SERVICE } from '../../../infrastructure/pagos/pagos.tokens';
import { IPagoService, PfTransaccionResponse } from '../../../infrastructure/pagos/pagos.interface';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * TDD Task 3.4 — ConfirmacionPagoService.procesarCodOper orchestration.
 *
 * Algorithm (design §5):
 * 1. Call IPagoService.consultarTransaccion(codOper)
 * 2. Idempotency pre-check: findPagoByCodOper → skip if exists
 * 3. If status=1: upsert pago, save card_token+display_num,
 *    transition Trial|PendientePago → Activa, extend current_period_end = now+30d
 * 4. If status=0: upsert pago Rechazado, transition → PendientePago
 */

describe('ConfirmacionPagoService', () => {
  let service: ConfirmacionPagoService;
  let mockPagoService: jest.Mocked<IPagoService>;
  let mockRepo: Record<string, jest.Mock>;
  let mockPrisma: Record<string, any>;

  const ORG_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const COD_OPER = 'PF-ABC-123';

  function mockConsultaSuccess(overrides: Partial<PfTransaccionResponse> = {}): PfTransaccionResponse {
    return {
      status: 1,
      codOper: COD_OPER,
      monto: 5,
      cardToken: 'ct_test123',
      displayNum: '7001',
      raw: { headerStatus: { code: 200 }, data: { status: 1 } },
      ...overrides,
    };
  }

  function mockConsultaDeclined(overrides: Partial<PfTransaccionResponse> = {}): PfTransaccionResponse {
    return {
      status: 0,
      codOper: COD_OPER,
      monto: 5,
      cardToken: 'ct_test123',
      displayNum: '7001',
      raw: { headerStatus: { code: 200 }, data: { status: 0 } },
      ...overrides,
    };
  }

  beforeEach(async () => {
    mockPagoService = {
      consultarTransaccion: jest.fn(),
      capturarTarjetaYcobrar: jest.fn(),
      crearEnlacePago: jest.fn(),
      cobroRecurrente: jest.fn(),
      reembolsar: jest.fn(),
    };

    mockRepo = {
      transitionTo: jest.fn(),
      upsertPagoByCodOper: jest.fn(),
      findPagoByCodOper: jest.fn(),
    };

    mockPrisma = {
      $transaction: jest
        .fn()
        .mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
      suscripciones: {
        findUnique: jest.fn().mockResolvedValue({ id: 'sub-uuid-123' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmacionPagoService,
        { provide: PAGO_SERVICE, useValue: mockPagoService },
        { provide: ISUSCRIPCIONES_REPOSITORY, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ConfirmacionPagoService>(ConfirmacionPagoService);
  });

  // ── Happy path: status=1, first time ─────────────────────────────────────

  describe('status=1 (approved) — first call', () => {
    beforeEach(() => {
      mockRepo.findPagoByCodOper.mockResolvedValue(null); // no existing pago
    });

    it('calls consultarTransaccion with the codOper', async () => {
      mockPagoService.consultarTransaccion.mockResolvedValue(mockConsultaSuccess());

      await service.procesarCodOper(ORG_ID, COD_OPER, 'pro', 'AUTH_CAPTURE');

      expect(mockPagoService.consultarTransaccion).toHaveBeenCalledWith(COD_OPER);
    });

    it('checks for existing pago by codOper (idempotency pre-check)', async () => {
      mockPagoService.consultarTransaccion.mockResolvedValue(mockConsultaSuccess());

      await service.procesarCodOper(ORG_ID, COD_OPER, 'pro', 'AUTH_CAPTURE');

      expect(mockRepo.findPagoByCodOper).toHaveBeenCalledWith(COD_OPER, mockPrisma);
    });

    it('upserts the pago with estado=Aprobado, using tx.monto (PF-authoritative)', async () => {
      mockPagoService.consultarTransaccion.mockResolvedValue(mockConsultaSuccess());

      await service.procesarCodOper(ORG_ID, COD_OPER, 'pro', 'AUTH_CAPTURE');

      expect(mockRepo.upsertPagoByCodOper).toHaveBeenCalledWith(
        expect.objectContaining({
          codOper: COD_OPER,
          monto: 5, // from tx.monto, not any client param
          estado: 'Aprobado',
          operationType: 'AUTH_CAPTURE',
        }),
        mockPrisma,
      );
    });

    it('stores PF-authoritative tx.monto, ignoring any client-supplied value', async () => {
      // Simulate PF returning monto=99999 — this is the only source of truth
      mockPagoService.consultarTransaccion.mockResolvedValue(
        mockConsultaSuccess({ monto: 99999 }),
      );

      await service.procesarCodOper(ORG_ID, COD_OPER, 'pro', 'AUTH_CAPTURE');

      // Even though a client might have tried to forge a different amount,
      // the stored monto comes strictly from the PF consultarTransaccion response.
      expect(mockRepo.upsertPagoByCodOper).toHaveBeenCalledWith(
        expect.objectContaining({ monto: 99999 }),
        mockPrisma,
      );
    });

    it('transitions Trial → Activa with card data', async () => {
      mockPagoService.consultarTransaccion.mockResolvedValue(mockConsultaSuccess());

      await service.procesarCodOper(ORG_ID, COD_OPER, 'pro', 'AUTH_CAPTURE');

      expect(mockRepo.transitionTo).toHaveBeenCalledWith(
        ORG_ID,
        'Activa',
        expect.objectContaining({
          cardToken: 'ct_test123',
          displayNum: '7001',
        }),
        mockPrisma,
      );
    });

    it('extends current_period_end to now+30d', async () => {
      mockPagoService.consultarTransaccion.mockResolvedValue(mockConsultaSuccess());
      const before = Date.now();

      await service.procesarCodOper(ORG_ID, COD_OPER, 'pro', 'AUTH_CAPTURE');

      const ctx = mockRepo.transitionTo.mock.calls[0][2] as { currentPeriodEnd?: Date };
      const periodEnd = ctx.currentPeriodEnd!;
      const expectedMin = new Date(before + 29 * 24 * 60 * 60 * 1000);
      expect(periodEnd.getTime()).toBeGreaterThan(expectedMin.getTime());
    });

    it('wraps the orchestration in a prisma.$transaction', async () => {
      mockPagoService.consultarTransaccion.mockResolvedValue(mockConsultaSuccess());

      await service.procesarCodOper(ORG_ID, COD_OPER, 'pro', 'AUTH_CAPTURE');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('passes the resolved subscription UUID (not empty) to upsertPagoByCodOper', async () => {
      mockPagoService.consultarTransaccion.mockResolvedValue(mockConsultaSuccess());

      await service.procesarCodOper(ORG_ID, COD_OPER, 'pro', 'AUTH_CAPTURE');

      expect(mockPrisma.suscripciones.findUnique).toHaveBeenCalledWith({
        where: { organizacion_id: ORG_ID },
        select: { id: true },
      });
      expect(mockRepo.upsertPagoByCodOper).toHaveBeenCalledWith(
        expect.objectContaining({ suscripcionId: 'sub-uuid-123' }),
        mockPrisma,
      );
    });

    it('throws when no subscription exists for the organizacion', async () => {
      mockPagoService.consultarTransaccion.mockResolvedValue(mockConsultaSuccess());
      (mockPrisma.suscripciones.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.procesarCodOper(ORG_ID, COD_OPER, 'pro', 'AUTH_CAPTURE'),
      ).rejects.toThrow(/No se encontró suscripción/);
    });
  });

  // ── Idempotency: replay same codOper ─────────────────────────────────────

  describe('idempotency (codOper replay)', () => {
    it('does NOT call transitionTo when codOper already exists', async () => {
      mockPagoService.consultarTransaccion.mockResolvedValue(mockConsultaSuccess());
      // Pre-check finds existing pago → should skip
      mockRepo.findPagoByCodOper.mockResolvedValue({
        id: 'pago-1',
        cod_oper: COD_OPER,
        estado: 'Aprobado',
      });

      await service.procesarCodOper(ORG_ID, COD_OPER, 'pro', 'AUTH_CAPTURE');

      expect(mockRepo.transitionTo).not.toHaveBeenCalled();
      expect(mockRepo.upsertPagoByCodOper).not.toHaveBeenCalled();
    });
  });

  // ── Declined: status=0 ────────────────────────────────────────────────────

  describe('status=0 (declined)', () => {
    beforeEach(() => {
      mockRepo.findPagoByCodOper.mockResolvedValue(null);
    });

    it('upserts the pago with estado=Rechazado', async () => {
      mockPagoService.consultarTransaccion.mockResolvedValue(mockConsultaDeclined());

      await service.procesarCodOper(ORG_ID, COD_OPER, 'pro', 'AUTH_CAPTURE');

      expect(mockRepo.upsertPagoByCodOper).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: 'Rechazado',
        }),
        mockPrisma,
      );
    });

    it('transitions to PendientePago on decline', async () => {
      mockPagoService.consultarTransaccion.mockResolvedValue(mockConsultaDeclined());

      await service.procesarCodOper(ORG_ID, COD_OPER, 'pro', 'AUTH_CAPTURE');

      expect(mockRepo.transitionTo).toHaveBeenCalledWith(ORG_ID, 'PendientePago', undefined, mockPrisma);
    });

    it('does NOT save card_token or display_num on decline', async () => {
      mockPagoService.consultarTransaccion.mockResolvedValue(mockConsultaDeclined());

      await service.procesarCodOper(ORG_ID, COD_OPER, 'pro', 'AUTH_CAPTURE');

      // transitionTo called with no ctx (third arg undefined) = no card data saved
      expect(mockRepo.transitionTo).toHaveBeenCalledWith(ORG_ID, 'PendientePago', undefined, mockPrisma);
    });
  });

  // ── Error propagation ────────────────────────────────────────────────────

  describe('error propagation', () => {
    it('propagates consultarTransaccion errors', async () => {
      mockPagoService.consultarTransaccion.mockRejectedValue(new Error('PF unavailable'));

      await expect(
        service.procesarCodOper(ORG_ID, COD_OPER, 'pro', 'AUTH_CAPTURE'),
      ).rejects.toThrow('PF unavailable');
    });

    it('rolls back (no upsert, no transition) on failure', async () => {
      mockPagoService.consultarTransaccion.mockRejectedValue(new Error('Network error'));

      await expect(
        service.procesarCodOper(ORG_ID, COD_OPER, 'pro', 'AUTH_CAPTURE'),
      ).rejects.toThrow();

      expect(mockRepo.upsertPagoByCodOper).not.toHaveBeenCalled();
      expect(mockRepo.transitionTo).not.toHaveBeenCalled();
    });
  });
});
