import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { DeleteConfirmationComponent, DeleteDialogData } from '../../shared/components/dialog/delete-confirmation/delete-confirmation.component';

@Injectable({
  providedIn: 'root'
})
export class DeleteConfirmationService {
  constructor(private dialog: MatDialog) {}

  // openDeleteDialog(data: DeleteDialogData = {}): Observable<boolean> {
  //   const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
  //     width: '400px',
  //     disableClose: true,
  //     hasBackdrop: true,
  //     backdropClass: 'bg-black',
  //     panelClass: 'custom-dialog-container',
  //     data: data
  //   });

  //   return dialogRef.afterClosed();
  // }
}
