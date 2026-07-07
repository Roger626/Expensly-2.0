import { Test, TestingModule } from '@nestjs/testing';
import { SuscripcionesController } from './suscripciones.controller';
import { SuscripcionesService } from '../services/suscripciones.service';
import { ConfirmacionPagoService } from '../services/confirmacion-pago.service';
import { ISUSCRIPCIONES_REPOSITORY } from '../repositories/interfaces/isuscripciones.repository';
import { PAGO_SERVICE } from '../../../infrastructure/pagos/pagos.tokens';
import { IPagoService } from '../../../infrastructure/pagos/pagos.interface';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';

/**
 * TDD Tasks 3.5 + 3.6 + 4.2 + slice-4-refactor — controller routes + guards + tenant scoping + config + enlace-pago.
 *
 * POST /suscripciones/cobrar            — JwtAuthGuard + RolesGuard(SUPERADMIN)
 * POST /suscripciones/crear-enlace-pago  — JwtAuthGuard + RolesGuard(SUPERADMIN)
 * GET  /suscripciones/actual             — JwtAuthGuard + RolesGuard(SUPERADMIN)
 * GET  /suscripciones/historial          — JwtAuthGuard + RolesGuard(SUPERADMIN)
 * GET  /suscripciones/config             — JwtAuthGuard + RolesGuard(SUPERADMIN)
 */

describe('SuscripcionesController', () => {
  let controller: SuscripcionesController;
  let mockConfirmacionPago: jest.Mocked<Pick<ConfirmacionPagoService, 'procesarCodOper'>>;
  let mockSuscripcionesService: jest.Mocked<Pick<SuscripcionesService, 'obtenerActual' | 'obtenerHistorial'>>;
  let mockPagoService: jest.Mocked<Pick<IPagoService, 'crearEnlacePago'>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockConfigService: any;

  const ORG_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const OTHER_ORG_ID = 'a13bc20d-67dd-3382-b678-1f23c3d4e580';

  function mockUser(overrides: Partial<CurrentUserPayload> = {}): CurrentUserPayload {
    return {
      userId: 'user-1',
      email: 'admin@test.com',
      role: 'SUPERADMIN',
      organizationId: ORG_ID,
      ...overrides,
    };
  }

  beforeEach(async () => {
    mockConfirmacionPago = {
      procesarCodOper: jest.fn().mockResolvedValue(undefined),
    };

    mockSuscripcionesService = {
      obtenerActual: jest.fn().mockResolvedValue({
        plan: 'pro',
        estado: 'Trial',
        current_period_end: null,
        trial_termina_en: new Date('2027-01-01'),
      }),
      obtenerHistorial: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      }),
    };

    mockPagoService = {
      crearEnlacePago: jest.fn().mockResolvedValue({
        checkoutUrl: 'https://checkout.paguelofacil.com?code=LK-ABC',
        code: 'LK-ABC',
      }),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'PAGUELO_ACCESS_TOKEN') return 'test-api-key';
        if (key === 'PAGUELO_CCLW') return 'test-cclw';
        if (key === 'PAGUELO_ENV') return 'sandbox';
        if (key === 'FRONTEND_URL') return 'http://localhost:4200';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuscripcionesController],
      providers: [
        { provide: ConfirmacionPagoService, useValue: mockConfirmacionPago },
        { provide: SuscripcionesService, useValue: mockSuscripcionesService },
        { provide: PAGO_SERVICE, useValue: mockPagoService },
        { provide: ConfigService, useValue: mockConfigService },
        // Guards need Reflector
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (_ctx: ExecutionContext) => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: (_ctx: ExecutionContext) => true })
      .compile();

    controller = module.get<SuscripcionesController>(SuscripcionesController);
  });

  // ── POST /suscripciones/cobrar ────────────────────────────────────────────

  describe('POST /suscripciones/cobrar', () => {
    it('delegates to ConfirmacionPagoService.procesarCodOper with tenant-scoped organizacionId', async () => {
      const user = mockUser();
      const dto = { plan: 'pro' as const, codOper: 'PF-ABC' };

      await controller.cobrar(user, dto);

      expect(mockConfirmacionPago.procesarCodOper).toHaveBeenCalledWith(
        ORG_ID,
        'PF-ABC',
        'pro',
        'AUTH_CAPTURE',
      );
    });

    it('uses organizacionId from JWT (never from body)', async () => {
      const user = mockUser({ organizationId: OTHER_ORG_ID });
      const dto = { plan: 'pro' as const, codOper: 'PF-XYZ' };

      await controller.cobrar(user, dto);

      expect(mockConfirmacionPago.procesarCodOper).toHaveBeenCalledWith(
        OTHER_ORG_ID,
        'PF-XYZ',
        'pro',
        'AUTH_CAPTURE',
      );
    });

    it('returns { success: true } on completion', async () => {
      const user = mockUser();
      const dto = { plan: 'pro' as const, codOper: 'PF-OK' };

      const result = await controller.cobrar(user, dto);

      expect(result).toEqual({ success: true });
    });

    it('propagates errors from the service', async () => {
      mockConfirmacionPago.procesarCodOper.mockRejectedValue(new Error('PF error'));
      const user = mockUser();
      const dto = { plan: 'pro' as const, codOper: 'PF-FAIL' };

      await expect(controller.cobrar(user, dto)).rejects.toThrow('PF error');
    });
  });

  // ── GET /suscripciones/actual ────────────────────────────────────────────

  describe('GET /suscripciones/actual', () => {
    it('returns the current subscription for the authenticated org', async () => {
      const user = mockUser();

      const result = await controller.obtenerActual(user);

      expect(mockSuscripcionesService.obtenerActual).toHaveBeenCalledWith(ORG_ID);
      expect(result.plan).toBe('pro');
      expect(result.estado).toBe('Trial');
    });

    it('uses organizacionId from JWT only (tenant isolation)', async () => {
      const user = mockUser({ organizationId: OTHER_ORG_ID });

      await controller.obtenerActual(user);

      expect(mockSuscripcionesService.obtenerActual).toHaveBeenCalledWith(OTHER_ORG_ID);
    });
  });

  // ── GET /suscripciones/historial ────────────────────────────────────────

  describe('GET /suscripciones/historial', () => {
    it('returns paginated pago history for the org', async () => {
      const user = mockUser();

      const result = await controller.obtenerHistorial(user, '1', '10');

      expect(mockSuscripcionesService.obtenerHistorial).toHaveBeenCalledWith(ORG_ID, 1, 10);
      expect(result.total).toBe(0);
    });

    it('defaults page to 1 and limit to 10', async () => {
      const user = mockUser();

      await controller.obtenerHistorial(user);

      expect(mockSuscripcionesService.obtenerHistorial).toHaveBeenCalledWith(ORG_ID, 1, 10);
    });

    it('accepts custom page and limit', async () => {
      const user = mockUser();

      await controller.obtenerHistorial(user, '3', '25');

      expect(mockSuscripcionesService.obtenerHistorial).toHaveBeenCalledWith(ORG_ID, 3, 25);
    });
  });

  // ── POST /suscripciones/crear-enlace-pago (slice-4 refactor + Fix 2/5) ──

  describe('POST /suscripciones/crear-enlace-pago', () => {
    it('delegates to pagoService.crearEnlacePago with monto derived from org plan (pro=$5)', async () => {
      const user = mockUser();

      await controller.crearEnlacePago(user);

      expect(mockPagoService.crearEnlacePago).toHaveBeenCalledWith({
        monto: 5, // pro = $5 — from org's actual plan
        descripcion: 'Plan Pro - Expensly',
        returnUrl: 'http://localhost:4200/cuenta/facturacion/checkout',
        parm1: 'pro',
      });
    });

    it('returns { checkoutUrl, code } on success', async () => {
      const user = mockUser();

      const result = await controller.crearEnlacePago(user);

      expect(result).toEqual({
        checkoutUrl: 'https://checkout.paguelofacil.com?code=LK-ABC',
        code: 'LK-ABC',
      });
    });

    it('resolves monto=$1 when org is on basic plan', async () => {
      mockSuscripcionesService.obtenerActual.mockResolvedValueOnce({
        plan: 'basic',
        estado: 'Activa',
        current_period_end: null,
        trial_termina_en: null,
      });
      const user = mockUser();

      await controller.crearEnlacePago(user);

      expect(mockPagoService.crearEnlacePago).toHaveBeenCalledWith(
        expect.objectContaining({ monto: 1, descripcion: 'Plan Basic - Expensly' }),
      );
    });

    it('resolves monto=$10 when org is on premium plan', async () => {
      mockSuscripcionesService.obtenerActual.mockResolvedValueOnce({
        plan: 'premium',
        estado: 'Activa',
        current_period_end: null,
        trial_termina_en: null,
      });
      const user = mockUser();

      await controller.crearEnlacePago(user);

      expect(mockPagoService.crearEnlacePago).toHaveBeenCalledWith(
        expect.objectContaining({ monto: 10, descripcion: 'Plan Premium - Expensly' }),
      );
    });

    it('defaults to pro plan when org has no subscription yet', async () => {
      mockSuscripcionesService.obtenerActual.mockResolvedValueOnce({
        plan: null,
        estado: null,
        current_period_end: null,
        trial_termina_en: null,
      });
      const user = mockUser();

      await controller.crearEnlacePago(user);

      expect(mockPagoService.crearEnlacePago).toHaveBeenCalledWith(
        expect.objectContaining({ monto: 5, descripcion: 'Plan Pro - Expensly', parm1: 'pro' }),
      );
    });

    it('always sets parm1 = plan (server-authoritative)', async () => {
      const user = mockUser();

      await controller.crearEnlacePago(user);

      expect(mockPagoService.crearEnlacePago).toHaveBeenCalledWith(
        expect.objectContaining({ parm1: 'pro' }),
      );
    });

    it('derives returnUrl from FRONTEND_URL env var (never from client)', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'FRONTEND_URL') return 'https://app.example.com';
        if (key === 'PAGUELO_ACCESS_TOKEN') return 'test-api-key';
        if (key === 'PAGUELO_CCLW') return 'test-cclw';
        if (key === 'PAGUELO_ENV') return 'sandbox';
        return undefined;
      });
      const user = mockUser();

      await controller.crearEnlacePago(user);

      expect(mockPagoService.crearEnlacePago).toHaveBeenCalledWith(
        expect.objectContaining({ returnUrl: 'https://app.example.com/cuenta/facturacion/checkout' }),
      );
    });

    it('strips trailing slash from FRONTEND_URL to avoid double-slash returnUrl', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'FRONTEND_URL') return 'https://app.example.com/';
        if (key === 'PAGUELO_ACCESS_TOKEN') return 'test-api-key';
        if (key === 'PAGUELO_CCLW') return 'test-cclw';
        if (key === 'PAGUELO_ENV') return 'sandbox';
        return undefined;
      });
      const user = mockUser();

      await controller.crearEnlacePago(user);

      expect(mockPagoService.crearEnlacePago).toHaveBeenCalledWith(
        expect.objectContaining({
          returnUrl: 'https://app.example.com/cuenta/facturacion/checkout',
        }),
      );
    });

    it('propagates errors from the service', async () => {
      mockPagoService.crearEnlacePago.mockRejectedValue(new Error('PF gateway error'));
      const user = mockUser();

      await expect(controller.crearEnlacePago(user)).rejects.toThrow('PF gateway error');
    });

    // ── Defensive plan lookup (Fix D) ──────────────────────────────────────

    it('falls back to pro pricing when org has a non-standard plan value', async () => {
      mockSuscripcionesService.obtenerActual.mockResolvedValueOnce({
        plan: 'enterprise', // non-standard — not in PLAN_PRICES
        estado: 'Activa',
        current_period_end: null,
        trial_termina_en: null,
      });
      const user = mockUser();

      await controller.crearEnlacePago(user);

      // Should fall back to pro ($5) instead of crashing
      expect(mockPagoService.crearEnlacePago).toHaveBeenCalledWith(
        expect.objectContaining({ monto: 5, descripcion: 'Plan Pro - Expensly' }),
      );
    });
  });
});
