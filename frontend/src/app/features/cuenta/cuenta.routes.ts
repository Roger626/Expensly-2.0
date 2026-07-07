import { Routes } from '@angular/router';

import { CuentaFacturacionComponent } from './pages/cuenta-facturacion/cuenta-facturacion.component';
import { HistorialPagosComponent } from './pages/historial-pagos/historial-pagos.component';

export const cuentaRoutes: Routes = [
  {
    path: 'facturacion/checkout',
    loadComponent: () =>
      import('./pages/checkout-callback/checkout-callback.component').then(
        (m) => m.CheckoutCallbackComponent,
      ),
  },
  {
    path: 'facturacion',
    component: CuentaFacturacionComponent,
  },
  {
    path: 'facturacion/historial',
    component: HistorialPagosComponent,
  },
  {
    path: '',
    redirectTo: 'facturacion',
    pathMatch: 'full',
  },
];
