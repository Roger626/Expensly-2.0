import { PAGO_SERVICE } from './pagos.tokens';
import { IPagoService } from './pagos.interface';

describe('Pagos interface & token (structural)', () => {
  it('should export PAGO_SERVICE as a non-empty string token', () => {
    expect(PAGO_SERVICE).toBeDefined();
    expect(typeof PAGO_SERVICE).toBe('string');
    expect(PAGO_SERVICE.length).toBeGreaterThan(0);
  });

  it('should export PAGO_SERVICE with the expected value', () => {
    expect(PAGO_SERVICE).toBe('PAGO_SERVICE');
  });

  it('should allow IPagoService to be imported (compile-time check)', () => {
    // IPagoService is a TypeScript interface — erased at runtime.
    // This test is a structural guard: if IPagoService did not exist,
    // the import above would fail at compile time.
    // We verify the import is usable by assigning a dummy object.
    const dummy: IPagoService = {} as IPagoService;
    expect(dummy).toBeDefined();
  });
});
