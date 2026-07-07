import { Routes } from '@angular/router';
import { FacturasComponent } from './pages/facturas/facturas.component';
import { CargarFacturaComponent } from '../registro-factura/pages/cargar-factura/cargar-factura.component';
import { UsuariosComponent } from './pages/usuarios/usuarios.component';
import { roleGuard } from '../../core/guards/role.guard';
import { Role } from '../../core/models/roles.enum';

export const adminRoutes: Routes = [
    {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.AdminDashboardPageComponent),
        canActivate: [roleGuard([Role.SUPERADMIN, Role.CONTADOR])]
    },
    { path: 'facturas',       component: FacturasComponent },
    { path: 'facturas/crear', component: CargarFacturaComponent },
    { path: 'usuarios',       component: UsuariosComponent },
];
