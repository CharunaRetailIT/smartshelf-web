import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserService } from '../../../core/services/user.service';
import { AssignRoleDto, Department, Role, UpdateUserDto, User, UserData } from '../../../core/interfaces/user.interface';
import { SnackbarData, CustomSnackbarComponent } from '../../../shared/components/alert/custom-snackbar.component';
import { MessageService } from 'primeng/api';

interface EditUserDialogData {
  user: User;
  roles?: Role[];
}

@Component({
  selector: 'app-edit-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule],
  templateUrl: './edit-user.component.html',
  styleUrl: './edit-user.component.css'
})
export class EditUserComponent implements OnInit {

  // #region Properties
  userForm: FormGroup;
  isSubmitting = false;
  departments: Department[] = [];
  roles: Role[] = [];
  canAssignRole = false;
  currentUser: User; // Store the user data separately
  // #endregion

  // #region Constructor
  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private messageService: MessageService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<EditUserComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EditUserDialogData
  ) {
    console.log('Edit user data received:', data); // Debug log

    // Extract user from the data object
    this.currentUser = data.user;
    this.roles = data.roles || [];

    this.userForm = this.createUserForm(this.currentUser);
  }
  // #endregion

  // #region Lifecycle Hooks
  ngOnInit(): void {
    this.loadDepartments();

    // If roles weren't passed in data, load them
    if (this.roles.length === 0) {
      this.loadRoles();
    }

    this.checkAdminPermissions();

    // Log form state after initialization
    setTimeout(() => {
      console.log('Form state after init:', {
        formValues: this.userForm.value,
        formValid: this.userForm.valid,
        formErrors: this.userForm.errors,
        departmentValue: this.userForm.get('department')?.value,
        roleValue: this.userForm.get('role')?.value,
        currentUser: this.currentUser
      });
    }, 500);
  }
  // #endregion

  // #region Form Initialization
  private createUserForm(user: User): FormGroup {
    console.log('Creating form with user:', user);
    console.log('User roleId:', user.roleId, 'Type:', typeof user.roleId);
    console.log('User departmentId:', user.departmentId, 'Type:', typeof user.departmentId);

    const form = this.fb.group({
      employeeId: [user?.employeeId || '', [Validators.required]],
      firstName: [user?.firstName || '', [Validators.required]],
      lastName: [user?.lastName || '', [Validators.required]],
      email: [user?.email || '', [Validators.required, Validators.email]],
      department: [user?.departmentId ? Number(user.departmentId) : null, [Validators.required]],
      role: [user?.roleId ? Number(user.roleId) : null, [Validators.required]]
    });

    // Log initial form values
    console.log('Form initialized with values:', form.value);

    return form;
  }
  // #endregion

  // #region Permission Checks
  private checkAdminPermissions(): void {
    this.userService.getCurrentUserRole().subscribe({
      next: (role) => {
        this.canAssignRole = role === 'Admin';
        console.log('User role:', role, 'Can assign role:', this.canAssignRole);

        if (!this.canAssignRole) {
          this.userForm.get('role')?.clearValidators();
          this.userForm.get('role')?.updateValueAndValidity();
        }
      },
      error: (error) => {
        console.error('Error checking permissions:', error);
        this.canAssignRole = false;
      }
    });
  }
  // #endregion

  // #region Data Loading
  private loadDepartments(): void {
    this.userService.getDepartments().subscribe({
      next: (departments) => {
        this.departments = departments;
        console.log('Departments loaded:', this.departments);

        // Check if current department exists
        const currentDeptId = this.userForm.get('department')?.value;
        console.log('Current department ID in form:', currentDeptId);

        if (currentDeptId) {
          const departmentExists = this.departments.some(d => d.id === currentDeptId);
          console.log('Department exists in list:', departmentExists);

          if (!departmentExists) {
            console.warn(`Department ID ${currentDeptId} not found in available departments`);
          }
        }
      },
      error: (error) => {
        console.error('Error loading departments:', error);
        this.showError('Error loading departments');
      }
    });
  }

  private loadRoles(): void {
    this.userService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
        console.log('Roles loaded:', this.roles);

        // Check if current role exists
        const currentRoleId = this.userForm.get('role')?.value;
        console.log('Current role ID in form:', currentRoleId);

        if (currentRoleId) {
          const roleExists = this.roles.some(r => r.id === currentRoleId);
          console.log('Role exists in list:', roleExists);

          if (!roleExists) {
            console.warn(`Role ID ${currentRoleId} not found in available roles`);
          }
        }
      },
      error: (error) => {
        console.error('Error loading roles:', error);
        this.showError('Error loading roles');
      }
    });
  }
  // #endregion

  // #region Form Submission
  onSubmit(): void {
    // Mark all fields as touched to trigger validation display
    this.markFormGroupTouched(this.userForm);

    if (this.userForm.invalid || this.isSubmitting) {
      console.log('Form invalid or submitting:', {
        invalid: this.userForm.invalid,
        submitting: this.isSubmitting,
        errors: this.getFormControlErrors()
      });
      return;
    }

    this.isSubmitting = true;
    const updateUserDto = this.mapFormToDto();

    console.log('Submitting update:', {
      userId: this.currentUser.id,
      dto: updateUserDto,
      formValue: this.userForm.value
    });

    this.userService.updateUser(this.currentUser.id, updateUserDto).subscribe({
      next: (response) => this.handleUpdateResponse(response),
      error: (error) => this.handleError(error, 'Failed to update user')
    });
  }

  private mapFormToDto(): UpdateUserDto {
    const formValue = this.userForm.value;
    const dto: UpdateUserDto = {
      employeeId: formValue.employeeId,
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      email: formValue.email,
      department: formValue.department
    };

    console.log('Mapped DTO:', dto);
    return dto;
  }

  private handleUpdateResponse(response: any): void {
    console.log('Update response:', response);

    if (response.statusCode === 200) {
      const formRole = this.userForm.value.role;
      console.log('Role assignment check:', {
        canAssignRole: this.canAssignRole,
        currentRoleId: this.currentUser.roleId,
        newRoleId: formRole,
        needsRoleUpdate: this.canAssignRole && formRole !== this.currentUser.roleId
      });

      if (this.canAssignRole && formRole !== this.currentUser.roleId) {
        this.assignRole(formRole);
      } else {
        this.handleSuccess('User updated successfully');
      }
    } else {
      this.handleError(
        { message: response.message, statusCode: response.statusCode },
        'Update completed with non-200 status'
      );
    }
  }

  private assignRole(roleId: number): void {
    const assignRoleDto: AssignRoleDto = { userId: this.currentUser.id, role: roleId };
    console.log('Assigning role:', assignRoleDto);

    this.userService.assignRole(assignRoleDto).subscribe({
      next: (response) => {
        console.log('Role assignment response:', response);
        this.handleSuccess('User updated successfully!');
      },
      error: (error) => {
        console.error('Role assignment error:', error);
        // Even if role assignment fails, consider the user update successful
        this.handleSuccess('User updated successfully, but role assignment failed');
      }
    });
  }

  // Helper to mark all form controls as touched
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  // Helper to get form control errors
  private getFormControlErrors(): any {
    const errors: any = {};
    Object.keys(this.userForm.controls).forEach(key => {
      const control = this.userForm.get(key);
      if (control?.errors) {
        errors[key] = control.errors;
      }
    });
    return errors;
  }
  // #endregion

  // #region Success/Error Handlers
  private handleSuccess(message: string): void {
    this.isSubmitting = false;
    this.showSuccess(message);
    this.dialogRef.close({
      success: true,
      data: this.userForm.value,
      user: this.currentUser
    });
  }

  private handleError(error: any, fallbackMessage: string): void {
    this.isSubmitting = false;
    console.error('Error:', error);

    let errorMessage = fallbackMessage;
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    this.showError(errorMessage)
  }

  // #endregion

  // #region Dialog Actions
  onCancel(): void {
    this.dialogRef.close({ success: false });
  }
  // #endregion

  // #region Helper Methods for Template
  getDepartmentName(deptId: number): string {
    const dept = this.departments.find(d => d.id === deptId);
    return dept ? dept.name : 'Loading...';
  }

  getRoleName(roleId: number): string {
    const role = this.roles.find(r => r.id === roleId);
    return role ? role.name : 'Loading...';
  }

  isFieldInvalid(fieldName: string): boolean {
    const control = this.userForm.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }

  getFieldError(fieldName: string): string {
    const control = this.userForm.get(fieldName);
    if (control && control.errors && control.touched) {
      if (control.errors['required']) return 'This field is required';
      if (control.errors['email']) return 'Please enter a valid email address';
    }
    return '';
  }

  // Get current display values for debugging
  getCurrentDepartmentDisplay(): string {
    const deptId = this.userForm.get('department')?.value;
    return deptId ? this.getDepartmentName(deptId) : 'Not selected';
  }

  getCurrentRoleDisplay(): string {
    const roleId = this.userForm.get('role')?.value;
    return roleId ? this.getRoleName(roleId) : 'Not selected';
  }
  // #endregion

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