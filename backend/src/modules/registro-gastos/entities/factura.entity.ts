import { Exclude, Expose, Transform, Type } from 'class-transformer';

@Exclude()
export class FacturaImagenEntity {
  @Expose()
  id: string;

  @Expose()
  url: string;

  @Expose()
  @Transform(({ obj }) => obj.imagePublicId)
  publicId: string;

  @Expose()
  orden: number;

  imagePublicId: string; // Needed so TS knows about it and Object.assign copies it, but excluded from JSON
}

@Exclude()
export class FacturaEntity {
  // ========= Identidad =========

  @Expose()
  id: string;

  // ========= Usuario =========

  @Expose()
  @Transform(({ obj }) => obj.usuario_id)
  usuarioId: string;

  @Expose()
  @Transform(({ obj }) => obj.usuarios?.nombre_completo ?? null)
  nombreEmpleado: string;

  // ========= Clasificación =========
  @Expose()
  @Transform(({ obj }) => obj.categorias?.nombre ?? null)
  categoria: string;

  // ========= Montos =========

  @Expose()
  @Transform(({ obj }) => obj.monto_total?.toNumber())
  montoTotal: number;

  @Expose()
  @Transform(({ obj }) => obj.subtotal?.toNumber())
  subtotal?: number;

  @Expose()
  @Transform(({ obj }) => obj.itbms?.toNumber())
  itbms?: number;

  // ========= Fechas =========

  @Expose()
  @Transform(({ obj }) => obj.fecha_emision?.toISOString())
  fechaEmision: string;

  // ========= Proveedor =========

  @Expose()
  @Transform(({ obj }) => obj.ruc_proveedor)
  rucProveedor?: string;

  @Expose()
  @Transform(({ obj }) => obj.dv_proveedor)
  dv?: string;

  @Expose()
  @Transform(({ obj }) => obj.nombre_proveedor)
  nombreProveedor?: string;

  @Expose()
  @Transform(({ obj }) => obj.numero_factura)
  numeroFactura: string;

  @Expose()
  @Transform(({ obj }) => obj.cufe)
  cufe?: string;

  // ========= Metadata de extracción =========

  @Expose()
  @Transform(({ obj }) => obj.origen_extraccion)
  origenExtraccion?: string;

  @Expose()
  @Transform(({ obj }) => obj.confianza_extraccion)
  confianzaExtraccion?: Record<string, string>;

  // ========= Documento =========

  // Eliminado del response JSON
  /*
  @Transform(({ obj }) => {
    if (obj.imagenes && obj.imagenes.length > 0) {
      return obj.imagenes[0].url;
    }
    return obj.url_imagen;
  })
  urlImagen: string;
  */

  // Eliminado del response JSON
  /*
  @Transform(({ obj }) => {
    if (obj.imagenes && obj.imagenes.length > 0) {
      return obj.imagenes[0].imagePublicId;
    }
    return obj.image_public_id;
  })
  imagePublicId: string;
  */

  /**
   * Todas las URLs de las imágenes.
   * Ahora se obtienen de la relación `imagenes`.
   */
  // Eliminado del response JSON
  /*
  @Transform(({ obj }) => {
    if (obj.imagenes && Array.isArray(obj.imagenes)) {
        return obj.imagenes.map(img => img.url);
    }
    // Fallback para legacy
    const firstUrl: string = obj.url_imagen ?? '';
    return firstUrl ? [firstUrl] : [];
  })
  imageUrls: string[];
  */

  @Expose()
@Type(() => FacturaImagenEntity)
  imagenes: FacturaImagenEntity[];

  // ========= Estado =========

  @Expose()
  @Transform(({ obj }) => obj.estado)
  estado?: string;

  @Expose()
  @Transform(({ obj }) => obj.motivo_rechazo)
  motivoRechazo?: string;

  // ========= Tags =========

  @Expose()
  @Transform(({ obj }) =>
    obj.factura_tags?.map((t) => t.tags?.nombre),
  )
  facturaTags?: string[];

  constructor(partial: Partial<FacturaEntity>) {
    Object.assign(this, partial);
    if (this.imagenes && this.imagenes.length > 0) {
        this.imagenes = this.imagenes.map(img => Object.assign(new FacturaImagenEntity(), img));
    }
  }
}
