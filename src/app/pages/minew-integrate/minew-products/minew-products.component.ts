import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import {
  MinewStore,
  ProductItem,
} from '../../../core/interfaces/minew.interface';
import { MinewService } from '../../../core/services/minew.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-minew-products',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './minew-products.component.html',
  styleUrl: './minew-products.component.css',
})
export class MinewProductsComponent {
  @Input() store!: MinewStore;
  @Output() logout = new EventEmitter<void>();

  dataSource: ProductItem[] = [];
  displayedColumns: string[] = [
    'id',
    'specification',
    'price',
    'discount',
    'unit',
  ];

  // State
  isLoading = false;
  isSyncing = false;
  errorMessage: string | null = null;
  totalItems = 0;
  pageSize = 10;
  pageIndex = 0;
  items: ProductItem[] = [];

  constructor(private minewService: MinewService) {}

  loadPage(reset: boolean = false): void {
    if (reset) {
      this.pageIndex = 0;
      this.items = [];
    }

    this.isLoading = true;
    this.errorMessage = null;

    const page = this.pageIndex + 1;

    this.minewService
      .getProducts(this.store.storeId, page, this.pageSize)
      .subscribe({
        next: (resp) => {
          if (reset) this.items = [];
          this.items = [...this.items, ...resp.items];
          this.totalItems = resp.totalNum;
          this.dataSource = this.items;
          this.isLoading = false;
        },
        error: (err) => {
          this.errorMessage = err?.error?.message ?? 'Failed to load products';
          this.isLoading = false;
        },
      });
  }

  /**
   * The grid drives loading, including the very first page - so there is no
   * separate call in ngOnInit. `first` is a row offset, which converts back to
   * the page index the Material paginator used to hand over directly.
   *
   * The append-on-next / reset-otherwise behaviour is unchanged.
   */
  handlePageEvent(event: TableLazyLoadEvent) {
    const rows = event.rows ?? this.pageSize;
    const nextIndex = Math.floor((event.first ?? 0) / rows);
    const previousIndex = this.pageIndex;

    this.pageSize = rows;
    this.pageIndex = nextIndex;

    if (nextIndex > previousIndex) {
      // Load more (next page)
      this.loadPage();
    } else {
      // Navigate to specific page
      this.loadPage(true);
    }
  }

  // Sync all products to cloud using existing service
  syncToCloud() {
    this.isSyncing = true;
    this.errorMessage = null;

    this.minewService.syncProducts(1).subscribe({
      next: () => {
        this.isSyncing = false;
        // Optional: show success toast
      },
      error: (err) => {
        this.errorMessage = err?.error?.message ?? 'Failed to sync to cloud';
        this.isSyncing = false;
      },
    });
  }

  onLogout() {
    this.logout.emit();
  }
}
