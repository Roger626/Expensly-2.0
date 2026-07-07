import { Test, TestingModule } from '@nestjs/testing';
import { RegistroGastosService } from './registro-gastos.service';
import { REGISTRO_GASTOS_REPOSITORY } from '../registro-gastos.tokens';
import { STORAGE_SERVICE } from 'src/infrastructure/storage/storage.tokens';

describe('RegistroGastosService — Dashboard Methods', () => {
  let service: RegistroGastosService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = {
      getDashboardResumen: jest.fn(),
      getDashboardTendencia: jest.fn(),
      getDashboardCategorias: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistroGastosService,
        { provide: 'FACTURA_STRATEGIES', useValue: [] },
        { provide: REGISTRO_GASTOS_REPOSITORY, useValue: repoMock },
        { provide: STORAGE_SERVICE, useValue: {} },
      ],
    }).compile();

    service = module.get<RegistroGastosService>(RegistroGastosService);
  });

  it('getDashboardResumen parses start/end dates and calls repository', async () => {
    repoMock.getDashboardResumen.mockResolvedValue({ total: 100 });

    const res = await service.getDashboardResumen('org-1', '2026-01-01', '2026-01-31', 'cat-1', 'emp-1');

    expect(res).toEqual({ total: 100 });
    expect(repoMock.getDashboardResumen).toHaveBeenCalledWith(
      'org-1',
      new Date('2026-01-01'),
      new Date('2026-01-31'),
      'cat-1',
      'emp-1'
    );
  });

  it('getDashboardTendencia calls repository', async () => {
    repoMock.getDashboardTendencia.mockResolvedValue([]);

    const res = await service.getDashboardTendencia('org-1', 'cat-1', 'emp-1');

    expect(res).toEqual([]);
    expect(repoMock.getDashboardTendencia).toHaveBeenCalledWith('org-1', 'cat-1', 'emp-1');
  });

  it('getDashboardCategorias parses start/end dates and calls repository', async () => {
    repoMock.getDashboardCategorias.mockResolvedValue([]);

    const res = await service.getDashboardCategorias('org-1', '2026-01-01', '2026-01-31', 'emp-1');

    expect(res).toEqual([]);
    expect(repoMock.getDashboardCategorias).toHaveBeenCalledWith(
      'org-1',
      new Date('2026-01-01'),
      new Date('2026-01-31'),
      'emp-1'
    );
  });
});
