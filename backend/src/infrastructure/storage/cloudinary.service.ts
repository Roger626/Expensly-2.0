import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { IStorageService } from './storage.interface';

@Injectable()
export class CloudinaryService implements IStorageService {
  
  // 1. Subida inicial a carpeta temp (un solo archivo)
  async uploadToTemp(file: Buffer): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { folder: 'expensly/temp' },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Upload failed: no result'));
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      Readable.from(file).pipe(upload);
    });
  }

  // 1b. Subida múltiple a temp en paralelo
  async uploadManyToTemp(files: Buffer[]): Promise<{ urls: string[]; publicIds: string[] }> {
    const results = await Promise.all(files.map(f => this.uploadToTemp(f)));
    return {
      urls:      results.map(r => r.url),
      publicIds: results.map(r => r.publicId),
    };
  }

  /**
   * Mueve de temp a permanente.
   * Acepta un publicId único O un JSON array de publicIds
   * (ej. '["expensly/temp/a","expensly/temp/b"]').
   * Devuelve la URL del primer archivo movido.
   */
  async makePermanent(publicId: string): Promise<string> {
    let ids: string[];
    try {
      const parsed = JSON.parse(publicId);
      ids = Array.isArray(parsed) ? parsed : [publicId];
    } catch {
      ids = [publicId];
    }

    const urls = await Promise.all(
      ids.map(async id => {
        // Generar el nuevo ID basado en la convención de carpetas
        const newId = id.replace('expensly/temp/', 'expensly/facturas/');
        
        try {
          // Intentar renombrar (mover) de temp a facturas
          const result = await cloudinary.uploader.rename(id, newId, { overwrite: true });
          return result.secure_url;
        } catch (error: any) {
          // Si el recurso no se encuentra en temp, verificar si ya existe en destino (idempotencia)
          if (error?.message?.includes('Resource not found')) {
            try {
              // Verificar si ya existe en la carpeta de destino
              const existing = await cloudinary.api.resource(newId);
              return existing.secure_url;
            } catch (checkError) {
              // Si tampoco existe en destino, relanzar el error original
              throw error;
            }
          }
          throw error;
        }
      }),
    );

    return urls[0]; // URL de la primera imagen (imagen principal)
  }

  // 3. Eliminar (para el Cron Job de limpieza)
  async deleteFile(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  // 4. Listar recursos huérfanos en temp/ para el Cron Job de limpieza
  async listTempOlderThan(hours: number): Promise<string[]> {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const publicIds: string[] = [];
    let nextCursor: string | undefined;

    do {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: 'expensly/temp/',
        max_results: 500,
        next_cursor: nextCursor,
      });

      for (const resource of result.resources ?? []) {
        if (new Date(resource.created_at).getTime() < cutoff) {
          publicIds.push(resource.public_id);
        }
      }

      nextCursor = result.next_cursor;
    } while (nextCursor);

    return publicIds;
  }
}