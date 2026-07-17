import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SkipIfRespondedInterceptor } from './common/interceptors/skip-if-responded.interceptor';
import { EmptyResponseExceptionFilter } from './common/filters/empty-response.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // En producción, las requests llegan a través de 2 saltos de proxy propios
  // (Nginx del contenedor frontend → Nginx del host, que a su vez recibe de
  // Cloudflare). Sin esto, Express toma la IP del hop inmediato anterior
  // (siempre la misma IP interna de docker) como "la" IP del cliente para
  // TODAS las requests — rompiendo el rate-limiting por IP de ThrottlerGuard
  // (ver app.module.ts), que terminaría limitando a todos los usuarios como
  // si fueran uno solo. `2` = confía en los últimos 2 hops del X-Forwarded-For
  // (nuestros dos Nginx) y toma la IP real que Cloudflare reporta ahí.
  app.getHttpAdapter().getInstance().set('trust proxy', 2);

  // El endpoint de procesamiento de facturas (QR + OCR + LLM) puede necesitar
  // el fallback LLM ocasional cuando el scraper DGI no matchea el layout, o
  // el flujo sin QR (OCR + LLM, y a veces escalado a visión). 60s era
  // demasiado ajustado para esos casos legítimos y cortaba la respuesta
  // antes de tiempo.
  const timeoutMs = 90000;
  
  // Configurar prefijo global para la API
  app.setGlobalPrefix('api');

  app.use((_req, res, next) => {
    res.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        res.status(504).json({
          statusCode: 504,
          message: 'La solicitud tardó demasiado en procesarse. Intenta nuevamente.',
          error: 'Gateway Timeout',
        });
      }
    });

    next();
  });
  
  // Configurar CORS
  const allowedOrigins = [
    'http://localhost:4200',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  
  // Si el timeout de arriba ya respondió (504), evita que el resultado tardío
  // del pipeline intente escribir la respuesta otra vez (ERR_HTTP_HEADERS_SENT).
  app.useGlobalInterceptors(new SkipIfRespondedInterceptor());
  // El interceptor de arriba vacía el Observable en ese caso, lo que hace que
  // Nest internamente lance EmptyError al intentar leer un resultado — es el
  // efecto secundario esperado (ver el filtro), no un error real a loguear
  // como tal ni a intentar responder de nuevo.
  app.useGlobalFilters(new EmptyResponseExceptionFilter());

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,       // Elimina propiedades que no estén en el DTO
    forbidNonWhitelisted: true, // Lanza error si envían propiedades extra
    transform: true,       // Convierte tipos automáticamente (ej: string a number)
  }));

  const server = app.getHttpServer() as {
    requestTimeout?: number;
    headersTimeout?: number;
    keepAliveTimeout?: number;
  };

  server.requestTimeout = timeoutMs + 5000;
  server.headersTimeout = timeoutMs + 10000;
  server.keepAliveTimeout = timeoutMs + 10000;
  
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Application is running on: http://localhost:${port}/api`);
}
bootstrap();