import { IPagoService } from './pagos.interface';

// We mock the axios module at the Jest level.
// ts-jest + esModuleInterop compiles "import axios from 'axios'" to
//   const axios_1 = __importDefault(require("axios"));
// which accesses .default, so our mock must provide it.
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('axios', () => {
  return {
    __esModule: true,
    default: { get: mockGet, post: mockPost },
  };
});

// ── Test doubles ────────────────────────────────────────────────────────────

describe('PagueloFacilService (slice 3 — consultarTransaccion real impl)', () => {
  let service: IPagoService;

  // Dynamic import so env vars are captured before the module loads
  async function createService(env: 'sandbox' | 'prod'): Promise<IPagoService> {
    process.env.PAGUELO_CCLW = 'CCLW_TEST';
    process.env.PAGUELO_ACCESS_TOKEN = 'TOKEN_TEST';
    process.env.PAGUELO_ENV = env;
    jest.resetModules();
    const mod = await import('./paguelo-facil.service');
    return new mod.PagueloFacilService();
  }

  beforeEach(() => {
    jest.resetModules();
    mockGet.mockReset();
    mockPost.mockReset();
    delete process.env.PAGUELO_CCLW;
    delete process.env.PAGUELO_ACCESS_TOKEN;
    delete process.env.PAGUELO_ENV;
  });

  // ── Environment switching ─────────────────────────────────────────────────

  describe('environment switching', () => {
    it('should use sandbox URLs when PAGUELO_ENV is "sandbox"', async () => {
      const svc = await createService('sandbox');
      const svcAny = svc as any;
      expect(svcAny.baseUrl).toContain('sandbox.paguelofacil.com');
    });

    it('should use production management URL when PAGUELO_ENV is "prod"', async () => {
      const svc = await createService('prod');
      const svcAny = svc as any;
      expect(svcAny.baseUrl).toContain('admin.paguelofacil.com');
    });

    it('should default to sandbox when PAGUELO_ENV is not set', async () => {
      process.env.PAGUELO_CCLW = 'CCLW_TEST';
      process.env.PAGUELO_ACCESS_TOKEN = 'TOKEN_TEST';
      delete process.env.PAGUELO_ENV;
      jest.resetModules();
      const mod = await import('./paguelo-facil.service');
      const svc = new mod.PagueloFacilService();
      const svcAny = svc as any;
      expect(svcAny.baseUrl).toContain('sandbox.paguelofacil.com');
    });
  });

  // ── Stub behavior: non-consultarTransaccion methods still throw ──────────

  describe('stub behavior (other methods — still slice 1)', () => {
    beforeEach(async () => {
      service = await createService('sandbox');
    });

    it('should throw "not implemented in slice 1" when calling capturarTarjetaYcobrar', async () => {
      await expect(service.capturarTarjetaYcobrar('token', 5)).rejects.toThrow(
        'not implemented in slice 1',
      );
    });

    it('should throw "not implemented in slice 1" when calling cobroRecurrente', async () => {
      await expect(service.cobroRecurrente('token', 10)).rejects.toThrow(
        'not implemented in slice 1',
      );
    });

    it('should throw "not implemented in slice 1" when calling reembolsar', async () => {
      await expect(service.reembolsar('OP123', 5)).rejects.toThrow(
        'not implemented in slice 1',
      );
    });

    it('should default reembolsar monto to undefined and still throw', async () => {
      await expect(service.reembolsar('OP123')).rejects.toThrow(
        'not implemented in slice 1',
      );
    });
  });

  // ── Configuration from environment ────────────────────────────────────────

  describe('configuration from environment', () => {
    it('should read PAGUELO_CCLW from env', async () => {
      process.env.PAGUELO_CCLW = 'MY_CCLW';
      process.env.PAGUELO_ACCESS_TOKEN = 'TOKEN';
      process.env.PAGUELO_ENV = 'sandbox';
      jest.resetModules();
      const mod = await import('./paguelo-facil.service');
      const svcAny = new mod.PagueloFacilService() as any;
      expect(svcAny.cclw).toBe('MY_CCLW');
    });

    it('should read PAGUELO_ACCESS_TOKEN from env', async () => {
      process.env.PAGUELO_CCLW = 'CCLW';
      process.env.PAGUELO_ACCESS_TOKEN = 'MY_TOKEN';
      process.env.PAGUELO_ENV = 'sandbox';
      jest.resetModules();
      const mod = await import('./paguelo-facil.service');
      const svcAny = new mod.PagueloFacilService() as any;
      expect(svcAny.accessToken).toBe('MY_TOKEN');
    });
  });

  // ── consultarTransaccion: real implementation (slice 3) ───────────────────

  describe('consultarTransaccion — real implementation', () => {
    const COD_OPER = 'PF-ABC-123';

    function buildPfResponse(status: number, dataStatus: number, overrides: Record<string, unknown> = {}) {
      return {
        data: {
          headerStatus: { code: status },
          // PF returns data as an ARRAY of transactions (verified against sandbox 2026-07-06).
          data: [
            {
              status: dataStatus,
              codOper: COD_OPER,
              amount: 5.0,
              cardToken: 'ct_abc123',
              displayCardNum: '7001',
              operationType: 'AUTH_CAPTURE',
              ...overrides,
            },
          ],
        },
      };
    }

    beforeEach(async () => {
      service = await createService('sandbox');
    });

    // ── Happy path ──────────────────────────────────────────────────────────

    it('calls the correct PF management endpoint with the codOper filter', async () => {
      mockGet.mockResolvedValue(buildPfResponse(200, 1));

      await service.consultarTransaccion(COD_OPER);

      expect(mockGet).toHaveBeenCalledTimes(1);
      const [url, config] = mockGet.mock.calls[0] as [string, Record<string, unknown>];
      expect(url).toContain('sandbox.paguelofacil.com');
      expect(url).toContain('/PFManagementServices/api/v1/MerchantTransactions');
      expect(url).toContain(`filter=codOper::${COD_OPER}`);
      // PF management API expects the raw accessToken WITHOUT "Bearer" prefix.
      expect((config.headers as Record<string, string>).Authorization).toBe('TOKEN_TEST');
    });

    it('returns a typed PfTransaccionResponse on success', async () => {
      mockGet.mockResolvedValue(buildPfResponse(200, 1));

      const result = await service.consultarTransaccion(COD_OPER);

      expect(result.status).toBe(1);
      expect(result.codOper).toBe(COD_OPER);
      expect(result.monto).toBe(5.0);
      expect(result.cardToken).toBe('ct_abc123');
      expect(result.displayNum).toBe('7001');
    });

    it('returns status=0 for a declined transaction', async () => {
      mockGet.mockResolvedValue(buildPfResponse(200, 0));

      const result = await service.consultarTransaccion(COD_OPER);

      expect(result.status).toBe(0);
    });

    it('parses monto as a number from the amount field', async () => {
      mockGet.mockResolvedValue(buildPfResponse(200, 1, { amount: 10.50 }));

      const result = await service.consultarTransaccion('OP-10');

      expect(result.monto).toBe(10.5);
    });

    it('handles missing cardToken and displayCardNum gracefully', async () => {
      mockGet.mockResolvedValue(
        buildPfResponse(200, 1, { cardToken: undefined, displayCardNum: undefined }),
      );

      const result = await service.consultarTransaccion(COD_OPER);

      expect(result.cardToken).toBeUndefined();
      expect(result.displayNum).toBeUndefined();
    });

    // ── Error mapping (from paguelofacil-docs/diccionario-de-datos.md) ──────

    it('maps PF code 200 to success (no error thrown)', async () => {
      mockGet.mockResolvedValue(buildPfResponse(200, 1));
      await expect(service.consultarTransaccion(COD_OPER)).resolves.toBeDefined();
    });

    it('maps PF code 400 to BadRequestException', async () => {
      mockGet.mockResolvedValue(buildPfResponse(400, 1));
      await expect(service.consultarTransaccion(COD_OPER)).rejects.toThrow('Invalid request');
    });

    it('maps PF code 410 to UnauthorizedException', async () => {
      mockGet.mockResolvedValue(buildPfResponse(410, 1));
      await expect(service.consultarTransaccion(COD_OPER)).rejects.toThrow('Invalid Api Key');
    });

    it('maps PF code 530 to ForbiddenException', async () => {
      mockGet.mockResolvedValue(buildPfResponse(530, 1));
      await expect(service.consultarTransaccion(COD_OPER)).rejects.toThrow('No privileges');
    });

    it('maps PF code 900 to RequestTimeoutException', async () => {
      mockGet.mockResolvedValue(buildPfResponse(900, 1));
      await expect(service.consultarTransaccion(COD_OPER)).rejects.toThrow('URL TimeOut Connection');
    });

    it('maps PF code 920 to InternalServerErrorException (exception)', async () => {
      mockGet.mockResolvedValue(buildPfResponse(920, 1));
      await expect(service.consultarTransaccion(COD_OPER)).rejects.toThrow('Exception');
    });

    // ── Reviewer fix #5: unmapped codes → InternalServerErrorException ──────

    it('maps unmapped code 300 to InternalServerErrorException with code', async () => {
      mockGet.mockResolvedValue(buildPfResponse(300, 1));
      await expect(service.consultarTransaccion(COD_OPER)).rejects.toThrow('Paguelo Fácil error: 300');
    });

    it('maps unmapped code 550 to InternalServerErrorException with code', async () => {
      mockGet.mockResolvedValue(buildPfResponse(550, 1));
      await expect(service.consultarTransaccion(COD_OPER)).rejects.toThrow('Paguelo Fácil error: 550');
    });

    it('maps unmapped code 551 to InternalServerErrorException with code', async () => {
      mockGet.mockResolvedValue(buildPfResponse(551, 1));
      await expect(service.consultarTransaccion(COD_OPER)).rejects.toThrow('Paguelo Fácil error: 551');
    });

    it('maps unmapped code 310 to InternalServerErrorException with code', async () => {
      mockGet.mockResolvedValue(buildPfResponse(310, 1));
      await expect(service.consultarTransaccion(COD_OPER)).rejects.toThrow('Paguelo Fácil error: 310');
    });

    // ── Network / axios errors ─────────────────────────────────────────────

    it('wraps axios network errors in a descriptive exception', async () => {
      mockGet.mockRejectedValue(new Error('Network Error'));
      await expect(service.consultarTransaccion(COD_OPER)).rejects.toThrow('Paguelo Fácil request failed');
    });
  });

  // ── crearEnlacePago: real implementation (slice 4 refactor) ───────────────

  describe('crearEnlacePago — real implementation', () => {
    const INPUT = {
      monto: 5,
      descripcion: 'Plan Pro - Expensly',
      returnUrl: 'https://example.com/cuenta/facturacion/checkout',
      parm1: 'pro',
    };

    function buildLinkDeamonResponse(code: number, overrides: Record<string, unknown> = {}) {
      return {
        data: {
          headerStatus: { code, description: code === 200 ? 'Success' : 'Error' },
          serverTime: '2026-01-01T12:00:00',
          message: code === 200 ? 'Success' : 'Error',
          data: code === 200
            ? { url: 'https://checkout.paguelofacil.com?code=LK-ABC123', code: 'LK-ABC123', ...overrides }
            : {},
          success: code === 200,
        },
      };
    }

    beforeEach(async () => {
      service = await createService('sandbox');
    });

    // ── Happy path ──────────────────────────────────────────────────────────

    it('calls the correct LinkDeamon.cfm endpoint via POST', async () => {
      mockPost.mockResolvedValue(buildLinkDeamonResponse(200));

      await service.crearEnlacePago(INPUT);

      expect(mockPost).toHaveBeenCalledTimes(1);
      const [url] = mockPost.mock.calls[0] as [string];
      expect(url).toContain('sandbox.paguelofacil.com');
      expect(url).toContain('/LinkDeamon.cfm');
    });

    it('sends form-urlencoded body with CCLW, CMTN, CDSC', async () => {
      mockPost.mockResolvedValue(buildLinkDeamonResponse(200));

      await service.crearEnlacePago(INPUT);

      const [, body] = mockPost.mock.calls[0] as [string, string];
      expect(body).toContain('CCLW=CCLW_TEST');
      expect(body).toContain('CMTN=5');
      expect(body).toContain('CDSC=Plan+Pro+-+Expensly');
    });

    it('HEX-encodes RETURN_URL as uppercase hex', async () => {
      mockPost.mockResolvedValue(buildLinkDeamonResponse(200));

      await service.crearEnlacePago(INPUT);

      const [, body] = mockPost.mock.calls[0] as [string, string];
      // Hex-encode "https://example.com/cuenta/facturacion/checkout"
      const hexEncoded = Buffer.from(INPUT.returnUrl).toString('hex').toUpperCase();
      expect(body).toContain(`RETURN_URL=${hexEncoded}`);
    });

    it('includes PARM_1 when provided', async () => {
      mockPost.mockResolvedValue(buildLinkDeamonResponse(200));

      await service.crearEnlacePago(INPUT);

      const [, body] = mockPost.mock.calls[0] as [string, string];
      expect(body).toContain('PARM_1=pro');
    });

    it('omits PARM_1 when not provided', async () => {
      mockPost.mockResolvedValue(buildLinkDeamonResponse(200));
      const inputWithoutParm = { monto: 5, descripcion: 'test', returnUrl: 'https://example.com' };

      await service.crearEnlacePago(inputWithoutParm);

      const [, body] = mockPost.mock.calls[0] as [string, string];
      expect(body).not.toContain('PARM_1');
    });

    it('includes EXPIRES_IN with default value (3600 seconds)', async () => {
      mockPost.mockResolvedValue(buildLinkDeamonResponse(200));

      await service.crearEnlacePago(INPUT);

      const [, body] = mockPost.mock.calls[0] as [string, string];
      expect(body).toContain('EXPIRES_IN=3600');
    });

    it('returns { checkoutUrl, code } on success', async () => {
      mockPost.mockResolvedValue(buildLinkDeamonResponse(200));

      const result = await service.crearEnlacePago(INPUT);

      expect(result).toEqual({
        checkoutUrl: 'https://checkout.paguelofacil.com?code=LK-ABC123',
        code: 'LK-ABC123',
      });
    });

    // ── Triangulation: different inputs ─────────────────────────────────────

    it('handles a different plan (premium) with corresponding monto', async () => {
      mockPost.mockResolvedValue(buildLinkDeamonResponse(200));

      await service.crearEnlacePago({ monto: 10, descripcion: 'Plan Premium - Expensly', returnUrl: 'https://example.com', parm1: 'premium' });

      const [, body] = mockPost.mock.calls[0] as [string, string];
      expect(body).toContain('CMTN=10');
      expect(body).toContain('PARM_1=premium');
    });

    it('URL-encodes the description containing special characters', async () => {
      mockPost.mockResolvedValue(buildLinkDeamonResponse(200));

      await service.crearEnlacePago({ monto: 1, descripcion: 'Plan Basic & más — Expensly', returnUrl: 'https://example.com' });

      const [, body] = mockPost.mock.calls[0] as [string, string];
      // & should be encoded
      expect(body).toContain('CDSC=Plan+Basic+%26+m%C3%A1s+%E2%80%94+Expensly');
    });

    // ── Error handling ──────────────────────────────────────────────────────

    it('handles PF error response from LinkDeamon with code 615', async () => {
      mockPost.mockResolvedValue(buildLinkDeamonResponse(615));

      await expect(service.crearEnlacePago(INPUT)).rejects.toThrow('Paguelo Fácil error: 615');
    });

    it('handles PF error code 400 from LinkDeamon', async () => {
      mockPost.mockResolvedValue(buildLinkDeamonResponse(400));

      await expect(service.crearEnlacePago(INPUT)).rejects.toThrow('Invalid request');
    });

    it('handles PF error code 410 from LinkDeamon', async () => {
      mockPost.mockResolvedValue(buildLinkDeamonResponse(410));

      await expect(service.crearEnlacePago(INPUT)).rejects.toThrow('Invalid Api Key');
    });

    it('wraps axios network errors in descriptive exception', async () => {
      mockPost.mockRejectedValue(new Error('Connection refused'));

      await expect(service.crearEnlacePago(INPUT)).rejects.toThrow('Paguelo Fácil request failed');
    });

    // ── Empty data.url / data.code (Fix 3 hardening) ────────────────────────

    it('throws when PF returns 200 but data.url is missing', async () => {
      mockPost.mockResolvedValue(buildLinkDeamonResponse(200, { url: undefined, code: undefined }));

      await expect(service.crearEnlacePago(INPUT)).rejects.toThrow(
        'Paguelo Fácil response missing checkout URL',
      );
    });

    it('throws when PF returns 200 but data.url is empty string and code is empty', async () => {
      mockPost.mockResolvedValue(buildLinkDeamonResponse(200, { url: '', code: '' }));

      await expect(service.crearEnlacePago(INPUT)).rejects.toThrow(
        'Paguelo Fácil response missing checkout URL',
      );
    });

    it('throws when PF returns 200 with data: {} (no url/code at all)', async () => {
      mockPost.mockResolvedValue({
        data: {
          headerStatus: { code: 200, description: 'Success' },
          serverTime: '2026-01-01T12:00:00',
          message: 'Success',
          data: {},
          success: true,
        },
      });

      await expect(service.crearEnlacePago(INPUT)).rejects.toThrow(
        'Paguelo Fácil response missing checkout URL',
      );
    });

    // ── Production env ──────────────────────────────────────────────────────

    it('uses secure.paguelofacil.com for prod environment', async () => {
      // Need a prod-configured service
      const prodService = await createService('prod');
      mockPost.mockResolvedValue(buildLinkDeamonResponse(200));

      await prodService.crearEnlacePago(INPUT);

      const [url] = mockPost.mock.calls[0] as [string];
      expect(url).toContain('secure.paguelofacil.com');
      expect(url).toContain('/LinkDeamon.cfm');
    });
  });
});
