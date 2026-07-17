import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

/**
 * Si una petición tarda más del timeout configurado en main.ts, ese
 * middleware ya envía una respuesta 504 mientras el procesamiento (QR/OCR/LLM)
 * sigue corriendo en segundo plano. Cuando ese trabajo finalmente termina e
 * intenta responder, Express lanza ERR_HTTP_HEADERS_SENT porque la respuesta
 * ya se envió. Este interceptor descarta silenciosamente ese resultado tardío
 * en vez de dejar que explote.
 */
@Injectable()
export class SkipIfRespondedInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(filter(() => !response.headersSent));
  }
}
