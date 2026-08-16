// store-management.component.ts
import { Component, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StoreService } from '../../../core/services/store.service';
import { finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subject } from 'rxjs';
import {
  Store,
  StoreFilterParams,
  StoreSyncRequest,
  StoreSyncResult,
} from '../../../core/interfaces/store.interface';
import { CommonModule } from '@angular/common';
import {
  SnackbarData,
  CustomSnackbarComponent,
} from '../../../shared/components/alert/custom-snackbar.component';
import { StoreModalComponent } from '../store-modal/store-modal.component';
import { StoreSyncComponent } from '../store-sync/store-sync.component';
import { DeleteConfirmationComponent } from '../../../shared/components/dialog/delete-confirmation/delete-confirmation.component';
import { ConfirmationDialogComponent } from '../../../shared/components/dialog/confirmation-dialog/confirmation-dialog.component';
import { AuthService } from '../../../core/services/auth.service';
import { MessageService } from 'primeng/api';
import { Router } from '@angular/router';

@Component({
  selector: 'app-store-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TableModule],
  templateUrl: './store-management.component.html',
  styleUrls: ['./store-management.component.css'],
})
export class StoreManagementComponent implements OnInit {
  // Data
  stores: Store[] = [];
  dataSource: Store[] = [];
  displayedColumns: string[] = [
    'store',
    'status',
    'devices',
    'contact',
    'created',
    'actions',
  ];

  // Loading states
  loading = false;

  // Pagination
  total = 0;
  pageIndex = 1;
  pageSize = 10;

  // Filters
  searchTerm = '';
  statusFilter = '';
  syncStatusFilter = '';
  createdFrom?: Date;
  createdTo?: Date;
  showAdvancedFilters = false;

  // Forms
  filterForm!: FormGroup;

  // Statistics
  statistics: any;
  totalDeviceCount = 0;

  //CurrentUser
  currentUserId: number = 0;

  // Search debounce
  private searchSubject = new Subject<string>();

  constructor(
    private fb: FormBuilder,
    private storeService: StoreService,
    public auth: AuthService,
    private messageService: MessageService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.getCurrentUser();
    this.initForms();
    // The grid is lazy, so its own initial onLazyLoad issues the first
    // loadStores() call - calling it here as well would double the request.
    this.loadStatistics();

    // Setup search debounce
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.pageIndex = 1;
        this.loadStores();
      });
  }

  getCurrentUser() {
    const user = this.auth.getCurrentUserValue();
    if (!user) {
      this.showError('User not authenticated');
      return;
    }
    this.currentUserId = user.id;
  }

  initForms(): void {
    this.filterForm = this.fb.group({
      searchTerm: [''],
      status: [''],
      syncStatus: [''],
      createdFrom: [null],
      createdTo: [null],
    });
  }

  loadStores(): void {
    this.loading = true;

    const filters: StoreFilterParams = {
      pageNumber: this.pageIndex,
      pageSize: this.pageSize,
      searchTerm: this.searchTerm,
      isActive: this.statusFilter ? JSON.parse(this.statusFilter) : undefined,
      isSynced: this.syncStatusFilter
        ? JSON.parse(this.syncStatusFilter)
        : undefined,
      createdFrom: this.createdFrom,
      createdTo: this.createdTo,
    };

    this.storeService
      .getStores(filters)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response) => {
          this.stores = response.items;
          this.dataSource = this.stores;
          this.total = response.totalCount;
        },
        error: (error) => {
          this.showError('Failed to load stores');
          console.error('Error loading stores:', error);
        },
      });
  }

  loadStatistics(): void {
    this.storeService.getStoreStatistics().subscribe({
      next: (stats) => {
        this.statistics = stats;
        console.log('stats', stats);
        this.calculateTotalDevices();
      },
      error: (error) => {
        console.error('Error loading statistics:', error);
      },
    });
  }

  calculateTotalDevices(): void {
    this.totalDeviceCount = this.stores.reduce(
      (total, store) => total + (store.deviceCount || 0),
      0,
    );
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onFilterChange(): void {
    this.pageIndex = 1;
    this.loadStores();
  }

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters = !this.showAdvancedFilters;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.syncStatusFilter = '';
    this.createdFrom = undefined;
    this.createdTo = undefined;
    this.pageIndex = 1;
    this.loadStores();
  }

  /**
   * The grid asks for a page. `first` is a row offset, so it converts back to
   * the 1-based page number the API expects - the same arithmetic the Material
   * paginator's `pageIndex + 1` used to do.
   */
  onLazyLoad(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? this.pageSize;
    this.pageSize = rows;
    this.pageIndex = Math.floor((event.first ?? 0) / rows) + 1;
    this.loadStores();
  }

  // Open create dialog
  openCreateModal(): void {
    const dialogRef = this.dialog.open(StoreModalComponent, {
      //width: '800px',
      maxHeight: '90vh',
      data: { isEdit: false },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.success) {
        this.showSuccess(
          `Store ${result.isEdit ? 'updated' : 'created'} successfully`,
        );
        this.loadStores();
        this.loadStatistics();
      }
    });
  }

  // Open edit dialog
  openEditModal(store: Store): void {
    const dialogRef = this.dialog.open(StoreModalComponent, {
      //width: '800px',
      maxHeight: '90vh',
      data: { store: store, isEdit: true },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.success) {
        this.showSuccess('Store updated successfully');
        this.loadStores();
        this.loadStatistics();
      }
    });
  }

  // Open sync dialog
  openSyncModal(): void {
    const pendingSyncStores = this.stores.filter((s) => !s.isSynced);

    const dialogRef = this.dialog.open(StoreSyncComponent, {
      // width: '800px',
      maxHeight: '90vh',
      data: { stores: pendingSyncStores },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.success) {
        if (result.hasErrors) {
          this.showWarning(
            `Sync completed with ${result.data.failedCount} errors`,
          );
        } else {
          this.showSuccess('Sync completed successfully!');
        }
        this.loadStores();
        this.loadStatistics();
      }
    });
  }

  // Sync single store
  syncSingleStore(store: Store): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Sync Store',
        message: `Are you sure you want to sync store "${store.storeName}"?`,
        confirmText: 'Sync',
        cancelText: 'Cancel',
        confirmColor: 'primary',
      },
      panelClass: ['rounded-lg'],
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        const syncRequest: StoreSyncRequest = {
          syncToCloud: true,
          storeIds: [store.id],
        };

        this.storeService.syncStores(syncRequest).subscribe({
          next: (response) => {
            if (response.failedCount === 0) {
              this.showSuccess('Store synced successfully');
            } else {
              this.showWarning(
                `Sync completed with ${response.failedCount} errors`,
              );
            }
            this.loadStores();
          },
          error: () => {
            this.showError('Failed to sync store');
          },
        });
      }
    });
  }

  // Delete/Restore store
  openDeleteDialog(store: Store): void {
    const action = store.isActive ? 'deactivate' : 'activate';
    const actionCapitalized = action.charAt(0).toUpperCase() + action.slice(1);
    const message = store.isActive
      ? `Are you sure you want to deactivate store "${store.storeName}"? The store will be hidden but not permanently deleted.`
      : `Are you sure you want to activate store "${store.storeName}"? The store will be visible again.`;

    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: `${actionCapitalized} Store`,
        message: message,
        confirmText: actionCapitalized,
        cancelText: 'Cancel',
        confirmColor: store.isActive ? 'warn' : 'primary',
      },
      panelClass: ['rounded-lg'],
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        const updatedStore = { ...store, isActive: !store.isActive };
        this.storeService.updateStore(store.id, updatedStore).subscribe({
          next: () => {
            this.showSuccess(`Store ${action}d successfully`);
            this.loadStores();
            this.loadStatistics();
          },
          error: (error) => {
            this.showError(`Failed to ${action} store`);
          },
        });
      }
    });
  }

  /**
   * Opens Device Management. The store id is passed as a query param so the
   * link carries the user's intent, but note that page scopes itself to the
   * current default store rather than reading the param, so it will show that
   * store's devices - see the note in the handover.
   */
  viewStoreDevices(store: Store): void {
    this.router.navigate(['/device-management'], {
      queryParams: { storeId: store.id },
    });
  }

  //#region Snackbar Methods
  private showSuccess(message: string): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: message,
      life: 5000,
    });
  }

  private showError(message: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000,
    });
  }

  private showWarning(message: string): void {
    this.messageService.add({
      severity: 'warn',
      summary: 'Warning',
      detail: message,
      life: 5000,
    });
  }

  private showInfo(message: string): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Info',
      detail: message,
      life: 5000,
    });
  }
  // private showSuccess(message: string): void {
  //   this.openSnackbar({
  //     message: message,
  //     icon: 'fa-check-circle',
  //     type: 'success'
  //   });
  // }

  // private showWarning(message: string): void {
  //   this.openSnackbar({
  //     message: message,
  //     icon: 'fa-exclamation-triangle',
  //     type: 'warning'
  //   });
  // }

  // private showError(message: string): void {
  //   this.openSnackbar({
  //     message: message,
  //     icon: 'fas fa-times-circle',
  //     type: 'error'
  //   });
  // }

  // private openSnackbar(data: SnackbarData): void {
  //   this.snackBar.openFromComponent(CustomSnackbarComponent, {
  //     data: data,
  //     duration: 5000,
  //     horizontalPosition: 'end',
  //     verticalPosition: 'top',
  //     panelClass: [`${data.type}-snackbar`]
  //   });
  // }
  //#endregion

  // Helper methods for UI
  getStoreInitials(storeName: string): string {
    if (!storeName) return '??';
    const words = storeName.split(' ');
    if (words.length >= 2) {
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }
    return storeName.substring(0, 2).toUpperCase();
  }

  getStatusColor(isActive: boolean): string {
    return isActive
      ? 'border-green-200 text-green-800 bg-green-50'
      : 'border-red-200 text-red-800 bg-red-50';
  }

  getSyncStatusColor(syncStatus: string): string {
    switch (syncStatus) {
      case 'success':
        return 'border-green-200 text-green-800 bg-green-50';
      case 'pending':
        return 'border-yellow-200 text-yellow-800 bg-yellow-50';
      case 'failed':
        return 'border-red-200 text-red-800 bg-red-50';
      default:
        return 'border-gray-200 text-gray-800 bg-gray-50';
    }
  }

  getSyncStatusIcon(syncStatus: string): string {
    switch (syncStatus) {
      case 'success':
        return 'fa-check-circle text-green-400';
      case 'pending':
        return 'fa-clock text-yellow-400';
      case 'failed':
        return 'fa-times-circle text-red-400';
      default:
        return 'fa-question-circle text-gray-400';
    }
  }

  getSyncStatusLabel(syncStatus: string): string {
    switch (syncStatus) {
      case 'success':
        return 'Synced';
      case 'pending':
        return 'Pending Sync';
      case 'failed':
        return 'Sync Failed';
      default:
        return 'Not Required';
    }
  }
}
