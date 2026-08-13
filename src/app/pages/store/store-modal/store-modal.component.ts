import { Component, Inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Store, StoreDto } from '../../../core/interfaces/store.interface';
import { StoreService } from '../../../core/services/store.service';
import { SnackbarData, CustomSnackbarComponent } from '../../../shared/components/alert/custom-snackbar.component';
import { CommonModule } from '@angular/common';
import { ConfirmationDialogComponent } from '../../../shared/components/dialog/confirmation-dialog/confirmation-dialog.component';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-store-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './store-modal.component.html',
  styleUrl: './store-modal.component.css'
})
export class StoreModalComponent implements OnInit {
  //#region Properties
  storeForm: FormGroup;
  isEditMode = false;
  currentStoreId?: number;
  isSubmitting = signal(false);

  // Default store settings
  readonly defaultSettings = {
    isActive: true,
    autoSync: true
  };
  //#endregion

  //#region Constructor
  constructor(
    private fb: FormBuilder,
    private storeService: StoreService,
    private messageService: MessageService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    public dialogRef: MatDialogRef<StoreModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { store?: Store; isEdit?: boolean }
  ) {
    this.isEditMode = data.isEdit || false;
    this.currentStoreId = data.store?.id;

    this.storeForm = this.fb.group({
      storeName: ['', [Validators.required, Validators.maxLength(200)]],
      // Minew's store/add rejects a blank number, name or address (code 54029),
      // and every store is published to Minew, so both are required. It also
      // rejects a non-numeric code (54030), hence the digits-only pattern.
      storeCode: ['', [Validators.required, Validators.pattern(/^\d+$/), Validators.maxLength(50)]],
      address: ['', [Validators.required, Validators.maxLength(500)]],
      contactPerson: ['', [Validators.maxLength(100)]],
      phone: ['', [Validators.maxLength(20)]],
      email: ['', [Validators.email, Validators.maxLength(100)]],
      latitude: [null],
      longitude: [null],
      minewStoreId: [''],
      minewTemplateId: [''],
      isActive: [this.defaultSettings.isActive],
      autoSync: [this.defaultSettings.autoSync]
    });
  }
  //#endregion

  //#region Lifecycle
  ngOnInit(): void {
    if (this.isEditMode && this.data.store) {
      this.loadStoreData(this.data.store);
    }
  }
  //#endregion

  //#region Form Methods
  private loadStoreData(store: Store): void {
    this.storeForm.patchValue({
      storeName: store.storeName,
      storeCode: store.storeCode || '',
      address: store.address || '',
      contactPerson: store.contactPerson || '',
      phone: store.phone || '',
      email: store.email || '',
      latitude: store.latitude || null,
      longitude: store.longitude || null,
      minewStoreId: store.minewStoreId || '',
      minewTemplateId: store.minewTemplateId || '',
      isActive: store.isActive,
      autoSync: store.isSynced || true
    });
  }

  //#endregion

  //#region Form Actions
  onSubmit(): void {
    if (this.storeForm.valid && !this.isSubmitting()) {
      this.isSubmitting.set(true);

      const formValue = this.storeForm.value;

      // An untouched optional field is '' , and the API's [EmailAddress] rejects
      // an empty string outright (null passes), so sending '' made every store
      // without an email fail with a bare 400. Send null for blanks instead.
      // undefined (not null) so JSON.stringify drops the key entirely.
      const orNull = (v: unknown): string | undefined => {
        const s = typeof v === 'string' ? v.trim() : v;
        return s ? (s as string) : undefined;
      };

      const storeDto: StoreDto = {
        storeName: formValue.storeName,
        // Required by the form, so always present - and Minew rejects blanks.
        storeCode: (formValue.storeCode ?? '').trim(),
        address: (formValue.address ?? '').trim(),
        phone: orNull(formValue.phone),
        email: orNull(formValue.email),
        contactPerson: orNull(formValue.contactPerson),
        minewStoreId: orNull(formValue.minewStoreId),
        minewTemplateId: orNull(formValue.minewTemplateId),
        latitude: formValue.latitude,
        longitude: formValue.longitude,
        isActive: formValue.isActive,
        createdUser: this.getCurrentUserId() // This should come from auth service
      };

      if (this.isEditMode && this.currentStoreId) {
        this.updateStore(this.currentStoreId, storeDto);
      } else {
        this.createStore(storeDto);
      }
    } else {
      this.markFormAsTouched();
    }
  }

  onCancel(): void {
    if (this.storeForm.dirty && !this.isSubmitting()) {
      const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
        width: '400px',
        disableClose: true,
        data: {
          title: 'Unsaved Changes',
          message: 'You have unsaved changes. Are you sure you want to cancel?',
          confirmText: 'Yes, Cancel',
          cancelText: 'No',
          confirmColor: 'warn'
        }
      });

      dialogRef.afterClosed().subscribe((confirmed: boolean) => {
        if (confirmed) {
          this.dialogRef.close({ success: false });
        }
      });
    } else {
      this.dialogRef.close({ success: false });
    }
  }


  // onCancel(): void {
  //   if (this.storeForm.dirty && !this.isSubmitting()) {
  //     if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
  //       this.dialogRef.close({ success: false });
  //     }
  //   } else {
  //     this.dialogRef.close({ success: false });
  //   }
  // }
  //#endregion

  //#region API Calls
  private createStore(storeDto: StoreDto): void {
    this.storeService.createStore(storeDto).subscribe({
      next: (createdStore) => this.handleSuccess('Store created successfully', createdStore),
      error: (error) => this.handleError(error, 'Failed to create store')
    });
  }

  private updateStore(storeId: number, storeDto: StoreDto): void {
    this.storeService.updateStore(storeId, storeDto).subscribe({
      next: (updatedStore) => this.handleSuccess('Store updated successfully', updatedStore),
      error: (error) => this.handleError(error, 'Failed to update store')
    });
  }
  //#endregion

  //#region Helpers
  private getCurrentUserId(): number {
    // This should be implemented based on your authentication service
    // For now, returning a default value
    return 1;
  }

  private markFormAsTouched(): void {
    Object.values(this.storeForm.controls).forEach(control => {
      control.markAsTouched();
    });
  }

  private handleSuccess(message: string, store?: Store): void {
    this.isSubmitting.set(false);
    this.showSuccess(message);

    this.dialogRef.close({
      success: true,
      data: store,
      isEdit: this.isEditMode
    });
  }

  private handleError(error: any, defaultMessage: string): void {
    this.isSubmitting.set(false);
    console.error('❌ Error:', error);

    let errorMessage = defaultMessage;
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    this.showError(errorMessage);
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
