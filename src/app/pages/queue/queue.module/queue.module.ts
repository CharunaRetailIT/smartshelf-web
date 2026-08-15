import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImportsModule } from '../../../imports/imports';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { QueueDetailsComponent } from '../queue-details/queue-details.component';
import { QueueListComponent } from '../queue-list/queue-list.component';
import { CreateQueueComponent } from '../create-queue/create-queue.component';
import { ConfirmationService, MessageService } from 'primeng/api';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ImportsModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild([
      { path: '', component: QueueListComponent },
      { path: 'create', component: CreateQueueComponent },
      { path: ':id', component: QueueDetailsComponent },
    ]),
  ],
  providers: [ConfirmationService, MessageService],
})
export class QueueModule {}
