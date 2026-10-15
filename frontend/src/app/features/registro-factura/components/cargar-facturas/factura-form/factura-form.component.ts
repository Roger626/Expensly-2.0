import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { ProcesarFacturaResponse, FacturaProcesamientoResult, CreateFacturaDto, Factura } from '../../../models/factura.model';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { InputComponent } from '../../../../../shared/input/input/input.component';
import { IconComponent } from '../../../../../shared/icon/icon.component';
import { CategoriaDto } from '../../../models/categoria.model';



@Component({
  selector: 'app-factura-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, IconComponent],
  templateUrl: './factura-form.component.html',
  styleUrl: './factura-form.component.css'
})
export class FacturaFormComponent implements OnChanges {
  @Input() invoiceData: ProcesarFacturaResponse | null = null;
  @Input() categorias: CategoriaDto[] = [];
  @Input() isSaving = false;
  @Input() origen: 'qr' | 'ia' | null = null;
  @Output() submitInvoice = new EventEmitter<CreateFacturaDto>();
  @Output() discard = new EventEmitter<void>();

  formError: string | null = null;
  cufeCopied = false;

  
  facturaForm: FormGroup;
  

  constructor(private fb: FormBuilder){
    this.facturaForm = this.createForm();
  }

  copyCufe(): void {
    const cufe = this.facturaForm.get('cufe')?.value;
    if (!cufe) return;
    navigator.clipboard?.writeText(cufe).then(() => {
      this.cufeCopied = true;
      setTimeout(() => (this.cufeCopied = false), 1800);
    }).catch(() => { /* sin permiso de portapapeles */ });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['invoiceData'] && this.invoiceData) {
      this.facturaForm.patchValue({
        nombreComercio: this.invoiceData.data.nombreProveedor,
        ruc: this.invoiceData.data.rucProveedor,
        dv: this.invoiceData.data.dv,
        numeroFactura: this.invoiceData.data.numeroFactura,
        fechaEmision: this.toISODate(this.invoiceData.data.fechaEmision),
        cufe: this.invoiceData.data.cufe,
        subtotal: this.invoiceData.data.subtotal,
        itbms: this.invoiceData.data.itbms,
        total: this.invoiceData.data.montoTotal,
      });
    }

  }

  /** Convierte "14/noviembre/2025" o "14/11/2025" a "2025-11-14" para <input type="date"> */
  private toISODate(raw: string): string {
    if (!raw) return '';
    const meses: Record<string, string> = {
      'enero':'01','febrero':'02','marzo':'03','abril':'04',
      'mayo':'05','junio':'06','julio':'07','agosto':'08',
      'septiembre':'09','octubre':'10','noviembre':'11','diciembre':'12',
    };
    // DD/mes_escrito/YYYY
    const ml = raw.match(/^(\d{1,2})\/([\w]+)\/(\d{4})$/);
    if (ml) {
      const d = ml[1].padStart(2, '0');
      const m = meses[ml[2].toLowerCase()] ?? ml[2].padStart(2, '0');
      return `${ml[3]}-${m}-${d}`;
    }
    // DD/MM/YYYY
    const mn = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mn) return `${mn[3]}-${mn[2].padStart(2,'0')}-${mn[1].padStart(2,'0')}`;
    // Ya en formato YYYY-MM-DD
    return raw;
  }

  private createForm(){
    return this.fb.group({
      nombreComercio: new FormControl("", [Validators.required]),
      ruc: new FormControl("", [Validators.required]),
      dv: new FormControl(""),
      numeroFactura: new FormControl("", [Validators.required]),
      fechaEmision: new FormControl("", [Validators.required]),
      cufe: new FormControl(""),
      subtotal: new FormControl(0, [Validators.required, Validators.min(0)]),
      itbms: new FormControl(0, [Validators.min(0)]),
      total: new FormControl(0, [Validators.required, Validators.min(0)]),
      categoria: new FormControl("", [Validators.required]),
    });
  }

  /** ITBMS esperado (7 % del subtotal) para avisar si lo extraído no cuadra. */
  get descuadre(): boolean {
    const { subtotal, itbms, total } = this.facturaForm.value;
    if (!subtotal || total == null) return false;
    return Math.abs((subtotal ?? 0) + (itbms ?? 0) - total) > 0.02;
  }

  onSubmit() {
    this.formError = null;
    if (this.facturaForm.valid && this.invoiceData) {
      const values = this.facturaForm.value;
      const base: FacturaProcesamientoResult = this.invoiceData.data;

      // Mapeo correcto de datos para el DTO
      const dto: CreateFacturaDto = {
        categoriaId: values.categoria,
        monto: values.total,
        subtotal: values.subtotal,
        impuesto: values.itbms,
        fechaEmision: values.fechaEmision,
        rucProveedor: values.ruc,
        dvProveedor: values.dv,
        nombreProveedor: values.nombreComercio,
        numeroFactura: values.numeroFactura,
        cufe: values.cufe,
        
        // --- Manejo de imágenes (Array vs Legacy) ---
        // 1. Array estructurado (nueva lógica)
        imagenesFactura: base.imagenes?.map(img => ({
          url: img.url,
          publicId: img.publicId
        })) ?? [],
        
        facturaTags: []
      };

      // Si no hay imágenes estructuradas, intentar reconstruir desde legacy (caso raro o fallback)
      if (dto.imagenesFactura.length === 0) {
        if (base.urlImagen && base.imagePublicId) {
             // Intentar parsear si es un JSON string o usarlo directo
             let pIds: string[] = [];
             try {
                 const parsed = JSON.parse(base.imagePublicId);
                 pIds = Array.isArray(parsed) ? parsed : [base.imagePublicId];
             } catch {
                 pIds = [base.imagePublicId];
             }
             // Si tenemos array de URLs, emparejar. Si solo hay urlImagen, usar esa.
             const urls: string[] = (base.imageUrls && base.imageUrls.length > 0) 
                ? base.imageUrls 
                : (base.urlImagen ? [base.urlImagen] : []);
             
             if (urls.length > 0) {
                 dto.imagenesFactura = urls.map((u, i) => ({
                     url: u,
                     publicId: pIds[i] || pIds[0] || ''
                 }));
             }
        }
      }

      if (dto.imagenesFactura.length === 0) {
        this.formError = 'No encontramos la imagen subida. Descarta y vuelve a subir la foto.';
        return;
      }

      this.submitInvoice.emit(dto);
    } else {
      this.facturaForm.markAllAsTouched();
      this.formError = 'Completa los campos marcados para guardar la factura.';
    }
  }

}
