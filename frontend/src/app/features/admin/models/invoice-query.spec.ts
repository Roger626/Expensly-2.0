import { applyInvoiceQuery, nextSort } from './invoice-query';
import { DEFAULT_FILTER, DEFAULT_SORT } from './invoice-filter-state.model';
import { Factura } from '../../registro-factura/models/factura.model';

const f = (id: string, fecha: string, monto: number, extra: Partial<Factura> = {}): Factura => ({
  facturaId: id, fechaEmision: fecha, montoTotal: monto, rucProveedor: '', nombreProveedor: `Prov ${id}`,
  cufe: '', numeroFactura: id, ...extra,
});

describe('applyInvoiceQuery', () => {
  const list = [
    f('a', '2026-10-01', 10, { estado: 'APROBADO', categoria: 'Hospedaje' }),
    f('b', '2026-10-15T00:00:00.000Z', 30, { categoria: 'Combustible' }),   // sin estado = pendiente
    f('c', '2026-09-30', 20, { estado: 'RECHAZADO', nombreEmpleado: 'Elena Ríos' }),
  ];

  it('ordena por fecha descendente por defecto', () => {
    expect(applyInvoiceQuery(list, DEFAULT_FILTER, DEFAULT_SORT).map((x) => x.facturaId)).toEqual(['b', 'a', 'c']);
  });

  it('incluye el día final completo y compara fechas sin zona horaria', () => {
    const r = applyInvoiceQuery(list, { ...DEFAULT_FILTER, dateFrom: '2026-10-01', dateTo: '2026-10-15' }, DEFAULT_SORT);
    expect(r.map((x) => x.facturaId)).toEqual(['b', 'a']);
  });

  it('trata una factura sin estado como pendiente', () => {
    const r = applyInvoiceQuery(list, { ...DEFAULT_FILTER, selectedStatuses: ['PENDIENTE'] }, DEFAULT_SORT);
    expect(r.map((x) => x.facturaId)).toEqual(['b']);
  });

  it('busca también por empleado y filtra por categoría', () => {
    expect(applyInvoiceQuery(list, { ...DEFAULT_FILTER, searchTerm: 'elena' }, DEFAULT_SORT).length).toBe(1);
    expect(applyInvoiceQuery(list, { ...DEFAULT_FILTER, selectedCategories: ['Hospedaje'] }, DEFAULT_SORT)[0].facturaId).toBe('a');
  });

  it('alterna la dirección al repetir la columna', () => {
    expect(nextSort({ key: 'monto', dir: 'desc' }, 'monto')).toEqual({ key: 'monto', dir: 'asc' });
    expect(applyInvoiceQuery(list, DEFAULT_FILTER, { key: 'monto', dir: 'asc' }).map((x) => x.montoTotal)).toEqual([10, 20, 30]);
  });
});
