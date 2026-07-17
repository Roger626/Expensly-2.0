import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IStorageService } from '../storage/storage.interface';
import { STORAGE_SERVICE } from '../storage/storage.tokens';

const TEMP_TTL_HORAS = 24;

/**
 * Cada imagen subida a /procesar-factura va primero a Cloudinary `temp/`.
 * Si el usuario nunca completa `/create` (abandona el flujo), ese archivo
 * queda huérfano para siempre — este cron lo limpia periódicamente.
 */
@Injectable()
export class CleanupTask {
  private readonly logger = new Logger(CleanupTask.name);

  constructor(
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async limpiarTempHuerfanos(): Promise<void> {
    try {
      const publicIds = await this.storageService.listTempOlderThan(TEMP_TTL_HORAS);
      if (publicIds.length === 0) return;

      this.logger.log(`Eliminando ${publicIds.length} archivo(s) huérfano(s) de expensly/temp/ (> ${TEMP_TTL_HORAS}h).`);
      await Promise.all(publicIds.map((id) => this.storageService.deleteFile(id)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Error limpiando temp de Cloudinary: ${msg}`);
    }
  }
}
