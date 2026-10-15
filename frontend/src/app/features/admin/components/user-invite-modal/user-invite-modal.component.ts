import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { FormsModule } from '@angular/forms';
import {
  InvitacionUsuario,
  RolUsuario,
  ROLES_DISPONIBLES,
} from '../../models/usuario.model';
import { ModalComponent } from '../../../../shared/modal/modal.component';

export type InvitarEvent = { email: string; rol: RolUsuario; nombre?: string; };

@Component({
  selector: 'app-user-invite-modal',
  standalone: true,
  imports: [FormsModule, ModalComponent, IconComponent],
  templateUrl: './user-invite-modal.component.html',
  styleUrl: './user-invite-modal.component.css',
})
export class UserInviteModalComponent implements OnChanges {

  // ── Inputs / Outputs ──────────────────────────────────────────────────────
  @Input()  visible   = false;
  /** El padre activa esto mientras el backend procesa la petición. */
  @Input()  isLoading = false;
  /** El padre activa esto cuando el backend confirma el éxito. */
  @Input()  success   = false;
  @Output() cerrar    = new EventEmitter<void>();
  @Output() invitar   = new EventEmitter<InvitarEvent>();

  // ── Estado interno del formulario ─────────────────────────────────────────
  email  = '';
  nombre = '';
  rol: RolUsuario | '' = '';

  /** Placeholder dinámico: muestra la parte local del email si el usuario no ha escrito un nombre. */
  get nombrePlaceholder(): string {
    const local = this.email.split('@')[0];
    return local || 'ej. Juan Pérez';
  }

  /** Valor efectivo que se enviará: lo que escribió el usuario, o la parte local del email. */
  get nombreEfectivo(): string {
    return this.nombre.trim() || this.email.split('@')[0];
  }

  readonly roles: RolUsuario[] = ROLES_DISPONIBLES;

  // Reinicia el formulario cuando el modal se abre
  // y detecta cuando el padre reinicia el estado de éxito
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.resetForm();
    }
    // Cuando el padre hace reset (success false→false no dispara, sólo cuando fue true→false)
    if (changes['success']?.previousValue === true && changes['success']?.currentValue === false) {
      this.resetForm();
    }
  }

  // ── Validación ────────────────────────────────────────────────────────────
  get emailValido(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim());
  }

  get formularioValido(): boolean {
    return this.emailValido && this.rol !== '';
  }

  readonly descripcionRol: Record<RolUsuario, string> = {
    Admin: 'Gestiona usuarios, plan y facturación, además de revisar facturas.',
    Contador: 'Revisa y aprueba facturas, exporta a Excel y administra categorías.',
    Empleado: 'Sube sus facturas y sigue su estado. Solo ve las suyas.',
  };

  // ── Acciones ──────────────────────────────────────────────────────────────
  onCerrar(): void {
    if (this.isLoading) return;
    this.cerrar.emit();
  }

  onEnviar(): void {
    if (!this.formularioValido || this.isLoading) return;
    this.invitar.emit({
      email:  this.email.trim(),
      rol:    this.rol as RolUsuario,
      nombre: this.nombreEfectivo,
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private resetForm(): void {
    this.email  = '';
    this.nombre = '';
    this.rol    = '';
  }
}
