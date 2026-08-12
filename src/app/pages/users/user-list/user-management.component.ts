import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Observable, Subject, takeUntil } from 'rxjs';

import { UserService } from '../../../core/services/user.service';
import {
  CreateUserDto,
  Role,
  User,
  UserData,
  UserFormData
} from '../../../core/interfaces/user.interface';
import { EditUserComponent } from '../edit-user/edit-user.component';
import { CreateUserComponent } from '../create-user/create-user.component';
import { DeleteConfirmationComponent } from '../../../shared/components/dialog/delete-confirmation/delete-confirmation.component';
import { SnackbarData, CustomSnackbarComponent } from '../../../shared/components/alert/custom-snackbar.component';
import { RestoreConfirmationComponent } from '../../../shared/components/dialog/restore-confirmation/restore-confirmation.component';
import { AuthService } from '../../../core/services/auth.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule
  ],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.css'
})
export class UserManagementComponent
  implements OnInit, OnDestroy, AfterViewInit {
  //#region Table Config
  displayedColumns: string[] = [
    'user',
    'role',
    'status',
    'lastLogin',
    'createdAt',
    'actions'
  ];
  dataSource = new MatTableDataSource<User>([]);
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  //#endregion

  //#region State
  users$!: Observable<User[]>;
  users: User[] = [];
  roles: Role[] = [];
  filteredUsers: User[] = [];
  destroy$ = new Subject<void>();

  searchTerm = '';
  roleFilter = 'all';
  statusFilter = 'all';

  showModal = false;
  editingUser: User | null = null;
  userForm: FormGroup;

  isLoading = true;

  //CurrentUser
  currentUserId: number = 0;
  //#endregion

  constructor(
    private userService: UserService,
    public auth: AuthService,
    private messageService: MessageService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      role: ['user', Validators.required],
      status: ['active', Validators.required],
      password: ['']
    });
  }

  //#region Lifecycle
  ngOnInit(): void {
    this.getCurrentUser();
    this.loadRoles();
    this.bindUsersStream();
  }

  getCurrentUser() {
    const user = this.auth.getCurrentUserValue();
    if (!user) {
      this.showError('User not authenticated');
      return;
    }
    this.currentUserId = user.id;
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  //#endregion

  //#region Data Fetching
  private loadRoles(): void {
    this.userService.getRoles().subscribe({
      next: (roles: Role[]) => {
        this.roles = roles;
        console.log('Roles loaded:', this.roles);
      },
      error: err => {
        console.error('Error fetching roles:', err);
        this.showError('Failed to load roles. Please try again.');
      }
    });
  }

  private bindUsersStream(): void {
    this.users$ = this.userService.users$;

    // Load users initially
    this.userService.getUsers();

    this.users$.pipe(takeUntil(this.destroy$)).subscribe(users => {
      this.users = users;
      this.isLoading = false;
      console.log('Users loaded:', users);
      this.applyFilters(); // Apply filters when users are loaded/updated
    });
  }
  //#endregion

  //#region Filtering
  applyFilters(): void {
    let filtered = this.users;

    // Apply search filter
    if (this.searchTerm) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.employeeId?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.firstName?.toLowerCase().includes(searchLower) ||
        user.lastName?.toLowerCase().includes(searchLower)
      );
    }

    // Apply role filter
    if (this.roleFilter !== 'all') {
      filtered = filtered.filter(user =>
        user.role?.toLowerCase() === this.roleFilter.toLowerCase()
      );
    }

    // Apply status filter
    if (this.statusFilter !== 'all') {
      const isActive = this.statusFilter === 'active';
      filtered = filtered.filter(user => user.isActive === isActive);
    }

    this.dataSource.data = filtered;

    // Reset paginator to first page after filtering
    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onRoleFilterChange(): void {
    this.applyFilters();
  }

  onStatusFilterChange(): void {
    this.applyFilters();
  }

  // Clear all filters
  clearFilters(): void {
    this.searchTerm = '';
    this.roleFilter = 'all';
    this.statusFilter = 'all';
    this.applyFilters();
  }
  //#endregion

  //#region CRUD Actions
  createUser(): void {
    const dialogRef = this.dialog.open(CreateUserComponent, {
      maxWidth: '90vw',
      disableClose: true,
      data: { roles: this.roles } // Pass roles to the dialog
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Refresh users after creation
        this.userService.getUsers();
        // this.showSnackBar('✅ User created successfully', 'success');
      }
    });
  }

  editUser(user: UserData): void {
    console.log('Editing user:', user);
    const dialogRef = this.dialog.open(EditUserComponent, {
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: {
        user: user,
        roles: this.roles
      },
      disableClose: true,
      panelClass: 'custom-dialog-panel'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        // Refresh users after update
        this.userService.getUsers();
        // this.showSuccess('User updated successfully!');
      }
    });
  }

  openDeleteDialog(user: User): void {
    console.log('Attempting to delete user:', user);
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Delete Employee',
        message: `Are you sure you want to delete ${user.employeeId}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      },
      panelClass: ['rounded-lg'],
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.deleteEmployee(user.id);
    });
  }

  private deleteEmployee(id: number): void {
    console.log('Deleting user with ID:', id);
    this.userService.deleteUser(id).subscribe({
      next: () => {
        this.userService.getUsers();
        this.showSuccess('User deleted successfully!');
      },
      error: err => {
        console.error('Error deleting user:', err);
        this.showError('Failed to delete user. Please try again.');
      }
    });
  }

  // Refresh users manually
  refreshUsers(): void {
    this.isLoading = true;
    this.userService.getUsers();
  }

  //Restore Operations
  restoreUser(user: User): void {
    const dialogRef = this.dialog.open(RestoreConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Restore User',
        message: `Are you sure you want to restore user "${user.employeeId}"?`,
        confirmText: 'Restore',
        cancelText: 'Cancel'
      },
      panelClass: ['rounded-lg'],
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.userService.restoreUser(user.id).subscribe({
          next: () => {
            this.userService.getUsers();
            this.showSuccess('User restored successfully!');
          },
          error: (err) => {
            console.error('Error restoring user:', err);
            this.showError('Failed to restore user. Please try again.');
          }
        });
      }
    });
  }
  //#endregion

  //#region Helpers
  getUserInitials(user: User): string {
    if (!user.firstName && !user.lastName) return '?';
    return `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase();
  }

  getRoleColor(role: string): string {
    switch (role) {
      case 'Admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Manager':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Viewer':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'Operator':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  getStatusColor(isActive: boolean): string {
    return isActive
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-red-100 text-red-800 border-red-200';
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