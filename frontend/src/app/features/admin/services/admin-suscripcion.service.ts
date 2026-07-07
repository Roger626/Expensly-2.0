import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  SuscripcionDto,
  PagoDto,
  PaginatedDto,
  ConfirmarCobroDto,
  CrearEnlacePagoRequestDto,
  CrearEnlacePagoResponseDto,
} from '../models/suscripcion.dto';
import { environment } from '../../../../environments/environment';

/**
 * Admin subscription management service.
 * Follows the same observable-based pattern as AdminFacturasService
 * and AdminUsuariosService — plain HttpClient, no BehaviorSubject state.
 */
@Injectable({ providedIn: 'root' })
export class AdminSuscripcionService {
  private readonly API = `${environment.apiUrl}/suscripciones`;

  constructor(private readonly http: HttpClient) {}

  /** Returns the current subscription for the authenticated org. */
  obtenerActual(): Observable<SuscripcionDto> {
    return this.http.get<SuscripcionDto>(`${this.API}/actual`);
  }

  /** Returns paginated pago history. */
  obtenerHistorial(
    page: number = 1,
    limit: number = 20,
  ): Observable<PaginatedDto<PagoDto>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    return this.http.get<PaginatedDto<PagoDto>>(`${this.API}/historial`, {
      params,
    });
  }

  /** Confirms a payment after PF onTxSuccess returns a codOper. */
  confirmarCobro(body: ConfirmarCobroDto): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.API}/cobrar`, body);
  }

  /** Initiates the Enlace de Pago (redirect) flow. Returns a checkout URL for PF. */
  crearEnlacePago(
    body: CrearEnlacePagoRequestDto,
  ): Observable<CrearEnlacePagoResponseDto> {
    return this.http.post<CrearEnlacePagoResponseDto>(
      `${this.API}/crear-enlace-pago`,
      body,
    );
  }
}
