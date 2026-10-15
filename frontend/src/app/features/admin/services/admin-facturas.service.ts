import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, combineLatest, tap } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';

import { Factura } from '../../registro-factura/models/factura.model';
import { FacturaApiResponse, mapFacturaApiToModel } from '../models/admin-factura.model';
import { IAdminFacturasService } from '../interfaces/iadmin-facturas.service';
import { applyInvoiceQuery, nextSort } from '../models/invoice-query';
import { DEFAULT_FILTER, DEFAULT_SORT, InvoiceFilterState, InvoiceSort } from '../models/invoice-filter-state.model';
import { environment } from '../../../../environments/environment';

// ─────────────────────────────────────────────────────────────────────────────
// Single Responsibility: this service manages ONLY invoice data for the admin.
// Open/Closed: new behaviour (filters, sorting) can be added without changing
//              existing code — just extend the computed observables.
// ─────────────────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class AdminFacturasService implements IAdminFacturasService {

  private readonly API = `${environment.apiUrl}/registro-gastos`;

  // ── Private mutable state (BehaviorSubject) ───────────────────────────────
  private readonly _facturas$     = new BehaviorSubject<Factura[]>([]);
  private readonly _isLoading$    = new BehaviorSubject<boolean>(false);
  private readonly _error$        = new BehaviorSubject<string | null>(null);
  private readonly _currentPage$  = new BehaviorSubject<number>(1);
  private readonly _itemsPerPage$ = new BehaviorSubject<number>(10);
  private readonly _filter$       = new BehaviorSubject<InvoiceFilterState>(DEFAULT_FILTER);
  private readonly _sort$         = new BehaviorSubject<InvoiceSort>(DEFAULT_SORT);

  // ── Public Observable streams ─────────────────────────────────────────────
  readonly facturas$     = this._facturas$.asObservable();
  readonly isLoading$    = this._isLoading$.asObservable();
  readonly error$        = this._error$.asObservable();
  readonly currentPage$  = this._currentPage$.asObservable();
  readonly itemsPerPage$ = this._itemsPerPage$.asObservable();
  readonly filter$       = this._filter$.asObservable();
  readonly sort$         = this._sort$.asObservable();

  /** Categorías únicas derivadas de la lista completa (sin filtrar). */
  readonly availableCategories$: Observable<string[]> = this._facturas$.pipe(
    map(list => {
      const cats = new Set(list.map(f => f.categoria).filter((c): c is string => !!c));
      return [...cats].sort();
    }),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
  );

  /** Facturas filtradas según los criterios actuales. */
  readonly filteredFacturas$ = combineLatest([this._facturas$, this._filter$, this._sort$]).pipe(
    map(([facturas, filter, sort]) => applyInvoiceQuery(facturas, filter, sort)),
  );

  /** Total de facturas coincidentes (respeta filtros). */
  readonly totalItems$ = this.filteredFacturas$.pipe(
    map(list => list.length)
  );

  /** Facturas recortadas para la página actual. */
  readonly pagedFacturas$ = combineLatest([
    this.filteredFacturas$,
    this._currentPage$,
    this._itemsPerPage$,
  ]).pipe(
    map(([facturas, page, size]) => {
      const start = (page - 1) * size;
      return facturas.slice(start, start + size);
    })
  );

  /** Estadísticas globales (siempre sobre TODAS las facturas, ignora filtros). */
  readonly stats$ = this._facturas$.pipe(
    map(facturas => {
      const hoy  = new Date();
      const mes  = hoy.getMonth();
      const anio = hoy.getFullYear();
      return {
        total:        facturas.length,
        aprobadas:    facturas.filter(f => f.estado === 'APROBADO').length,
        pendientes:   facturas.filter(f => f.estado === 'PENDIENTE').length,
        rechazadas:   facturas.filter(f => f.estado === 'RECHAZADO').length,
        totalAprobado: facturas
          .filter(f => f.estado === 'APROBADO')
          .reduce((s, f) => s + f.montoTotal, 0),
        esteMes: facturas.filter(f => {
          const d = new Date(f.fechaEmision);
          return d.getMonth() === mes && d.getFullYear() === anio;
        }).length,
      };
    }),
  );

  constructor(private readonly http: HttpClient) {}

  // ── Comandos ──────────────────────────────────────────────────────────────

  /** Carga todas las facturas. No hace nada si ya hay una petición en curso. */
  loadAll(): void {
    if (this._isLoading$.getValue()) return;

    this._isLoading$.next(true);
    this._error$.next(null);

    this.http.get<FacturaApiResponse[]>(this.API).subscribe({
      next: (data) => {
        this._facturas$.next(data.map(mapFacturaApiToModel));
        this._isLoading$.next(false);
      },
      error: () => {
        this._error$.next('No se pudieron cargar las facturas. Intenta nuevamente.');
        this._isLoading$.next(false);
      },
    });
  }

  /** Navega a una página específica. */
  goToPage(page: number): void {
    this._currentPage$.next(page);
  }

  /** Actualiza los filtros y resetea a la primera página. */
  setFilter(state: InvoiceFilterState): void {
    this._currentPage$.next(1);
    this._filter$.next(state);
  }

  /** Cambia el orden; si es la misma columna, invierte la dirección. */
  toggleSort(key: InvoiceSort['key']): void {
    this._sort$.next(nextSort(this._sort$.getValue(), key));
  }

  /** Snapshot del filtro actual (sin suscripción). */
  getCurrentFilter(): InvoiceFilterState {
    return this._filter$.getValue();
  }

  /** Cambia solo el filtro de estados preservando el resto. */
  setStatusFilter(statuses: string[]): void {
    this._filter$.next({ ...this._filter$.getValue(), selectedStatuses: statuses });
    this._currentPage$.next(1);
  }

  /** Limpia la caché local y recarga todo desde la API. */
  refresh(): void {
    this._facturas$.next([]);
    this._currentPage$.next(1);
    this.loadAll();
  }

  /**
   * Aprueba o rechaza una factura.
   * Actualiza la caché local para reflejar el cambio inmediatamente.
   */
  updateEstado(
    id: string,
    estado: string,
    motivoRechazo?: string,
  ): Observable<Factura> {
    return this.http
      .put<FacturaApiResponse>(`${this.API}/update/${id}`, { estado, motivoRechazo })
      .pipe(
        map(mapFacturaApiToModel),
        tap((updated) => {
          const current = this._facturas$.getValue();
          this._facturas$.next(current.map(f => f.facturaId === id ? updated : f));
        }),
      );
  }

  /**
   * Exporta un subconjunto de facturas a Excel.
   * Recibe los IDs a exportar y devuelve un Blob listo para descargar.
   */
  exportToExcel(ids: string[]): Observable<Blob> {
    return this.http.post(`${this.API}/export`, { ids }, { responseType: 'blob' });
  }
}

