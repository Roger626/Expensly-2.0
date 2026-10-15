import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { UsuarioTabla } from '../../models/usuario.model';
import { IconComponent } from '../../../../shared/icon/icon.component';

export interface MenuAccionEvent {
  accion: 'activar' | 'desactivar' | 'cambiar-rol' | 'eliminar';
  usuario: UsuarioTabla;
}

@Component({
  selector: 'app-user-table',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './user-table.component.html',
  styleUrl: './user-table.component.css',
})
export class UserTableComponent {
  @Input() usuarios: UsuarioTabla[] = [];
  @Input() totalCount = 0;
  @Input() paginaActual = 1;
  @Input() itemsPorPagina = 10;
  @Input() currentUserId = '';
  @Input() hasFilter = false;

  @Output() pageChange = new EventEmitter<number>();
  @Output() menuAccion = new EventEmitter<MenuAccionEvent>();
  @Output() invitar = new EventEmitter<void>();

  menuAbiertoId: string | null = null;

  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  cerrarMenu(): void {
    this.menuAbiertoId = null;
  }

  toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.menuAbiertoId = this.menuAbiertoId === id ? null : id;
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.itemsPorPagina));
  }
  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }
  get primerItem(): number {
    return this.totalCount === 0 ? 0 : (this.paginaActual - 1) * this.itemsPorPagina + 1;
  }
  get ultimoItem(): number {
    return Math.min(this.paginaActual * this.itemsPorPagina, this.totalCount);
  }
  irPagina(p: number): void {
    if (p >= 1 && p <= this.totalPaginas && p !== this.paginaActual) this.pageChange.emit(p);
  }

  dispatch(accion: MenuAccionEvent['accion'], usuario: UsuarioTabla, event: MouseEvent): void {
    event.stopPropagation();
    this.menuAbiertoId = null;
    this.menuAccion.emit({ accion, usuario });
  }

  rolTone(rol: string): string {
    return rol === 'Admin' ? 'brand' : rol === 'Contador' ? 'violet' : 'plain';
  }
}
