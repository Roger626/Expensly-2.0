const mockReadBarcodes = jest.fn();
const mockGet = jest.fn();
const mockDnsLookup = jest.fn();

jest.mock('zxing-wasm/reader', () => ({
  prepareZXingModule: jest.fn().mockResolvedValue(undefined),
  readBarcodes: (...args: unknown[]) => mockReadBarcodes(...args),
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

jest.mock('dns', () => ({
  promises: { lookup: (...args: unknown[]) => mockDnsLookup(...args) },
}));

import { ProcesarFacturaQRStrategy, QR_TRUSTED_DOMAINS } from './factura-procesar-qr-strategy';
import { ILlmService } from '../../../infrastructure/llm/illm.service';
import { FacturaProcesamientoInput } from './factura-procesar.strategy.interface';
import { REAL_DGI_FACTURA_HTML } from './__fixtures__/dgi-factura-real.html';

describe('ProcesarFacturaQRStrategy', () => {
  let llmService: jest.Mocked<ILlmService>;
  let strategy: ProcesarFacturaQRStrategy;

  beforeEach(() => {
    mockReadBarcodes.mockReset();
    mockGet.mockReset();
    mockDnsLookup.mockReset();
    // By default, any hostname resolves to a public IP — individual tests
    // override this to simulate a hostname resolving to an internal address.
    mockDnsLookup.mockResolvedValue([{ address: '203.0.113.10', family: 4 }]);
    llmService = {
      extractFromText: jest.fn(),
      extractFromImages: jest.fn(),
      extractFromHtml: jest.fn(),
    };
    strategy = new ProcesarFacturaQRStrategy(llmService);
  });

  describe('QR_TRUSTED_DOMAINS', () => {
    it('includes the real production DGI Panama domain (dgi-fep.mef.gob.pa, no subdomain)', () => {
      // Regression guard: real QR codes point here. Missing this sends every
      // Panama invoice through the slow generic LLM fallback instead of the
      // fast deterministic scraper.
      expect(QR_TRUSTED_DOMAINS).toContain('dgi-fep.mef.gob.pa');
    });

    it('also includes the efact. subdomain variant', () => {
      expect(QR_TRUSTED_DOMAINS).toContain('efact.dgi-fep.mef.gob.pa');
    });
  });

  describe('SSRF defense in processInvoice', () => {
    it('rejects a qrUrl that is not a valid http(s) URL', async () => {
      await expect(
        strategy.processInvoice({ qrUrl: 'not-a-url' } as FacturaProcesamientoInput),
      ).rejects.toThrow(/URL válida/);
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('rejects when qrUrl is missing entirely', async () => {
      await expect(
        strategy.processInvoice({} as FacturaProcesamientoInput),
      ).rejects.toThrow();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('never fetches a non-http(s) scheme (e.g. file://)', async () => {
      await expect(
        strategy.processInvoice({ qrUrl: 'file:///etc/passwd' } as FacturaProcesamientoInput),
      ).rejects.toThrow();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('rejects a literal private IPv4 URL without doing a DNS lookup', async () => {
      await expect(
        strategy.processInvoice({ qrUrl: 'http://192.168.1.5/x' } as FacturaProcesamientoInput),
      ).rejects.toThrow();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('rejects the AWS/Azure metadata IP', async () => {
      await expect(
        strategy.processInvoice({ qrUrl: 'http://169.254.169.254/latest/meta-data' } as FacturaProcesamientoInput),
      ).rejects.toThrow();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('rejects a public-looking hostname that resolves to a private IP', async () => {
      mockDnsLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);

      await expect(
        strategy.processInvoice({ qrUrl: 'https://looks-public.example.com/x' } as FacturaProcesamientoInput),
      ).rejects.toThrow();
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('allows a hostname that resolves to a public IP', async () => {
      mockGet.mockResolvedValue({ data: '<html></html>' });
      llmService.extractFromHtml.mockResolvedValue({
        data: {
          montoTotal: 1, fechaEmision: '', rucProveedor: '', dv: '',
          nombreProveedor: '', cufe: '', numeroFactura: '',
        },
        confidence: {},
        modelo: 'gpt-4o-mini',
      });

      await expect(
        strategy.processInvoice({ qrUrl: 'https://otro-portal.example.com/x' } as FacturaProcesamientoInput),
      ).resolves.toBeDefined();
      expect(mockGet).toHaveBeenCalled();
    });
  });

  // Fixture con la estructura REAL del portal DGI (paneles EMISOR/RECEPTOR con
  // campo "NOMBRE" dentro de cada uno, no "EMISOR" como field — el "EMISOR" es
  // solo el título del panel). "Valor Total" en el tfoot es el TOTAL FINAL
  // (no el subtotal), confirmado con un HTML real de producción.
  const COMPLETE_DGI_HTML = `
    <html><body>
      <div class="panel-heading"><div class="row">
        <div class="col-sm-4 text-left"><h5>No. 013084019</h5></div>
        <div class="col-sm-4 text-center"><h4><strong>FACTURA</strong></h4></div>
        <div class="col-sm-4 text-right"><h5>14/11/2025 10:00:00</h5></div>
      </div></div>
      <dl><dt class="small">CÓDIGO ÚNICO DE FACTURA ELECTRÓNICA [CUFE]</dt><dd>FE01200000000000000000000000000000</dd></dl>
      <dl><dt class="small">FECHA AUTORIZACIÓN</dt><dd>20/11/2025 08:00:00</dd></dl>
      <div class="panel">
        <div class="panel-heading">EMISOR</div>
        <div class="panel-body">
          <dl><dt class="small">RUC</dt><dd>9-733-273</dd></dl>
          <dl><dt class="small">DV</dt><dd>97</dd></dl>
          <dl><dt class="small">NOMBRE</dt><dd>Comercial Test S.A.</dd></dl>
        </div>
      </div>
      <div class="panel">
        <div class="panel-heading">RECEPTOR</div>
        <div class="panel-body">
          <dl><dt class="small">NOMBRE</dt><dd>Cliente Final</dd></dl>
        </div>
      </div>
      <table><tfoot>
        <tr><td>Valor Total: <div>43.78</div></td></tr>
        <tr><td>ITBMS Total: <div>0.48</div></td></tr>
      </tfoot></table>
    </body></html>`;

  describe('domain routing in processInvoice', () => {
    it('uses the deterministic DGI scraper for the trusted domain when the result is complete (does not call the LLM)', async () => {
      mockGet.mockResolvedValue({ data: COMPLETE_DGI_HTML });

      const result = await strategy.processInvoice({
        qrUrl: 'https://efact.dgi-fep.mef.gob.pa/Consultas/FE?x=1',
      } as FacturaProcesamientoInput);

      expect(llmService.extractFromHtml).not.toHaveBeenCalled();
      expect(result.origenExtraccion).toBe('QR_DGI');
      expect(result.rucProveedor).toBe('9-733-273');
      expect(result.nombreProveedor).toBe('Comercial Test S.A.'); // no el RECEPTOR
      // "Valor Total" (43.78) es el TOTAL FINAL, no el subtotal.
      expect(result.montoTotal).toBeCloseTo(43.78);
      expect(result.subtotal).toBeCloseTo(43.30);
      expect(result.itbms).toBeCloseTo(0.48);
      // Usa la fecha de EMISIÓN del encabezado, no la de AUTORIZACIÓN.
      expect(result.fechaEmision).toBe('2025-11-14');
    });

    it('regression: parses a real DGI portal HTML dump correctly end-to-end', async () => {
      mockGet.mockResolvedValue({ data: REAL_DGI_FACTURA_HTML });

      const result = await strategy.processInvoice({
        qrUrl: 'https://dgi-fep.mef.gob.pa/Consultas/FacturasPorQR?chFE=x',
      } as FacturaProcesamientoInput);

      expect(llmService.extractFromHtml).not.toHaveBeenCalled();
      expect(result.origenExtraccion).toBe('QR_DGI');
      expect(result.numeroFactura).toBe('0002894016');
      expect(result.rucProveedor).toBe('1080323-1-554308');
      expect(result.dv).toBe('39');
      expect(result.nombreProveedor).toBe('EMPRESAS CARBONE S A'); // no "ROGER MILLAN" (receptor)
      expect(result.cufe).toBe('FE01200001080323-1-554308-39PPAL2026022500028940160200114825972210');
      expect(result.fechaEmision).toBe('2026-02-25'); // fecha de emisión, no la de autorización (25/02 08:55)
      // "Valor Total" (127.85) es el TOTAL FINAL: Σ(Monto por línea 119.49) + ITBMS (8.36).
      expect(result.montoTotal).toBeCloseTo(127.85);
      expect(result.itbms).toBeCloseTo(8.36);
      expect(result.subtotal).toBeCloseTo(119.49);
    });

    it('regression: does NOT read an explicit "TOTAL" field as subtotal when there is no tfoot breakdown', async () => {
      // Layout SIN <tfoot> "Valor Total"/"ITBMS Total", pero SÍ con un campo
      // "TOTAL" explícito (43.78) y un "ITBMS" explícito (0.48) por separado.
      // El bug real: findField('TOTAL') se usaba como fallback de subtotal,
      // metiendo 43.78 en "subtotal" y luego sumando ITBMS otra vez → 44.26.
      const html = `
        <html><body>
          <table>
            <tr><td>RUC</td><td>9-733-273</td></tr>
            <tr><td>DV</td><td>97</td></tr>
            <tr><td>EMISOR</td><td>Comercial Test S.A.</td></tr>
            <tr><td>FECHA</td><td>14/11/2025</td></tr>
            <tr><td>TOTAL</td><td>43.78</td></tr>
            <tr><td>ITBMS</td><td>0.48</td></tr>
          </table>
          <h4>Factura N# 013084019</h4>
        </body></html>`;
      mockGet.mockResolvedValue({ data: html });

      const result = await strategy.processInvoice({
        qrUrl: 'https://dgi-fep.mef.gob.pa/Consultas/FacturasPorQR?chFE=x',
      } as FacturaProcesamientoInput);

      // El total explícito debe quedar en montoTotal, NUNCA duplicado en subtotal.
      expect(result.montoTotal).toBeCloseTo(43.78);
      expect(result.subtotal).not.toBe(43.78);
    });

    it('uses the deterministic DGI scraper for the real production QR domain (no subdomain)', async () => {
      mockGet.mockResolvedValue({ data: COMPLETE_DGI_HTML });

      const result = await strategy.processInvoice({
        qrUrl: 'https://dgi-fep.mef.gob.pa/Consultas/FacturasPorQR?chFE=FE0120000...',
      } as FacturaProcesamientoInput);

      expect(llmService.extractFromHtml).not.toHaveBeenCalled();
      expect(result.origenExtraccion).toBe('QR_DGI');
    });

    it('falls back to LLM validation on the SAME html (no extra fetch) when the DGI scraper result looks incomplete', async () => {
      // Layout no matchea los selectores -> todos los campos quedan vacíos/0.
      mockGet.mockResolvedValue({ data: '<html><body>layout distinto, sin selectores conocidos</body></html>' });
      llmService.extractFromHtml.mockResolvedValue({
        data: {
          montoTotal: 43.78, fechaEmision: '2025-11-14', rucProveedor: '9-733-273', dv: '97',
          nombreProveedor: 'Comercial Test S.A.', cufe: '', numeroFactura: '013084019',
        },
        confidence: { montoTotal: 'media' },
        modelo: 'gpt-4o-mini',
      });

      const result = await strategy.processInvoice({
        qrUrl: 'https://dgi-fep.mef.gob.pa/Consultas/FacturasPorQR?chFE=x',
      } as FacturaProcesamientoInput);

      expect(mockGet).toHaveBeenCalledTimes(1); // no se vuelve a pedir el HTML
      expect(llmService.extractFromHtml).toHaveBeenCalledTimes(1);
      expect(result.origenExtraccion).toBe('QR_DGI_LLM_FALLBACK');
      expect(result.montoTotal).toBe(43.78);
      expect(result.rucProveedor).toBe('9-733-273');
    });

    it('falls back to the partial scraper result (does not throw) if the LLM validation itself fails', async () => {
      mockGet.mockResolvedValue({ data: '<html><body>layout distinto</body></html>' });
      llmService.extractFromHtml.mockRejectedValue(new Error('LLM down'));

      const result = await strategy.processInvoice({
        qrUrl: 'https://dgi-fep.mef.gob.pa/Consultas/FacturasPorQR?chFE=x',
      } as FacturaProcesamientoInput);

      expect(result.origenExtraccion).toBe('QR_DGI');
      expect(result.montoTotal).toBe(0);
    });

    it('falls back to LLM extraction over HTML for an unrecognized fiscal domain', async () => {
      mockGet.mockResolvedValue({ data: '<html>otro portal fiscal</html>' });
      llmService.extractFromHtml.mockResolvedValue({
        data: {
          montoTotal: 10, fechaEmision: '2025-01-01', rucProveedor: '', dv: '',
          nombreProveedor: 'X', cufe: '', numeroFactura: '1',
        },
        confidence: {},
        modelo: 'gpt-4o-mini',
      });

      const result = await strategy.processInvoice({
        qrUrl: 'https://otro-portal-fiscal.gob.mx/verificar?id=1',
      } as FacturaProcesamientoInput);

      expect(llmService.extractFromHtml).toHaveBeenCalledWith('otro portal fiscal');
      expect(result.origenExtraccion).toBe('QR_GENERICO_LLM');
      expect(result.montoTotal).toBe(10);
    });

    it('strips script/style noise from the HTML before sending it to the LLM (token/latency reduction)', async () => {
      mockGet.mockResolvedValue({
        data: '<html><head><style>.a{}</style></head><body><script>evil()</script><p>RUC 9-733-273</p></body></html>',
      });
      llmService.extractFromHtml.mockResolvedValue({
        data: {
          montoTotal: 1, fechaEmision: '', rucProveedor: '', dv: '',
          nombreProveedor: '', cufe: '', numeroFactura: '',
        },
        confidence: {},
        modelo: 'gpt-4o-mini',
      });

      await strategy.processInvoice({
        qrUrl: 'https://otro-portal-fiscal.gob.mx/verificar?id=1',
      } as FacturaProcesamientoInput);

      const sentHtml = llmService.extractFromHtml.mock.calls[0][0];
      expect(sentHtml).not.toContain('<script>');
      expect(sentHtml).not.toContain('<style>');
      expect(sentHtml).toContain('RUC 9-733-273');
    });
  });

  describe('canHandle — clientQrData fast path', () => {
    const buffers = [Buffer.from([0xff, 0xd8, 0xff])]; // fake JPEG magic bytes

    it('trusts clientQrData directly without scanning any image (no cost regression)', async () => {
      const input: FacturaProcesamientoInput = {
        fileBuffers: buffers,
        clientQrData: 'https://efact.dgi-fep.mef.gob.pa/x',
      };

      const handled = await strategy.canHandle(input);

      expect(handled).toBe(true);
      expect(input.qrUrl).toBe('https://efact.dgi-fep.mef.gob.pa/x');
      // The fast path must not touch the image pipeline at all.
      expect(mockReadBarcodes).not.toHaveBeenCalled();
    });

    it('does not require fileBuffers when clientQrData is present', async () => {
      const input: FacturaProcesamientoInput = {
        fileBuffers: [],
        clientQrData: 'https://efact.dgi-fep.mef.gob.pa/x',
      };

      const handled = await strategy.canHandle(input);

      expect(handled).toBe(false); // no buffers at all -> nothing to process/upload
    });
  });

  describe('canHandle — standard server-side scan (no clientQrData)', () => {
    it('scans all buffers in parallel and returns true when one decodes a QR', async () => {
      mockReadBarcodes.mockResolvedValue([{ text: 'https://efact.dgi-fep.mef.gob.pa/found' }]);

      const input: FacturaProcesamientoInput = {
        fileBuffers: [Buffer.from([0xff, 0xd8, 0xff]), Buffer.from([0xff, 0xd8, 0xff])],
      };
      const handled = await strategy.canHandle(input);

      expect(handled).toBe(true);
      expect(input.qrUrl).toBe('https://efact.dgi-fep.mef.gob.pa/found');
    });

    it('returns false when no buffer decodes a QR', async () => {
      mockReadBarcodes.mockResolvedValue([]);

      const input: FacturaProcesamientoInput = {
        fileBuffers: [Buffer.from([0xff, 0xd8, 0xff])],
      };
      const handled = await strategy.canHandle(input);

      expect(handled).toBe(false);
    });
  });
});
