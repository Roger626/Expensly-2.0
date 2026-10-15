export class CategoriaEntity {
    id: string;
    organizacionId: string;
    nombre: string;
    codigoContable?: string;

    /** Acepta la fila de Prisma (snake_case) o una entidad ya mapeada: el controlador vuelve a envolver lo que devuelve el repositorio. */
    constructor(data: any) {
        this.id = data.id;
        this.organizacionId = data.organizacion_id ?? data.organizacionId;
        this.nombre = data.nombre;
        this.codigoContable = data.codigo_contable ?? data.codigoContable ?? undefined;
    }
}
