import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { Role } from './core/models/roles.enum';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.authRoutes),
  },
  {
    // Módulo de empleados: solo accesible para EMPLEADO
    path: 'facturas',
    canActivate: [authGuard, roleGuard([Role.EMPLEADO])],
    loadChildren: () =>
      import('./features/registro-factura/registro-factura.routes').then(
        m => m.registroFacturaRoutes
      ),
  },
  {
    // Módulo de administración: solo accesible para SUPERADMIN y CONTADOR
    path: 'admin',
    canActivate: [authGuard, roleGuard([Role.SUPERADMIN, Role.CONTADOR])],
    loadChildren: () =>
      import('./features/admin/admin.routes').then(m => m.adminRoutes),
  },

  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(m => m.LandingComponent),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./shared/not-found/not-found.component').then(m => m.NotFoundComponent),
  },
];

