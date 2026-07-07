import { Injectable } from '@angular/core';
import { AdminFacturasService } from './admin-facturas.service';
import { AdminUsuariosService } from './admin-usuarios.service';
import { AdminSuscripcionService } from './admin-suscripcion.service';
import { AdminDashboardService } from './admin-dashboard.service';

// ─────────────────────────────────────────────────────────────────────────────
// Admin Facade  (Facade pattern)
//
// Page components inject this single service instead of many individual ones.
// This keeps components thin and makes it easy to add new admin resources
// (usuarios, categorias, reportes…) without touching existing pages.
// ─────────────────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class AdminFacadeService {
  constructor(
    /** Invoice management (CRUD + pagination). */
    readonly facturas: AdminFacturasService,

    /** User management (list + invite). */
    readonly usuarios: AdminUsuariosService,

    /** Subscription management (plan, billing, PF config). */
    readonly suscripciones: AdminSuscripcionService,

    /** Dashboard analysis. */
    readonly dashboard: AdminDashboardService,
  ) {}
}
