import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/auth`;
  private readonly TOKEN_KEY = 'access_token';
  private readonly USER_KEY = 'auth_user';

  // ─── Estado reactivo con Signals ───────────────────────────────────────────
  private readonly _currentUser = signal<AuthUser | null>(this._loadUserFromStorage());
  private readonly _token       = signal<string | null>(localStorage.getItem(this.TOKEN_KEY));

  /** Señal pública del usuario autenticado */
  readonly currentUser = this._currentUser.asReadonly();

  /**
   * true si hay sesión activa con token no expirado.
   * La verificación de firma JWT recae en el backend;
   * aquí solo comprobamos la claim `exp` del payload.
   */
  readonly isAuthenticated = computed(() => {
    const token = this._token();
    if (!token || !this._currentUser()) return false;
    return !this._isTokenExpired(token);
  });

  /** ID de la organización del usuario autenticado */
  readonly organizationId = computed(() => this._currentUser()?.organizationId ?? null);

  /** Rol del usuario autenticado */
  readonly userRole = computed(() => this._currentUser()?.role ?? null);

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, { email, password }).pipe(
      tap(res => this.saveSession(res))
    );
  }

  getFriendlyErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }

    const message = this.extractResponseMessage(error.error);
    if (message) {
      return message;
    }

    if (error.status === 401) {
      return 'Correo o contraseña incorrectos.';
    }

    if (error.status === 409) {
      return 'Ya existe un registro con esos datos.';
    }

    if (error.status === 504 || error.status === 408) {
      return 'El servidor tardó demasiado en responder. Intenta de nuevo.';
    }

    if (error.status === 0) {
      return 'No fue posible conectar con el servidor. Revisa tu conexión e inténtalo otra vez.';
    }

    return fallback;
  }

  /**
   * Paso 1 — Solicita el enlace de restablecimiento de contraseña.
   * El backend envía el correo si el email existe (respuesta siempre genérica).
   */
  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/forgot-password`, { email });
  }

  /**
   * Paso 2 — Restablece la contraseña usando el token del correo.
   */
  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/reset-password`, { token, newPassword });
  }

  logout(): void {
    this.http.post(`${this.API_URL}/logout`, {}).subscribe({ error: () => {} });
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._token.set(null);
    this._currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  saveSession(authData: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, authData.accessToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(authData.user));
    this._token.set(authData.accessToken);
    this._currentUser.set(authData.user);
  }

  getToken(): string | null {
    return this._token();
  }

  getUser(): AuthUser | null {
    return this._currentUser();
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }

  private _loadUserFromStorage(): AuthUser | null {
    const raw = localStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  private extractResponseMessage(payload: unknown): string | null {
    if (!payload) {
      return null;
    }

    if (typeof payload === 'string') {
      return payload;
    }

    if (typeof payload === 'object' && 'message' in payload) {
      const message = (payload as { message?: string | string[] }).message;
      if (Array.isArray(message)) {
        return message.join(' ');
      }

      return message ?? null;
    }

    return null;
  }

  /** Decodifica el payload del JWT sin verificar la firma. */
  getTokenPayload(): Record<string, unknown> | null {
    const token = this._token();
    if (!token) return null;
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const json  = decodeURIComponent(
        atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  /** Comprueba si la claim `exp` del token ya venció. */
  private _isTokenExpired(token: string): boolean {
    try {
      const base64  = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      return typeof payload.exp === 'number' && Date.now() >= payload.exp * 1000;
    } catch {
      return true; // Si no puede decodearse, se considera expirado
    }
  }
}

