import { Test, TestingModule } from '@nestjs/testing';
import { RegistroGastosController } from './registro-gastos.controller';
import { RegistroGastosService } from '../services/registro-gastos.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { CurrentUserPayload } from 'src/modules/auth/decorators/current-user.decorator';

describe('RegistroGastosController — Dashboard Endpoints', () => {
  let controller: RegistroGastosController;
  let serviceMock: any;

  const ORG_ID = 'org-123';
  const userPayload: CurrentUserPayload = {
    userId: 'user-1',
    email: 'admin@test.com',
    role: 'SUPERADMIN',
    organizationId: ORG_ID,
  };

  beforeEach(async () => {
    serviceMock = {
      getDashboardResumen: jest.fn(),
      getDashboardTendencia: jest.fn(),
      getDashboardCategorias: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RegistroGastosController],
      providers: [
        { provide: RegistroGastosService, useValue: serviceMock },
        { provide: 'EXPORT_STRATEGY', useValue: {} },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (_ctx: ExecutionContext) => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: (_ctx: ExecutionContext) => true })
      .compile();

    controller = module.get<RegistroGastosController>(RegistroGastosController);
  });

  it('GET /dashboard/resumen calls service with query params', async () => {
    serviceMock.getDashboardResumen.mockResolvedValue({ total: 500 });

    const result = await controller.getDashboardResumen(
      userPayload,
      '2026-01-01',
      '2026-01-31',
      'cat-1',
      'emp-1'
    );

    expect(result).toEqual({ total: 500 });
    expect(serviceMock.getDashboardResumen).toHaveBeenCalledWith(
      ORG_ID,
      '2026-01-01',
      '2026-01-31',
      'cat-1',
      'emp-1'
    );
  });

  it('GET /dashboard/tendencia-mensual calls service with query params', async () => {
    serviceMock.getDashboardTendencia.mockResolvedValue([]);

    const result = await controller.getDashboardTendencia(
      userPayload,
      'cat-1',
      'emp-1'
    );

    expect(result).toEqual([]);
    expect(serviceMock.getDashboardTendencia).toHaveBeenCalledWith(
      ORG_ID,
      'cat-1',
      'emp-1'
    );
  });

  it('GET /dashboard/categorias calls service with query params', async () => {
    serviceMock.getDashboardCategorias.mockResolvedValue([]);

    const result = await controller.getDashboardCategorias(
      userPayload,
      '2026-01-01',
      '2026-01-31',
      'emp-1'
    );

    expect(result).toEqual([]);
    expect(serviceMock.getDashboardCategorias).toHaveBeenCalledWith(
      ORG_ID,
      '2026-01-01',
      '2026-01-31',
      'emp-1'
    );
  });
});
