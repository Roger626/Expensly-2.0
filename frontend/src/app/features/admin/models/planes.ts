// Catálogo de planes. Fuente de verdad del precio: PLAN_PRICES en
// backend/src/modules/suscripciones/controllers/suscripciones.controller.ts
export type PlanKey = 'basic' | 'pro' | 'premium';

export interface Plan {
  key: PlanKey;
  nombre: string;
  precio: number;          // USD al mes
  para: string;
}

export const PLANES: Plan[] = [
  { key: 'basic', nombre: 'Basic', precio: 1, para: 'Equipos pequeños que empiezan a ordenar sus facturas.' },
  { key: 'pro', nombre: 'Pro', precio: 5, para: 'Empresas con varios empleados registrando gastos cada semana.' },
  { key: 'premium', nombre: 'Premium', precio: 10, para: 'Organizaciones con más volumen de facturas y usuarios.' },
];

export const planDe = (key: string | null | undefined): Plan => PLANES.find((p) => p.key === key) ?? PLANES[1];

export const ESTADO_SUSCRIPCION: Record<string, { label: string; tone: string }> = {
  Trial: { label: 'En prueba', tone: 'brand' },
  Activa: { label: 'Activa', tone: 'ok' },
  PendientePago: { label: 'Pago pendiente', tone: 'warn' },
  Suspendida: { label: 'Suspendida', tone: 'danger' },
  Cancelada: { label: 'Cancelada', tone: 'plain' },
};
