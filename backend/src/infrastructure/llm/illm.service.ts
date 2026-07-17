import { FacturaProcesamientoResult } from '../../modules/registro-gastos/strategies/factura-procesar.strategy.interface';

/** Nivel de confianza que el modelo asigna a cada campo extraído. */
export type CampoConfianza = 'alta' | 'media' | 'baja';

/** Campos de factura que tienen sentido pedirle al modelo (excluye metadata de imágenes). */
export type CampoFactura = Extract<
  keyof FacturaProcesamientoResult,
  'montoTotal' | 'subtotal' | 'itbms' | 'fechaEmision' | 'rucProveedor' | 'dv' | 'nombreProveedor' | 'cufe' | 'numeroFactura'
>;

export interface LlmExtractionResult {
  data: FacturaProcesamientoResult;
  confidence: Partial<Record<CampoFactura, CampoConfianza>>;
  /** Identificador del modelo/deployment usado, para trazabilidad (p.ej. "gpt-4o-mini"). */
  modelo: string;
}

/**
 * Contrato de extracción estructurada de datos de facturas vía LLM.
 * Implementación de referencia: Azure OpenAI (ver azure-openai.service.ts).
 * Cualquier proveedor (OpenAI directo, Anthropic, etc.) puede implementar
 * esta interfaz sin que el resto del pipeline de facturas se entere.
 */
export interface ILlmService {
  /**
   * Extrae los campos de la factura a partir de texto plano (típicamente la
   * salida combinada de Azure Document Intelligence). Camino barato y rápido —
   * primera opción cuando hay texto OCR disponible.
   */
  extractFromText(text: string): Promise<LlmExtractionResult>;

  /**
   * Extrae los campos directamente de la(s) imagen(es) usando un modelo con
   * visión. Fallback más costoso: solo se invoca cuando extractFromText()
   * devuelve confianza baja o campos clave vacíos.
   */
  extractFromImages(buffers: Buffer[]): Promise<LlmExtractionResult>;

  /**
   * Extrae los campos a partir de HTML crudo (p.ej. el portal fiscal de un
   * país sin scraper dedicado). Permite soportar QR de dominios desconocidos
   * sin escribir selectores cheerio nuevos por cada portal.
   */
  extractFromHtml(html: string): Promise<LlmExtractionResult>;
}
