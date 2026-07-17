import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { RegistroGastosModule } from './modules/registro-gastos/registro-gastos.module';
import { SuscripcionesModule } from './modules/suscripciones/suscripciones.module';
import { MailModule } from './infrastructure/mail/mail.module';
import { TasksModule } from './infrastructure/tasks/tasks.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    // Límite global por defecto; el endpoint de procesamiento de facturas
    // (dispara Azure OCR + LLM + scraping DGI, todos con costo) usa un
    // límite más estricto vía @Throttle() en su propio controller.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    MailModule,
    AuthModule,
    RegistroGastosModule,
    SuscripcionesModule,
    TasksModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
