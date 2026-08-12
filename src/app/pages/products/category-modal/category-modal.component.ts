import { Component, inject, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { ProductCategory } from '../../../core/interfaces/product.interface';
import { CategoryService } from '../../../core/services/category.service';
import { AuthService } from '../../../core/services/auth.service';
import { CustomSnackbarComponent, SnackbarData } from '../../../shared/components/alert/custom-snackbar.component';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { SettingsService } from '../../../core/services/settings.service';
import { MessageService } from 'primeng/api';
import { ImportsModule } from '../../../imports/imports';

export interface CategoryModalData {
  category?: ProductCategory;
  isEditMode: boolean;
}

@Component({
  selector: 'app-category-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatCardModule,
    MatDividerModule,
    MatIconModule,
    MatSelectModule,
    ImportsModule
  ],
  templateUrl: './category-modal.component.html',
  styleUrls: ['./category-modal.component.css'],
})
export class CategoryModalComponent implements OnInit {
  private messageService = inject(MessageService);

  categoryForm: FormGroup;
  loading = false;
  isEditMode = false;
  isSubmitting = false;
  currentUserId!: number;
  storeId: number = 0;

  constructor(
    private fb: FormBuilder,
    private categoryService: CategoryService,
    private snackBar: MatSnackBar,
    public auth: AuthService,
    private settingsService: SettingsService,
    public dialogRef: MatDialogRef<CategoryModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CategoryModalData
  ) {
    this.categoryForm = this.createForm();
  }

  canEdit(): boolean {
    return this.auth.hasAnyRole(['Admin', 'Manager', 'Operator']);
  }

  isReadOnlyMode(): boolean {
    return !this.canEdit();
  }

  getCategoryHeaderText(): string {
    if (!this.data?.category) {
      return 'Add New Category';
    }

    return this.canEdit() ? 'Edit Category' : 'View Category';
  }

  getCategoryDescriptionText(): string {
    if (!this.data?.category) {
      return 'Create a new product category for better organization';
    }

    return this.canEdit()
      ? 'Update existing category information'
      : 'View category details';
  }


  ngOnInit(): void {
    console.log('Modal Data Received:', this.data);

    this.initCurrentUser();
    this.defaultStoreData();
    if (this.data?.category && this.data.isEditMode) {
      this.isEditMode = true;
      this.populateForm(this.data.category);
      console.log('Edit Mode - Form Data:', this.categoryForm.value);
    } else {
      this.isEditMode = false;
      console.log('Create Mode - Form Data:', this.categoryForm.value);
    }

    if (!this.canEdit()) {
      this.categoryForm.disable();
    }
  }
  defaultStoreData() {
    const currentStore = this.settingsService.getCurrentDefaultStore();
    if (currentStore) {
      this.storeId = currentStore.id;
    }
  }

  private initCurrentUser(): void {
    const user = this.auth.getCurrentUserValue();
    if (!user) {
      this.showError('User not authenticated');
      this.dialogRef.close(false);
      return;
    }
    this.currentUserId = user.id;
  }

  createForm(): FormGroup {
    return this.fb.group({
      // Basic Information Section
      categoryName: ['', [Validators.required, Validators.maxLength(100)]],
      categoryCode: ['', [Validators.required, Validators.maxLength(50)]],

      // Details Section
      categoryDescription: ['', [Validators.maxLength(500)]],
      isActive: [true],

      // Meta Fields (hidden in form but needed for API)
      id: [0],
      createdUser: [0],
      updatedUser: [0]
    });
  }

  populateForm(category: ProductCategory): void {
    this.categoryForm.patchValue({
      id: category.id || 0,
      categoryName: category.categoryName || '',
      categoryCode: category.categoryCode || '',
      categoryDescription: category.categoryDescription || '',
      isActive: category.isActive !== undefined ? category.isActive : true,
      createdUser: category.createdUser || 0,
      updatedUser: category.updatedUser || 0
    });
  }

  get canSubmit(): boolean {
    return this.categoryForm.valid && !this.isSubmitting && !!this.currentUserId;
  }

  // Add this getter to access form controls in template
  get formControls() {
    return this.categoryForm.controls;
  }

  onSubmit(): void {
    if (!this.currentUserId) {
      this.showError('User not authenticated. Please login again.');
      return;
    }

    if (this.categoryForm.valid) {
      this.isSubmitting = true;

      const formValue = this.categoryForm.value;

      const categoryData: ProductCategory = {
        id: formValue.id,
        categoryName: formValue.categoryName,
        categoryCode: formValue.categoryCode,
        categoryDescription: formValue.categoryDescription,
        isActive: formValue.isActive,
        createdUser: this.isEditMode ? formValue.createdUser : this.currentUserId,
        updatedUser: this.currentUserId,
        storeId: this.storeId
      };

      console.log('Submitting Category Data:', categoryData);

      const operation = this.isEditMode
        ? this.categoryService.updateCategory(categoryData.id!, categoryData)
        : this.categoryService.createCategory(categoryData);

      operation.subscribe({
        next: (response) => {
          this.isSubmitting = false;
          const message = this.isEditMode
            ? 'Category updated successfully!'
            : 'Category created successfully!';
          this.showSuccess(message);
          this.dialogRef.close(response);
        },
        error: (err) => {
          this.isSubmitting = false;
          const message = this.isEditMode
            ? 'Failed to update category.'
            : 'Failed to create category.';
          this.showError(message);
          console.error('Error saving category:', err);
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.categoryForm.controls).forEach(key => {
      const control = this.categoryForm.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const control = this.categoryForm.get(fieldName);

    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        return `${this.getFieldLabel(fieldName)} is required`;
      }
      if (control.errors['maxlength']) {
        const maxLength = control.errors['maxlength'].requiredLength;
        return `${this.getFieldLabel(fieldName)} should not exceed ${maxLength} characters`;
      }
    }
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      categoryName: 'Category Name',
      categoryCode: 'Category Code',
      categoryDescription: 'Description'
    };
    return labels[fieldName] || fieldName;
  }

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