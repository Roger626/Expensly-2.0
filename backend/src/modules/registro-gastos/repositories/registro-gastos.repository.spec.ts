import { Test, TestingModule } from '@nestjs/testing';
import { RegistroGastosRepository } from './registro-gastos.repository';
import { PrismaService } from '../../../prisma/prisma.service';

describe('RegistroGastosRepository — Dashboard Methods', () => {
  let repo: RegistroGastosRepository;
  let prisma: PrismaService;

  const ORG_ID = 'org-123';

  beforeEach(async () => {
    const mockPrisma = {
      facturas: {
        aggregate: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as PrismaService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistroGastosRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<RegistroGastosRepository>(RegistroGastosRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getDashboardResumen', () => {
    it('calculates totals, pending, expired, and returns 10 recent transactions', async () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');

      (prisma.facturas.aggregate as jest.Mock).mockResolvedValue({
        _sum: {
          monto_total: { toNumber: () => 1000.50 } as any,
          itbms: { toNumber: () => 70.00 } as any,
        },
      });

      (prisma.facturas.count as jest.Mock)
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(2); // expired (>48h)

      const mockTransactions = [
        {
          id: '1',
          monto_total: { toNumber: () => 100 } as any,
          fecha_emision: new Date('2026-01-10'),
          estado: 'PENDIENTE',
          usuarios: { nombre_completo: 'Juan Perez' },
          categorias: { nombre: 'Comida' },
        },
      ];
      (prisma.facturas.findMany as jest.Mock).mockResolvedValue(mockTransactions);

      const res = await repo.getDashboardResumen(ORG_ID, start, end);

      expect(res.gastoTotal).toBe(1000.50);
      expect(res.itbmsRecuperable).toBe(70.00);
      expect(res.tasaRecuperacion).toBeCloseTo(7.0, 1);
      expect(res.aprobacionesPendientes).toBe(5);
      expect(res.reportesVencidos).toBe(2);
      expect(res.ultimasTransacciones).toHaveLength(1);
      expect(res.ultimasTransacciones[0].montoTotal).toBe(100);
    });

    it('returns safe fallback values when no invoices exist', async () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');

      (prisma.facturas.aggregate as jest.Mock).mockResolvedValue({
        _sum: {
          monto_total: null,
          itbms: null,
        },
      });

      (prisma.facturas.count as jest.Mock).mockResolvedValue(0);
      (prisma.facturas.findMany as jest.Mock).mockResolvedValue([]);

      const res = await repo.getDashboardResumen(ORG_ID, start, end);

      expect(res.gastoTotal).toBe(0);
      expect(res.itbmsRecuperable).toBe(0);
      expect(res.tasaRecuperacion).toBe(0);
      expect(res.aprobacionesPendientes).toBe(0);
      expect(res.reportesVencidos).toBe(0);
      expect(res.ultimasTransacciones).toEqual([]);
    });

    it('calculates variación vs. an equal-length previous period', async () => {
      // Rango pedido: 16 días (15 ene - 31 ene). El periodo anterior debe ser
      // los 16 días inmediatamente anteriores (30 dic - 15 ene).
      const start = new Date('2026-01-15');
      const end = new Date('2026-01-31');

      (prisma.facturas.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { monto_total: { toNumber: () => 220 } as any, itbms: { toNumber: () => 20 } as any } }) // periodo actual
        .mockResolvedValueOnce({ _sum: { monto_total: { toNumber: () => 200 } as any, itbms: { toNumber: () => 10 } as any } }); // periodo anterior

      (prisma.facturas.count as jest.Mock).mockResolvedValue(0);
      (prisma.facturas.findMany as jest.Mock).mockResolvedValue([]);

      const res = await repo.getDashboardResumen(ORG_ID, start, end);

      expect(res.gastoTotal).toBe(220);
      // (220-200)/200 * 100 = 10%
      expect(res.variacionGastoTotal).toBeCloseTo(10, 1);
      // (20-10)/10 * 100 = 100%
      expect(res.variacionItbmsRecuperable).toBeCloseTo(100, 1);

      // Verifica que el rango del periodo anterior sea el inmediatamente
      // previo, de igual duración (16 días).
      const prevCallArgs = (prisma.facturas.aggregate as jest.Mock).mock.calls[1][0];
      expect(prevCallArgs.where.fecha_emision.lt).toEqual(start);
      expect(prevCallArgs.where.fecha_emision.gte).toEqual(new Date('2025-12-30'));
    });

    it('returns null variación fields when the previous period has no data (avoids divide-by-zero)', async () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');

      (prisma.facturas.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { monto_total: { toNumber: () => 500 } as any, itbms: { toNumber: () => 35 } as any } }) // actual
        .mockResolvedValueOnce({ _sum: { monto_total: null, itbms: null } }); // anterior (sin datos)

      (prisma.facturas.count as jest.Mock).mockResolvedValue(0);
      (prisma.facturas.findMany as jest.Mock).mockResolvedValue([]);

      const res = await repo.getDashboardResumen(ORG_ID, start, end);

      expect(res.variacionGastoTotal).toBeNull();
      expect(res.variacionItbmsRecuperable).toBeNull();
    });
  });

  describe('getDashboardTendencia', () => {
    it('returns monthly spend trend for the last 6 months when no date range is given', async () => {
      const mockFacturas = [
        {
          monto_total: { toNumber: () => 150.00 } as any,
          itbms: { toNumber: () => 10.50 } as any,
          fecha_emision: new Date(),
        },
      ];
      (prisma.facturas.findMany as jest.Mock).mockResolvedValue(mockFacturas);

      const res = await repo.getDashboardTendencia(ORG_ID);

      expect(res).toHaveLength(6);
      const currentMonth = res[5];
      expect(currentMonth.montoTotal).toBe(150.00);
      expect(currentMonth.itbms).toBe(10.50);
    });

    it('honors an explicit date range instead of the fixed 6-month window', async () => {
      (prisma.facturas.findMany as jest.Mock).mockResolvedValue([]);

      // Rango de 3 meses: enero a marzo 2026.
      const res = await repo.getDashboardTendencia(
        ORG_ID, undefined, undefined,
        new Date('2026-01-01'), new Date('2026-03-31'),
      );

      expect(res).toHaveLength(3);
      expect(res.map((m: any) => m.mes)).toEqual(['2026-01', '2026-02', '2026-03']);
    });

    it('caps to the last 12 months when the requested range is wider', async () => {
      (prisma.facturas.findMany as jest.Mock).mockResolvedValue([]);

      // Rango de 24 meses (2024-01 a 2025-12) — debe capar a los últimos 12.
      const res = await repo.getDashboardTendencia(
        ORG_ID, undefined, undefined,
        new Date('2024-01-01'), new Date('2025-12-31'),
      );

      expect(res).toHaveLength(12);
      expect(res[0].mes).toBe('2025-01');
      expect(res[11].mes).toBe('2025-12');
    });

    it('aggregates invoices into the correct month bucket within a custom range', async () => {
      const mockFacturas = [
        { monto_total: { toNumber: () => 100 } as any, itbms: { toNumber: () => 7 } as any, fecha_emision: new Date('2026-02-15') },
        { monto_total: { toNumber: () => 50 } as any, itbms: { toNumber: () => 3.5 } as any, fecha_emision: new Date('2026-02-20') },
      ];
      (prisma.facturas.findMany as jest.Mock).mockResolvedValue(mockFacturas);

      const res = await repo.getDashboardTendencia(
        ORG_ID, undefined, undefined,
        new Date('2026-01-01'), new Date('2026-03-31'),
      );

      const feb = res.find((m: any) => m.mes === '2026-02');
      expect(feb.montoTotal).toBe(150);
      expect(feb.itbms).toBeCloseTo(10.5, 1);
    });
  });

  describe('getDashboardCategorias', () => {
    it('returns breakdown of expenses grouped by category', async () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');

      const mockFacturas = [
        {
          categoria_id: 'cat-1',
          monto_total: { toNumber: () => 200.00 } as any,
          categorias: { nombre: 'Oficina' },
        },
        {
          categoria_id: 'cat-1',
          monto_total: { toNumber: () => 300.00 } as any,
          categorias: { nombre: 'Oficina' },
        },
        {
          categoria_id: null,
          monto_total: { toNumber: () => 50.00 } as any,
          categorias: null,
        },
      ];
      (prisma.facturas.findMany as jest.Mock).mockResolvedValue(mockFacturas);

      const res = await repo.getDashboardCategorias(ORG_ID, start, end);

      expect(res).toHaveLength(2);
      const oficina = res.find(c => c.name === 'Oficina');
      const sinCat = res.find(c => c.name === 'Sin categoría');

      expect(oficina.montoTotal).toBe(500.00);
      expect(oficina.count).toBe(2);
      expect(oficina.percentage).toBeCloseTo(90.91, 1);

      expect(sinCat.montoTotal).toBe(50.00);
      expect(sinCat.count).toBe(1);
      expect(sinCat.percentage).toBeCloseTo(9.09, 1);
    });
  });
});
