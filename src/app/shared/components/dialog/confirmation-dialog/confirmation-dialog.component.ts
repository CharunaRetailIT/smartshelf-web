import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'warn' | 'accent';
}

@Component({
  selector: 'app-confirmation-dialog',
  imports: [CommonModule],
  templateUrl: './confirmation-dialog.component.html',
  styles: ``
})
export class ConfirmationDialogComponent {
constructor(
    private dialogRef: MatDialogRef<ConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  // Same three branches as before - only the class names changed, so the
  // confirm button now uses the shared dialog button styles instead of its own
  // Tailwind colours (the default branch used to be blue, which clashed with
  // the app's green primary).
  getConfirmButtonClass(): string {
    const baseClass = 'dlg-btn';

    switch (this.data.confirmColor) {
      case 'warn':
        return `${baseClass} dlg-btn-danger`;
      case 'accent':
        return `${baseClass} dlg-btn-primary`;
      default:
        return `${baseClass} dlg-btn-primary`;
    }
  }
}
