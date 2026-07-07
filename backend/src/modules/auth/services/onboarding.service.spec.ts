import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { AuthService } from './auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { IAuthRepository } from '../interfaces/iauth.repository';
import { OnboardingCompanyDto } from '../dto/onboarding-company.dto';

// ── Test doubles ────────────────────────────────────────────────────────────

describe('OnboardingService — createOrganizationWithAdmin (Trial + suscripciones)', () => {
  let service: OnboardingService;

  // Mocked collaborators
  let mockAuthRepo: jest.Mocked<IAuthRepository>;
  let mockAuthService: jest.Mocked<Partial<AuthService>>;
  let mockPrismaService: jest.Mocked<Partial<PrismaService>>;

  // Fake Prisma transaction client
  let mockTx: any;

  // Test data
  const validCompanyDto: OnboardingCompanyDto = {
    razonSocial: 'Acme Corp',
    ruc: '123456-7',
    dv: '01',
    subscripcion: 'pro',
  };

  const validAdminData = {
    name: 'John Doe',
    email: 'john@acme.com',
    password: 'securePass123',
  };

  const fakeOrgId = 'org-uuid-001';

  const fakeAuthResponse = {
    accessToken: 'jwt-token-xxx',
    user: {
      id: 'user-uuid-001',
      email: 'john@acme.com',
      name: 'John Doe',
      role: 'SUPERADMIN',
      organizationId: 'org-uuid-001',
    },
  };

  beforeAll(() => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/expensly_test?schema=public';
  });

  beforeEach(async () => {
    // ── Build mock transaction client ──────────────────────────────────────
    mockTx = {
      organizaciones: {
        create: jest.fn(),
      },
      categorias: {
        createMany: jest.fn(),
      },
      suscripciones: {
        create: jest.fn(),
      },
    };

    // ── Mock PrismaService ─────────────────────────────────────────────────
    mockPrismaService = {
      $transaction: jest.fn().mockImplementation(async (fn: any) => {
        return fn(mockTx);
      }),
    } as any;

    // ── Mock AuthRepository ────────────────────────────────────────────────
    mockAuthRepo = {
      existsOrganizationByRuc: jest.fn().mockResolvedValue(false),
      existsUserByEmail: jest.fn().mockResolvedValue(false),
      createOrganization: jest.fn(),
      findOrganizationById: jest.fn(),
      findOrganizationByRuc: jest.fn(),
      findUserByEmail: jest.fn(),
      findUserById: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deactivateUser: jest.fn(),
      setUserStatus: jest.fn(),
      updateUserRole: jest.fn(),
      deleteUser: jest.fn(),
      createSession: jest.fn(),
      findSessionByTokenId: jest.fn(),
      deleteSession: jest.fn(),
      deleteUserSessions: jest.fn(),
      updateOrganization: jest.fn(),
      findUsersByOrganizationId: jest.fn(),
      saveResetToken: jest.fn(),
      findUserByResetToken: jest.fn(),
      clearResetToken: jest.fn(),
      updatePassword: jest.fn(),
    } as any;

    // ── Mock AuthService ───────────────────────────────────────────────────
    mockAuthService = {
      registerUser: jest.fn().mockResolvedValue(fakeAuthResponse),
    } as any;

    // ── Compile module ─────────────────────────────────────────────────────
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: 'IAuthRepository', useValue: mockAuthRepo },
        { provide: AuthService, useValue: mockAuthService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
  });

  afterAll(() => {
    delete process.env.DATABASE_URL;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Core happy-path tests
  // ──────────────────────────────────────────────────────────────────────────

  describe('trial row creation', () => {
    beforeEach(() => {
      // Setup: tx operations return fake records
      mockTx.organizaciones.create.mockResolvedValue({
        id: fakeOrgId,
        razon_social: validCompanyDto.razonSocial,
        ruc: validCompanyDto.ruc,
        dv: validCompanyDto.dv,
        plan_suscripcion: 'pro',
        trial_inicia_en: expect.any(Date) as any,
        trial_termina_en: expect.any(Date) as any,
        fecha_registro: new Date(),
      });
      mockTx.categorias.createMany.mockResolvedValue({ count: 5 });
      mockTx.suscripciones.create.mockResolvedValue({
        id: 'sub-uuid-001',
        organizacion_id: fakeOrgId,
        plan: 'pro',
        estado: 'Trial',
        fecha_creacion: new Date(),
      });
    });

    it('should call prisma.$transaction for atomicity of org + suscripciones', async () => {
      await service.createOrganizationWithAdmin(validCompanyDto, validAdminData);
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should create a suscripciones row with plan from DTO and estado=Trial inside tx', async () => {
      await service.createOrganizationWithAdmin(validCompanyDto, validAdminData);

      expect(mockTx.suscripciones.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizacion_id: fakeOrgId,
            plan: 'pro',
            estado: 'Trial',
          }),
        }),
      );
    });

    it('should set organizaciones.trial_inicia_en explicitly (not via DB default)', async () => {
      const beforeCall = Date.now();
      await service.createOrganizationWithAdmin(validCompanyDto, validAdminData);
      const afterCall = Date.now();

      const createCall = mockTx.organizaciones.create.mock.calls[0][0];
      const trialIniciaEn = createCall?.data?.trial_inicia_en;

      expect(trialIniciaEn).toBeDefined();
      expect(trialIniciaEn).toBeInstanceOf(Date);
      // Must be within 60 seconds of now (reviewer fix #6: explicit, not DB default)
      const ts = trialIniciaEn.getTime();
      expect(ts).toBeGreaterThanOrEqual(beforeCall - 1000);
      expect(ts).toBeLessThanOrEqual(afterCall + 1000);
    });

    it('should set organizaciones.trial_termina_en to trial_inicia_en + 14 days', async () => {
      await service.createOrganizationWithAdmin(validCompanyDto, validAdminData);

      const createCall = mockTx.organizaciones.create.mock.calls[0][0];
      const trialIniciaEn = createCall?.data?.trial_inicia_en as Date;
      const trialTerminaEn = createCall?.data?.trial_termina_en as Date;

      expect(trialTerminaEn).toBeDefined();
      expect(trialTerminaEn).toBeInstanceOf(Date);

      const expectedTermina = trialIniciaEn.getTime() + 14 * 24 * 60 * 60 * 1000;
      const diff = Math.abs(trialTerminaEn.getTime() - expectedTermina);
      // Allow ±60 seconds tolerance for test execution time
      expect(diff).toBeLessThanOrEqual(60_000);
    });

    it('should still write plan_suscripcion on organizaciones for backward compat', async () => {
      await service.createOrganizationWithAdmin(validCompanyDto, validAdminData);

      const createCall = mockTx.organizaciones.create.mock.calls[0][0];
      expect(createCall?.data?.plan_suscripcion).toBe('pro');
    });

    it('should create default categories for the new org', async () => {
      await service.createOrganizationWithAdmin(validCompanyDto, validAdminData);

      expect(mockTx.categorias.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              organizacion_id: fakeOrgId,
              nombre: 'Alimentación',
            }),
          ]),
        }),
      );
    });

    it('should register the admin user via AuthService after transaction', async () => {
      await service.createOrganizationWithAdmin(validCompanyDto, validAdminData);

      expect(mockAuthService.registerUser).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: fakeOrgId,
          name: validAdminData.name,
          email: validAdminData.email,
        }),
      );
    });

    it('should return organization and authData in the response', async () => {
      const result = await service.createOrganizationWithAdmin(validCompanyDto, validAdminData);

      expect(result).toBeDefined();
      expect(result.organization).toBeDefined();
      expect(result.organization.id).toBe(fakeOrgId);
      expect(result.authData).toBeDefined();
      expect(result.authData.accessToken).toBe(fakeAuthResponse.accessToken);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Plan default behavior
  // ──────────────────────────────────────────────────────────────────────────

  describe('plan default', () => {
    beforeEach(() => {
      mockTx.organizaciones.create.mockResolvedValue({
        id: fakeOrgId,
        razon_social: 'NoPlan Corp',
        ruc: '111-1',
        dv: '01',
      });
      mockTx.categorias.createMany.mockResolvedValue({ count: 5 });
      mockTx.suscripciones.create.mockResolvedValue({ id: 'sub-default' });
    });

    it('should default subscripcion to "basic" when not provided in DTO', async () => {
      const dtoWithoutPlan: OnboardingCompanyDto = {
        razonSocial: 'NoPlan Corp',
        ruc: '111-1',
        dv: '01',
        // subscripcion intentionally undefined
      };

      await service.createOrganizationWithAdmin(dtoWithoutPlan, validAdminData);

      // suscripciones row gets 'basic'
      expect(mockTx.suscripciones.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            plan: 'basic',
          }),
        }),
      );

      // organizaciones.plan_suscripcion also gets 'basic'
      expect(mockTx.organizaciones.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            plan_suscripcion: 'basic',
          }),
        }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Atomicity / failure tests
  // ──────────────────────────────────────────────────────────────────────────

  describe('atomicity on failure', () => {
    it('should reject duplicate RUC before entering transaction', async () => {
      mockAuthRepo.existsOrganizationByRuc.mockResolvedValue(true);

      await expect(
        service.createOrganizationWithAdmin(validCompanyDto, validAdminData),
      ).rejects.toThrow(ConflictException);

      // Transaction should never have been started
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should reject duplicate email before entering transaction', async () => {
      mockAuthRepo.existsUserByEmail.mockResolvedValue(true);

      await expect(
        service.createOrganizationWithAdmin(validCompanyDto, validAdminData),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should rollback everything if org creation fails inside transaction', async () => {
      mockTx.organizaciones.create.mockRejectedValue(
        new Error('DB constraint violation'),
      );

      // prisma.$transaction rethrows errors from the callback
      mockPrismaService.$transaction = jest.fn().mockImplementation(async (fn: any) => {
        return fn(mockTx);
        // Prisma's real $transaction would rollback + rethrow on error
      });

      await expect(
        service.createOrganizationWithAdmin(validCompanyDto, validAdminData),
      ).rejects.toThrow('DB constraint violation');

      // suscripciones.create should NEVER have been called (it comes after org create)
      expect(mockTx.suscripciones.create).not.toHaveBeenCalled();
    });
  });
});
