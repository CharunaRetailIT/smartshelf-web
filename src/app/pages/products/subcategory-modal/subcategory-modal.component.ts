import { Component, Inject, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import {
  ProductSubCategory,
  ProductCategory,
} from '../../../core/interfaces/product.interface';
import { CategoryService } from '../../../core/services/category.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  CustomSnackbarComponent,
  SnackbarData,
} from '../../../shared/components/alert/custom-snackbar.component';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SettingsService } from '../../../core/services/settings.service';
import { MessageService } from 'primeng/api';

export interface SubcategoryModalData {
  subCategory?: ProductSubCategory;
  categories: ProductCategory[];
  isEditMode: boolean;
}

@Component({
  selector: 'app-subcategory-modal',
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
    MatCheckboxModule,
  ],
  templateUrl: './subcategory-modal.component.html',
  styleUrls: ['./subcategory-modal.component.css'],
})
export class SubcategoryModalComponent implements OnInit {
  subCategoryForm: FormGroup;
  loading = false;
  isEditMode = false;
  isSubmitting = false;
  currentUserId!: number;
  categories: ProductCategory[] = [];
  storeId: number = 0;

  constructor(
    private fb: FormBuilder,
    private categoryService: CategoryService,
    private messageService: MessageService,
    private snackBar: MatSnackBar,
    public auth: AuthService,
    private settingsService: SettingsService,
    public dialogRef: MatDialogRef<SubcategoryModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SubcategoryModalData,
  ) {
    this.subCategoryForm = this.createForm();
  }

  canEdit(): boolean {
    return this.auth.hasAnyRole(['Admin', 'Manager', 'Operator']);
  }

  isReadOnlyMode(): boolean {
    return !this.canEdit();
  }

  getSUbCategoryHeaderText(): string {
    if (!this.data?.subCategory) {
      return 'Add New Subcategory';
    }

    return this.canEdit() ? 'Edit Subcategory' : 'View Subcategory';
  }

  getSubCategoryDescriptionText(): string {
    if (!this.data?.subCategory) {
      return 'Create a new product subcategory for better organization';
    }

    return this.canEdit()
      ? 'Update existing subcategory information'
      : 'View subcategory details';
  }

  ngOnInit(): void {
    console.log('Modal Data Received:', this.data);

    this.initCurrentUser();
    this.defaultStoreData();
    if (this.data?.categories) {
      this.categories = this.data.categories;
    }

    if (this.data?.subCategory && this.data.isEditMode) {
      this.isEditMode = true;
      this.populateForm(this.data.subCategory);
      console.log('Edit Mode - Form Data:', this.subCategoryForm.value);
    } else {
      this.isEditMode = false;
      console.log('Create Mode - Form Data:', this.subCategoryForm.value);
    }

    if (!this.canEdit()) {
      this.subCategoryForm.disable();
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
      categoryId: ['', [Validators.required, Validators.min(1)]],
      subCategoryName: ['', [Validators.required, Validators.maxLength(100)]],
      subCategoryCode: ['', [Validators.required, Validators.maxLength(50)]],

      // Details Section
      subCategoryDescription: ['', [Validators.maxLength(500)]],
      isActive: [true],

      // Meta Fields (hidden in form but needed for API)
      id: [0],
      createdUser: [0],
      updatedUser: [0],
    });
  }

  populateForm(subCategory: ProductSubCategory): void {
    this.subCategoryForm.patchValue({
      id: subCategory.id || 0,
      categoryId: subCategory.categoryId || 0,
      subCategoryName: subCategory.subCategoryName || '',
      subCategoryCode: subCategory.subCategoryCode || '',
      subCategoryDescription: subCategory.subCategoryDescription || '',
      isActive:
        subCategory.isActive !== undefined ? subCategory.isActive : true,
      createdUser: subCategory.createdUser || 0,
      updatedUser: subCategory.updatedUser || 0,
      storeId: this.storeId,
    });
  }

  get canSubmit(): boolean {
    return (
      this.subCategoryForm.valid && !this.isSubmitting && !!this.currentUserId
    );
  }

  // Add this getter to access form controls in template
  get formControls() {
    return this.subCategoryForm.controls;
  }

  getCategoryName(categoryId: number): string {
    const category = this.categories.find((c) => c.id === categoryId);
    return category ? category.categoryName : 'Not selected';
  }

  onSubmit(): void {
    if (!this.currentUserId) {
      this.showError('User not authenticated. Please login again.');
      return;
    }

    if (this.subCategoryForm.valid) {
      this.isSubmitting = true;

      const formValue = this.subCategoryForm.value;

      const subCategoryData: ProductSubCategory = {
        id: formValue.id,
        categoryId: formValue.categoryId,
        subCategoryName: formValue.subCategoryName,
        subCategoryCode: formValue.subCategoryCode,
        subCategoryDescription: formValue.subCategoryDescription,
        isActive: formValue.isActive,
        createdUser: this.isEditMode
          ? formValue.createdUser
          : this.currentUserId,
        updatedUser: this.currentUserId,
        storeId: this.storeId,
      };

      console.log('Submitting Subcategory Data:', subCategoryData);

      const operation = this.isEditMode
        ? this.categoryService.updateSubCategory(
            subCategoryData.id!,
            subCategoryData,
          )
        : this.categoryService.createSubCategory(subCategoryData);

      operation.subscribe({
        next: (response) => {
          this.isSubmitting = false;
          const message = this.isEditMode
            ? 'Subcategory updated successfully!'
            : 'Subcategory created successfully!';
          this.showSuccess(message);
          this.dialogRef.close(response);
        },
        error: (err) => {
          this.isSubmitting = false;
          const message = this.isEditMode
            ? 'Failed to update subcategory.'
            : 'Failed to create subcategory.';
          this.showError(message);
          console.error('Error saving subcategory:', err);
        },
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.subCategoryForm.controls).forEach((key) => {
      const control = this.subCategoryForm.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const control = this.subCategoryForm.get(fieldName);

    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        return `${this.getFieldLabel(fieldName)} is required`;
      }
      if (control.errors['min'] && fieldName === 'categoryId') {
        return 'Please select a parent category';
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
      categoryId: 'Parent Category',
      subCategoryName: 'Subcategory Name',
      subCategoryCode: 'Subcategory Code',
      subCategoryDescription: 'Description',
    };
    return labels[fieldName] || fieldName;
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
