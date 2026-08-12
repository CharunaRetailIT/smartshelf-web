import { Component, Input, OnInit } from '@angular/core';
import { QueueService } from '../../../core/services/queue.service';
import { ImportsModule } from '../../../imports/imports';

@Component({
  selector: 'app-queue-details',
  standalone: true,
  imports: [ImportsModule],
  templateUrl: './queue-details.component.html',
  styleUrl: './queue-details.component.css',
})
export class QueueDetailsComponent implements OnInit {
  @Input() queueId!: number;

  queue: any = null;
  loading: boolean = false;

  constructor(private queueService: QueueService) {}

  ngOnInit() {
    if (this.queueId) {
      this.loadQueueDetails();
    }
  }

  loadQueueDetails() {
    this.loading = true;
    this.queueService.getQueueById(this.queueId).subscribe({
      next: (res: any) => {
        this.queue = res.result;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading queue details', err);
        this.loading = false;
      },
    });
  }

  getStatusSeverity(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'COMPLETED':
        return 'info';
      case 'FAILED':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  getPrioritySeverity(priority: string): string {
    switch (priority) {
      case 'EMERGENCY':
        return 'danger';
      case 'PRICE_CHANGE':
        return 'warning';
      case 'PROMOTION':
        return 'success';
      case 'SCHEDULED':
        return 'info';
      default:
        return 'secondary';
    }
  }
}
