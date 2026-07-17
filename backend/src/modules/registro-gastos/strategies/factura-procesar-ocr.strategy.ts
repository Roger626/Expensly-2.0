import { FacturaProcesamientoInput, FacturaProcesamientoResult, IProcesarFacturaStrategy } from "./factura-procesar.strategy.interface";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ProcessInvoice } from "../../../infrastructure/ocr/iazure-ocr.service";
import { OCR_SERVICE } from "../../../infrastructure/ocr/ocr.tokens";
import { ILlmService, LlmExtractionResult } from "../../../infrastructure/llm/illm.service";
import { LLM_SERVICE } from "../../../infrastructure/llm/llm.tokens";
import { reconcileInvoiceTotals } from "../utils/invoice-math.util";

/** Campos clave: si el LLM-texto los marca en baja confianza o vacíos, se escala a visión. */
const CAMPOS_CRITICOS = ['montoTotal', 'fechaEmision', 'rucProveedor'] as const;

@Injectable()
export class ProcesarFacturaOCRStrategy implements IProcesarFacturaStrategy {
    private readonly logger = new Logger(ProcesarFacturaOCRStrategy.name);

    constructor(
        @Inject(OCR_SERVICE)
        private readonly ocrService: ProcessInvoice,
        @Inject(LLM_SERVICE)
        private readonly llmService: ILlmService,
    ) {}

    async canHandle(input: FacturaProcesamientoInput): Promise<boolean> {
        const buffers = input.fileBuffers ?? (input.fileBuffer ? [input.fileBuffer] : []);
        return buffers.length > 0;
    }

    /**
     * Orquesta: OCR (texto) → extracción LLM sobre texto (barato) → si la
     * confianza en campos críticos es baja, escala a LLM de visión sobre las
     * imágenes (más caro, solo cuando hace falta) → reconciliación aritmética
     * determinística sobre el resultado final.
     */
    async processInvoice(input: FacturaProcesamientoInput): Promise<FacturaProcesamientoResult> {
        const buffers = input.fileBuffers ?? (input.fileBuffer ? [input.fileBuffer] : []);

        const imageTexts = await this.ocrService.extractText(buffers);

        let extraction: LlmExtractionResult;
        let origenExtraccion: string;
        if (imageTexts.length > 0) {
            const combinedText = imageTexts.join('\n');
            extraction = await this.llmService.extractFromText(combinedText);
            origenExtraccion = 'OCR_LLM';

            if (this.necesitaEscalarAVision(extraction)) {
                this.logger.warn('Confianza baja en campos críticos tras extracción de texto — escalando a LLM de visión.');
                extraction = await this.llmService.extractFromImages(buffers);
                origenExtraccion = 'OCR_LLM_VISION';
            }
        } else {
            this.logger.warn('OCR no devolvió texto de ninguna imagen — usando LLM de visión directamente.');
            extraction = await this.llmService.extractFromImages(buffers);
            origenExtraccion = 'OCR_LLM_VISION';
        }

        return {
            ...reconcileInvoiceTotals(extraction.data),
            origenExtraccion,
            confianzaExtraccion: extraction.confidence,
        };
    }

    private necesitaEscalarAVision(extraction: LlmExtractionResult): boolean {
        return CAMPOS_CRITICOS.some((campo) => {
            const confianza = extraction.confidence[campo];
            const valor = extraction.data[campo];
            const vacio = valor === undefined || valor === null || valor === '' || valor === 0;
            return vacio || confianza === 'baja';
        });
    }
}
