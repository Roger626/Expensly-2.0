import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, combineLatest, map, Subscription, filter, delay } from 'rxjs';

import { UserTableComponent, MenuAccionEvent } from '../../components/user-table/user-table.component';
import { UserInviteModalComponent, InvitarEvent } from '../../components/user-invite-modal/user-invite-modal.component';
import { UserRoleGuideComponent } from '../../components/user-role-guide/user-role-guide.component';
import { UserActionModalComponent, ActionModalMode, RolCambiadoEvent } from '../../components/user-action-modal/user-action-modal.component';
import { SuscripcionBannerComponent } from '../../../../shared/suscripcion-banner/suscripcion-banner.component';
import { AdminFacadeService } from '../../services/admin.facade.service';
import { UsuarioTabla, ROL_DISPLAY_TO_BACKEND } from '../../models/usuario.model';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [
    AsyncPipe,
    FormsModule,
    UserTableComponent,
    UserInviteModalComponent,
    UserRoleGuideComponent,
    UserActionModalComponent,
    SuscripcionBannerComponent,
  ],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css'
})
export class UsuariosComponent implements OnInit, OnDestroy {

  private readonly facade = inject(AdminFacadeService);
  private readonly subs   = new Subscription();

  ngOnInit(): void {
    this.facade.usuarios.loadAll();

    // Cierra el modal automáticamente 1.8 s después de que el backend confirme éxito
    this.subs.add(
      this.facade.usuarios.inviteSuccess$.pipe(
        filter(ok => ok),
        delay(1800),
      ).subscribe(() => {
        this.modalVisible = false;
        this.facade.usuarios.resetInviteState();
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ── Streams del facade ────────────────────────────────────────────────────
  protected readonly isLoading$     = this.facade.usuarios.isLoading$;
  protected readonly error$         = this.facade.usuarios.error$;
  protected readonly isInviting$    = this.facade.usuarios.isInviting$;
  protected readonly inviteSuccess$ = this.facade.usuarios.inviteSuccess$;

  // ── Búsqueda / paginación (estado local) ─────────────────────────────────
  protected busqueda       = '';
  protected paginaActual   = 1;
  protected itemsPorPagina = 10;

  // ── Modal Invitar ──────────────────────────────────────────────────────────────
  protected modalVisible = false;

  // ── Modal Acción (cambiar rol / eliminar) ──────────────────────────────
  protected actionModalVisible = false;
  protected actionModalMode: ActionModalMode = 'cambiar-rol';
  protected actionModalUsuario: UsuarioTabla | null = null;

  // ── Lista filtrada + paginada ─────────────────────────────────────────────
  protected readonly usuariosFiltrados$: Observable<UsuarioTabla[]> =
    this.facade.usuarios.usuarios$.pipe(
      map(lista => {
        const q = this.busqueda.toLowerCase().trim();
        if (!q) return lista;
        return lista.filter(
          u =>
            u.nombre.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q)  ||
            u.rol.toLowerCase().includes(q),
        );
      }),
    );

  protected readonly vm$ = combineLatest([
    this.usuariosFiltrados$,
    this.facade.usuarios.isLoading$,
    this.facade.usuarios.error$,
    this.facade.usuarios.isInviting$,
    this.facade.usuarios.inviteSuccess$,
  ]).pipe(
    map(([filtrados, isLoading, error, isInviting, inviteSuccess]) => ({
      filtrados,
      isLoading,
      error,
      isInviting,
      inviteSuccess,
      paginados:   filtrados.slice(
        (this.paginaActual - 1) * this.itemsPorPagina,
        this.paginaActual * this.itemsPorPagina,
      ),
      total: filtrados.length,
    })),
  );

  // ── Handlers de búsqueda / paginación ────────────────────────────────────
  onBuscar(valor: string): void {
    this.busqueda = valor;
    this.paginaActual = 1;
  }

  onPageChange(page: number): void {
    this.paginaActual = page;
  }

  // ── Handlers del modal ───────────────────────────────────────────────────
  abrirModal(): void {
    this.modalVisible = true;
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.facade.usuarios.resetInviteState();
  }

  onInvitar(evento: InvitarEvent): void {
    const rolBackend = ROL_DISPLAY_TO_BACKEND[evento.rol];
    this.facade.usuarios.inviteUser(evento.email, rolBackend, evento.nombre);
  }

  // ── Handler de acciones de la tabla ──────────────────────────────────────
  onMenuAccion(evento: MenuAccionEvent): void {
    const { accion, usuario } = evento;
    if (accion === 'activar') {
      this.facade.usuarios.setUserStatus(usuario.id, true);
    } else if (accion === 'desactivar') {
      this.facade.usuarios.setUserStatus(usuario.id, false);
    } else if (accion === 'cambiar-rol' || accion === 'eliminar') {
      this.actionModalMode    = accion;
      this.actionModalUsuario = usuario;
      this.actionModalVisible = true;
    }
  }

  onRolCambiado(evento: RolCambiadoEvent): void {
    this.facade.usuarios.updateUserRole(evento.userId, evento.rol);
  }

  onEliminado(userId: string): void {
    this.facade.usuarios.deleteUser(userId);
  }
}
