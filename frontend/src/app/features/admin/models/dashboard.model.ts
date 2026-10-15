// Respuestas de /registro-gastos/dashboard/* (ver registro-gastos.repository.ts en el backend)

export type EstadoFactura = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

export interface DashboardTransaccion {
  id: string;
  empleado: string;
  categoria: string;
  fecha: string;          // YYYY-MM-DD
  montoTotal: number;
  estado: EstadoFactura | null;
}

export interface DashboardResumen {
  gastoTotal: number;
  itbmsRecuperable: number;
  tasaRecuperacion: number;               // % del gasto
  variacionGastoTotal: number | null;     // % vs periodo anterior
  variacionItbmsRecuperable: number | null;
  aprobacionesPendientes: number;
  reportesVencidos: number;               // pendientes con más de 48 h
  ultimasTransacciones: DashboardTransaccion[];
}

export interface DashboardTendencia {
  mes: string;            // YYYY-MM
  montoTotal: number;
  itbms: number;
}

export interface DashboardCategoria {
  id: string | null;
  name: string;
  montoTotal: number;
  count: number;
  percentage: number;
}

export interface DashboardFiltros {
  startDate: string;
  endDate: string;
  categoriaId?: string;
  usuarioId?: string;
}

export const EMPTY_RESUMEN: DashboardResumen = {
  gastoTotal: 0,
  itbmsRecuperable: 0,
  tasaRecuperacion: 0,
  variacionGastoTotal: null,
  variacionItbmsRecuperable: null,
  aprobacionesPendientes: 0,
  reportesVencidos: 0,
  ultimasTransacciones: [],
};
