import { reconcileInvoiceTotals } from './invoice-math.util';
import { FacturaProcesamientoResult } from '../strategies/factura-procesar.strategy.interface';

function base(overrides: Partial<FacturaProcesamientoResult> = {}): FacturaProcesamientoResult {
  return {
    montoTotal: 0,
    fechaEmision: '',
    rucProveedor: '',
    dv: '',
    nombreProveedor: '',
    cufe: '',
    numeroFactura: '',
    ...overrides,
  };
}

describe('reconcileInvoiceTotals', () => {
  it('recalculates montoTotal when subtotal + itbms is greater than the reported total', () => {
    const result = reconcileInvoiceTotals(base({ montoTotal: 10, subtotal: 12, itbms: 1 }));
    expect(result.montoTotal).toBe(13);
  });

  it('derives subtotal from montoTotal - itbms when subtotal is missing', () => {
    const result = reconcileInvoiceTotals(base({ montoTotal: 10, itbms: 1 }));
    expect(result.subtotal).toBe(9);
  });

  it('leaves consistent values untouched', () => {
    const result = reconcileInvoiceTotals(base({ montoTotal: 10, subtotal: 9, itbms: 1 }));
    expect(result.montoTotal).toBe(10);
    expect(result.subtotal).toBe(9);
  });

  it('does not derive a negative or zero subtotal', () => {
    const result = reconcileInvoiceTotals(base({ montoTotal: 5, itbms: 5 }));
    expect(result.subtotal).toBeUndefined();
  });

  it('treats a missing itbms as 0 without throwing', () => {
    const result = reconcileInvoiceTotals(base({ montoTotal: 10, subtotal: 12 }));
    expect(result.montoTotal).toBe(12);
    expect(result.itbms).toBeUndefined();
  });
});
