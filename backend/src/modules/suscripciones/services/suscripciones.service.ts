import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Service for subscription read operations and display data.
 */
@Injectable()
export class SuscripcionesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get the current subscription for the authenticated organization.
   * Returns plan, estado, current_period_end, and trial_termina_en.
   */
  async obtenerActual(organizacionId: string) {
    const [sub, org] = await Promise.all([
      this.prisma.suscripciones.findUnique({
        where: { organizacion_id: organizacionId },
      }),
      this.prisma.organizaciones.findUnique({
        where: { id: organizacionId },
        select: { trial_termina_en: true },
      }),
    ]);

    return {
      plan: sub?.plan ?? null,
      estado: sub?.estado ?? null,
      current_period_end: sub?.current_period_end ?? null,
      trial_termina_en: org?.trial_termina_en ?? null,
    };
  }

  /**
   * Get paginated payment history for the org.
   */
  async obtenerHistorial(organizacionId: string, page: number, limit: number) {
    // First get the suscripcion_id for this org
    const sub = await this.prisma.suscripciones.findUnique({
      where: { organizacion_id: organizacionId },
      select: { id: true },
    });

    if (!sub) {
      return { data: [], total: 0, page, limit };
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.pagos.findMany({
        where: { suscripcion_id: sub.id },
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.pagos.count({
        where: { suscripcion_id: sub.id },
      }),
    ]);

    return { data, total, page, limit };
  }
}
