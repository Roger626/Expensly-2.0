export class FacturaProcesamientoInput {
    /** Todas las imágenes subidas (una factura puede venir en varios cortes) */
    fileBuffers?: Buffer[];
    /** Primer buffer — backward-compat para estrategias que trabajan con uno solo */
    fileBuffer?: Buffer;
    qrUrl?: string;
    /**
     * Dato QR escaneado en el cliente (Angular + zxing-wasm).
     * Si el servidor confirma el mismo valor → se omite Azure OCR (ahorro de costo).
     * Si hay discrepancia o el servidor no puede verificarlo → fallback a OCR.
     */
    clientQrData?: string;
}

export class FacturaProcesamientoResult {
    montoTotal: number;
    subtotal?: number;
    itbms?: number;
    fechaEmision: string;
    rucProveedor: string;
    dv: string;
    nombreProveedor: string;
    cufe: string;
    numeroFactura: string;
    /** Origen del dato: QR_DGI | QR_GENERICO_LLM | OCR_LLM | OCR_LLM_VISION */
    origenExtraccion?: string;
    /** Confianza por campo ('alta'|'media'|'baja'), cuando el origen es un LLM */
    confianzaExtraccion?: Record<string, string>;
    urlImagen?: string;
    /** Todas las URLs de Cloudinary (una por imagen subida) */
    imageUrls?: string[];
    imagePublicId?: string;
    /** Array con objetos de imagen para el frontend (url, publicId, orden) */
    imagenes?: { url: string; publicId: string; orden: number }[];
}       

export interface IProcesarFacturaStrategy {
    canHandle(input: FacturaProcesamientoInput): Promise<boolean>;
    processInvoice(input: FacturaProcesamientoInput): Promise<FacturaProcesamientoResult>;
}