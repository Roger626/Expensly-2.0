import { Component, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CargarArchivoComponent } from '../../components/cargar-facturas/cargar-archivo/cargar-archivo.component';

import { RegistroFacturaService } from '../../services/registro-factura.service';
import { CategoriaDto } from '../../models/categoria.model';
import { ProcesarFacturaResponse, FacturaProcesamientoResult, Factura, CreateFacturaDto } from '../../models/factura.model';
import { FacturaFormComponent } from '../../components/cargar-facturas/factura-form/factura-form.component';
import { QrScannerService } from '../../../../core/services/qr-scanner.service';
import { FacturaViewComponent } from '../../../../shared/factura-view/factura-view.component';
import { ToastService } from '../../../../shared/toast/toast.service';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { AuthService } from '../../../auth/services/auth.service';
import { Role } from '../../../../core/models/roles.enum';
import { money } from '../../../../shared/format/format';

@Component({
  selector: 'app-cargar-factura',
  standalone: true,
  imports: [RouterLink, CargarArchivoComponent, FacturaFormComponent, FacturaViewComponent, IconComponent],
  templateUrl: './cargar-factura.component.html',
  styleUrl: './cargar-factura.component.css'
})
export class CargarFacturaComponent implements OnInit, OnDestroy {
  @ViewChild(CargarArchivoComponent) cargarArchivoRef!: CargarArchivoComponent;

  resultadoOCR: ProcesarFacturaResponse | null = null;
  isLoading = false;
  isLightboxOpen = false;

  onLightboxChange(open: boolean): void {
    this.isLightboxOpen = open;
  }
  /** Indica si se está guardando la factura en backend */
  isSaving = false;
  /** Mensaje de estado visible al usuario durante el procesamiento */
  loadingMensaje = 'Procesando factura…';
  /** null = sin datos, true = QR detectado, false = no detectado */
  qrDetectado: boolean | null = null;
  errorMensaje: string | null = null;
  categorias: CategoriaDto[] = [];
  imageUrls: string[] = [];

  private subs = new Subscription();
  private readonly auth = inject(AuthService);
  readonly money = money;

  /** Factura recién guardada (paso 3). */
  guardada: { proveedor: string; total: number } | null = null;

  get paso(): 1 | 2 | 3 {
    return this.guardada ? 3 : this.resultadoOCR ? 2 : 1;
  }

  /** A dónde ir para ver la factura según el rol. */
  get listaUrl(): string {
    return this.auth.userRole() === Role.EMPLEADO ? '/facturas' : '/admin/facturas';
  }

  constructor(
    private registroFacturaService: RegistroFacturaService,
    private qrScannerService: QrScannerService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.registroFacturaService.cargarCategorias();
    this.subs.add(
      this.registroFacturaService.categorias$.subscribe(cats => this.categorias = cats)
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  /**
   * Flujo de doble verificación:
   * 1. Escanear QR en el browser (Canvas + zxing-wasm) — instantáneo, sin costo.
   * 2. Enviar imágenes + resultado QR al backend.
   * 3. El backend verifica de forma independiente:
   *    - Si coincide → usa el QR para scrapear DGI (sin Azure OCR).
   *    - Si no coincide o no puede leerlo → fallback a Azure OCR.
   */
  async procesarFactura(archivos: File[]): Promise<void> {
    this.isLoading = true;
    this.errorMensaje = null;
    this.resultadoOCR = null;
    this.qrDetectado = null;

    // ── Fase 1: escaneo en el browser (gratis, GPU del usuario) ──────────────
    this.loadingMensaje = 'Buscando código QR…';
    let clientQrData: string | undefined;
    try {
      const qr = await this.qrScannerService.scanFiles(archivos);
      if (qr) {
        clientQrData = qr;
        this.qrDetectado = true;
        this.loadingMensaje = 'Código QR encontrado. Consultando la DGI…';
      } else {
        this.qrDetectado = false;
        this.loadingMensaje = 'Sin código QR. Leyendo la foto con IA, puede tardar unos segundos…';
      }
    } catch (err) {
      // El escaneo QR es opcional — si falla, continuar sin él
    }

    // ── Fase 2: enviar al backend con el clientQrData (si lo hay) ────────────
    this.registroFacturaService.subirArchivos(archivos, clientQrData).subscribe({
      next: (response: ProcesarFacturaResponse) => {
        this.resultadoOCR = response;
        // Usar el array de objetos 'imagenes' (nuevo formato)
        if (response.data.imagenes && response.data.imagenes.length > 0) {
            this.imageUrls = response.data.imagenes
                .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
                .map(img => img.url);
        } else {
            // Fallback para respuestas antiguas
            this.imageUrls = response.data.imageUrls?.length
                ? response.data.imageUrls
                : (response.data.urlImagen ? [response.data.urlImagen] : []);
        }
        this.isLoading = false;

      },
      error: (error) => {
        const msg = error?.error?.message ?? 'Error al procesar la factura. Intente nuevamente.';
        this.errorMensaje = msg;
        this.isLoading = false;
        this.toast.error('Error al procesar', msg);
      }
    });
  }

  guardarFactura(invoice: ProcesarFacturaResponse): void {
    this.registroFacturaService.setFacturaData(invoice);
  }

  limpiarEstadoPadre() {
    this.guardada = null;
    this.resultadoOCR = null;
    this.errorMensaje = null;
    this.qrDetectado = null;
    this.imageUrls = [];
    this.cargarArchivoRef?.reset();
    this.registroFacturaService.clearFacturaData();
  }

  createFactura(dto: CreateFacturaDto): void {
    if (this.isSaving) return;
    this.isSaving = true;

    this.registroFacturaService.createFactura(dto).subscribe({
      next: () => {
        this.isSaving = false;
        this.guardada = { proveedor: dto.nombreProveedor, total: dto.monto };
        this.toast.success('Factura guardada', 'Quedó pendiente de aprobación.');
      },
      error: (error) => {
        const msg = error?.error?.message ?? 'Error al guardar la factura. Intente nuevamente.';
        this.errorMensaje = msg;
        this.isSaving = false;
        this.toast.error('No se pudo guardar', msg);
      }
    });
  }
}
