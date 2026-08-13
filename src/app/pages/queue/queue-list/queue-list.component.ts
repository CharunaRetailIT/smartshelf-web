import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Table, TableRowExpandEvent } from 'primeng/table';
import { DeviceService } from '../../../core/services/device.service';
import { QueueService } from '../../../core/services/queue.service';
import { StoreService } from '../../../core/services/store.service';
import { ImportsModule } from '../../../imports/imports';
import { Router, RouterModule } from '@angular/router';
import { QueueDetailsComponent } from '../queue-details/queue-details.component';
import { CreateQueueComponent } from '../create-queue/create-queue.component';
import { AuthService } from '../../../core/services/auth.service';
import { SettingsService } from '../../../core/services/settings.service';
import { MatDialog } from '@angular/material/dialog';
import { DeleteConfirmationComponent } from '../../../shared/components/dialog/delete-confirmation/delete-confirmation.component';

@Component({
  selector: 'app-queue-list',
  standalone: true,
  imports: [
    ImportsModule,
    RouterModule,
    QueueDetailsComponent,
    CreateQueueComponent,
  ],
  templateUrl: './queue-list.component.html',
  styleUrl: './queue-list.component.css',
})
export class QueueListComponent implements OnInit {
  @ViewChild('dt') table!: Table;
  @ViewChild('createQueueRef') createQueueRef!: CreateQueueComponent;

  private router = inject(Router);

  // Dialog properties
  showCreateDialog: boolean = false;

  queues: any[] = [];
  totalRecords: number = 0;
  loading: boolean = false;

  // Filter values
  selectedStore: any = null;
  selectedStatus: string = '';
  selectedQueueType: string = '';
  dateRange: Date[] = [];

  // Dropdown options
  stores: any[] = [];
  // Values must match the Status.Name rows a queue can actually have
  // (QueueStatus: Pending=5, Processing=6, Completed=7, Failed=8). "Active" was
  // not one of them, so that option could never match a row.
  statusOptions: any[] = [
    { label: 'Pending', value: 'Pending' },
    { label: 'Processing', value: 'Processing' },
    { label: 'Completed', value: 'Completed' },
    { label: 'Failed', value: 'Failed' },
  ];

  queueTypeOptions: any[] = [
    { label: 'Template Queue', value: 'TEMPLATE_QUEUE' },
    { label: 'Message Queue', value: 'MESSAGE_QUEUE' },
  ];

  // Row expansion
  // expandedRows: { [key: string]: boolean } = {};
  expandedRows: { [key: string]: boolean } = {};

  // Statistics
  stats: any = {};
  statsLoading: boolean = false;

  //store loading
  initialLoading = false;

  //Current User
  currentUserId: number = 0;

  //Default Store
  storeId: number = 0;

  // Pagination for lazy loading
  private pageNumber = 1;
  private pageSize = 20;
  private hasMoreData = true;
  private isLoadingMore = false;

  constructor(
    private queueService: QueueService,
    private deviceService: DeviceService,
    private storeService: StoreService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    public auth: AuthService,
    private settingsService: SettingsService,
    private dialog: MatDialog,
  ) {}

  ngOnInit() {
    this.getCurrentUser();
    this.setDefaultStore();
    this.loadStores();
    this.loadStats();
  }

  getCurrentUser() {
    const user = this.auth.getCurrentUserValue();
    if (!user) {
      console.log('User not authenticated');
      return;
    }
    this.currentUserId = user.id;
  }

  setDefaultStore() {
    const currentStore = this.settingsService.getCurrentDefaultStore();
    if (currentStore) {
      this.storeId = currentStore.id;
    }
  }

  loadStores() {
    this.initialLoading = true;
    this.pageNumber = 1;

    this.storeService
      .getStores({
        pageNumber: this.pageNumber,
        pageSize: this.pageSize,
        isActive: true,
      })
      .subscribe({
        next: (response) => {
          this.stores = response.items;
          console.log('Initial stores loaded:', this.stores);
          this.hasMoreData = response.hasNextPage;
          this.initialLoading = false;
        },
        error: (error) => {
          console.error('Error loading stores:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load stores',
          });
          this.initialLoading = false;
        },
      });
  }

  loadStats() {
    this.statsLoading = true;
    this.queueService.getQueueStatistics(this.storeId).subscribe({
      next: (res: any) => {
        this.stats = res.result || {};
        this.statsLoading = false;
      },
      error: (err) => {
        console.error('Error loading stats', err);
        this.statsLoading = false;
      },
    });
  }

  loadQueues(event: any) {
    this.loading = true;

    const request = {
      pageNumber: event.first / event.rows + 1,
      pageSize: event.rows || 10,
      sortBy: event.sortField || 'createdDate',
      sortDescending: event.sortOrder === -1,
      searchTerm: event.globalFilter || '',
      storeId: this.selectedStore?.id ?? this.storeId,
      status: this.selectedStatus,
      queueType: this.selectedQueueType,
      startDateFrom: this.dateRange?.[0]?.toISOString(),
      startDateTo: this.dateRange?.[1]?.toISOString(),
    };
    console.log('Loading queues with request:', request);
    this.queueService.getQueuesPaged(request).subscribe({
      next: (res: any) => {
        this.queues = res.result.items || [];
        console.log('Loaded queues:', this.queues);
        this.totalRecords = res.result.totalCount || 0;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading queues', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load queues',
        });
        this.loading = false;
      },
    });
  }

  onGlobalFilter(event: Event) {
    const input = event.target as HTMLInputElement;
    this.table.filterGlobal(input.value, 'contains');
  }

  clearFilters() {
    this.selectedStore = null;
    this.selectedStatus = '';
    this.selectedQueueType = '';
    this.dateRange = [];
    this.table.clear();
    this.loadQueues({ first: 0, rows: 10 });
  }

  getStatusSeverity(status: string): string {
    // The API returns Status.Name ("Completed", "Pending"), not the uppercase
    // constants this compared against - so every row fell through to the
    // default severity. Normalise before matching.
    switch ((status || '').toUpperCase()) {
      case 'ACTIVE':
      case 'PROCESSING':
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

  activateQueue(queue: any) {
    this.confirmationService.confirm({
      message: `Are you sure you want to activate this queue?`,
      header: 'Confirm Activation',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.queueService.activateQueue(queue.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Queue activated successfully',
            });
            this.loadQueues({ first: 0, rows: 10 });
          },
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.error?.message || 'Failed to activate queue',
            });
          },
        });
      },
    });
  }

  deactivateQueue(queue: any) {
    this.confirmationService.confirm({
      message: `Are you sure you want to deactivate this queue?`,
      header: 'Confirm Deactivation',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.queueService.deactivateQueue(queue.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Queue deactivated successfully',
            });
            this.loadQueues({ first: 0, rows: 10 });
          },
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.error?.message || 'Failed to deactivate queue',
            });
          },
        });
      },
    });
  }

  deleteQueue(queue: any) {
    // Was PrimeNG's ConfirmationService, but the page has no <p-confirmDialog>
    // to render it - confirm() published to nothing, so `accept` never ran and
    // delete silently did nothing. Use the Material dialog the rest of the app
    // already confirms deletes with.
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Delete Queue',
        message: `Are you sure you want to delete queue #${queue.id}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      },
      panelClass: ['rounded-lg'],
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      this.queueService.deleteQueue(queue.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Queue deleted successfully',
            });
            this.loadQueues({ first: 0, rows: 10 });
            this.loadStats();
          },
        error: (err) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message || 'Failed to delete queue',
          });
        },
      });
    });
  }

  onRowExpand(event: TableRowExpandEvent) {
    console.log('Expanded', event.data);
  }

  onRowCollapse(event: TableRowExpandEvent) {
    console.log('Collapsed', event.data);
  }

  // navigateToCreate() {
  //   this.router.navigate(['/queue/create']);

  //   // window.location.href = '#/queue/create';
  // }

  /** The create dialog reports success here so the list reflects it at once. */
  onQueueCreated() {
    this.loadQueues({ first: 0, rows: 10 });
    this.loadStats();
  }

  openCreateDialog() {
    this.createQueueRef.open();
  }

  onDialogHide() {
    this.showCreateDialog = false;
    // Refresh the queue list when dialog closes
    this.loadQueues({ first: 0, rows: 10 });
    this.loadStats();
  }

  toggleRow(queue: any) {
    console.log('Toggling row for queue:', queue);
    if (this.expandedRows[queue.id]) {
      delete this.expandedRows[queue.id];
    } else {
      this.expandedRows[queue.id] = true;
    }
  }

  expandAll() {
    this.expandedRows = {};

    this.queues.forEach((queue) => {
      this.expandedRows[queue.id] = true;
    });
  }

  collapseAll() {
    this.expandedRows = {};
  }
}
