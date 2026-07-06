import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const timeoutMs = 60000;
  
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