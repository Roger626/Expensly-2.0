import { IProcesarFacturaStrategy } from "./factura-procesar.strategy.interface";
import { FacturaProcesamientoResult, FacturaProcesamientoInput} from "./factura-procesar.strategy.interface";
import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { Jimp } from 'jimp';
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as nodePath from 'path';
import { ILlmService } from '../../../infrastructure/llm/illm.service';
import { LLM_SERVICE } from '../../../infrastructure/llm/llm.tokens';
import { reconcileInvoiceTotals } from '../utils/invoice-math.util';
import { promises as dns } from 'dns';
import * as net from 'net';

const QR_FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-PA,es;q=0.9',
};

// ─── Dominios con scraper determinístico dedicado ─────────────────────────────
// Solo decide qué RUTA de extracción usar (scraper cheerio vs. fallback
// genérico vía LLM) — NO es la defensa de seguridad contra SSRF. Esa vive en
// assertPublicHost() de abajo, que bloquea IPs privadas/internas sin importar
// el dominio, porque el fallback genérico (fase 2) necesita poder aceptar
// CUALQUIER portal fiscal público, no solo uno hardcodeado.
// El dominio real que usan los QR de facturas emitidas en producción es
// "dgi-fep.mef.gob.pa" (sin subdominio "efact."). Se mantiene también la
// variante "efact.dgi-fep.mef.gob.pa" por si el ambiente de pruebas/otro
// flujo de la DGI la usa, pero la real observada en QRs de clientes es la
// primera — confirmarlo mal aquí manda TODAS las facturas panameñas al
// fallback genérico (fetch + LLM), mucho más lento que el scraper dedicado.
export const QR_TRUSTED_DOMAINS = ['dgi-fep.mef.gob.pa', 'efact.dgi-fep.mef.gob.pa'];

/** Parsea la URL del QR y valida que sea http(s); devuelve null si no es una URL válida/fetcheable. */
function parseHttpUrl(url: string): URL | null {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null;
    } catch {
        return null;
    }
}

// ─── Defensa SSRF: bloquear IPs privadas/internas/metadata ───────────────────
// Se aplica a CUALQUIER URL antes de axios.get(), sin importar si viene de
// clientQrData (no verificado) o del escaneo server-side. No basta con una
// allowlist de dominios porque el fallback genérico (Fase 2) debe poder
// aceptar portales fiscales de cualquier país; en cambio, ninguna factura
// legítima apunta jamás a una IP privada, loopback o de metadata de nube.
const PRIVATE_IPV4_RANGES: Array<[string, number]> = [
    ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
    ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
    ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4],
];

function ipv4ToInt(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
    const ipInt = ipv4ToInt(ip);
    return PRIVATE_IPV4_RANGES.some(([base, bits]) => {
        const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
        return (ipInt & mask) === (ipv4ToInt(base) & mask);
    });
}

function isPrivateIPv6(ip: string): boolean {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;                    // loopback / unspecified
    if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;                     // fe80::/10 link-local
    if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;                     // fc00::/7 unique local
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);           // ::ffff:a.b.c.d
    if (mapped) return isPrivateIPv4(mapped[1]);
    return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
    if (net.isIP(hostname)) {
        const blocked = net.isIPv4(hostname) ? isPrivateIPv4(hostname) : isPrivateIPv6(hostname);
        if (blocked) throw new Error(`Host bloqueado (IP privada/interna): ${hostname}`);
        return;
    }
    const addresses = await dns.lookup(hostname, { all: true });
    for (const { address, family } of addresses) {
        const blocked = family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
        if (blocked) throw new Error(`Host bloqueado (resuelve a IP privada/interna): ${hostname} -> ${address}`);
    }
}

// ─── Inicialización WASM (una sola vez al cargar el módulo) ──────────────────
// NestJS compila a CommonJS. zxing-wasm usa import.meta.url (ESM) para localizar
// el .wasm → falla silenciosamente en CJS. La solución fiable es leer el binario
// con fs.readFileSync y pasarlo como wasmBinary, bypaseando toda resolución de URL.
// Guardamos la promesa de inicialización para esperar antes de cada decode.
const moduleLogger = new Logger('ZXing');
const wasmReady: Promise<unknown> = (() => {
    try {
        const wasmPath = nodePath.join(
            process.cwd(), 'node_modules', 'zxing-wasm', 'dist', 'reader', 'zxing_reader.wasm',
        );
        const nodeBuf = fs.readFileSync(wasmPath);
        const wasmBinary = nodeBuf.buffer.slice(
            nodeBuf.byteOffset,
            nodeBuf.byteOffset + nodeBuf.byteLength,
        ) as ArrayBuffer;
        const p = prepareZXingModule({ overrides: { wasmBinary }, fireImmediately: true });
        moduleLogger.log('WASM cargado desde: ' + wasmPath);
        return Promise.resolve(p);
    } catch (e) {
        moduleLogger.error('No se pudo cargar el WASM: ' + e);
        return Promise.resolve();
    }
})();

@Injectable()
export class ProcesarFacturaQRStrategy implements IProcesarFacturaStrategy {
    private readonly logger = new Logger(ProcesarFacturaQRStrategy.name);

    constructor(
        @Inject(LLM_SERVICE)
        private readonly llmService: ILlmService,
    ) {}

    /**
     * a) El cliente envía `clientQrData` (escaneado con zxing-wasm en el browser):
     *    se confía en el valor directamente (fast path, sin re-escanear). La
     *    seguridad no depende de re-verificar la imagen — vive en
     *    processInvoice() (assertPublicHost bloquea IPs privadas/internas
     *    antes de cualquier fetch), así que confiar aquí es seguro y evita
     *    pagar el costo del pipeline completo (P1-P8) por cada imagen.
     *
     * b) El cliente NO envía `clientQrData`:
     *    el servidor escanea todas las imágenes en paralelo (pipeline
     *    completo P1-P8 cada una); gana la primera que decodifique un QR.
     */
    async canHandle(input: FacturaProcesamientoInput): Promise<boolean> {
        const buffers = input.fileBuffers ?? (input.fileBuffer ? [input.fileBuffer] : []);
        if (buffers.length === 0) return false;

        // ── Fast path: el cliente ya escaneó el QR (zxing-wasm en el browser) ──
        // Se confía en el valor directamente — no se vuelve a escanear la(s)
        // imagen(es) porque re-verificar con un pipeline reducido es poco
        // fiable (P1 solo decodifica QR grandes/nítidos; casi cualquier foto
        // real necesita los recortes/upscale P2-P8 para decodificar, igual que
        // el flujo estándar de abajo) y re-verificar con el pipeline COMPLETO
        // en las N imágenes anula el ahorro de tiempo que este fast-path existe
        // para dar. La defensa contra SSRF no depende de esto — vive en
        // processInvoice() (allowlist de dominio + bloqueo de IPs privadas
        // antes de cualquier fetch), así que es segura sin re-escanear.
        if (input.clientQrData) {
            input.qrUrl = input.clientQrData;
            this.logger.log(`QR recibido del cliente (sin re-escaneo): ${input.clientQrData}`);
            return true;
        }

        // ── Flujo estándar: el cliente no envió QR → escanear server-side ──────
        // Se corre en paralelo sobre todas las imágenes: la primera que
        // decodifique un QR gana. Antes era secuencial (imagen por imagen),
        // lo que en uploads de muchas fotos podía tardar más de un minuto.
        const resultados = await Promise.all(
            buffers.map((buffer, i) =>
                this.tryScanBuffer(buffer, i + 1).catch((err) => {
                    this.logger.error(`Error al escanear imagen ${i + 1}: ${err}`);
                    return null;
                }),
            ),
        );

        const encontrado = resultados.find((r): r is string => Boolean(r));
        if (encontrado) {
            input.qrUrl = encontrado;
            this.logger.log(`QR detectado (flujo estándar): ${encontrado}`);
            return true;
        }

        this.logger.log(`No se detectó QR en ninguna de las ${buffers.length} imágenes.`);
        return false;
    }

    /**
     * Pipeline de detección para un buffer:
     *
     * P1. Bytes originales del archivo (JPEG/PNG) — ZXing los decodifica internamente.
     *     Máxima calidad sin ninguna pérdida por re-encoding.
     *
     * P2–P5. Recortes progresivos de la zona inferior (QR siempre al pie del ticket):
     *     50% inferior · 35% inferior · 25% inferior · 15% inferior
     *     Cada recorte se procesa con greyscale + contraste alto antes del scan.
     *
    * P6. Recorte cuadrado centrado en el pie (zona del QR), con normalize() + contraste.

    * P7. Imagen completa binarizada con umbral adaptativo para tickets sobreexpuestos.

    * P8. Recorte 25% inferior, imagen invertida (QR claro sobre fondo oscuro).
     *
     * Para cada recorte se usan dos tamaños: nativo y ×2 (la mayoría de los escáneres
     * WASM requieren ≥ 100 px de lado de módulo para decodificar correctamente fotos).
     */
    private async tryScanBuffer(buffer: Buffer, imgNum: number): Promise<string | null> {
        // ── Pass 1: archivo original sin tocar ────────────────────────────────
        const r1 = await this.zxingScan(new Uint8Array(buffer));
        if (r1) { this.logger.log(`[QRStrategy] img ${imgNum} P1 (original)`); return r1; }

        // ── Cargar con Jimp para los recortes ─────────────────────────────────
        const image = await Jimp.read(buffer);
        const { width: w, height: h } = image;

        // ── Estrategia de recortes: bottom %, con y sin upscale ───────────────
        const crops: Array<{ yFrac: number; hFrac: number; label: string }> = [
            { yFrac: 0.50, hFrac: 0.50, label: '50% inf' },
            { yFrac: 0.65, hFrac: 0.35, label: '35% inf' },
            { yFrac: 0.75, hFrac: 0.25, label: '25% inf' },
            { yFrac: 0.85, hFrac: 0.15, label: '15% inf' },
        ];

        for (const { yFrac, hFrac, label } of crops) {
            const cropH = Math.max(Math.floor(h * hFrac), 1);
            const cropY = Math.floor(h * yFrac);

            // greyscale + contraste agresivo — ZXing HybridBinarizer trabaja mejor con
            // imágenes de alto contraste; reduce el ruido de papel mal iluminado
            const base = image.clone()
                .crop({ x: 0, y: cropY, w, h: cropH })
                .greyscale()
                .contrast(0.8);

            const bufNative = await base.getBuffer('image/png');
            const rx = await this.zxingScan(new Uint8Array(bufNative));
            if (rx) { this.logger.log(`[QRStrategy] img ${imgNum} recorte ${label} (nativo)`); return rx; }

            // Upscale ×2 — mínimo recomendado para decodificar QR en fotos de teléfono
            // donde el módulo del QR es < 10 px después del downscale inicial a 2000px
            if (cropH < 800) {
                const upscaled = base.clone().resize({ w: Math.min(w * 2, 3000), h: cropH * 2 });
                const bufUp = await upscaled.getBuffer('image/png');
                const ry = await this.zxingScan(new Uint8Array(bufUp));
                if (ry) { this.logger.log(`[QRStrategy] img ${imgNum} recorte ${label} (×2)`); return ry; }
            }
        }

        // ── Pass 6: recorte cuadrado centrado en el pie (zona QR), normalize+contraste ──
        const squareSize = Math.min(w, Math.max(Math.floor(h * 0.45), 500));
        const cropY6 = Math.max(0, h - squareSize);
        const cropX6 = Math.max(0, Math.floor((w - squareSize) / 2));
        const focused = image.clone()
            .crop({ x: cropX6, y: cropY6, w: squareSize, h: squareSize })
            .greyscale()
            .normalize()   // estira histograma, útil con sombras en el QR
            .contrast(0.9);

        const bufFocus = await focused.getBuffer('image/png');
        const r6 = await this.zxingScan(new Uint8Array(bufFocus));
        if (r6) { this.logger.log(`[QRStrategy] img ${imgNum} P6 (cuadrado QR)`); return r6; }

        // Upscale del recorte si quedó chico (< 1200px)
        if (squareSize < 1200) {
            const up = focused.clone().resize({ w: squareSize * 2, h: squareSize * 2 });
            const bufUp = await up.getBuffer('image/png');
            const r6b = await this.zxingScan(new Uint8Array(bufUp));
            if (r6b) { this.logger.log(`[QRStrategy] img ${imgNum} P6b (cuadrado QR ×2)`); return r6b; }
        }

        // ── Pass 7: imagen completa binarizada (tickets sobre/sub-expuestos) ──
        const binarized = image.clone().greyscale().threshold({ max: 128 });
        const bufBin = await binarized.getBuffer('image/png');
        const r7 = await this.zxingScan(new Uint8Array(bufBin));
        if (r7) { this.logger.log(`[QRStrategy] img ${imgNum} P7 (binarizado)`); return r7; }

        // ── Pass 8: 25% inferior invertido (QR blanco sobre fondo negro) ──────
        const cropY8 = Math.floor(h * 0.75);
        const inverted = image.clone()
            .crop({ x: 0, y: cropY8, w, h: h - cropY8 })
            .greyscale()
            .invert();
        const bufInv = await inverted.getBuffer('image/png');
        const r8 = await this.zxingScan(new Uint8Array(bufInv));
        if (r8) { this.logger.log(`[QRStrategy] img ${imgNum} P8 (invertido)`); return r8; }

        return null;
    }

    /**
     * Llama a readBarcodes con los bytes de imagen (JPEG/PNG/PNG-procesado).
     * La API v2 de zxing-wasm acepta Uint8Array directamente — decodifica
     * el formato internamente, sin pasar por DOM ni Blob.
     */
    private async zxingScan(input: Uint8Array): Promise<string | null> {
        try {
            await wasmReady; // asegurar que el módulo WASM está listo
            const results = await readBarcodes(input, {
                formats: ['QRCode'],
                tryHarder: true,   // búsqueda exhaustiva: más lenta pero detecta QR en fotos
                tryRotate: true,   // rota la imagen si el QR no está alineado
                tryInvert: true,   // intenta invertir si el fondo es más oscuro que el código
            });
            const text = results?.[0]?.text?.trim() ?? null;
            return text && text.length > 5 ? text : null;
        } catch {
            return null; // no debe bloquear el pipeline si un pass falla
        }
    }

    /**
     * Punto de entrada: valida que el QR sea una URL http(s) real (defensa
     * SSRF — nunca se hace fetch de algo que no sea una URL bien formada) y
     * bifurca según el dominio:
     *   - Dominio en la allowlist (portal fiscal conocido, hoy solo DGI
     *     Panamá) → scraper cheerio determinístico, gratis y ya probado.
     *   - Cualquier otro dominio → se trae el HTML igual (mismos headers/
     *     timeout) pero se delega el entendimiento del layout a
     *     `LLM_SERVICE.extractFromHtml()`, para soportar portales fiscales
     *     de otros países sin escribir un scraper nuevo por cada uno.
     */
    async processInvoice(input: FacturaProcesamientoInput): Promise<FacturaProcesamientoResult> {
        const url = input.qrUrl;
        if (!url) throw new BadRequestException('No se encontró un código QR válido en la imagen.');

        const parsed = parseHttpUrl(url);
        if (!parsed) {
            throw new BadRequestException('El código QR no contiene una URL válida.');
        }

        try {
            await assertPublicHost(parsed.hostname);
        } catch (err: any) {
            this.logger.warn(`URL de QR bloqueada por seguridad: ${err.message}`);
            throw new BadRequestException('El código QR no corresponde a un host válido.');
        }

        if (QR_TRUSTED_DOMAINS.includes(parsed.hostname)) {
            return this.scrapeDgiPanama(url);
        }

        this.logger.log(`Dominio de QR no reconocido (${parsed.hostname}) — usando fallback genérico vía LLM.`);
        return this.genericHtmlExtraction(url);
    }

    /** Fallback genérico: trae el HTML de cualquier portal fiscal desconocido y deja que el LLM lo interprete. */
    private async genericHtmlExtraction(url: string): Promise<FacturaProcesamientoResult> {
        try {
            const { data } = await axios.get(url, { timeout: 8000, headers: QR_FETCH_HEADERS });
            const html = typeof data === 'string' ? data : JSON.stringify(data);
            const extraction = await this.llmService.extractFromHtml(this.stripHtmlNoise(html));
            return {
                ...extraction.data,
                origenExtraccion: 'QR_GENERICO_LLM',
                confianzaExtraccion: extraction.confidence,
            };
        } catch (error: any) {
            this.logger.error(`Error en fallback genérico (LLM sobre HTML): ${error.message}`);
            throw new InternalServerErrorException(`Error al procesar la factura desde QR: ${error.message}`);
        }
    }

    /**
     * Los portales gubernamentales suelen incluir mucho <script>/<style>/boilerplate
     * que no aporta nada a la extracción y solo infla tokens (más costo y latencia
     * en la llamada al LLM). Se queda solo con el <body>, sin scripts/estilos/comentarios.
     */
    private stripHtmlNoise(html: string): string {
        const $ = cheerio.load(html);
        $('script, style, noscript, svg, img, link, meta').remove();
        const cleaned = $('body').html() ?? html;
        return cleaned.replace(/\s{2,}/g, ' ').trim().slice(0, 40_000);
    }

    /** Scraping del portal DGI Panamá (efact.dgi-fep.mef.gob.pa) */
    private async scrapeDgiPanama(url: string): Promise<FacturaProcesamientoResult> {
        try {
            const { data } = await axios.get(url, { timeout: 8000, headers: QR_FETCH_HEADERS });

            const $ = cheerio.load(data);

            // __ Helpers ──────────────────────────────────────────────────────────
            // Busca el texto de un <dd> cuyo <dt> hermano contiene la etiqueta
            const findField = (label: string): string =>
                $(`dt, th, td, label, strong, b`)
                    .filter((_, el) => $(el).text().trim().toUpperCase().includes(label.toUpperCase()))
                    .first()
                    .nextAll('dd, td')
                    .first()
                    .text()
                    .trim();

            // Extrae número decimal de un string ("B/. 6.21" → 6.21)
            const parseAmount = (raw: string): number =>
                parseFloat(raw.replace(/[^\d.]/g, '')) || 0;

            // Convierte "14/noviembre/2025" o "14/11/2025" a "2025-11-14"
            const normalizeFecha = (raw: string): string => {
                if (!raw) return '';
                const meses: Record<string, string> = {
                    'enero':'01','febrero':'02','marzo':'03','abril':'04',
                    'mayo':'05','junio':'06','julio':'07','agosto':'08',
                    'septiembre':'09','octubre':'10','noviembre':'11','diciembre':'12',
                };
                // DD/mes_escrito/YYYY
                const ml = raw.match(/(\d{1,2})\/(\w+)\/(\d{4})/);
                if (ml) {
                    const d = ml[1].padStart(2, '0');
                    const m = meses[ml[2].toLowerCase()] ?? ml[2].padStart(2, '0');
                    return `${ml[3]}-${m}-${d}`;
                }
                // DD/MM/YYYY
                const mn = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                if (mn) return `${mn[3]}-${mn[2].padStart(2,'0')}-${mn[1].padStart(2,'0')}`;
                return raw;
            };

            // ── Campos del EMISOR ────────────────────────────────────────────────
            // El portal repite los mismos labels (RUC, DV, NOMBRE) para EMISOR y
            // RECEPTOR en paneles separados. findField() global toma el primero
            // que aparece en el documento — que hoy es el EMISOR porque su panel
            // va antes que el de RECEPTOR — pero es frágil ante cualquier cambio
            // de orden. Se busca explícitamente el panel cuyo encabezado dice
            // "EMISOR" y se restringe la búsqueda a ese panel específico.
            const emisorPanel = $('.panel-heading')
                .filter((_, el) => $(el).text().trim().toUpperCase() === 'EMISOR')
                .closest('.panel');

            const findFieldIn = ($scope: ReturnType<typeof $>, label: string): string =>
                $scope
                    .find('dt, th, td, label, strong, b')
                    .filter((_, el) => $(el).text().trim().toUpperCase().includes(label.toUpperCase()))
                    .first()
                    .nextAll('dd, td')
                    .first()
                    .text()
                    .trim();

            const scope = emisorPanel.length ? emisorPanel : $.root();

            const rucRaw = findFieldIn(scope, 'RUC') || $('[class*="ruc"]').first().text().trim();
            const dvRaw  = findFieldIn(scope, 'DV')  || '';

            const nombreCandidato =
                findFieldIn(scope, 'NOMBRE') ||
                findFieldIn(scope, 'RAZON SOCIAL') ||
                findFieldIn(scope, 'RAZON') ||
                $('[class*="emisor"], [class*="nombre"], [class*="razon"]').first().text().trim();

            // Descartar si el candidato parece ser el tipo de documento
            const esNombreDocumento = /factura|comprobante|operaci[oó]n|documento/i.test(nombreCandidato);
            const nombreProveedor = esNombreDocumento ? '' : nombreCandidato;

            // Número de factura — el portal suele mostrarlo como "N# 013084019" o "No. 013084019"
            const facturaRaw = $('h4, h5, .panel-title, [class*="factura"], [class*="invoice"]')
                .filter((_, el) => /N[#°o]/.test($(el).text()))
                .first()
                .text()
                .trim();
            const numeroFactura = facturaRaw.replace(/.*?N[#°o\.\s]+/i, '').trim() || findField('FACTURA');

            // Fecha de emisión — normalizada a YYYY-MM-DD.
            // Prioridad al <h5> del encabezado (fecha de EMISIÓN real, siempre
            // presente en facturas electrónicas) sobre findField('FECHA'), que
            // puede matchear "FECHA AUTORIZACIÓN" (fecha en que la DGI autorizó
            // el documento — normalmente igual, pero no siempre — a la emisión).
            const fechaHeaderRaw = $('.panel-heading .text-right h5').first().text().trim();
            const fechaRaw = fechaHeaderRaw ||
                findField('FECHA EMISIÓN') ||
                findField('FECHA') ||
                $('[class*="fecha"]').first().text().trim();
            const fechaEmision = normalizeFecha(fechaRaw);

            // ── Totales ──────────────────────────────────────────────────────────
            // Hallazgo confirmado con un HTML real: el portal DGI llama
            // "Valor Total" al TOTAL FINAL (con ITBMS incluido), a pesar de que
            // el nombre suena a subtotal. Se verifica con la aritmética del
            // propio documento: Valor Total = Σ(Monto por línea) + ITBMS Total.
            // El portal NUNCA expone un campo "Subtotal" explícito — se deriva
            // como montoTotal - itbms, usando los dos totales que el portal SÍ
            // calcula y muestra (más confiable que re-sumar cada línea de la
            // tabla, cuyas columnas varían entre tipos de documento).
            let valorTotalRaw = '';
            let itbmsTotalRaw = '';
            $('tfoot tr').each((_, tr) => {
                const td = $(tr).find('td');
                const cellText = td.text();
                if (/valor total/i.test(cellText)) {
                    valorTotalRaw = td.find('div').first().text().trim();
                } else if (/itbms total/i.test(cellText)) {
                    itbmsTotalRaw = td.find('div').first().text().trim();
                }
            });
            if (!itbmsTotalRaw) itbmsTotalRaw = findField('ITBMS');

            const itbms = parseAmount(itbmsTotalRaw);

            let montoTotal: number;
            let subtotal: number | undefined;

            if (valorTotalRaw) {
                montoTotal = parseAmount(valorTotalRaw);
                subtotal = montoTotal > itbms ? +(montoTotal - itbms).toFixed(2) : undefined;
            } else {
                // Layout sin <tfoot> reconocible (otro tipo de documento, ej.
                // Comprobante Auxiliar): un campo "SUBTOTAL" explícito (si
                // existe) sí puede usarse como subtotal; un campo "TOTAL"
                // NUNCA se asigna a subtotal — es el total final. Si no hay
                // desglose en absoluto, reconcileInvoiceTotals deriva el
                // subtotal después a partir de montoTotal - itbms.
                const explicitSubtotalRaw = findField('SUBTOTAL');
                const explicitTotalRaw = findField('TOTAL');
                subtotal   = explicitSubtotalRaw ? parseAmount(explicitSubtotalRaw) : undefined;
                montoTotal = explicitTotalRaw ? parseAmount(explicitTotalRaw) : 0;
            }

            // CUFE: el portal lo muestra explícitamente
            const cufe = findField('CUFE') ||
                $('[class*="cufe"]').first().text().trim() ||
                // fallback: regex sobre el HTML completo
                (data.match(/FE[0-9A-Za-z\-]{30,}/) ?? [''])[0];

            const scraped: FacturaProcesamientoResult = reconcileInvoiceTotals({
                subtotal,
                montoTotal,
                itbms,
                fechaEmision,
                rucProveedor:    rucRaw,
                dv:              dvRaw,
                nombreProveedor: nombreProveedor,
                cufe,
                numeroFactura,
                origenExtraccion: 'QR_DGI',
            });

            // ── Validación cruzada con LLM ──────────────────────────────────────
            // Los selectores de arriba están hardcodeados contra un layout
            // específico del portal DGI; si ese layout cambia (o el HTML de
            // esta factura difiere), el scraper puede devolver campos vacíos
            // O — peor — campos con VALORES en la etiqueta equivocada (ej. el
            // total leído como subtotal), sin lanzar ningún error. En vez de
            // confiar ciegamente, se valida que el resultado esté completo Y
            // sea aritméticamente plausible; si no, se re-interpreta el MISMO
            // HTML ya descargado (sin otro fetch) con el LLM, más robusto a
            // cambios de layout aunque más lento. Así la mayoría de los casos
            // (layout sin cambios) siguen siendo instantáneos, y solo se paga
            // el costo del LLM cuando el scraper realmente falla.
            if (this.isScraperResultIncomplete(scraped)) {
                this.logger.warn('Scraper DGI devolvió datos incompletos — validando con LLM sobre el mismo HTML.');
                try {
                    const extraction = await this.llmService.extractFromHtml(this.stripHtmlNoise(data));
                    return {
                        ...extraction.data,
                        origenExtraccion: 'QR_DGI_LLM_FALLBACK',
                        confianzaExtraccion: extraction.confidence,
                    };
                } catch (llmErr) {
                    this.logger.warn(`Fallback LLM también falló, se devuelve el resultado parcial del scraper: ${llmErr}`);
                    return scraped;
                }
            }

            return scraped;

        } catch (error: any) {
            this.logger.error(`Error en scraping DGI: ${error.message}`);
            throw new InternalServerErrorException(`Error al procesar la factura desde QR: ${error.message}`);
        }
    }

    /**
     * Detecta tanto campos faltantes como valores IMPLAUSIBLES (ej. total y
     * subtotal invertidos), que es el caso más peligroso porque el scraper
     * no lanza ningún error — solo produce un número con la etiqueta
     * equivocada. El ITBMS en Panamá es 7% estándar (hasta 15% en pocos
     * casos); si el impuesto resulta ser una fracción absurda del subtotal,
     * es señal de que los campos están mal mapeados.
     */
    private isScraperResultIncomplete(result: FacturaProcesamientoResult): boolean {
        if (
            !result.rucProveedor ||
            !result.nombreProveedor ||
            !result.numeroFactura ||
            !result.montoTotal ||
            result.montoTotal <= 0
        ) {
            return true;
        }

        if (result.subtotal !== undefined) {
            // El subtotal nunca debería ser mayor que el total.
            if (result.subtotal > result.montoTotal) return true;

            const itbms = result.itbms ?? 0;
            // ITBMS fuera de un rango razonable (0%-20%) respecto al subtotal
            // sugiere que "subtotal" en realidad contiene el total (u otro
            // campo mal mapeado).
            if (result.subtotal > 0 && itbms / result.subtotal > 0.20) return true;
        }

        return false;
    }
}