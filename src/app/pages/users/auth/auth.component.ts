import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RegisterRequest } from '../../../core/interfaces/auth.interface';
import {
  SnackbarData,
  CustomSnackbarComponent,
} from '../../../shared/components/alert/custom-snackbar.component';
import { MessageService } from 'primeng/api';
import { ImportsModule } from '../../../imports/imports';
import { StoreService } from '../../../core/services/store.service';
import { StoreLookup } from '../../../core/interfaces/store.interface';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ImportsModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css',
})
export class AuthComponent implements OnInit {
  // #region State
  isSignUp = signal(false);
  showPassword = signal(false);
  isLoading = signal(false);
  rememberMe = signal(false);

  signInForm: FormGroup;
  signUpForm: FormGroup;

  stores: StoreLookup[] = [];
  storesLoading = signal(false);
  // #endregion

  // #region Constructor
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private storeService: StoreService,
    private messageService: MessageService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {
    this.signInForm = this.fb.group({
      employeeId: ['', Validators.required],
      password: ['', Validators.required],
    });

    this.signUpForm = this.fb.group(
      {
        employeeId: ['', Validators.required],
        firstName: ['', Validators.required],
        lastName: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        address1: [''],
        address2: [''],
        address3: [''],
        department: [''],
        storeId: [null, Validators.required],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
        agreeToTerms: [false, Validators.requiredTrue],
      },
      { validators: this.passwordMatchValidator },
    );
  }
  // #endregion

  // #region Lifecycle Hooks
  ngOnInit(): void {
    // this.loadRememberedCredentials();
    this.loadStores();
  }

  private loadStores(): void {
    this.storesLoading.set(true);
    this.storeService.getStoreLookup().subscribe({
      next: (stores) => {
        this.stores = stores;
        this.storesLoading.set(false);
      },
      error: () => {
        this.storesLoading.set(false);
        this.showError('Failed to load stores. Please refresh and try again.');
      },
    });
  }
  // #endregion

  // #region Remember Me Methods
  private loadRememberedCredentials(): void {
    const savedCredentials = this.getSavedCredentials();

    if (savedCredentials) {
      this.signInForm.patchValue({
        employeeId: savedCredentials.employeeId,
        password: savedCredentials.password,
        rememberMe: true,
      });
      this.rememberMe.set(true);
    }
  }

  private saveCredentials(employeeId: string, password: string): void {
    if (this.rememberMe()) {
      const credentials = {
        employeeId,
        password: this.encryptPassword(password),
        timestamp: new Date().getTime(),
      };

      localStorage.setItem(
        'rememberedCredentials',
        JSON.stringify(credentials),
      );
    }
  }

  private getSavedCredentials(): {
    employeeId: string;
    password: string;
  } | null {
    try {
      const saved = localStorage.getItem('rememberedCredentials');

      if (!saved) return null;

      const credentials = JSON.parse(saved);

      // Optional: Check if credentials are too old (e.g., older than 30 days)
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
      const isExpired = new Date().getTime() - credentials.timestamp > maxAge;

      if (isExpired) {
        this.clearSavedCredentials();
        return null;
      }

      return {
        employeeId: credentials.employeeId,
        password: this.decryptPassword(credentials.password),
      };
    } catch (error) {
      console.error('Error loading saved credentials:', error);
      this.clearSavedCredentials();
      return null;
    }
  }

  private clearSavedCredentials(): void {
    localStorage.removeItem('rememberedCredentials');
  }

  // Simple encryption/decryption (for demonstration)
  // In production, use proper encryption like crypto-js or backend storage
  private encryptPassword(password: string): string {
    // Base64 encoding (not secure for production)
    return btoa(password);
  }

  private decryptPassword(encryptedPassword: string): string {
    try {
      // Base64 decoding
      return atob(encryptedPassword);
    } catch (error) {
      console.error('Error decrypting password:', error);
      return '';
    }
  }
  // #endregion

  // #region UI Handlers
  switchToSignIn() {
    this.isSignUp.set(false);
    this.showPassword.set(false);
  }

  switchToSignUp() {
    this.isSignUp.set(true);
    this.showPassword.set(false);
  }

  togglePassword() {
    this.showPassword.set(!this.showPassword());
  }

  toggleRememberMe() {
    const rememberMeValue = this.signInForm.get('rememberMe')?.value;
    this.rememberMe.set(rememberMeValue);

    if (!rememberMeValue) {
      // Clear saved credentials if user unchecks "Remember Me"
      this.clearSavedCredentials();
    }
  }
  // #endregion

  // #region Auth Actions
  onSignIn() {
    if (this.signInForm.valid) {
      this.isLoading.set(true);

      const credentials = {
        userName: this.signInForm.value.employeeId,
        password: this.signInForm.value.password,
      };

      // // Save credentials if "Remember Me" is checked
      // if (this.signInForm.value.rememberMe) {
      //   this.saveCredentials(credentials.userName, credentials.password);
      // } else {
      //   this.clearSavedCredentials();
      // }

      this.authService.login(credentials).subscribe({
        next: (res) => {
          console.log('✅ Login successful:', res);
          this.isLoading.set(false);
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          console.error('❌ Login failed:', err);
          this.isLoading.set(false);
          this.showError('Invalid Credentials!');
        },
      });
    }
  }

  onSignUp() {
    if (this.signUpForm.valid) {
      const formValue = this.signUpForm.value;
      const createUserDto: RegisterRequest = {
        employeeId: formValue.employeeId,
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        email: formValue.email,
        password: formValue.password,
        department: 0,
        storeId: formValue.storeId,
        address1: formValue.address1,
        address2: formValue.address2,
        address3: formValue.address3,
      };

      this.authService.register(createUserDto).subscribe({
        next: (res) => {
          console.log('✅ Registration successful', res);
          this.showSuccess('Account created successfully!');
          this.signUpForm.reset();
        },
        error: (err) => {
          console.error('❌ Registration failed', err);
          this.showError('Registration failed!,RIT Please try again.');
        },
      });
    }
  }
  // #endregion

  // #region Validators
  private passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');

    if (
      password &&
      confirmPassword &&
      password.value !== confirmPassword.value
    ) {
      confirmPassword.setErrors({ mismatch: true });
      return { mismatch: true };
    }

    if (confirmPassword?.errors?.['mismatch']) {
      delete confirmPassword.errors['mismatch'];
      if (Object.keys(confirmPassword.errors).length === 0) {
        confirmPassword.setErrors(null);
      }
    }

    return null;
  }
  // #endregion

  //#region  Snackbar Methods
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
