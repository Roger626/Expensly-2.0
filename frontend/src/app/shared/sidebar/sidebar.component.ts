import { Component, EventEmitter, Output, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icons.generated';
import { AuthService } from '../../features/auth/services/auth.service';
import { Role } from '../../core/models/roles.enum';

interface NavItem {
  label: string;
  link: string;
  icon: IconName;
  activeIcon: IconName;
  exact?: boolean;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { label: 'Dashboard', link: '/admin/dashboard', icon: 'widget-5-linear', activeIcon: 'widget-5-bold-duotone', exact: true },
  { label: 'Facturas', link: '/admin/facturas', icon: 'bill-list-linear', activeIcon: 'bill-list-bold-duotone', exact: true },
  { label: 'Nueva Factura', link: '/admin/facturas/crear', icon: 'document-add-linear', activeIcon: 'document-add-bold-duotone' },
  { label: 'Usuarios', link: '/admin/usuarios', icon: 'users-group-rounded-linear', activeIcon: 'users-group-rounded-bold-duotone', roles: [Role.SUPERADMIN] },
  { label: 'Categorías', link: '/admin/categorias', icon: 'tag-linear', activeIcon: 'tag-bold-duotone' },
  { label: 'Facturación', link: '/cuenta/facturacion', icon: 'card-linear', activeIcon: 'card-bold-duotone', roles: [Role.SUPERADMIN] },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  private readonly auth = inject(AuthService);

  isCollapsed = false;
  @Output() logout = new EventEmitter<void>();
  @Output() collapsedChange = new EventEmitter<boolean>();

  readonly items = computed(() => {
    const role = this.auth.userRole() as Role | null;
    return NAV.filter((i) => !i.roles || (role && i.roles.includes(role)));
  });

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
    this.collapsedChange.emit(this.isCollapsed);
  }

  onLogout(): void {
    this.logout.emit();
  }
}
