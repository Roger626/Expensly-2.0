import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  UsuarioApiResponse,
  UsuarioTabla,
  RolBackend,
  mapApiUsuarioToTabla,
} from '../models/usuario.model';
import { IAdminUsuariosService } from '../interfaces/iadmin-usuarios.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { environment } from '../../../../environments/environment';

// ─────────────────────────────────────────────────────────────────────────────
// AdminUsuariosService
//   - Carga usuarios de la organización (GET /auth/users)
//   - Invita nuevos usuarios (POST /auth/invite)
// ─────────────────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class AdminUsuariosService implements IAdminUsuariosService {

  private readonly API = `${environment.apiUrl}/auth`;

  // ── Estado privado ────────────────────────────────────────────────────────
  private readonly _usuarios$      = new BehaviorSubject<UsuarioTabla[]>([]);
  private readonly _isLoading$     = new BehaviorSubject<boolean>(false);
  private readonly _error$         = new BehaviorSubject<string | null>(null);
  private readonly _isInviting$    = new BehaviorSubject<boolean>(false);
  private readonly _inviteSuccess$ = new BehaviorSubject<boolean>(false);

  // ── Streams públicos (sólo lectura) ───────────────────────────────────────
  readonly usuarios$      = this._usuarios$.asObservable();
  readonly isLoading$     = this._isLoading$.asObservable();
  readonly error$         = this._error$.asObservable();
  readonly isInviting$    = this._isInviting$.asObservable();
  readonly inviteSuccess$ = this._inviteSuccess$.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly toast: ToastService,
  ) {}

  // ── Cargar usuarios ───────────────────────────────────────────────────────
  loadAll(): void {
    this._isLoading$.next(true);
    this._error$.next(null);

    this.http
      .get<UsuarioApiResponse[]>(`${this.API}/users`)
      .pipe(finalize(() => this._isLoading$.next(false)))
      .subscribe({
        next: (list) =>
          this._usuarios$.next(list.map(u => mapApiUsuarioToTabla(u))),
        error: (err) =>
          this._error$.next(
            err?.error?.message ?? 'No se pudo cargar la lista de usuarios.',
          ),
      });
  }

  // ── Invitar usuario ───────────────────────────────────────────────────────
  inviteUser(email: string, rol: RolBackend, nombre?: string): void {
    this._isInviting$.next(true);
    this._inviteSuccess$.next(false);
    this._error$.next(null);

    const body: Record<string, string> = { email, rol };
    if (nombre?.trim()) body['nombre'] = nombre.trim();

    this.http
      .post<{ message: string; tempPassword: string }>(`${this.API}/invite`, body)
      .pipe(finalize(() => this._isInviting$.next(false)))
      .subscribe({
        next: () => {
          this._inviteSuccess$.next(true);
          this.loadAll();
          const displayName = nombre?.trim() || email.split('@')[0];
          this.toast.success(
            'Invitación enviada',
            `${displayName} recibirá sus credenciales por correo.`,
          );
        },
        error: (err) => {
          const msg = err?.error?.message ?? 'Error al enviar la invitación.';
          this._error$.next(msg);
          this.toast.error('No se pudo invitar', msg);
        },
      });
  }

  // ── Reiniciar estado del modal de invitación ──────────────────────────────
  resetInviteState(): void {
    this._inviteSuccess$.next(false);
    this._error$.next(null);
  }

  // ── Cambiar estado activo/desactivado ──────────────────────────────
  setUserStatus(userId: string, activo: boolean): void {
    this._error$.next(null);
    this.http
      .patch<void>(`${this.API}/users/${userId}/status`, { activo })
      .subscribe({
        next: () => {
          this.loadAll();
          this.toast.success(activo ? 'Usuario activado' : 'Usuario desactivado', activo ? 'Ya puede iniciar sesión.' : 'Ya no podrá iniciar sesión.');
        },
        error: (err) => this.toast.error('No se pudo cambiar el estado', err?.error?.message ?? 'Inténtalo de nuevo.'),
      });
  }

  // ── Cambiar rol ──────────────────────────────────────────────────────────
  updateUserRole(userId: string, rol: RolBackend): void {
    this._error$.next(null);
    this.http
      .patch<void>(`${this.API}/users/${userId}/role`, { rol })
      .subscribe({
        next: () => {
          this.loadAll();
          this.toast.success('Rol actualizado', 'Los permisos cambian en su próximo inicio de sesión.');
        },
        error: (err) => this.toast.error('No se pudo cambiar el rol', err?.error?.message ?? 'Inténtalo de nuevo.'),
      });
  }

  // ── Eliminar usuario ────────────────────────────────────────────────────────
  deleteUser(userId: string): void {
    this._error$.next(null);
    this.http
      .delete<void>(`${this.API}/users/${userId}`)
      .subscribe({
        next: () => {
          this.loadAll();
          this.toast.success('Usuario eliminado', 'Sus facturas se conservan para auditoría.');
        },
        error: (err) => this.toast.error('No se pudo eliminar', err?.error?.message ?? 'Inténtalo de nuevo.'),
      });
  }
}
