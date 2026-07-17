import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { AzureOpenAI } from 'openai';
import { ILlmService, LlmExtractionResult, CampoFactura, CampoConfianza } from './illm.service';
import { FacturaProcesamientoResult } from '../../modules/registro-gastos/strategies/factura-procesar.strategy.interface';

const CAMPOS: CampoFactura[] = [
  'montoTotal', 'subtotal', 'itbms', 'fechaEmision',
  'rucProveedor', 'dv', 'nombreProveedor', 'cufe', 'numeroFactura',
];

const SYSTEM_PROMPT = `Eres un asistente de extracción de datos de facturas y recibos de cualquier país, idioma o formato.
Se te da texto (OCR) o una imagen de una factura/recibo. Devuelve SOLO los campos que puedas identificar con confianza.

Reglas generales:
- Fechas siempre en formato YYYY-MM-DD.
- Montos siempre como número con punto decimal (sin símbolo de moneda). El OCR a veces usa coma como
  separador decimal (ej. "43,30") — interprétalo como 43.30, no como millar.
- Si un campo de texto no aparece en el documento, devuelve "" (string vacío), nunca inventes datos.
- "rucProveedor"/"dv" son el identificador fiscal del EMISOR/vendedor, no del comprador ni del validador del documento.
- "cufe" solo existe en facturas electrónicas con código de verificación fiscal; si no aparece, devuelve "".
- "montoTotal" es el total final a pagar (con impuestos incluidos). Si ves varios montos candidatos,
  prioriza el que esté explícitamente etiquetado "TOTAL" (no "SUBTOTAL" ni un monto intermedio de línea).
- Verifica la aritmética cuando sea posible: subtotal + impuesto debería ≈ montoTotal. Si un valor no
  cuadra con los demás, prefiere el que sí es consistente y baja la confianza del campo dudoso.
- Para cada campo, indica tu nivel de confianza ("alta", "media", "baja") según qué tan explícito/inequívoco fue encontrarlo.

Notas específicas para facturas fiscales de Panamá (formato DGI), cuando aplique:
- El RUC panameño tiene formato "9-733-273" (solo dígitos) o "E-8-92906"/"PE-20-1234" (extranjero, con letra(s) inicial).
  El "DV" (dígito verificador) suele aparecer como campo separado junto al RUC.
- "ITBMS" es el impuesto al valor agregado panameño — equivale al campo "itbms" de esta extracción.
- "Total Neto" o "Monto Base" son sinónimos de "subtotal" (monto antes de ITBMS).
- El "CUFE" empieza con "FE" seguido de dígitos y guiones (ej. "FE0120000...").
- El número de factura puede aparecer como "N°", "N#", "Nro.", "No.", o "Número" (a veces el OCR lo
  distorsiona, ej. "N-mero").`;

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    montoTotal: { type: 'number' },
    subtotal: { type: ['number', 'null'] },
    itbms: { type: ['number', 'null'] },
    fechaEmision: { type: 'string' },
    rucProveedor: { type: 'string' },
    dv: { type: 'string' },
    nombreProveedor: { type: 'string' },
    cufe: { type: 'string' },
    numeroFactura: { type: 'string' },
    confidence: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(
        CAMPOS.map((c) => [c, { type: 'string', enum: ['alta', 'media', 'baja'] }]),
      ),
      required: CAMPOS,
    },
  },
  required: [...CAMPOS, 'confidence'],
};

interface RawExtraction {
  montoTotal: number;
  subtotal: number | null;
  itbms: number | null;
  fechaEmision: string;
  rucProveedor: string;
  dv: string;
  nombreProveedor: string;
  cufe: string;
  numeroFactura: string;
  confidence: Partial<Record<CampoFactura, CampoConfianza>>;
}

@Injectable()
export class AzureOpenAiService implements ILlmService {
  private readonly logger = new Logger(AzureOpenAiService.name);
  private readonly textClient: AzureOpenAI;
  private readonly visionClient: AzureOpenAI;
  private readonly textDeployment: string;
  private readonly visionDeployment: string;

  constructor() {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_KEY;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION;
    this.textDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_TEXT ?? '';
    this.visionDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_VISION ?? '';

    if (!endpoint || !apiKey || !apiVersion || !this.textDeployment || !this.visionDeployment) {
      throw new Error(
        'Azure OpenAI no está configurado (revisa AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, ' +
        'AZURE_OPENAI_API_VERSION, AZURE_OPENAI_DEPLOYMENT_TEXT, AZURE_OPENAI_DEPLOYMENT_VISION).',
      );
    }

    this.textClient = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment: this.textDeployment });
    this.visionClient = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment: this.visionDeployment });
  }

  async extractFromText(text: string): Promise<LlmExtractionResult> {
    return this.runExtraction(this.textClient, this.textDeployment, [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Texto extraído por OCR de una factura/recibo:\n\n${text}` },
    ]);
  }

  async extractFromHtml(html: string): Promise<LlmExtractionResult> {
    return this.runExtraction(this.textClient, this.textDeployment, [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `HTML de un portal de validación fiscal (extrae los mismos campos):\n\n${html}` },
    ]);
  }

  async extractFromImages(buffers: Buffer[]): Promise<LlmExtractionResult> {
    const content: Array<Record<string, unknown>> = [
      { type: 'text', text: 'Imágenes de una factura/recibo (puede venir en varios cortes de la misma factura):' },
      ...buffers.map((buf) => ({
        type: 'image_url',
        image_url: { url: `data:${this.detectMime(buf)};base64,${buf.toString('base64')}` },
      })),
    ];

    return this.runExtraction(this.visionClient, this.visionDeployment, [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: content as never },
    ]);
  }

  private async runExtraction(
    client: AzureOpenAI,
    deployment: string,
    messages: Array<{ role: 'system' | 'user'; content: unknown }>,
  ): Promise<LlmExtractionResult> {
    try {
      const completion = await client.chat.completions.create({
        model: deployment,
        messages: messages as never,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'invoice_extraction', strict: true, schema: RESPONSE_SCHEMA },
        },
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error('El modelo no devolvió contenido.');

      const parsed: RawExtraction = JSON.parse(raw);
      const data: FacturaProcesamientoResult = {
        montoTotal: parsed.montoTotal ?? 0,
        subtotal: parsed.subtotal ?? undefined,
        itbms: parsed.itbms ?? undefined,
        fechaEmision: parsed.fechaEmision ?? '',
        rucProveedor: parsed.rucProveedor ?? '',
        dv: parsed.dv ?? '',
        nombreProveedor: parsed.nombreProveedor ?? '',
        cufe: parsed.cufe ?? '',
        numeroFactura: parsed.numeroFactura ?? '',
      };

      return { data, confidence: parsed.confidence ?? {}, modelo: deployment };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Error en extracción LLM (deployment=${deployment}): ${msg}`);
      throw new InternalServerErrorException(`Error al extraer datos con IA: ${msg}`);
    }
  }

  private detectMime(buf: Buffer): string {
    if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
    if (buf.length >= 12 && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    return 'image/jpeg';
  }
}
