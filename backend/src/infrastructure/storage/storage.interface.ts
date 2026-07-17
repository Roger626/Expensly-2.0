export interface IStorageService {
    uploadToTemp(file: Buffer): Promise<{ url: string; publicId: string }>;
    /** Sube varios buffers a temp y devuelve arrays paralelos de urls/publicIds */
    uploadManyToTemp(files: Buffer[]): Promise<{ urls: string[]; publicIds: string[] }>;
    /**
     * Mueve las imágenes a la carpeta permanente.
     * `publicId` puede ser un JSON array (ej. '["id1","id2"]') cuando se subieron
     * múltiples imágenes; en ese caso mueve todas y devuelve la URL de la primera.
     */
    makePermanent(publicId: string): Promise<string>;
    deleteFile(publicId: string): Promise<void>;
    /** Lista publicIds bajo expensly/temp/ subidos hace más de `hours` horas (para el cron de limpieza). */
    listTempOlderThan(hours: number): Promise<string[]>;
}