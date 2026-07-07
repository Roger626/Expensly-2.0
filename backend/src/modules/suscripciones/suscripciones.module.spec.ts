import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SuscripcionesModule } from './suscripciones.module';
import { PAGO_SERVICE } from '../../infrastructure/pagos/pagos.tokens';
import { IPagoService } from '../../infrastructure/pagos/pagos.interface';

describe('SuscripcionesModule (skeleton — slice 1)', () => {
  let module: TestingModule;

  beforeAll(async () => {
    // Set env vars for PagosModule dependency
    process.env.PAGUELO_CCLW = 'CCLW_TEST';
    process.env.PAGUELO_ACCESS_TOKEN = 'TOKEN_TEST';
    process.env.PAGUELO_ENV = 'sandbox';

    // Set a fake DATABASE_URL so PrismaService constructor does not crash
    // (PrismaModule is global and PrismaService connects onModuleInit)
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/expensly_test?schema=public';

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        SuscripcionesModule,
      ],
    }).compile();
  });

  afterAll(async () => {
    delete process.env.PAGUELO_CCLW;
    delete process.env.PAGUELO_ACCESS_TOKEN;
    delete process.env.PAGUELO_ENV;
    await module?.close();
  });

  it('should make PAGO_SERVICE injectable via PagosModule import', () => {
    const service = module.get<IPagoService>(PAGO_SERVICE);
    expect(service).toBeDefined();
    // Verify it exposes the IPagoService contract
    expect(typeof service.consultarTransaccion).toBe('function');
    expect(typeof service.crearEnlacePago).toBe('function');
  });

  it('should compile successfully (module booted without errors)', () => {
    expect(module).toBeDefined();
  });
});
