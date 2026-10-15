export interface InvoiceFilterState {
  searchTerm:         string;
  dateFrom:           string | null;
  dateTo:             string | null;
  selectedCategories: string[];
  selectedStatuses:   string[];
}

export const DEFAULT_FILTER: InvoiceFilterState = {
  searchTerm:         '',
  dateFrom:           null,
  dateTo:             null,
  selectedCategories: [],
  selectedStatuses:   [],
};

export type InvoiceSortKey = 'fecha' | 'monto' | 'proveedor';
export interface InvoiceSort { key: InvoiceSortKey; dir: 'asc' | 'desc'; }
/** Lo más reciente primero. */
export const DEFAULT_SORT: InvoiceSort = { key: 'fecha', dir: 'desc' };
