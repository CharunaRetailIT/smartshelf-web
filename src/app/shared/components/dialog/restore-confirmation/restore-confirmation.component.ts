import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';

export interface RestoreDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

@Component({
  selector: 'app-restore-confirmation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dlg-confirm">
      <!-- Header -->
      <div class="dlg-confirm-head">
        <span class="dlg-icon-badge" aria-hidden="true">
          <i class="fas fa-undo"></i>
        </span>
        <h3 class="dlg-confirm-title">{{ data.title }}</h3>
      </div>

      <!-- Content -->
      <p class="dlg-confirm-message">{{ data.message }}</p>

      <!-- Actions -->
      <div class="dlg-confirm-actions">
        <button
          type="button"
          (click)="onCancel()"
          class="dlg-btn dlg-btn-secondary">
          {{ data.cancelText || 'Cancel' }}
        </button>
        <button
          type="button"
          (click)="onConfirm()"
          class="dlg-btn dlg-btn-primary">
          {{ data.confirmText || 'Restore' }}
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./restore-confirmation.component.css']
})
export class RestoreConfirmationComponent {
  constructor(
    public dialogRef: MatDialogRef<RestoreConfirmationComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RestoreDialogData
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}