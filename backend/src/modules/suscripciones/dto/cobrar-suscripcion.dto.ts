import { IsIn, IsString, Matches } from 'class-validator';

/**
 * DTO for POST /suscripciones/cobrar
 * Received from the frontend after onTxSuccess fires with codOper.
 * Monto is NOT accepted — it is derived server-side from PF polling (tx.monto).
 */
export class CobrarSuscripcionDto {
  @IsIn(['basic', 'pro', 'premium'], {
    message: 'El plan debe ser basic, pro o premium',
  })
  plan!: 'basic' | 'pro' | 'premium';

  @IsString({ message: 'El código de operación es requerido' })
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'El código de operación contiene caracteres inválidos',
  })
  codOper!: string;
}
