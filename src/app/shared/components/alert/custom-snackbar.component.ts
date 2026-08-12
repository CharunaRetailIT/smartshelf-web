import { Component, Inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';

export interface SnackbarData {
  message: string;
  icon: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

@Component({
  selector: 'app-custom-snackbar',
  template: `
    <div class="custom-snackbar" [class]="data.type + '-snackbar'">
      <div class="snackbar-content">
        <i class="fas {{data.icon}} snackbar-icon"></i>
        <span class="snackbar-message">{{data.message}}</span>
      </div>
      <button mat-icon-button class="snackbar-close" (click)="snackBarRef.dismiss()">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `,
  styles: [`
    .custom-snackbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 48px;
    }
    .snackbar-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .snackbar-icon {
      font-size: 18px;
    }
    .snackbar-close {
      color: inherit;
      opacity: 0.8;
    }
    .snackbar-close:hover {
      opacity: 1;
    }
    
    /* Style variants */
     .success-snackbar { color: white; }
    .error-snackbar {  color: white; }
    .warning-snackbar {color: white; }
    .info-snackbar {color: white; }
   /*.success-snackbar { background-color: #4caf50; color: white; }
    .error-snackbar { background-color: #f44336; color: white; }
    .warning-snackbar { background-color: #ff9800; color: white; }
    .info-snackbar { background-color: #2196f3; color: white; }*/
  `]
})
export class CustomSnackbarComponent {
  constructor(
    public snackBarRef: MatSnackBarRef<CustomSnackbarComponent>,
    @Inject(MAT_SNACK_BAR_DATA) public data: SnackbarData
  ) {}
}