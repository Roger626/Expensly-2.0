// Formato compartido para montos, fechas y personas (es-PA, dólares).

// En Panamá el balboa circula a la par del dólar y se escribe $1,234.56
const MONEY = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONEY_SHORT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

export const money = (n: number | null | undefined) => MONEY.format(Number(n) || 0);
export const moneyShort = (n: number) => MONEY_SHORT.format(n);

/** Fechas YYYY-MM-DD (o ISO) se muestran en UTC para no correr el día en Panamá (UTC-5). */
export const shortDate = (iso: string | null | undefined) =>
  iso ? `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}` : '';
export const longDate = (iso: string | null | undefined) =>
  iso ? `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}` : '';
export const monthLabel = (ym: string) => `${MONTHS[+ym.slice(5, 7) - 1]} ${ym.slice(2, 4)}`;

/** Días completos desde una fecha YYYY-MM-DD hasta hoy. */
export function daysSince(iso: string): number {
  const d = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const now = new Date();
  return Math.max(0, Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - d) / 86_400_000));
}

export function ageLabel(iso: string): string {
  const d = daysSince(iso);
  return d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '··';
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
}

/** YYYY-MM-DD en hora local. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
