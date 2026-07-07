import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PagosModule } from '../../infrastructure/pagos/pagos.module';

// Controllers
import { SuscripcionesController } from './controllers/suscripciones.controller';

// Services
import { SuscripcionesService } from './services/suscripciones.service';
import { ConfirmacionPagoService } from './services/confirmacion-pago.service';

// Repositories
import { SuscripcionesRepository } from './repositories/suscripciones.repository';
import { ISUSCRIPCIONES_REPOSITORY } from './repositories/interfaces/isuscripciones.repository';

@Module({
  imports: [
    PrismaModule,
    PagosModule,
  ],
  controllers: [SuscripcionesController],
  providers: [
    SuscripcionesService,
    {
      provide: ISUSCRIPCIONES_REPOSITORY,
      useExisting: SuscripcionesRepository,
    },
    SuscripcionesRepository,
    ConfirmacionPagoService,
  ],
  exports: [SuscripcionesService, ConfirmacionPagoService],
})
export class SuscripcionesModule {}
