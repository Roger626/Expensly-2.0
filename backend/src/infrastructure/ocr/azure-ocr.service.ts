import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";
import { ProcessInvoice } from './iazure-ocr.service';

@Injectable()
export class AzureOcrService implements ProcessInvoice {
  private readonly logger = new Logger(AzureOcrService.name);
  private client: DocumentAnalysisClient;

  constructor() {
    const endpoint = process.env.AZURE_OCR_ENDPOINT;
    const apiKey = process.env.AZURE_OCR_KEY;

    if (!endpoint || !apiKey) {
      throw new Error('Azure OCR credentials are not configured');
    }

    this.client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(apiKey), {
      retryOptions: {
        maxRetries: 3,
        retryDelayInMs: 1000,
        maxRetryDelayInMs: 4000
      }
    });
  }

  /**
   * Usa prebuilt-read (texto libre) sobre cada imagen en paralelo.
   * Responsabilidad única: OCR → texto. El entendimiento de los campos de la
   * factura (RUC, total, fecha, etc.) vive en ILlmService, no aquí.
   */
  async extractText(fileBuffers: Buffer[]): Promise<string[]> {
    try {
      const texts = await Promise.all(
        fileBuffers.map(async (buffer, i) => {
          const poller = await this.client.beginAnalyzeDocument('prebuilt-read', buffer);
          const result = await poller.pollUntilDone();
          const pageText = result.pages
            ?.flatMap(p => p.lines?.map(l => l.content) ?? [])
            .join('\n') ?? '';

          if (pageText.trim()) {
            this.logger.log(`Imagen ${i + 1} extraída (${pageText.split('\n').length} líneas)`);
          } else {
            this.logger.warn(`Imagen ${i + 1}: sin texto`);
          }
          return pageText;
        }),
      );

      return texts.filter((t) => t.trim().length > 0);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error procesando la factura con Azure OCR: ${msg}`);
      throw new InternalServerErrorException(`Error al procesar la factura con Azure OCR: ${msg}`);
    }
  }
}
