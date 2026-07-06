import { Module } from '@nestjs/common';
import { ConciliacionService } from './services/conciliacion.service';
import { ConciliacionController } from './controllers/conciliacion.controller';
import { ConciliacionRepository } from './repositories/conciliacion.repository';
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [ConciliacionController],
    providers: [
        ConciliacionService,
        ConciliacionRepository,
    ],

})
export class ConciliacionModule {}