import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { MinewStore, ProductItem } from '../../../core/interfaces/minew.interface';
import { MinewService } from '../../../core/services/minew.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-minew-products',
  standalone: true,
  imports: [CommonModule,FormsModule,MatTableModule,MatPaginatorModule, MatButtonModule, MatCardModule, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './minew-products.component.html',
  styleUrl: './minew-products.component.css'
})
export class MinewProductsComponent {
 @Input() store!: MinewStore;
 @Output() logout = new EventEmitter<void>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  dataSource = new MatTableDataSource<ProductItem>([]);
  displayedColumns: string[] = ['id', 'specification', 'price', 'discount', 'unit'];

  // State
  isLoading = false;
  isSyncing = false;
  errorMessage: string | null = null;
  totalItems = 0;
  pageSize = 10;
  pageIndex = 0;
  items: ProductItem[] = [];

  constructor(private minewService: MinewService) {}

  ngOnInit() {
    this.loadPage();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }

  loadPage(reset: boolean = false): void {
    if (reset) {
      this.pageIndex = 0;
      this.items = [];
    }

    this.isLoading = true;
    this.errorMessage = null;

    const page = this.pageIndex + 1;

    this.minewService.getProducts(this.store.storeId, page, this.pageSize).subscribe({
      next: (resp) => {
        if (reset) this.items = [];
        this.items = [...this.items, ...resp.items];
        this.totalItems = resp.totalNum;
        this.dataSource.data = this.items;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = err?.error?.message ?? 'Failed to load products';
        this.isLoading = false;
      },
    });
  }

  handlePageEvent(event: PageEvent) {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;

    if (event.previousPageIndex !== undefined && event.pageIndex > event.previousPageIndex) {
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
      }
    });
  }

  onLogout() {
    this.logout.emit();
  }
}
