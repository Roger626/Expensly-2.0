import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  DashboardCategoria, DashboardFiltros, DashboardResumen, DashboardTendencia,
} from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly API = `${environment.apiUrl}/registro-gastos/dashboard`;

  constructor(private readonly http: HttpClient) {}

  getResumen(f: DashboardFiltros): Observable<DashboardResumen> {
    return this.http.get<DashboardResumen>(`${this.API}/resumen`, { params: toParams(f) });
  }

  getTendencia(f: DashboardFiltros): Observable<DashboardTendencia[]> {
    return this.http.get<DashboardTendencia[]>(`${this.API}/tendencia-mensual`, { params: toParams(f) });
  }

  /** El backend no filtra este endpoint por categoría: se omite a propósito. */
  getCategorias(f: DashboardFiltros): Observable<DashboardCategoria[]> {
    return this.http.get<DashboardCategoria[]>(`${this.API}/categorias`, {
      params: toParams({ ...f, categoriaId: undefined }),
    });
  }
}

function toParams(f: DashboardFiltros): HttpParams {
  let p = new HttpParams().set('startDate', f.startDate).set('endDate', f.endDate);
  if (f.categoriaId) p = p.set('categoriaId', f.categoriaId);
  if (f.usuarioId) p = p.set('usuarioId', f.usuarioId);
  return p;
}
