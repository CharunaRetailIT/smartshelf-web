import { Component, Inject, OnInit, signal } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Store, StoreSyncResult, StoreSyncRequest } from '../../../core/interfaces/store.interface';
import { StoreService } from '../../../core/services/store.service';
import { SnackbarData, CustomSnackbarComponent } from '../../../shared/components/alert/custom-snackbar.component';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-store-sync',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './store-sync.component.html',
  styleUrl: './store-sync.component.css'
})
export class StoreSyncComponent implements OnInit {
  //#region Properties
  syncForm: FormGroup;
  storesForSync: Store[] = [];
  filteredStores: Store[] = [];
  selectedStoreIds: number[] = [];
  storeSearchTerm = '';

  // Signals
  isSubmitting = signal(false);
  isPreviewing = signal(false);

  // Sync data
  syncPreview: any = null;
  lastSyncResult?: StoreSyncResult;

  // Default settings
  readonly defaultSettings = {
    syncFromCloud: true,
    syncToCloud: false,
    syncMode: 'all',
    retryAttempts: 3,
    syncTimeout: 60,
    forceSync: false
  };
  //#endregion

  //#region Constructor
  constructor(
    private fb: FormBuilder,
    private storeService: StoreService,
    private messageService: MessageService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<StoreSyncComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { stores?: Store[] }
  ) {
    this.syncForm = this.fb.group({
      syncFromCloud: [this.defaultSettings.syncFromCloud],
      syncToCloud: [this.defaultSettings.syncToCloud],
      syncMode: [this.defaultSettings.syncMode],
      retryAttempts: [this.defaultSettings.retryAttempts, [Validators.min(0), Validators.max(5)]],
      syncTimeout: [this.defaultSettings.syncTimeout, [Validators.min(30), Validators.max(300)]],
      forceSync: [this.defaultSettings.forceSync]
    });
  }
  //#endregion

  //#region Lifecycle
  ngOnInit(): void {
    this.loadStoresForSync();
    this.loadLastSyncResult();

    // Watch for sync mode changes
    this.syncForm.get('syncToCloud')?.valueChanges.subscribe(value => {
      if (value) {
        this.loadStoresForSync();
      } else {
        this.syncForm.patchValue({ syncMode: 'all' });
      }
    });

    this.syncForm.get('syncMode')?.valueChanges.subscribe(mode => {
      if (mode === 'all') {
        this.selectAllStores();
      }
    });
  }
  //#endregion

  //#region Data Loading
  private loadStoresForSync(): void {
    const filters = {
      pageNumber: 1,
      pageSize: 100,
      storeType: 'minew',
      isActive: true
    };

    this.storeService.getStores(filters).subscribe({
      next: (response) => {
        this.storesForSync = response.items;
        this.filteredStores = [...this.storesForSync];

        // Auto-select all stores for "all" mode
        if (this.syncForm.get('syncMode')?.value === 'all') {
          this.selectAllStores();
        }
      },
      error: (error) => {
        console.error('Error loading stores for sync:', error);
        this.showError('Failed to load stores for sync');
      }
    });
  }

  private loadLastSyncResult(): void {
    // In a real app, you might load this from a service
    // This is a placeholder for demonstration
    this.lastSyncResult = {
      syncedCount: 5,
      failedCount: 1,
      messages: ['Sync completed with some errors'],
      details: [],
      timestamp: new Date(Date.now() - 3600000) // 1 hour ago
    };
  }
  //#endregion

  //#region Store Filtering and Selection
  filterStores(): void {
    if (!this.storeSearchTerm) {
      this.filteredStores = [...this.storesForSync];
      return;
    }

    const searchTerm = this.storeSearchTerm.toLowerCase();
    this.filteredStores = this.storesForSync.filter(store =>
      store.storeName.toLowerCase().includes(searchTerm) ||
      store.storeCode?.toLowerCase().includes(searchTerm) ||
      store.address?.toLowerCase().includes(searchTerm)
    );
  }

  toggleStoreSelection(storeId: number): void {
    const index = this.selectedStoreIds.indexOf(storeId);
    if (index > -1) {
      this.selectedStoreIds.splice(index, 1);
    } else {
      this.selectedStoreIds.push(storeId);
    }
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.selectedStoreIds = [];
    } else {
      this.selectAllStores();
    }
  }

  selectAllStores(): void {
    this.selectedStoreIds = this.storesForSync.map(store => store.id);
  }

  isStoreSelected(storeId: number): boolean {
    return this.selectedStoreIds.includes(storeId);
  }

  isAllSelected(): boolean {
    return this.selectedStoreIds.length === this.storesForSync.length && this.storesForSync.length > 0;
  }

  getPendingSyncCount(): number {
    return this.storesForSync.filter(store => !store.isSynced).length;
  }
  //#endregion

  //#region Preview Methods
  canPreview(): boolean {
    const formValue = this.syncForm.value;
    return formValue.syncFromCloud || formValue.syncToCloud;
  }

  previewSync(): void {
    if (!this.canPreview()) return;

    this.isPreviewing.set(true);

    // Calculate preview
    const formValue = this.syncForm.value;
    const storesToExport = formValue.syncToCloud ?
      (formValue.syncMode === 'all' ? this.storesForSync.length : this.selectedStoreIds.length) : 0;

    const storesToImport = formValue.syncFromCloud ? 10 : 0; // Placeholder - would come from API

    this.syncPreview = {
      storesToImport,
      storesToExport,
      estimatedTime: Math.ceil((storesToImport + storesToExport) * 2) // 2 seconds per store
    };

    setTimeout(() => {
      this.isPreviewing.set(false);
    }, 1000);
  }
  //#endregion

  //#region Form Actions
  onSubmit(): void {
    if (this.syncForm.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);

    const formValue = this.syncForm.value;
    const syncRequest: StoreSyncRequest = {
      syncFromCloud: formValue.syncFromCloud,
      syncToCloud: formValue.syncToCloud,
      storeIds: formValue.syncToCloud && formValue.syncMode === 'selected' ?
        this.selectedStoreIds : undefined
    };

    // Add additional parameters
    const syncParams = {
      ...syncRequest,
      retryAttempts: formValue.retryAttempts,
      syncTimeout: formValue.syncTimeout,
      forceSync: formValue.forceSync
    };

    this.storeService.syncStores(syncParams).subscribe({
      next: (result) => this.handleSyncSuccess(result),
      error: (error) => this.handleSyncError(error)
    });
  }

  onCancel(): void {
    if (this.syncForm.dirty && !this.isSubmitting()) {
      if (confirm('Sync operation is in progress. Are you sure you want to cancel?')) {
        this.dialogRef.close({ success: false });
      }
    } else {
      this.dialogRef.close({ success: false });
    }
  }
  //#endregion

  //#region Sync Handlers
  private handleSyncSuccess(result: StoreSyncResult): void {
    this.isSubmitting.set(false);
    this.lastSyncResult = result;

    if (result.failedCount === 0) {
      this.showSuccess('Sync completed successfully!');
    } else if (result.failedCount < result.syncedCount) {
      this.showWarning(`Sync completed with ${result.failedCount} errors`);
    } else {
      this.showError('Sync failed completely');
    }

    this.dialogRef.close({
      success: true,
      data: result,
      hasErrors: result.failedCount > 0
    });
  }

  private handleSyncError(error: any): void {
    this.isSubmitting.set(false);
    console.error('❌ Sync error:', error);

    let errorMessage = 'Sync failed. Please try again.';
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    this.showError(errorMessage);
  }
  //#endregion

  //#region UI Helpers
  getSyncStatusClass(store: Store): string {
    if (!store.isSynced) return 'bg-yellow-100 text-yellow-800';

    switch (store.syncStatus) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getSyncStatusIcon(store: Store): string {
    if (!store.isSynced) return 'fa-clock text-yellow-600';

    switch (store.syncStatus) {
      case 'success': return 'fa-check-circle text-green-600';
      case 'failed': return 'fa-times-circle text-red-600';
      case 'pending': return 'fa-clock text-yellow-600';
      default: return 'fa-question-circle text-gray-600';
    }
  }

  getSyncStatusLabel(store: Store): string {
    if (!store.isSynced) return 'Pending';

    switch (store.syncStatus) {
      case 'success': return 'Synced';
      case 'failed': return 'Failed';
      case 'pending': return 'Pending';
      default: return 'Unknown';
    }
  }

  getResultStatusClass(result: StoreSyncResult): string {
    if (result.failedCount === 0) {
      return 'bg-green-100 text-green-800';
    } else if (result.failedCount < result.syncedCount) {
      return 'bg-yellow-100 text-yellow-800';
    } else {
      return 'bg-red-100 text-red-800';
    }
  }

  getResultStatusLabel(result: StoreSyncResult): string {
    if (result.failedCount === 0) {
      return 'Success';
    } else if (result.failedCount < result.syncedCount) {
      return 'Partial Success';
    } else {
      return 'Failed';
    }
  }
  //#endregion

  //#region Snackbar Methods
  private showSuccess(message: string): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: message,
      life: 5000
    });
  }

  private showError(message: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000
    });
  }

  private showWarning(message: string): void {
    this.messageService.add({
      severity: 'warn',
      summary: 'Warning',
      detail: message,
      life: 5000
    });
  }

  private showInfo(message: string): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Info',
      detail: message,
      life: 5000
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
}
