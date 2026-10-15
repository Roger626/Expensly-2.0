import { Factura } from '../../registro-factura/models/factura.model';
import { InvoiceFilterState, InvoiceSort } from './invoice-filter-state.model';

/**
 * Filtra y ordena facturas en memoria. Compartido por la vista del admin y la del empleado.
 * Las fechas se comparan como texto YYYY-MM-DD para no correr el día por la zona horaria.
 */
export function applyInvoiceQuery(list: Factura[], filter: InvoiceFilterState, sort: InvoiceSort): Factura[] {
  const term = filter.searchTerm.toLowerCase().trim();
  const cats = new Set(filter.selectedCategories);
  const statuses = new Set(filter.selectedStatuses);

  const result = list.filter((f) => {
    const day = f.fechaEmision.slice(0, 10);
    return (!term || [f.nombreProveedor, f.rucProveedor, f.numeroFactura, f.cufe, f.categoria, f.nombreEmpleado]
              .some((v) => v?.toLowerCase().includes(term)))
      && (!filter.dateFrom || day >= filter.dateFrom)
      && (!filter.dateTo || day <= filter.dateTo)
      && (!cats.size || (!!f.categoria && cats.has(f.categoria)))
      && (!statuses.size || statuses.has(f.estado ?? 'PENDIENTE'));
  });

  const sign = sort.dir === 'asc' ? 1 : -1;
  const value = (f: Factura) =>
    sort.key === 'monto' ? f.montoTotal : sort.key === 'proveedor' ? (f.nombreProveedor ?? '').toLowerCase() : f.fechaEmision;
  return result.sort((a, b) => {
    const va = value(a), vb = value(b);
    return (va < vb ? -1 : va > vb ? 1 : 0) * sign;
  });
}

export function nextSort(cur: InvoiceSort, key: InvoiceSort['key']): InvoiceSort {
  return cur.key === key
    ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: key === 'proveedor' ? 'asc' : 'desc' };
}
