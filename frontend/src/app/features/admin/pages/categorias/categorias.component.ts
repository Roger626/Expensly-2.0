import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminFacadeService } from '../../services/admin.facade.service';
import { CategoriaInput } from '../../services/admin-categorias.service';
import { ToastService } from '../../../../shared/toast/toast.service';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { CategoriaDto } from '../../../registro-factura/models/categoria.model';
import { Factura } from '../../../registro-factura/models/factura.model';
import { money } from '../../../../shared/format/format';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, IconComponent],
  templateUrl: './categorias.component.html',
  styleUrl: './categorias.component.css',
})
export class CategoriasComponent implements OnInit {
  private readonly facade = inject(AdminFacadeService);
  private readonly toast = inject(ToastService);
  readonly money = money;

  readonly store = this.facade.categorias;
  private readonly facturas = toSignal(this.facade.facturas.facturas$, { initialValue: [] as Factura[] });

  readonly search = signal('');
  readonly creating = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly draft = signal<CategoriaInput>({ nombre: '', codigoContable: '' });

  /** Uso de cada categoría según las facturas cargadas (se cruzan por nombre). */
  private readonly uso = computed(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const f of this.facturas()) {
      if (!f.categoria) continue;
      const u = map.get(f.categoria) ?? { count: 0, total: 0 };
      u.count++;
      u.total += f.montoTotal;
      map.set(f.categoria, u);
    }
    return map;
  });

  readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.store.sorted()
      .filter((c) => !term || c.nombre.toLowerCase().includes(term) || (c.codigoContable ?? '').toLowerCase().includes(term))
      .map((c) => ({ ...c, ...(this.uso().get(c.nombre) ?? { count: 0, total: 0 }) }));
  });

  readonly totalSinCategoria = computed(() => this.facturas().filter((f) => !f.categoria).length);

  ngOnInit(): void {
    this.store.load();
    this.facade.facturas.loadAll();
  }

  startCreate(): void {
    this.editingId.set(null);
    this.deletingId.set(null);
    this.draft.set({ nombre: '', codigoContable: '' });
    this.creating.set(true);
    this.focusEditor();
  }

  startEdit(c: CategoriaDto): void {
    this.creating.set(false);
    this.deletingId.set(null);
    this.draft.set({ nombre: c.nombre, codigoContable: c.codigoContable ?? '' });
    this.editingId.set(c.id);
    this.focusEditor();
  }

  private focusEditor(): void {
    setTimeout(() => (document.getElementById('cat-nombre') as HTMLInputElement | null)?.select());
  }

  cancel(): void {
    this.creating.set(false);
    this.editingId.set(null);
  }

  patch(field: keyof CategoriaInput, value: string): void {
    this.draft.update((d) => ({ ...d, [field]: value }));
  }

  /** Mensaje de validación del borrador, o null si se puede guardar. */
  readonly draftError = computed(() => {
    const nombre = this.draft().nombre.trim();
    if (!nombre) return 'Escribe un nombre.';
    const dup = this.store.list().some((c) => c.id !== this.editingId() && c.nombre.trim().toLowerCase() === nombre.toLowerCase());
    return dup ? 'Ya existe una categoría con ese nombre.' : null;
  });

  save(): void {
    if (this.draftError() || this.saving()) return;
    const input: CategoriaInput = {
      nombre: this.draft().nombre.trim(),
      codigoContable: this.draft().codigoContable?.trim() || undefined,
    };
    const id = this.editingId();
    this.saving.set(true);
    (id ? this.store.update(id, input) : this.store.create(input)).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(id ? 'Categoría actualizada' : 'Categoría creada', input.nombre);
        this.cancel();
        if (id) this.facade.facturas.refresh(); // el nombre aparece en las facturas
      },
      error: (e: HttpErrorResponse) => {
        this.saving.set(false);
        this.toast.error('No se pudo guardar la categoría', e.error?.message ?? 'Inténtalo de nuevo.');
      },
    });
  }

  confirmDelete(c: CategoriaDto): void {
    this.cancel();
    this.deletingId.set(c.id);
  }

  remove(c: CategoriaDto): void {
    this.saving.set(true);
    this.store.remove(c.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.deletingId.set(null);
        this.toast.success('Categoría eliminada', c.nombre);
        this.facade.facturas.refresh();
      },
      error: (e: HttpErrorResponse) => {
        this.saving.set(false);
        this.toast.error('No se pudo eliminar la categoría', e.error?.message ?? 'Inténtalo de nuevo.');
      },
    });
  }
}
