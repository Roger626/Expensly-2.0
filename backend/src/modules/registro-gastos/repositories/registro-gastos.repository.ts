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
                origen_extraccion: dto.origenExtraccion ?? null,
                confianza_extraccion: dto.confianzaExtraccion ?? undefined,
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

        // Periodo anterior de igual duración, para calcular variación (ej. "↑ 8% vs. periodo previo").
        // Ej. si el rango pedido es [15 ene, 31 ene] (16 días), el anterior es [30 dic, 15 ene).
        const durationMs = end.getTime() - start.getTime();
        const prevEnd = start;
        const prevStart = new Date(start.getTime() - durationMs);

        const prevFilterBase: any = {
            organizacion_id: orgId,
            fecha_emision: { gte: prevStart, lt: prevEnd },
        };
        if (catId) prevFilterBase.categoria_id = catId;
        if (empId) prevFilterBase.usuario_id = empId;

        const prevTotalsResult = await this.prisma.facturas.aggregate({
            _sum: { monto_total: true, itbms: true },
            where: { ...prevFilterBase, estado: { not: 'RECHAZADO' } },
        });

        const gastoTotalAnterior = this.toNum(prevTotalsResult._sum.monto_total);
        const itbmsRecuperableAnterior = this.toNum(prevTotalsResult._sum.itbms);

        // null (no un porcentaje calculado de 0) cuando no hay base de comparación —
        // evita mostrar "∞%" o un falso "+100%" cuando el periodo anterior no tuvo gastos.
        const variacionGastoTotal = gastoTotalAnterior > 0
            ? Number((((gastoTotal - gastoTotalAnterior) / gastoTotalAnterior) * 100).toFixed(1))
            : null;
        const variacionItbmsRecuperable = itbmsRecuperableAnterior > 0
            ? Number((((itbmsRecuperable - itbmsRecuperableAnterior) / itbmsRecuperableAnterior) * 100).toFixed(1))
            : null;

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
            variacionGastoTotal,
            variacionItbmsRecuperable,
            aprobacionesPendientes: pendingCount,
            reportesVencidos: expiredCount,
            ultimasTransacciones,
        };
    }

    async getDashboardTendencia(
        orgId: string,
        catId?: string,
        empId?: string,
        start?: Date,
        end?: Date,
    ): Promise<any> {
        // Sin rango explícito: comportamiento original (últimos 6 meses fijos).
        // Todo el cálculo de meses usa getters/constructores UTC (no locales):
        // `fecha_emision` es un @db.Date (fecha calendario sin huso horario) y
        // `start`/`end` llegan de un string ISO "YYYY-MM-DD" (new Date() lo
        // parsea como medianoche UTC). Mezclar eso con getters locales corría
        // el mes hacia atrás en servidores con offset negativo (ej. Panamá,
        // UTC-5): medianoche UTC del día 1 es 31 del mes anterior en hora local.
        const now = new Date();
        const startDate = start ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
        const endDate = end ?? now;

        const where: any = {
            organizacion_id: orgId,
            estado: {
                not: 'RECHAZADO',
            },
            fecha_emision: {
                gte: startDate,
                lte: endDate,
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

        // Buckets mensuales desde el mes de startDate hasta el de endDate, capado a
        // los últimos 12 si el rango pedido es más ancho (evita payloads gigantes).
        let cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
        const lastMonth = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
        const monthsSpan = (lastMonth.getUTCFullYear() - cursor.getUTCFullYear()) * 12
            + (lastMonth.getUTCMonth() - cursor.getUTCMonth()) + 1;
        if (monthsSpan > 12) {
            cursor = new Date(Date.UTC(lastMonth.getUTCFullYear(), lastMonth.getUTCMonth() - 11, 1));
        }

        const monthsList: any[] = [];
        while (cursor <= lastMonth) {
            const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
            monthsList.push({
                mes: key,
                montoTotal: 0,
                itbms: 0,
            });
            cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
        }

        for (const f of facturas) {
            if (!f.fecha_emision) continue;
            const date = new Date(f.fecha_emision);
            const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
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