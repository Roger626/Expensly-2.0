import { Controller, Post, Get, Body, UseGuards, Query, Inject, UseInterceptors, ClassSerializerInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SuscripcionesService } from '../services/suscripciones.service';
import { ConfirmacionPagoService } from '../services/confirmacion-pago.service';
import { CobrarSuscripcionDto } from '../dto/cobrar-suscripcion.dto';
import { PAGO_SERVICE } from '../../../infrastructure/pagos/pagos.tokens';
import { IPagoService } from '../../../infrastructure/pagos/pagos.interface';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { PlanConfig } from '../interfaces/plan-config';

/** Plan-price mapping: server-authoritative — client monto is never trusted. */
const PLAN_PRICES: Record<string, PlanConfig> = {
  basic: { name: 'Plan Basic - Expensly', price_usd: 1, features_dummy: [] },
  pro: { name: 'Plan Pro - Expensly', price_usd: 5, features_dummy: [] },
  premium: { name: 'Plan Premium - Expensly', price_usd: 10, features_dummy: [] },
};

/**
 * Controller for subscription management.
 * All routes are tenant-scoped by req.user.organizationId from JWT.
 */
@Controller('suscripciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class SuscripcionesController {
  constructor(
    private readonly suscripcionesService: SuscripcionesService,
    private readonly confirmacionPagoService: ConfirmacionPagoService,
    private readonly configService: ConfigService,
    @Inject(PAGO_SERVICE) private readonly pagoService: IPagoService,
  ) {}

  /**
   * POST /suscripciones/cobrar
   * Confirms a payment after the frontend receives the codOper from PF onTxSuccess.
   * Polling-only — no webhook (locked decision).
   * Monto is NOT accepted from client — the service derives it from PF polling (tx.monto).
   */
  @Post('cobrar')
  @Roles('SUPERADMIN')
  async cobrar(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CobrarSuscripcionDto,
  ) {
    // Tenant scope: organizacionId from JWT, never from body
    await this.confirmacionPagoService.procesarCodOper(
      user.organizationId,
      dto.codOper,
      dto.plan,
      'AUTH_CAPTURE',
    );
    return { success: true };
  }

  /**
   * GET /suscripciones/actual
   * Returns the current subscription row for the authenticated org.
   */
  @Get('actual')
  @Roles('SUPERADMIN')
  async obtenerActual(@CurrentUser() user: CurrentUserPayload) {
    return this.suscripcionesService.obtenerActual(user.organizationId);
  }

  /**
   * GET /suscripciones/historial
   * Returns paginated pago history for the authenticated org.
   */
  @Get('historial')
  @Roles('SUPERADMIN')
  async obtenerHistorial(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 10;
    return this.suscripcionesService.obtenerHistorial(
      user.organizationId,
      p,
      l,
    );
  }

  /**
   * POST /suscripciones/crear-enlace-pago
   * Initiates the Enlace de Pago (redirect) flow.
   * Plan, monto, and returnUrl are DERIVED SERVER-SIDE — never from the client.
   * Uses the org's CURRENT subscription plan as the authoritative pricing source
   * to prevent client-supplied plan underpayment.
   */
  @Post('crear-enlace-pago')
  @Roles('SUPERADMIN')
  async crearEnlacePago(
    @CurrentUser() user: CurrentUserPayload,
  ) {
    // Look up the org's CURRENT subscription plan — server-authoritative
    const orgSub = await this.suscripcionesService.obtenerActual(
      user.organizationId,
    );
    const plan = (orgSub?.plan as 'basic' | 'pro' | 'premium') || 'pro';
    // Defensive: fall back to 'pro' pricing if plan is not a recognized key
    const planConfig = PLAN_PRICES[plan] ?? PLAN_PRICES['pro'];

    // Derive returnUrl server-side — never trust client-supplied URLs
    // Strip trailing slash to avoid double-slash
    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:4200'
    ).replace(/\/+$/, '');
    const returnUrl = `${frontendUrl}/cuenta/facturacion/checkout`;

    // PARM_1 carries the org's server-authoritative plan for callback round-trip
    // ALWAYS the org's actual plan — never client-overridable
    const parm1 = plan;

    return this.pagoService.crearEnlacePago({
      monto: planConfig.price_usd,
      descripcion: planConfig.name,
      returnUrl,
      parm1,
    });
  }
}
