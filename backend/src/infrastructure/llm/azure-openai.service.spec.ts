const mockCreate = jest.fn();

jest.mock('openai', () => {
  return {
    AzureOpenAI: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
  };
});

describe('AzureOpenAiService', () => {
  const ENV = {
    AZURE_OPENAI_ENDPOINT: 'https://test-resource.openai.azure.com/',
    AZURE_OPENAI_KEY: 'test-key',
    AZURE_OPENAI_API_VERSION: '2024-10-21',
    AZURE_OPENAI_DEPLOYMENT_TEXT: 'gpt-4o-mini',
    AZURE_OPENAI_DEPLOYMENT_VISION: 'gpt-4o',
  };

  async function createService() {
    Object.assign(process.env, ENV);
    jest.resetModules();
    const mod = await import('./azure-openai.service');
    return new mod.AzureOpenAiService();
  }

  beforeEach(() => {
    mockCreate.mockReset();
    for (const key of Object.keys(ENV)) delete process.env[key];
  });

  function buildCompletion(payload: Record<string, unknown>) {
    return { choices: [{ message: { content: JSON.stringify(payload) } }] };
  }

  const VALID_PAYLOAD = {
    montoTotal: 43.3,
    subtotal: 42.82,
    itbms: 0.48,
    fechaEmision: '2025-11-14',
    rucProveedor: '9-733-273',
    dv: '97',
    nombreProveedor: 'Comercial Test S.A.',
    cufe: 'FE0110000...',
    numeroFactura: '013084019',
    confidence: {
      montoTotal: 'alta', subtotal: 'alta', itbms: 'alta', fechaEmision: 'alta',
      rucProveedor: 'alta', dv: 'media', nombreProveedor: 'alta', cufe: 'media', numeroFactura: 'alta',
    },
  };

  describe('constructor', () => {
    it('throws when required env vars are missing', async () => {
      jest.resetModules();
      const mod = await import('./azure-openai.service');
      expect(() => new mod.AzureOpenAiService()).toThrow();
    });

    it('constructs successfully when all env vars are present', async () => {
      await expect(createService()).resolves.toBeDefined();
    });
  });

  describe('extractFromText', () => {
    it('parses the structured JSON response into FacturaProcesamientoResult + confidence', async () => {
      mockCreate.mockResolvedValue(buildCompletion(VALID_PAYLOAD));
      const service = await createService();

      const result = await service.extractFromText('texto OCR de una factura');

      expect(result.data.montoTotal).toBe(43.3);
      expect(result.data.rucProveedor).toBe('9-733-273');
      expect(result.confidence.montoTotal).toBe('alta');
      expect(result.modelo).toBe('gpt-4o-mini');
    });

    it('uses the text deployment (gpt-4o-mini), not the vision one', async () => {
      mockCreate.mockResolvedValue(buildCompletion(VALID_PAYLOAD));
      const service = await createService();

      await service.extractFromText('texto');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o-mini' }),
      );
    });

    it('throws InternalServerErrorException when the model returns no content', async () => {
      mockCreate.mockResolvedValue({ choices: [{ message: {} }] });
      const service = await createService();

      await expect(service.extractFromText('texto')).rejects.toThrow();
    });

    it('wraps SDK errors in InternalServerErrorException', async () => {
      mockCreate.mockRejectedValue(new Error('rate limited'));
      const service = await createService();

      await expect(service.extractFromText('texto')).rejects.toThrow('rate limited');
    });
  });

  describe('extractFromImages', () => {
    it('uses the vision deployment (gpt-4o) and base64-encodes the buffers', async () => {
      mockCreate.mockResolvedValue(buildCompletion(VALID_PAYLOAD));
      const service = await createService();
      const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);

      await service.extractFromImages([fakeJpeg]);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o' }),
      );
      const call = mockCreate.mock.calls[0][0];
      const userMessage = call.messages.find((m: any) => m.role === 'user');
      const imagePart = userMessage.content.find((c: any) => c.type === 'image_url');
      expect(imagePart.image_url.url).toContain('data:image/jpeg;base64,');
    });
  });

  describe('extractFromHtml', () => {
    it('sends the HTML as user content on the text deployment', async () => {
      mockCreate.mockResolvedValue(buildCompletion(VALID_PAYLOAD));
      const service = await createService();

      await service.extractFromHtml('<html>factura</html>');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o-mini' }),
      );
    });
  });
});
