// device-selection-modal.component.ts
import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { DeviceService } from '../../../core/services/device.service';
import {
  DeviceSelectionModalData,
  ComboCreationResult,
} from '../../../core/interfaces/combo-create.models';

@Component({
  selector: 'app-device-selection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  template: `
    <div class="modal-header">
      <h5 class="modal-title">Select Device for Template</h5>
      <button type="button" class="btn-close" (click)="close()"></button>
    </div>
    <div class="modal-body">
      <div class="template-info mb-3" *ngIf="data.selectedTemplate">
        <h6>Template Information:</h6>
        <p><strong>Name:</strong> {{ data.selectedTemplate.name }}</p>
        <p>
          <strong>Screen Size:</strong> {{ data.selectedTemplate.screenSize }}
        </p>
      </div>

      <div class="mb-3">
        <input
          type="text"
          class="form-control"
          placeholder="Search devices..."
          [(ngModel)]="searchTerm"
          (input)="filterDevices()"
        />
      </div>

      <div class="device-list" style="max-height: 400px; overflow-y: auto;">
        <div class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr>
                <th></th>
                <th>Device Name</th>
                <th>MAC Address</th>
                <th>Screen Size</th>
                <th>Status</th>
                <th>Battery</th>
              </tr>
            </thead>
            <tbody>
              <tr
                *ngFor="let device of filteredDevices"
                (click)="selectDevice(device)"
                [class.table-primary]="selectedDevice?.id === device.id"
              >
                <td>
                  <input
                    type="radio"
                    name="deviceRadio"
                    [checked]="selectedDevice?.id === device.id"
                  />
                </td>
                <td>{{ device.deviceName || 'Unnamed Device' }}</td>
                <td>{{ device.mac }}</td>
                <td>{{ device.screenSize }}</td>
                <td>
                  <span [class]="getStatusClass(device.status)">
                    {{ device.status }}
                  </span>
                </td>
                <td>
                  <span [class]="getBatteryClass(device.battery)">
                    {{ device.battery }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div *ngIf="filteredDevices.length === 0" class="text-center py-4">
          <p>No devices found. Please sync devices from cloud first.</p>
        </div>
      </div>

      <div class="mt-3" *ngIf="loading">
        <div class="spinner-border spinner-border-sm" role="status"></div>
        Loading devices...
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" (click)="close()">
        Cancel
      </button>
      <button
        type="button"
        class="btn btn-primary"
        (click)="createCombo()"
        [disabled]="!selectedDevice || creatingCombo"
      >
        <span
          *ngIf="creatingCombo"
          class="spinner-border spinner-border-sm me-2"
        ></span>
        {{ creatingCombo ? 'Creating...' : 'Create Combo' }}
      </button>
    </div>
  `,
  styles: [
    `
      .device-list tr {
        cursor: pointer;
      }
      .badge-online {
        background-color: #28a745;
      }
      .badge-offline {
        background-color: #dc3545;
      }
      .battery-high {
        color: #28a745;
      }
      .battery-medium {
        color: #ffc107;
      }
      .battery-low {
        color: #dc3545;
      }
    `,
  ],
})
export class DeviceSelectionModalComponent implements OnInit {
  devices: any[] = [];
  filteredDevices: any[] = [];
  selectedDevice: any = null;
  searchTerm: string = '';
  loading: boolean = false;
  creatingCombo: boolean = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DeviceSelectionModalData,
    private dialogRef: MatDialogRef<DeviceSelectionModalComponent>,
    private deviceService: DeviceService,
  ) {}

  ngOnInit() {
    this.loadDevices();
  }

  loadDevices() {
    this.loading = true;
    if (this.data.storeId) {
      this.deviceService.syncDevicesFromCloud(this.data.storeId).subscribe({
        next: (devices) => {
          this.devices = devices;
          this.filteredDevices = devices;
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load devices:', error);
          this.loading = false;
        },
      });
    }
  }

  filterDevices() {
    if (!this.searchTerm.trim()) {
      this.filteredDevices = [...this.devices];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredDevices = this.devices.filter(
      (device) =>
        device.deviceName?.toLowerCase().includes(term) ||
        device.mac?.toLowerCase().includes(term) ||
        device.screenSize?.toLowerCase().includes(term),
    );
  }

  selectDevice(device: any) {
    this.selectedDevice = device;
  }

  createCombo() {
    if (!this.selectedDevice || !this.data.selectedTemplate) {
      return;
    }

    this.creatingCombo = true;
    this.deviceService
      .createDeviceTemplateCombo(
        this.selectedDevice.id,
        this.data.selectedTemplate.id,
      )
      .subscribe({
        next: (combo) => {
          const result: ComboCreationResult = {
            success: true,
            combo: combo,
          };
          this.dialogRef.close(result);
        },
        error: (error) => {
          const result: ComboCreationResult = {
            success: false,
            error: error.message,
          };
          this.dialogRef.close(result);
          this.creatingCombo = false;
        },
      });
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'online':
        return 'badge badge-online';
      case 'offline':
        return 'badge badge-offline';
      default:
        return 'badge badge-secondary';
    }
  }

  getBatteryClass(battery: number): string {
    if (battery > 70) return 'battery-high';
    if (battery > 30) return 'battery-medium';
    return 'battery-low';
  }

  close() {
    this.dialogRef.close({ success: false });
  }
}
