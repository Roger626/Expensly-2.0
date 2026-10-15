import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, finalize, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../auth/services/auth.service';
import { CategoriaDto } from '../../registro-factura/models/categoria.model';

export interface CategoriaInput {
  nombre: string;
  codigoContable?: string;
}

/** Catálogo de categorías contables de la organización (CRUD en /categorias). */
@Injectable({ providedIn: 'root' })
export class AdminCategoriasService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly API = `${environment.apiUrl}/categorias`;

  private readonly _list = signal<CategoriaDto[]>([]);
  readonly list = this._list.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly sorted = computed(() => [...this._list()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));

  load(): void {
    const orgId = this.auth.organizationId();
    if (!orgId) return;
    this.loading.set(true);
    this.error.set(null);
    this.http.get<CategoriaDto[]>(`${this.API}/organizacion/${orgId}`)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => this._list.set(list),
        error: () => this.error.set('No se pudieron cargar las categorías.'),
      });
  }

  create(input: CategoriaInput): Observable<CategoriaDto> {
    // El backend toma la organización del JWT; el DTO igual exige el campo.
    return this.http.post<CategoriaDto>(this.API, { ...input, organizacionId: this.auth.organizationId() })
      .pipe(tap((c) => this._list.update((l) => [...l, c])));
  }

  update(id: string, input: CategoriaInput): Observable<CategoriaDto> {
    return this.http.put<CategoriaDto>(`${this.API}/${id}`, input)
      .pipe(tap((c) => this._list.update((l) => l.map((x) => (x.id === id ? c : x)))));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API}/${id}`)
      .pipe(tap(() => this._list.update((l) => l.filter((x) => x.id !== id))));
  }
}
