import { Test, TestingModule } from '@nestjs/testing';
import { LlmModule } from './llm.module';
import { AzureOpenAiService } from './azure-openai.service';
import { LLM_SERVICE } from './llm.tokens';
import { ILlmService } from './illm.service';

describe('LlmModule (DI wiring)', () => {
  let module: TestingModule;

  beforeAll(async () => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test-resource.openai.azure.com/';
    process.env.AZURE_OPENAI_KEY = 'test-key';
    process.env.AZURE_OPENAI_API_VERSION = '2024-10-21';
    process.env.AZURE_OPENAI_DEPLOYMENT_TEXT = 'gpt-4o-mini';
    process.env.AZURE_OPENAI_DEPLOYMENT_VISION = 'gpt-4o';

    module = await Test.createTestingModule({
      imports: [LlmModule],
    }).compile();
  });

  afterAll(async () => {
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_KEY;
    delete process.env.AZURE_OPENAI_API_VERSION;
    delete process.env.AZURE_OPENAI_DEPLOYMENT_TEXT;
    delete process.env.AZURE_OPENAI_DEPLOYMENT_VISION;
    await module?.close();
  });

  it('should resolve LLM_SERVICE to an AzureOpenAiService instance', () => {
    const service = module.get<ILlmService>(LLM_SERVICE);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(AzureOpenAiService);
  });

  it('should resolve the same singleton instance on multiple gets', () => {
    const a = module.get<ILlmService>(LLM_SERVICE);
    const b = module.get<ILlmService>(LLM_SERVICE);
    expect(a).toBe(b);
  });

  it('should expose the full ILlmService contract', () => {
    const service = module.get<ILlmService>(LLM_SERVICE);
    expect(service.extractFromText).toBeInstanceOf(Function);
    expect(service.extractFromImages).toBeInstanceOf(Function);
    expect(service.extractFromHtml).toBeInstanceOf(Function);
  });
});
