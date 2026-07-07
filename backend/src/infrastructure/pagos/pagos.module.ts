import { Module } from '@nestjs/common';
import { PagueloFacilService } from './paguelo-facil.service';
import { PAGO_SERVICE } from './pagos.tokens';

@Module({
  providers: [
    PagueloFacilService,
    {
      provide: PAGO_SERVICE,
      useExisting: PagueloFacilService,
    },
  ],
  exports: [PAGO_SERVICE],
})
export class PagosModule {}
