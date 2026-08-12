import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ImportsModule } from '../../../imports/imports';
import { MessageService } from 'primeng/api';
import { HttpResponseData } from '../../../core/interfaces/http-response.interface';
import { UpdateUserDto } from '../../../core/interfaces/user.interface';
import { SnackbarData, CustomSnackbarComponent } from '../../../shared/components/alert/custom-snackbar.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { MinewModule } from "../../minew-integrate/minew.module";
import { RouterModule } from '@angular/router';

interface UserProfile {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: number;
  department: string;
  roleId: number;
  role: string;
  profileImageUrl: string | null;
  address1: string;
  address2: string;
  address3: string;
}

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ImportsModule, MinewModule, RouterModule],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent implements OnInit {
  profileForm: FormGroup;
  userProfile: UserProfile | null = null;
  loading = true;
  saving = false;
  uploadingImage = false;
  editMode = false;
  currentUserId: number = 0;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private auth: AuthService,
    private messageService: MessageService,
    private snackBar: MatSnackBar
  ) {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(50)]],
      lastName: ['', [Validators.required, Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      address1: ['', Validators.maxLength(200)],
      address2: ['', Validators.maxLength(200)],
      address3: ['', Validators.maxLength(200)]
    });
  }

  ngOnInit(): void {
    this.getCurrentUser();
    this.loadProfile();
  }

  getCurrentUser() {
    const user = this.auth.getCurrentUserValue();
    if (!user) {
      this.showError('User not authenticated');
      return;
    }
    this.currentUserId = user.id;
  }

  loadProfile(): void {
    this.loading = true;

    // Use UserService instead of direct HttpClient call
    this.userService.getMyProfile().subscribe({
      next: (response) => {
        console.log('Profile response:', response);
        if (response.success) {
          this.userProfile = response.result;
          this.populateForm();
        } else {
          this.showError(response.message);
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading profile:', error);
        this.showError('Failed to load profile: ' + (error.message || 'Unknown error'));
        this.loading = false;
      }
    });
  }

  populateForm(): void {
    if (this.userProfile) {
      this.profileForm.patchValue({
        firstName: this.userProfile.firstName,
        lastName: this.userProfile.lastName,
        email: this.userProfile.email,
        address1: this.userProfile.address1 || '',
        address2: this.userProfile.address2 || '',
        address3: this.userProfile.address3 || ''
      });
      this.profileForm.disable();
    }
  }

  toggleEditMode(): void {
    this.editMode = !this.editMode;

    if (this.editMode) {
      this.profileForm.enable();
    } else {
      this.profileForm.disable();
      this.populateForm();
    }
  }

  onSave(): void {
    if (this.profileForm.invalid || !this.userProfile) {
      this.markFormGroupTouched(this.profileForm);
      this.showError('Please fill in all required fields correctly');
      return;
    }

    this.saving = true;
    const updateData: UpdateUserDto = this.profileForm.value;

    // Use UserService instead of direct HttpClient call
    this.userService.updateMyProfile(updateData).subscribe({
      next: (response) => {
        if (response.success && response.result) {
          this.userProfile = response.result;
          this.showSuccess('Profile updated successfully');
          this.editMode = false;
          this.profileForm.disable();
          this.loadProfile();
        } else {
          this.showError(response.message);
        }
        this.saving = false;
      },
      error: (error) => {
        const errorMsg = error.error?.message || 'Failed to update profile';
        this.showError(errorMsg);
        this.saving = false;
        console.error('Error updating profile:', error);
      }
    });
  }

  onImageSelect(event: any): void {
    const file = event.files[0];
    if (!file || !this.userProfile) return;

    // Use UserService validation
    const validation = this.userService.validateImageFile(file);
    if (!validation.valid) {
      this.showError(validation.error || 'Invalid file');
      return;
    }

    this.uploadingImage = true;

    // Use UserService instead of direct HttpClient call
    this.userService.uploadProfileImage(file).subscribe({
      next: (response) => {
        if (response.success && response.result && this.userProfile) {
          this.userProfile.profileImageUrl = response.result.profileImageUrl;
          // optional: update full user object
          // this.userProfile = response.result.user;

          this.showSuccess('Profile image updated successfully');
        } else {
          this.showError(response.message);
        }
        this.uploadingImage = false;
      },
      error: (error) => {
        const errorMsg = error.error?.message || 'Failed to upload image';
        this.showError(errorMsg);
        this.uploadingImage = false;
        console.error('Error uploading image:', error);
      }
    });
  }

  // In your UserService
  // getProfileImageUrl(fileName: string): string {
  //   if (!fileName) return '';

  //   // Remove any spaces from the file name
  //   const cleanFileName = fileName.replace(/\s+/g, '');

  //   // Construct the URL
  //   const baseUrl = 'https://localhost:44321/api/uploads';
  //   return `${baseUrl}/profile-images/${cleanFileName}`;
  // }

  getSafeProfileImageUrl(): string {
    if (!this.userProfile || !this.userProfile.profileImageUrl) {
      return ''; // Return empty or placeholder image
    }

    // Ensure we have the correct URL format
    let imageUrl = this.userProfile.profileImageUrl;

    // Debug log
    console.log('Original image URL:', imageUrl);

    // If the URL is already complete, use it
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // Check if it's the correct domain
      if (imageUrl.includes('localhost:44321')) {
        console.log('Using API server URL:', imageUrl);
        return imageUrl;
      }
    }

    // If we have a relative path, construct the full URL
    const baseUrl = 'https://localhost:44321';
    // Remove leading slash if present to avoid double slash
    const cleanPath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
    const fullUrl = `${baseUrl}/${cleanPath}`;

    console.log('Constructed image URL:', fullUrl);
    return fullUrl;
  }

  getProfileImageUrl(): string {
    if (this.userProfile?.profileImageUrl) {
      // Use UserService method
      return this.userProfile.profileImageUrl;
    }
    return '';
  }

  getInitials(): string {
    if (!this.userProfile) return 'U';
    const firstInitial = this.userProfile.firstName?.charAt(0) || '';
    const lastInitial = this.userProfile.lastName?.charAt(0) || '';
    return `${firstInitial}${lastInitial}`.toUpperCase() || 'U';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.profileForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.profileForm.get(fieldName);
    if (field?.hasError('required')) return 'This field is required';
    if (field?.hasError('email')) return 'Please enter a valid email';
    if (field?.hasError('maxlength')) return 'Maximum length exceeded';
    return '';
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
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

  // private showWarning(message: string): void {
  //   this.openSnackbar({
  //     message: message,
  //     icon: 'fas fa-exclamation-triangle',
  //     type: 'warning'
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