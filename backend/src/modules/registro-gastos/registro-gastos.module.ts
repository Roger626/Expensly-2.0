import { Module } from '@nestjs/common';
import { RegistroGastosService } from './services/registro-gastos.service';
import { RegistroGastosController } from './controllers/registro-gastos.controller';
import { CategoriaController } from './controllers/categoria.controller';
import { RegistroGastosRepository } from './repositories/registro-gastos.repository';
import { CategoriaRepository } from './repositories/categoria.repository';
import { CategoriaService } from './services/categoria.service';
import { ProcesarFacturaOCRStrategy } from "./strategies/factura-procesar-ocr.strategy";
import { ProcesarFacturaQRStrategy } from "./strategies/factura-procesar-qr-strategy";
import { ExcelExportStrategy } from './strategies/excel-export.strategy';
import { PrismaModule } from "../../prisma/prisma.module";
import { IProcesarFacturaStrategy } from './strategies/factura-procesar.strategy.interface';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from 'src/infrastructure/storage/storage.module';
import { OcrModule } from 'src/infrastructure/ocr/ocr.module';
import { LlmModule } from 'src/infrastructure/llm/llm.module';
import { REGISTRO_GASTOS_REPOSITORY, CATEGORIA_REPOSITORY, EXPORT_STRATEGY } from './registro-gastos.tokens';
import { ExcelService } from 'src/infrastructure/storage/excel.service';

@Module({
    imports: [PrismaModule, AuthModule, StorageModule, OcrModule, LlmModule],
    controllers: [RegistroGastosController, CategoriaController],
    providers: [
        RegistroGastosService,
        RegistroGastosRepository,
        CategoriaService,
        CategoriaRepository,
        {
            provide: REGISTRO_GASTOS_REPOSITORY,
            useExisting: RegistroGastosRepository,
        },
        {
            provide: CATEGORIA_REPOSITORY,
            useExisting: CategoriaRepository,
        },
        ProcesarFacturaOCRStrategy,
        ProcesarFacturaQRStrategy,
        {
            provide: 'FACTURA_STRATEGIES',
            useFactory: (...strats: IProcesarFacturaStrategy[]) => strats,
            inject: [ProcesarFacturaQRStrategy, ProcesarFacturaOCRStrategy],
        },
        // ── Excel export ──────────────────────────────────────────────────
        ExcelService,
        ExcelExportStrategy,
        {
            provide: EXPORT_STRATEGY,
            useExisting: ExcelExportStrategy,
        },
    ],
})
export class RegistroGastosModule {}
