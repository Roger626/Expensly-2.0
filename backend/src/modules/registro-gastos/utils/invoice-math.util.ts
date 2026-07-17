import { FacturaProcesamientoResult } from '../strategies/factura-procesar.strategy.interface';

/**
 * Reconcilia subtotal/impuesto/total cuando la extracción (regex, LLM-texto
 * o LLM-visión) trae valores inconsistentes. Es una capa determinística que
 * corre SIEMPRE después de cualquier método de extracción — no hay que
 * confiar en que el regex o el LLM hagan bien la aritmética.
 */
export function reconcileInvoiceTotals(result: FacturaProcesamientoResult): FacturaProcesamientoResult {
  let { montoTotal, subtotal, itbms } = result;
  const itbmsVal = itbms ?? 0;

  // Si el subtotal reportado es mayor al total, el total viene mal (u omitido) → recalcular.
  if (subtotal && montoTotal && subtotal > montoTotal && itbmsVal >= 0) {
    montoTotal = +(subtotal + itbmsVal).toFixed(2);
  }

  // Si no hay subtotal pero sí total e itbms, derivarlo.
  if (!subtotal && montoTotal && itbmsVal && montoTotal > itbmsVal) {
    const calc = +(montoTotal - itbmsVal).toFixed(2);
    if (calc > 0) subtotal = calc;
  }

  return { ...result, montoTotal, subtotal, itbms: itbms ?? undefined };
}
