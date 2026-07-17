import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { EmptyError } from 'rxjs';

/**
 * SkipIfRespondedInterceptor (ver skip-if-responded.interceptor.ts) descarta
 * el resultado de una request cuyo timeout ya respondió, filtrando el
 * Observable a vacío. Nest internamente consume ese Observable final con
 * `lastValueFrom()` (ver RouterResponseController.transformToResult) — que
 * lanza EmptyError("no elements in sequence") cuando no hay ninguna emisión.
 * Es el efecto secundario esperado de ese descarte, no un fallo real: la
 * respuesta ya se envió (504 por timeout), no hay nada que responder. Sin
 * este filtro, el ExceptionsHandler por defecto además intentaría escribir
 * en la respuesta otra vez (mismo problema que el interceptor previene).
 */
@Catch(EmptyError)
export class EmptyResponseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(EmptyResponseExceptionFilter.name);

  catch(exception: EmptyError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();
    if (!response?.headersSent) {
      // No debería ocurrir fuera del escenario de timeout — lo logueamos
      // por si acaso indica un problema distinto.
      this.logger.warn(`EmptyError inesperado sin respuesta previa enviada: ${exception.message}`);
      return;
    }
    this.logger.debug('Descartada una respuesta tardía tras timeout (ya se había enviado 504).');
  }
}
