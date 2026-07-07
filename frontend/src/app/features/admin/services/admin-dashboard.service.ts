import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly API = `${environment.apiUrl}/registro-gastos/dashboard`;

  constructor(private readonly http: HttpClient) {}

  getDashboardResumen(
    startDate: string,
    endDate: string,
    categoriaId?: string,
    usuarioId?: string
  ): Observable<any> {
    let params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    if (categoriaId) {
      params = params.set('categoriaId', categoriaId);
    }
    if (usuarioId) {
      params = params.set('usuarioId', usuarioId);
    }

    return this.http.get<any>(`${this.API}/resumen`, { params });
  }

  getDashboardTendencia(
    categoriaId?: string,
    usuarioId?: string
  ): Observable<any> {
    let params = new HttpParams();

    if (categoriaId) {
      params = params.set('categoriaId', categoriaId);
    }
    if (usuarioId) {
      params = params.set('usuarioId', usuarioId);
    }

    return this.http.get<any>(`${this.API}/tendencia-mensual`, { params });
  }

  getDashboardCategorias(
    startDate: string,
    endDate: string,
    usuarioId?: string
  ): Observable<any> {
    let params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);

    if (usuarioId) {
      params = params.set('usuarioId', usuarioId);
    }

    return this.http.get<any>(`${this.API}/categorias`, { params });
  }

  getCategorias(orgId: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/categorias/organizacion/${orgId}`);
  }
}
