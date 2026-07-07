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

    // ==================== Dashboard Queries ====================

    private toNum(val: any): number {
        if (!val) return 0;
        if (typeof val.toNumber === 'function') {
            return val.toNumber();
        }
        return Number(val);
    }

    async getDashboardResumen(
        orgId: string,
        start: Date,
        end: Date,
        catId?: string,
        empId?: string,
    ): Promise<any> {
        const filterBase: any = {
            organizacion_id: orgId,
            fecha_emision: {
                gte: start,
                lte: end,
            },
        };
        if (catId) filterBase.categoria_id = catId;
        if (empId) filterBase.usuario_id = empId;

        const totalsResult = await this.prisma.facturas.aggregate({
            _sum: {
                monto_total: true,
                itbms: true,
            },
            where: {
                ...filterBase,
                estado: {
                    not: 'RECHAZADO',
                },
            },
        });

        const gastoTotal = this.toNum(totalsResult._sum.monto_total);
        const itbmsRecuperable = this.toNum(totalsResult._sum.itbms);
        const tasaRecuperacion = gastoTotal > 0 ? (itbmsRecuperable / gastoTotal) * 100 : 0;

        const pendingCount = await this.prisma.facturas.count({
            where: {
                ...filterBase,
                estado: 'PENDIENTE',
            },
        });

        const limitDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const expiredCount = await this.prisma.facturas.count({
            where: {
                ...filterBase,
                estado: 'PENDIENTE',
                fecha_subida: {
                    lt: limitDate,
                },
            },
        });

        const recentInvoices = await this.prisma.facturas.findMany({
            where: filterBase,
            orderBy: {
                fecha_subida: 'desc',
            },
            take: 10,
            include: {
                usuarios: {
                    select: {
                        nombre_completo: true,
                    },
                },
                categorias: {
                    select: {
                        nombre: true,
                    },
                },
            },
        });

        const ultimasTransacciones = recentInvoices.map((f) => ({
            id: f.id,
            empleado: f.usuarios?.nombre_completo ?? 'N/A',
            categoria: f.categorias?.nombre ?? 'Sin categoría',
            fecha: f.fecha_emision ? f.fecha_emision.toISOString().split('T')[0] : '',
            montoTotal: this.toNum(f.monto_total),
            estado: f.estado,
        }));

        return {
            gastoTotal,
            itbmsRecuperable,
            tasaRecuperacion,
            aprobacionesPendientes: pendingCount,
            reportesVencidos: expiredCount,
            ultimasTransacciones,
        };
    }

    async getDashboardTendencia(
        orgId: string,
        catId?: string,
        empId?: string,
    ): Promise<any> {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);

        const where: any = {
            organizacion_id: orgId,
            estado: {
                not: 'RECHAZADO',
            },
            fecha_emision: {
                gte: startDate,
            },
        };
        if (catId) where.categoria_id = catId;
        if (empId) where.usuario_id = empId;

        const facturas = await this.prisma.facturas.findMany({
            where,
            select: {
                monto_total: true,
                itbms: true,
                fecha_emision: true,
            },
        });

        const monthsList: any[] = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthsList.push({
                mes: key,
                montoTotal: 0,
                itbms: 0,
            });
        }

        for (const f of facturas) {
            if (!f.fecha_emision) continue;
            const date = new Date(f.fecha_emision);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const target = monthsList.find((m) => m.mes === key);
            if (target) {
                target.montoTotal += this.toNum(f.monto_total);
                target.itbms += this.toNum(f.itbms);
            }
        }

        return monthsList.map((m) => ({
            mes: m.mes,
            montoTotal: Number(m.montoTotal.toFixed(2)),
            itbms: Number(m.itbms.toFixed(2)),
        }));
    }

    async getDashboardCategorias(
        orgId: string,
        start: Date,
        end: Date,
        empId?: string,
    ): Promise<any> {
        const where: any = {
            organizacion_id: orgId,
            fecha_emision: {
                gte: start,
                lte: end,
            },
            estado: {
                not: 'RECHAZADO',
            },
        };
        if (empId) where.usuario_id = empId;

        const facturas = await this.prisma.facturas.findMany({
            where,
            include: {
                categorias: true,
            },
        });

        const categoryMap = new Map<string, { id: string | null; name: string; montoTotal: number; count: number }>();
        let totalGasto = 0;

        for (const f of facturas) {
            const catId = f.categoria_id;
            const catName = f.categorias ? f.categorias.nombre : 'Sin categoría';
            const monto = this.toNum(f.monto_total);
            totalGasto += monto;

            const key = catId || 'null';
            const existing = categoryMap.get(key);
            if (existing) {
                existing.montoTotal += monto;
                existing.count += 1;
            } else {
                categoryMap.set(key, {
                    id: catId,
                    name: catName,
                    montoTotal: monto,
                    count: 1,
                });
            }
        }

        return Array.from(categoryMap.values()).map((cat) => ({
            id: cat.id,
            name: cat.name,
            montoTotal: Number(cat.montoTotal.toFixed(2)),
            count: cat.count,
            percentage: totalGasto > 0 ? Number(((cat.montoTotal / totalGasto) * 100).toFixed(2)) : 0,
        }));
    }
}