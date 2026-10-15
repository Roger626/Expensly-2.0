import { Component, Output, EventEmitter, Input } from '@angular/core';
import { IconComponent } from '../../../../../shared/icon/icon.component';

interface ImagenPreview {
  file: File;
  preview: string;
}

@Component({
  selector: 'app-cargar-archivo',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './cargar-archivo.component.html',
  styleUrl: './cargar-archivo.component.css'
})
export class CargarArchivoComponent {
  @Output() enviarArchivos = new EventEmitter<File[]>();
  @Output() archivosDescartados = new EventEmitter<void>();
  /** Bloquea cambios mientras se procesa. */
  @Input() busy = false;
  /** Avisos de archivos que no se pudieron agregar. */
  avisos: string[] = [];

  imagenes: ImagenPreview[] = [];
  isDragging = false;

  readonly MAX_FILES = 10;
  readonly MAX_SIZE  = 5 * 1024 * 1024; // 5 MB por imagen

  get hasFiles(): boolean { return this.imagenes.length > 0; }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) this.processFiles(Array.from(input.files));
    input.value = '';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    if (event.dataTransfer?.files) {
      this.processFiles(Array.from(event.dataTransfer.files));
    }
  }

  private processFiles(files: File[]) {
    this.avisos = [];
    const disponibles = this.MAX_FILES - this.imagenes.length;
    const aAgregar   = files.slice(0, disponibles);

    for (const file of aAgregar) {
      if (!file.type.startsWith('image/')) {
        this.avisos.push(`“${file.name}” no es una imagen.`);
        continue;
      }
      if (file.size > this.MAX_SIZE) {
        this.avisos.push(`“${file.name}” pesa más de 5 MB.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.imagenes.push({ file, preview: reader.result as string });
      };
      reader.readAsDataURL(file);
    }

    if (files.length > disponibles) {
      this.avisos.push(`Se admiten hasta ${this.MAX_FILES} imágenes por factura; las demás no se agregaron.`);
    }
  }

  removeImagen(index: number) {
    this.imagenes.splice(index, 1);
  }

  onDiscard() {
    this.imagenes = [];
    this.avisos = [];
    this.archivosDescartados.emit();
  }

  /** Limpieza programática desde el padre (post-guardado) */
  reset() {
    this.imagenes = [];
    this.avisos = [];
    this.isDragging = false;
  }

  onUpload() {
    if (this.hasFiles) {
      this.enviarArchivos.emit(this.imagenes.map(i => i.file));
    }
  }
}
