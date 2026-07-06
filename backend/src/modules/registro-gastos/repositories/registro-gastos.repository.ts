import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IRegistroGastosRepository } from '../interfaces/iregistro-gastos.repository';
import type { facturas } from '../../../../generated/prisma/client';
import { CreateFacturaDto, UpdateFacturaDto } from '../dto/factura.dto';
import { FacturaEntity } from '../entities/factura.entity';

@Injectable()
export class RegistroGastosRepository implements IRegistroGastosRepository {
    constructor(private readonly prisma: PrismaService) {}

    // Definimos las relaciones en un solo lugar para evitar duplicación
    private readonly includeRelations = {
        categorias: true,
        imagenes: {
            orderBy: {
                orden: 'asc',
            },
        },
        usuarios: {
            select: {
                id: true,
                nombre_completo: true,
                email: true,
            },
        },
        organizaciones: {
            select: {
                id: true,
                razon_social: true,
                ruc: true,
            },
        },
        factura_tags: {
            include: {
                tags: true,
            },
        },
    } as const;

    // ==================== Operaciones de Lectura ====================

    async getAllFacturas(organizacionId: string): Promise<FacturaEntity[]> {
        const facturas = await this.prisma.facturas.findMany({
            where:   { organizacion_id: organizacionId },
            include: this.includeRelations,
            orderBy: { fecha_subida: 'desc' },
        });
        return facturas.map((factura) => new FacturaEntity(factura as any));
    }

    async getFacturaById(id: string, organizacionId: string): Promise<FacturaEntity> {
        const factura = await this.prisma.facturas.findFirst({
            where:   { id, organizacion_id: organizacionId },
            include: this.includeRelations,
        });

        if (!factura) {
            throw new NotFoundException(`Factura con ID ${id} no encontrada o no pertenece a tu organización`);
        }

        return new FacturaEntity(factura as any);
    }

    async getFacturasByUsuario(userId: string): Promise<FacturaEntity[]> {
        const facturas = await this.prisma.facturas.findMany({
            where: { usuario_id: userId },
            include: this.includeRelations,
            orderBy: { fecha_subida: 'desc' },
        });
        return facturas.map((f) => new FacturaEntity(f as any));
    }

    // ==================== Operaciones de Creación ====================

    async createFactura(organizacionId: string, usuarioId: string, dto: CreateFacturaDto): Promise<FacturaEntity> {
        const factura = await this.prisma.facturas.create({
            data: {
                organizacion_id: organizacionId,
                usuario_id: usuarioId,
                categoria_id: dto.categoriaId,
                monto_total: dto.monto,
                subtotal: dto.subtotal ?? null,
                itbms: dto.impuesto ?? 0,
                fecha_emision: new Date(dto.fechaEmision),
                ruc_proveedor: dto.rucProveedor,
                dv_proveedor: dto.dvProveedor ?? null,
                nombre_proveedor: dto.nombreProveedor,
                numero_factura: dto.numeroFactura,
                cufe: dto.cufe,
                estado: 'PENDIENTE',
                factura_tags: dto.facturaTags && dto.facturaTags.length > 0
                    ? {
                        create: dto.facturaTags.map((tagId) => ({
                            tags: { connect: { id: tagId } }
                        })),
                    }
                    : undefined,
                imagenes: {
                    create: dto.imagenesFactura.map((img, index) => ({
                        url: img.url,
                        imagePublicId: img.publicId,
                        orden: index
                    }))
                }
            },
            include: this.includeRelations,
        });

        return new FacturaEntity(factura as any);
    }

    // ==================== Operaciones de Actualización ====================

    async updateFactura(id: string, dto: UpdateFacturaDto, organizacionId: string): Promise<FacturaEntity> {
        // Verificar propiedad antes de actualizar
        const existing = await this.prisma.facturas.findFirst({
            where: { id, organizacion_id: organizacionId },
        });
        if (!existing) {
            throw new NotFoundException(`Factura con ID ${id} no encontrada o no pertenece a tu organización`);
        }

        // Construir el objeto de actualización dinámicamente
        const updateData: any = {};

        if (dto.categoriaId !== undefined) updateData.categoria_id = dto.categoriaId;
        if (dto.monto !== undefined) updateData.monto_total = dto.monto;
        if (dto.subtotal !== undefined) updateData.subtotal = dto.subtotal;
        if (dto.impuesto !== undefined) updateData.itbms = dto.impuesto;
        if (dto.fechaEmision !== undefined) updateData.fecha_emision = new Date(dto.fechaEmision);
        if (dto.rucProveedor !== undefined) updateData.ruc_proveedor = dto.rucProveedor;
        if (dto.dvProveedor !== undefined) updateData.dv_proveedor = dto.dvProveedor;
        if (dto.nombreProveedor !== undefined) updateData.nombre_proveedor = dto.nombreProveedor;
        if (dto.numeroFactura !== undefined) updateData.numero_factura = dto.numeroFactura;
        if (dto.cufe !== undefined) updateData.cufe = dto.cufe;
        if (dto.imagenesFactura !== undefined && dto.imagenesFactura.length > 0) {
            updateData.imagenes = {
                deleteMany: {},
                create: dto.imagenesFactura.map((img, index) => ({
                    url: img.url,
                    imagePublicId: img.publicId,
                    orden: index
                }))
            };
        }
        if (dto.estado !== undefined) updateData.estado = dto.estado;
        if (dto.motivoRechazo !== undefined) updateData.motivo_rechazo = dto.motivoRechazo;

        // Actualización atómica de tags usando nested writes
        if (dto.facturaTags !== undefined && dto.facturaTags !== null) {
            updateData.factura_tags = {
                deleteMany: {}, // Borra todos los tags actuales
                create: dto.facturaTags.map((tagId) => ({ tag_id: tagId })), // Crea los nuevos
            };
        }

        // Actualizar factura con todas las relaciones en una sola operación
        const factura = await this.prisma.facturas.update({
            where: { id },
            data: updateData,
            include: this.includeRelations,
        });

        return new FacturaEntity(factura as any);
    }

    async updateFacturaMine(id: string, userId: string, dto: UpdateFacturaDto): Promise<FacturaEntity> {
        const factura = await this.prisma.facturas.findUnique({ where: { id } });
        if (!factura) throw new NotFoundException(`Factura con ID ${id} no encontrada`);
        if (factura.usuario_id !== userId) throw new NotFoundException(`No tienes permiso sobre esta factura`);
        if (factura.estado !== 'PENDIENTE') throw new Error('Solo puedes editar facturas en estado PENDIENTE');

        const { estado: _e, motivoRechazo: _m, ...allowedDto } = dto as any;
        // Pasar el org de la factura existente para que updateFactura no rechace la operación
        return this.updateFactura(id, allowedDto, factura.organizacion_id);
    }

    async deleteFacturaMine(id: string, userId: string): Promise<boolean> {
        const factura = await this.prisma.facturas.findUnique({ where: { id } });
        if (!factura) throw new NotFoundException(`Factura con ID ${id} no encontrada`);
        if (factura.usuario_id !== userId) throw new NotFoundException(`No tienes permiso sobre esta factura`);
        if (factura.estado !== 'PENDIENTE') throw new Error('Solo puedes eliminar facturas en estado PENDIENTE');
        return this.deleteFactura(id, factura.organizacion_id);
    }

    // ==================== Operaciones de Eliminación ====================

    async deleteFactura(id: string, organizacionId: string): Promise<boolean> {
        const existing = await this.prisma.facturas.findFirst({
            where: { id, organizacion_id: organizacionId },
        });
        if (!existing) {
            throw new NotFoundException(`Factura con ID ${id} no encontrada o no pertenece a tu organización`);
        }
        try {
            await this.prisma.facturas.delete({ where: { id } });
            return true;
        } catch (error) {
            throw new NotFoundException(`Factura con ID ${id} no encontrada`);
        }
    }

    async invoiceExists(
        organizacionId: string,
        numFactura: string,
        rucProveedor: string,
        cufe: string = "",
    ): Promise<boolean> {
        const factura = await this.prisma.facturas.findFirst({
            where: {
                // Todas las condiciones quedan acotadas a la organización del usuario
                organizacion_id: organizacionId,
                OR: [
                    {
                        // Caso 1: Misma factura del mismo proveedor dentro de la org
                        numero_factura: numFactura,
                        ruc_proveedor:  rucProveedor,
                    },
                    // Caso 2: CUFE duplicado dentro de la org (si viene informado)
                    ...(cufe ? [{ cufe }] : []),
                ],
            },
        });

        if (factura) {
            throw new ConflictException(
                factura.cufe === cufe
                    ? `Ya existe una factura registrada con el CUFE: ${cufe}`
                    : `Ya existe la factura ${numFactura} para el proveedor ${rucProveedor}`,
            );
        }

        return false;
    }
}