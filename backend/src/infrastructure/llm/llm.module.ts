import { Module } from '@nestjs/common';
import { AzureOpenAiService } from './azure-openai.service';
import { LLM_SERVICE } from './llm.tokens';

@Module({
  providers: [
    AzureOpenAiService,
    { provide: LLM_SERVICE, useExisting: AzureOpenAiService },
  ],
  exports: [LLM_SERVICE],
})
export class LlmModule {}
