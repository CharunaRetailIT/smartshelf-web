import { Component, Inject, OnInit } from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  AisleMaster,
  ShelvesSummary,
} from '../../../core/interfaces/aisle.interface';
import { AisleService } from '../../../core/services/aisle.service';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  SnackbarData,
  CustomSnackbarComponent,
} from '../../../shared/components/alert/custom-snackbar.component';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-edit-aisle',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatIconModule,
  ],
  templateUrl: './edit-aisle.component.html',
  styleUrls: ['./edit-aisle.component.css'],
})
export class EditAisleComponent implements OnInit {
  //#region Form & State
  aisleForm!: FormGroup;
  isSubmitting = false;
  shelvesSummary: ShelvesSummary = {
    total: 0,
    active: 0,
    inactive: 0,
    lastUpdated: new Date(),
  };
  //#endregion

  //#region Constructor
  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<EditAisleComponent>,
    private snackBar: MatSnackBar,
    private aisleService: AisleService,
    private messageService: MessageService,
    @Inject(MAT_DIALOG_DATA)
    public data: { aisle: AisleMaster; currentUserId: number },
  ) {
    this.aisleForm = this.createForm();
  }
  //#endregion

  //#region Lifecycle
  ngOnInit(): void {
    console.log(this.data.aisle);
    if (this.data?.aisle) {
      this.populateForm();
      this.loadShelvesSummary();
    }
  }
  //#endregion

  //#region Form Methods
  private createForm(): FormGroup {
    return this.fb.group({
      id: [''],
      name: ['', [Validators.required, Validators.maxLength(75)]],
      description: ['', [Validators.maxLength(50)]],
      ipAddress: ['', [Validators.pattern(/^(\d{1,3}\.){3}\d{1,3}$/)]],
      networkName: ['', [Validators.maxLength(50)]],
      macAddress: [''],
      // macAddress: ['', [Validators.maxLength(20), Validators.pattern(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)]],
      location: ['', [Validators.required, Validators.maxLength(75)]],
      coordinates: ['', [Validators.maxLength(75)]],
      deviceName: ['', [Validators.maxLength(50)]],
      isActive: [true],
    });
  }

  private populateForm(): void {
    const aisle = this.data.aisle;
    this.aisleForm.patchValue({
      id: aisle.id,
      name: aisle.name,
      description: aisle.description,
      location: aisle.location,
      coordinates: aisle.coordinates,
      isActive: aisle.isActive,
    });
  }

  private markFormGroupTouched(): void {
    Object.keys(this.aisleForm.controls).forEach((key) => {
      const control = this.aisleForm.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const control = this.aisleForm.get(fieldName);
    if (control?.errors && control.touched) {
      if (control.errors['required']) return `${fieldName} is required`;
      if (control.errors['maxlength']) return `${fieldName} is too long`;
      if (control.errors['pattern']) return `Invalid ${fieldName} format`;
    }
    return '';
  }
  //#endregion

  //#region Shelves Summary
  private loadShelvesSummary(): void {
    // Mock for demo. Remove if not needed.
    this.shelvesSummary = {
      total: 8,
      active: 6,
      inactive: 2,
      lastUpdated: new Date(),
    };
  }
  //#endregion

  //#region Actions
  onSubmit(): void {
    if (!this.aisleForm.valid) {
      this.markFormGroupTouched();
      return;
    }

    this.isSubmitting = true;

    const formValue = this.aisleForm.value;
    const updatedAisle: AisleMaster = {
      ...formValue,
      storeId: this.data.aisle.storeId,
      updatedUser: this.data.currentUserId,
      updatedDate: new Date(),
    };

    this.aisleService
      .updateAisle(Number(updatedAisle.id), updatedAisle)
      .subscribe({
        next: (res) => {
          this.isSubmitting = false;
          this.showSuccess('Aisle updated successfully!');
          this.dialogRef.close(res);
        },
        error: (err) => {
          this.isSubmitting = false;
          console.error(err);
          this.showError('Failed to update aisle.');
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
  //#endregion

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

  //   private showError(message: string): void {
  //     this.openSnackbar({
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
