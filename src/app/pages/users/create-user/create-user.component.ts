import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { UserService } from '../../../core/services/user.service';
import {
  CreateUserDto,
  Department,
  Role,
} from '../../../core/interfaces/user.interface';
import {
  SnackbarData,
  CustomSnackbarComponent,
} from '../../../shared/components/alert/custom-snackbar.component';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-create-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-user.component.html',
  styleUrl: './create-user.component.css',
})
export class CreateUserComponent implements OnInit {
  //#region Properties
  userForm: FormGroup;
  departments = signal<Department[]>([]);
  roles = signal<Role[]>([]);
  isSubmitting = signal(false);
  showPassword = signal(false);
  //#endregion

  //#region Constructor
  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private messageService: MessageService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<CreateUserComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {
    this.userForm = this.fb.group({
      employeeId: ['', [Validators.required]],
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      department: [''],
      roleId: ['', [Validators.required]],
    });
  }
  //#endregion

  //#region Lifecycle
  ngOnInit(): void {
    this.loadDepartments();
    this.loadRoles();
  }
  //#endregion

  //#region API Calls
  private loadDepartments(): void {
    this.userService.getDepartments().subscribe({
      next: (departments) => this.departments.set(departments),
      error: (error) => {
        console.error('Error loading departments:', error);
        this.showError('Error loading departments');
      },
    });
  }

  private loadRoles(): void {
    this.userService.getRoles().subscribe({
      next: (roles) => this.roles.set(roles),
      error: (error) => {
        console.error('Error loading roles:', error);
        this.showError('Error loading roles');
      },
    });
  }
  //#endregion

  //#region Form Actions
  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  onSubmit(): void {
    if (this.userForm.valid && !this.isSubmitting()) {
      this.isSubmitting.set(true);

      const formValue = this.userForm.value;

      let dept =
        formValue.department === '' || formValue.department === undefined
          ? null
          : Number(formValue.department);

      const createUserDto: CreateUserDto = {
        employeeId: formValue.employeeId,
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        email: formValue.email,
        password: formValue.password,
        department: formValue.department || 0,
        roleId: formValue.roleId,
      };
      console.log('Creating user with data:', createUserDto);

      this.userService.createUser(createUserDto).subscribe({
        next: () => this.handleSuccess('User created successfully'),
        error: (error) => this.handleError(error, 'Failed to create user'),
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close({ success: false });
  }
  //#endregion

  //#region Helpers
  private handleSuccess(message: string): void {
    this.isSubmitting.set(false);
    this.showSuccess(message);
    this.dialogRef.close({ success: true, data: this.userForm.value });
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
