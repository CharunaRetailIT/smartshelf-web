import { Component, OnInit, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Table, TableModule } from 'primeng/table';
import {
  Message,
  MessageWithUser,
} from '../../../core/interfaces/message.interface';
import { QueueService } from '../../../core/services/queue.service';
import { MatInputModule } from '@angular/material/input';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { CreateMessageComponent } from '../create-message/create-message.component';
import { EditMessageComponent } from '../edit-message/edit-message.component';
import { firstValueFrom } from 'rxjs';
import { DeleteConfirmationComponent } from '../../../shared/components/dialog/delete-confirmation/delete-confirmation.component';
import { AuthService } from '../../../core/services/auth.service';
import { RouterModule } from '@angular/router';
import {
  CustomSnackbarComponent,
  SnackbarData,
} from '../../../shared/components/alert/custom-snackbar.component';
import { SettingsService } from '../../../core/services/settings.service';
import { CustomMessageService } from '../../../core/services/message.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-message-list',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatInputModule,
    TableModule,
    MatIconModule,
    MatSelectModule,
    RouterModule,
  ],
  templateUrl: './message-list.component.html',
  styleUrl: './message-list.component.css',
})
export class MessageListComponent implements OnInit {
  @ViewChild('messagesTable') messagesTable?: Table;

  dataSource: MessageWithUser[] = [];
  // Updated displayedColumns to include actions
  displayedColumns: string[] = [
    'title',
    'content_type',
    'is_active',
    'created_by',
    'created_at',
    'actions',
  ];
  currentUserId!: number;

  //Default store
  storeId: number = 0;

  constructor(
    public auth: AuthService,
    private settingsService: SettingsService,
    private messageService: CustomMessageService,
    private primemessageService: MessageService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.setDefaultStore();
    this.loadMessages();
    // Subscribe to current user
    this.auth.currentUser$.subscribe((user) => {
      if (user) {
        this.currentUserId = user.id;
      } else {
        this.showError('User not authenticated');
      }
    });
  }

  canEdit(): boolean {
    return this.auth.hasAnyRole(['Admin', 'Manager', 'Operator']);
  }

  isReadOnlyMode(): boolean {
    return !this.canEdit();
  }

  setDefaultStore() {
    const currentStore = this.settingsService.getCurrentDefaultStore();
    if (currentStore) {
      this.storeId = currentStore.id;
    }
  }

  private loadMessages(): void {
    console.log('store', this.storeId);
    this.messageService.getMessagesWithUser(this.storeId).subscribe({
      next: (messages) => {
        console.log('Fetched messages:', messages);
        this.dataSource = messages;
      },
      error: (error) => {
        this.showError('Failed to load messages: ' + error.message);
      },
    });
  }

  /**
   * Same free-text search as before, now run by the grid across the columns
   * listed in `globalFilterFields`. Filtering still returns to page one.
   */
  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.messagesTable?.filterGlobal(
      filterValue.trim().toLowerCase(),
      'contains',
    );
  }

  createMessage(): void {
    const dialogRef = this.dialog.open(CreateMessageComponent, {
      maxWidth: '90vw',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.loadMessages();
    });
  }

  getContentTypeIcon(contentType: number): string {
    switch (contentType) {
      case 1:
        return 'fas fa-align-left';
      case 2:
        return 'fas fa-image';
      case 3:
        return 'fas fa-video';
      case 4:
        return 'fas fa-paint-brush';
      default:
        return 'fas fa-question';
    }
  }

  getContentTypeClass(contentType: number): string {
    switch (contentType) {
      case 1:
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 2:
        return 'bg-green-100 text-green-800 border-green-200';
      case 3:
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 4:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  getMessageTypeBackground(type: number): string {
    switch (type) {
      case 1:
        return 'bg-blue-100';
      case 2:
        return 'bg-green-100';
      case 3:
        return 'bg-purple-100';
      case 4:
        return 'bg-orange-100';
      default:
        return 'bg-gray-100';
    }
  }

  getMessageTypeIconColor(type: number): string {
    switch (type) {
      case 1:
        return 'text-blue-600';
      case 2:
        return 'text-green-600';
      case 3:
        return 'text-purple-600';
      case 4:
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  editMessage(message: MessageWithUser): void {
    const dialogRef = this.dialog.open(EditMessageComponent, {
      data: { message },
      width: '95vw',
      maxWidth: '1200px',
      disableClose: true,
      panelClass: ['edit-message-dialog'],
      // hasBackdrop: false,
      // backdropClass: 'edit-dialog-backdrop'
    });
    console.log('Opened edit dialog for message:', message);
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadMessages(); // Refresh the list
        // this.showSuccess('Message updated successfully');
      }
    });
  }

  deleteMessage(message: any): void {
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Delete Message',
        message: `Are you sure you want to delete "${message.title}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      },
      panelClass: ['rounded-lg'],
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result === true) {
        try {
          await firstValueFrom(
            this.messageService.deleteMessage(
              message.id,
              this.currentUserId,
              this.storeId,
            ),
          );
          this.showSuccess('Message deleted successfully');
          this.loadMessages();
        } catch (error) {
          console.error(error);
          this.showError('Failed to delete Message. Please try again.');
        }
      }
    });
  }

  //#region Snackbar Methods
  private showSuccess(message: string): void {
    this.primemessageService.add({
      severity: 'success',
      summary: 'Success',
      detail: message,
      life: 5000,
    });
  }

  private showError(message: string): void {
    this.primemessageService.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000,
    });
  }

  private showWarning(message: string): void {
    this.primemessageService.add({
      severity: 'warn',
      summary: 'Warning',
      detail: message,
      life: 5000,
    });
  }

  private showInfo(message: string): void {
    this.primemessageService.add({
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
