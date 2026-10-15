import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription, delay, filter } from 'rxjs';

import { UserTableComponent, MenuAccionEvent } from '../../components/user-table/user-table.component';
import { UserInviteModalComponent, InvitarEvent } from '../../components/user-invite-modal/user-invite-modal.component';
import { UserRoleGuideComponent } from '../../components/user-role-guide/user-role-guide.component';
import { UserActionModalComponent, ActionModalMode, RolCambiadoEvent } from '../../components/user-action-modal/user-action-modal.component';
import { SuscripcionBannerComponent } from '../../../../shared/suscripcion-banner/suscripcion-banner.component';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { AdminFacadeService } from '../../services/admin.facade.service';
import { AuthService } from '../../../auth/services/auth.service';
import { UsuarioTabla, RolUsuario, ROL_DISPLAY_TO_BACKEND } from '../../models/usuario.model';

type RolFiltro = 'Todos' | RolUsuario;
const PAGE_SIZE = 10;

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [AsyncPipe, FormsModule, UserTableComponent, UserInviteModalComponent, UserRoleGuideComponent,
    UserActionModalComponent, SuscripcionBannerComponent, IconComponent],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css',
})
export class UsuariosComponent implements OnInit, OnDestroy {
  private readonly facade = inject(AdminFacadeService);
  private readonly auth = inject(AuthService);
  private readonly subs = new Subscription();

  protected readonly usuarios = toSignal(this.facade.usuarios.usuarios$, { initialValue: [] as UsuarioTabla[] });
  protected readonly isLoading$ = this.facade.usuarios.isLoading$;
  protected readonly error$ = this.facade.usuarios.error$;
  protected readonly isInviting$ = this.facade.usuarios.isInviting$;
  protected readonly inviteSuccess$ = this.facade.usuarios.inviteSuccess$;
  protected readonly currentUserId = computed(() => this.auth.currentUser()?.id ?? '');

  // ── Búsqueda, filtro de rol y paginación ─────────────────────
  protected readonly busqueda = signal('');
  protected readonly rol = signal<RolFiltro>('Todos');
  protected readonly pagina = signal(1);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly roles: RolFiltro[] = ['Todos', 'Admin', 'Contador', 'Empleado'];

  protected readonly conteo = computed(() => {
    const c: Record<RolFiltro, number> = { Todos: 0, Admin: 0, Contador: 0, Empleado: 0 };
    for (const u of this.usuarios()) { c.Todos++; c[u.rol]++; }
    return c;
  });

  protected readonly filtrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    const rol = this.rol();
    return this.usuarios().filter((u) =>
      (rol === 'Todos' || u.rol === rol) &&
      (!q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
  });

  protected readonly paginados = computed(() =>
    this.filtrados().slice((this.pagina() - 1) * PAGE_SIZE, this.pagina() * PAGE_SIZE));

  // ── Modales ──────────────────────────────────────────────────
  protected modalVisible = false;
  protected actionModalVisible = false;
  protected actionModalMode: ActionModalMode = 'cambiar-rol';
  protected actionModalUsuario: UsuarioTabla | null = null;

  ngOnInit(): void {
    this.facade.usuarios.loadAll();
    // Cierra el modal de invitación poco después de confirmar el éxito
    this.subs.add(
      this.facade.usuarios.inviteSuccess$.pipe(filter(Boolean), delay(1800)).subscribe(() => {
        this.modalVisible = false;
        this.facade.usuarios.resetInviteState();
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  onBuscar(valor: string): void {
    this.busqueda.set(valor);
    this.pagina.set(1);
  }

  onRol(r: RolFiltro): void {
    this.rol.set(r);
    this.pagina.set(1);
  }

  abrirModal(): void {
    this.modalVisible = true;
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.facade.usuarios.resetInviteState();
  }

  onInvitar(e: InvitarEvent): void {
    this.facade.usuarios.inviteUser(e.email, ROL_DISPLAY_TO_BACKEND[e.rol], e.nombre);
  }

  onMenuAccion({ accion, usuario }: MenuAccionEvent): void {
    if (accion === 'activar' || accion === 'desactivar') {
      this.facade.usuarios.setUserStatus(usuario.id, accion === 'activar');
    } else {
      this.actionModalMode = accion;
      this.actionModalUsuario = usuario;
      this.actionModalVisible = true;
    }
  }

  onRolCambiado(e: RolCambiadoEvent): void {
    this.facade.usuarios.updateUserRole(e.userId, e.rol);
  }

  onEliminado(userId: string): void {
    this.facade.usuarios.deleteUser(userId);
  }
}
