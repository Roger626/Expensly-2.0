import { Inject, Injectable } from '@nestjs/common';
import { CreateFacturaDto, UpdateFacturaDto } from '../dto/factura.dto';
import { FacturaEntity } from '../entities/factura.entity';
import { IProcesarFacturaStrategy, FacturaProcesamientoResult, FacturaProcesamientoInput } from '../strategies/factura-procesar.strategy.interface';
import { IRegistroGastosRepository } from '../interfaces/iregistro-gastos.repository';
import { IStorageService } from 'src/infrastructure/storage/storage.interface';
import { REGISTRO_GASTOS_REPOSITORY } from '../registro-gastos.tokens';
import { STORAGE_SERVICE } from 'src/infrastructure/storage/storage.tokens';
import { Jimp } from 'jimp';
import { ProcesarFacturaQRStrategy } from '../strategies/factura-procesar-qr-strategy';


@Injectable()
export class RegistroGastosService {

    constructor(
        @Inject('FACTURA_STRATEGIES')
        private readonly strategies: IProcesarFacturaStrategy[],
        @Inject(REGISTRO_GASTOS_REPOSITORY)
        private readonly registroGastosRepository: IRegistroGastosRepository,
        @Inject(STORAGE_SERVICE)
        private readonly cloudinaryService: IStorageService,
    ){}
    

    /**
     * Recibe uno o más buffers (fotos de distintos tramos de la misma factura).
     * Las estrategias se prueban en orden: primero QR (en todas las imágenes),
     * luego OCR (texto concatenado de todas las páginas).
     * Todas las imágenes se suben a Cloudinary temp; los publicIds del
     * array se serializan en un solo string JSON para la columna imagePublicId.
     */
    async processInvoice(fileBuffers: Buffer[], clientQrData?: string): Promise<FacturaProcesamientoResult> {
        const originalBuffers = fileBuffers;

        // Downscale solo cuando NO hay un QR del cliente: si hay clientQrData la
        // estrategia QR usa el fast-path (no escanea imágenes) y si llega a OCR
        // igualmente necesitará los buffers escalados. Hacer Jimp.read() en 3
        // imágenes de alta resolución añade ~3-5s innecesarios cuando hay QR.
        const scaledBuffers = clientQrData
            ? originalBuffers
            : await this.downscaleBuffers(fileBuffers, 2400, 1000);

        for (const estrategia of this.strategies) {
            const buffersForStrategy = estrategia instanceof ProcesarFacturaQRStrategy
                ? originalBuffers   // QR necesita el máximo detalle disponible
                : scaledBuffers;    // OCR se beneficia de imágenes más livianas

            const input: FacturaProcesamientoInput = {
                fileBuffers: buffersForStrategy,
                fileBuffer:  buffersForStrategy[0], // compat con estrategias de una sola imagen
                clientQrData,                        // undefined si el cliente no mandó QR
            };

            if (await estrategia.canHandle(input)) {
                try {
                    const [resultado, { urls, publicIds }] = await Promise.all([
                        estrategia.processInvoice(input),
                        this.cloudinaryService.uploadManyToTemp(originalBuffers),
                    ]);

                    return {
                        ...resultado,
                        imagenes: urls.map((url, i) => ({ url, publicId: publicIds[i], orden: i })),
                    };
                } catch (err) {
                    // Si el QR falla (scraping timeout/DGI down), continuar con la siguiente
                    // estrategia (OCR) en vez de responder 500 para no bloquear al usuario.
                    if (estrategia instanceof ProcesarFacturaQRStrategy) {
                        console.warn('[RegistroGastosService] QR falló, haciendo fallback a OCR:', err);
                        continue;
                    }
                    throw err;
                }
            }
        }

        throw new Error("La imagen no pudo ser procesada. Intente con otra imagen o revise el formato del archivo.");
    }

    async getAllFacturas(organizacionId: string): Promise<FacturaEntity[]> {
        return await this.registroGastosRepository.getAllFacturas(organizacionId);
    }

    async getFacturasByUsuario(userId: string): Promise<FacturaEntity[]> {
        return await this.registroGastosRepository.getFacturasByUsuario(userId);
    }

    async updateFacturaMine(id: string, userId: string, dto: UpdateFacturaDto): Promise<FacturaEntity> {
        return await this.registroGastosRepository.updateFacturaMine(id, userId, dto);
    }

    async deleteFacturaMine(id: string, userId: string): Promise<boolean> {
        return await this.registroGastosRepository.deleteFacturaMine(id, userId);
    }

    async getFacturaById(id: string, organizacionId: string): Promise<FacturaEntity> {
        return await this.registroGastosRepository.getFacturaById(id, organizacionId);
    }
    
    async createFactura(organizacionId: string, usuarioId: string, dto: CreateFacturaDto): Promise<FacturaEntity>{
        let cufe = dto.cufe ? dto.cufe.trim() : "";
        //Verificar si ya existe una factura con el mismo CUFE
        const facturaExistente = await this.registroGastosRepository.invoiceExists(organizacionId, dto.numeroFactura, dto.rucProveedor, cufe);
        if(facturaExistente) throw new Error("Ya existe una factura registrada con el mismo CUFE.");

        if(!dto.categoriaId) throw new Error("Debe proporcionar una categoría para la factura.");

        // Mover las imágenes de temp a permanente (si hay)
        if (dto.imagenesFactura && dto.imagenesFactura.length > 0) {
            await Promise.all(dto.imagenesFactura.map(async (img) => {
                // makePermanent mueve el archivo y retorna la nueva URL segura
                const newUrl = await this.cloudinaryService.makePermanent(img.publicId);
                img.url = newUrl;
                // Actualizamos el publicId a la ruta definitiva según la convención de CloudinaryService
                img.publicId = img.publicId.replace('expensly/temp/', 'expensly/facturas/');
            }));
        }

        return await this.registroGastosRepository.createFactura(organizacionId, usuarioId, dto);
    }

    async updateFactura(id: string, organizacionId: string, dto: UpdateFacturaDto): Promise<FacturaEntity> {
        if (dto.estado === 'RECHAZADO' && !dto.motivoRechazo) {
            throw new Error('Debe proporcionar un motivo de rechazo al rechazar una factura.');
        }
        return await this.registroGastosRepository.updateFactura(id, dto, organizacionId);
    }

    async deleteFactura(id: string, organizacionId: string): Promise<boolean> {
        return await this.registroGastosRepository.deleteFactura(id, organizacionId);
    }

    async getDashboardResumen(
        orgId: string,
        start: string,
        end: string,
        catId?: string,
        empId?: string,
    ): Promise<any> {
        return await this.registroGastosRepository.getDashboardResumen(
            orgId,
            new Date(start),
            new Date(end),
            catId,
            empId,
        );
    }

    async getDashboardTendencia(
        orgId: string,
        catId?: string,
        empId?: string,
    ): Promise<any> {
        return await this.registroGastosRepository.getDashboardTendencia(orgId, catId, empId);
    }

    async getDashboardCategorias(
        orgId: string,
        start: string,
        end: string,
        empId?: string,
    ): Promise<any> {
        return await this.registroGastosRepository.getDashboardCategorias(
            orgId,
            new Date(start),
            new Date(end),
            empId,
        );
    }

    /**
     * Redimensiona cada buffer al vuelo si su lado más largo supera `maxPx` **y**
     * el lado corto sigue siendo suficientemente ancho (>= minShort).
     * Evita empequeñecer facturas muy estrechas y largas donde el QR queda ilegible.
     * Formato de salida: JPEG 90 % — más ligero que PNG y suficiente para OCR/QR.
     */
    private async downscaleBuffers(buffers: Buffer[], maxPx: number, minShort: number): Promise<Buffer[]> {
        return Promise.all(buffers.map(async (buf, i) => {
            try {
                const image = await Jimp.read(buf);
                const longest  = Math.max(image.width, image.height);
                const shortest = Math.min(image.width, image.height);

                // No reducir si ya está dentro de tamaño o si el lado corto es pequeño
                if (longest <= maxPx || shortest <= minShort) {
                    console.log(`[Downscale] Imagen ${i + 1}: ${image.width}x${image.height} — sin cambios (long=${longest}, short=${shortest}).`);
                    return buf;
                }

                const scale = maxPx / longest;
                const newW   = Math.round(image.width  * scale);
                const newH   = Math.round(image.height * scale);
                const origW  = image.width;
                const origH  = image.height;

                image.resize({ w: newW, h: newH });
                const scaled = await image.getBuffer('image/jpeg', { quality: 90 });
                console.log(`[Downscale] Imagen ${i + 1}: ${origW}x${origH} → ${newW}x${newH} (escala ${(scale * 100).toFixed(0)}%)`);
                return scaled;
            } catch (err) {
                console.warn(`[Downscale] No se pudo escalar la imagen ${i + 1}:`, err);
                return buf;               // si falla, devolver original sin bloquear
            }
        }));
    }
}