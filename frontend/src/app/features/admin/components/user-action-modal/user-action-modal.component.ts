import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
} from '@angular/core';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../../shared/modal/modal.component';
import { UsuarioTabla, RolUsuario, RolBackend, ROLES_DISPONIBLES, ROL_DISPLAY_TO_BACKEND } from '../../models/usuario.model';

export type ActionModalMode = 'cambiar-rol' | 'eliminar';

export interface RolCambiadoEvent {
  userId: string;
  rol: RolBackend;
}

@Component({
  selector: 'app-user-action-modal',
  standalone: true,
  imports: [FormsModule, ModalComponent, IconComponent],
  templateUrl: './user-action-modal.component.html',
  styleUrl: './user-action-modal.component.css',
})
export class UserActionModalComponent implements OnChanges {

  @Input() visible  = false;
  @Input() mode: ActionModalMode = 'cambiar-rol';
  @Input() usuario: UsuarioTabla | null = null;

  @Output() cerrar       = new EventEmitter<void>();
  @Output() rolCambiado  = new EventEmitter<RolCambiadoEvent>();
  @Output() eliminado    = new EventEmitter<string>();

  rolSeleccionado: RolUsuario | '' = '';
  readonly roles: RolUsuario[] = ROLES_DISPONIBLES;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true && this.usuario) {
      this.rolSeleccionado = this.usuario.rol;
    }
  }

  get titulo(): string {
    return this.mode === 'eliminar' ? 'Eliminar usuario' : 'Cambiar rol';
  }

  get subtitulo(): string {
    return this.usuario ? `${this.usuario.nombre} · ${this.usuario.email}` : '';
  }

  get modalVariant() {
    return this.mode === 'eliminar' ? 'danger' as const : 'default' as const;
  }

  onConfirmar(): void {
    if (!this.usuario) return;
    if (this.mode === 'eliminar') {
      this.eliminado.emit(this.usuario.id);
    } else {
      if (!this.rolSeleccionado) return;
      this.rolCambiado.emit({
        userId: this.usuario.id,
        rol: ROL_DISPLAY_TO_BACKEND[this.rolSeleccionado as RolUsuario],
      });
    }
    this.cerrar.emit();
  }

  onCerrar(): void {
    this.cerrar.emit();
  }
}
