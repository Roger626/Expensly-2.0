import { Test, TestingModule } from '@nestjs/testing';
import { PagosModule } from './pagos.module';
import { PagueloFacilService } from './paguelo-facil.service';
import { PAGO_SERVICE } from './pagos.tokens';
import { IPagoService } from './pagos.interface';

describe('PagosModule (DI wiring)', () => {
  let module: TestingModule;

  beforeAll(async () => {
    // Set env vars before module init so the service constructor reads them
    process.env.PAGUELO_CCLW = 'CCLW_TEST';
    process.env.PAGUELO_ACCESS_TOKEN = 'TOKEN_TEST';
    process.env.PAGUELO_ENV = 'sandbox';

    module = await Test.createTestingModule({
      imports: [PagosModule],
    }).compile();
  });

  afterAll(async () => {
    delete process.env.PAGUELO_CCLW;
    delete process.env.PAGUELO_ACCESS_TOKEN;
    delete process.env.PAGUELO_ENV;
    await module?.close();
  });

  it('should resolve PAGO_SERVICE to a PagueloFacilService instance', () => {
    const service = module.get<IPagoService>(PAGO_SERVICE);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(PagueloFacilService);
  });

  it('should resolve the same instance for PAGO_SERVICE on multiple gets', () => {
    const a = module.get<IPagoService>(PAGO_SERVICE);
    const b = module.get<IPagoService>(PAGO_SERVICE);
    expect(a).toBe(b);
  });

  it('should export PAGO_SERVICE so that importing modules can inject it', () => {
    // If PAGO_SERVICE is exported and resolves, this is the contract that
    // SuscripcionesModule depends on. The fact that we got an instance above
    // confirms the module exports it.
    const service = module.get<IPagoService>(PAGO_SERVICE);
    expect(service.capturarTarjetaYcobrar).toBeInstanceOf(Function);
    expect(service.consultarTransaccion).toBeInstanceOf(Function);
    expect(service.crearEnlacePago).toBeInstanceOf(Function);
    expect(service.cobroRecurrente).toBeInstanceOf(Function);
    expect(service.reembolsar).toBeInstanceOf(Function);
  });
});
