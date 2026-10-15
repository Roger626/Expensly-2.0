import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../../shared/icon/icon.component';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

import {
  DEFAULT_FILTER,
  InvoiceFilterState,
} from '../../models/invoice-filter-state.model';

@Component({
  selector: 'app-invoice-filter',
  standalone: true,
  imports: [FormsModule, IconComponent],
  templateUrl: './invoice-filter.component.html',
  styleUrl: './invoice-filter.component.css',
})
export class InvoiceFilterComponent implements OnInit, OnDestroy {
  /** Available categories derived from loaded invoices. */
  @Input() categories: string[] = [];

  /** Emits whenever any filter changes (debounced for search text). */
  @Output() filterChange = new EventEmitter<InvoiceFilterState>();

  // ── Local state ───────────────────────────────────────────────────────────
  searchTerm         = '';
  dateFrom: string   = '';
  dateTo: string     = '';
  selectedCategories = new Set<string>();
  categoryDropdownOpen = false;

  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$     = new Subject<void>();

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // Debounce free-text search so we don't emit on every keystroke
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.emit());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  get activeFilterCount(): number {
    let n = 0;
    if (this.searchTerm.trim())            n++;
    if (this.dateFrom || this.dateTo)      n++;
    if (this.selectedCategories.size > 0)  n++;
    return n;
  }

  get categoryLabel(): string {
    if (this.selectedCategories.size === 0) return 'Todas las categorías';
    if (this.selectedCategories.size === 1) return [...this.selectedCategories][0];
    return `${this.selectedCategories.size} categorías`;
  }

  // ── Event handlers ────────────────────────────────────────────────────────
  onSearchInput(): void {
    this.searchInput$.next(this.searchTerm);
  }

  onDateChange(): void {
    this.emit();
  }

  toggleCategory(cat: string): void {
    if (this.selectedCategories.has(cat)) {
      this.selectedCategories.delete(cat);
    } else {
      this.selectedCategories.add(cat);
    }
    this.emit();
  }

  isCategorySelected(cat: string): boolean {
    return this.selectedCategories.has(cat);
  }

  toggleCategoryDropdown(): void {
    this.categoryDropdownOpen = !this.categoryDropdownOpen;
  }

  clearFilters(): void {
    this.searchTerm  = '';
    this.dateFrom    = '';
    this.dateTo      = '';
    this.selectedCategories.clear();
    this.categoryDropdownOpen = false;
    this.emit();
  }

  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.category-dropdown-wrapper')) {
      this.categoryDropdownOpen = false;
    }
  }

  clearCategorySelection(): void {
    this.selectedCategories.clear();
    this.categoryDropdownOpen = false;
    this.emit();
  }

  // ── Emit ──────────────────────────────────────────────────────────────────
  private emit(): void {
    const state: InvoiceFilterState = {
      searchTerm:         this.searchTerm.trim(),
      dateFrom:           this.dateFrom  || null,
      dateTo:             this.dateTo    || null,
      selectedCategories: [...this.selectedCategories],
      selectedStatuses:   [],
    };
    this.filterChange.emit(state);
  }
}

