/** Subscription row returned by GET /suscripciones/actual */
export interface SuscripcionDto {
  id: string;
  plan: string;
  estado: 'Trial' | 'Activa' | 'PendientePago' | 'Suspendida' | 'Cancelada';
  trial_termina_en?: string;
  current_period_end?: string;
  card_token?: string;
  display_num?: string;
  dunning_step: number;
  fecha_creacion: string;
}

/** Pago row returned by GET /suscripciones/historial */
export interface PagoDto {
  id: string;
  cod_oper: string;
  monto: number;
  estado: string;
  operation_type: string;
  fecha: string;
}

/** Paginated wrapper for list endpoints */
export interface PaginatedDto<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/** Body for POST /suscripciones/cobrar */
export interface ConfirmarCobroDto {
  plan: 'basic' | 'pro' | 'premium';
  codOper: string;
}

/** Body for POST /suscripciones/crear-enlace-pago */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CrearEnlacePagoRequestDto {}

/** Response from POST /suscripciones/crear-enlace-pago */
export interface CrearEnlacePagoResponseDto {
  checkoutUrl: string;
  code: string;
}
