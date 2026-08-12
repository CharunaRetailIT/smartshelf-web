import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';

import { DeviceService } from '../../../core/services/device.service';
import { SettingsService } from '../../../core/services/settings.service';
import { MinewStore } from '../../../core/interfaces/minew.interface';
import {
  ImportPreview,
  BatchAddResult,
  EnhancedBatchAddResult,
  BatchWakeDevicesRequest,
  DelayedSyncRequest
} from '../../../core/interfaces/device.interface';
import { ImportsModule } from '../../../imports/imports';
import { FileSizePipe } from '../../../pipes/file-size.pipe';

@Component({
  selector: 'app-minew-batch-add',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ImportsModule,
    FileSizePipe,
  ],
  templateUrl: './minew-batch-add.component.html',
  styleUrls: ['./minew-batch-add.component.css']
})
export class MinewBatchAddComponent implements OnInit {
  @Output() devicesAdded = new EventEmitter<number>(); // Emit count of devices added

  displayDialog = false;
  activeTabIndex = 0;

  // Store selection
  stores: MinewStore[] = [];
  selectedStore: string = '';

  // Manual input
  macAddressesInput: string = '';

  // File upload
  uploadedFile: File | null = null;
  filePreview: string[] = [];

  // Preview data
  importPreview: ImportPreview | null = null;
  previewData: { macAddress: string, isValid: boolean, message: string }[] = [];

  // Processing
  isProcessing = false;
  isWakingUp = false;
  isSyncing = false;
  importResult: EnhancedBatchAddResult | null = null;

  // Results
  results: { macAddress: string, success: boolean, message: string, status: string }[] = [];

  // Sync options
  syncAfterAdd = true;
  deviceType = 1; // 1 for tag, 5 for warning light
  wakeDelaySeconds = 30; // Default 30 seconds delay for wake up

  // Default store info
  localStoreId: number = 0;
  localStoreName: string = '';

  // Process steps
  currentStep: 'preview' | 'adding' | 'waking' | 'syncing' | 'complete' = 'preview';
  stepProgress = 0;

  constructor(
    private deviceService: DeviceService,
    private settingsService: SettingsService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.loadStores();
    this.loadDefaultStore();
  }

  loadStores(): void {
    this.deviceService.getActiveStores().subscribe({
      next: (stores) => {
        this.stores = stores;
        if (stores.length > 0) {
          this.selectedStore = stores[0].storeId;
        }
      },
      error: (error) => {
        this.showError('Failed to load stores');
      }
    });
  }

  loadDefaultStore(): void {
    const currentStore = this.settingsService.getCurrentDefaultStore();
    if (currentStore) {
      this.localStoreId = currentStore.id;
      this.localStoreName = currentStore.storeName;
    }
  }

  openDialog(): void {
    this.displayDialog = true;
    this.resetForm();
  }

  resetForm(): void {
    this.macAddressesInput = '';
    this.uploadedFile = null;
    this.filePreview = [];
    this.importPreview = null;
    this.previewData = [];
    this.importResult = null;
    this.results = [];
    this.activeTabIndex = 0;
    this.currentStep = 'preview';
    this.stepProgress = 0;
  }

  // Manual input handling
  validateManualInput(): void {
    const lines = this.macAddressesInput
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    this.generatePreview(lines);
  }

  // File upload handling
  onFileSelect(event: any): void {
    const file = event.files[0];
    if (file) {
      this.uploadedFile = file;
      this.previewFile(file);
    }
  }

  previewFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const content = e.target.result;
      const lines = content
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0);

      this.filePreview = lines;
      this.generatePreview(lines);
    };

    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      // For Excel files, we'll need to handle differently
      this.messageService.add({
        severity: 'info',
        summary: 'Excel File',
        detail: 'Excel file will be processed on server'
      });
      this.generatePreview([]);
    }
  }

  generatePreview(macAddresses: string[]): void {
    const validMacs: string[] = [];
    const invalidMacs: string[] = [];
    const preview: { macAddress: string, isValid: boolean, message: string }[] = [];

    macAddresses.forEach(mac => {
      // Clean and validate MAC
      const cleanedMac = mac.replace(/[:-\s]/g, '').toLowerCase();
      const isValid = cleanedMac.length === 12 && /^[0-9a-f]{12}$/.test(cleanedMac);

      if (isValid) {
        validMacs.push(cleanedMac);
        preview.push({
          macAddress: cleanedMac,
          isValid: true,
          message: 'Valid MAC address'
        });
      } else {
        invalidMacs.push(mac);
        preview.push({
          macAddress: mac,
          isValid: false,
          message: 'Invalid MAC address format (should be 12 hex characters)'
        });
      }
    });

    this.importPreview = {
      macAddresses: macAddresses,
      totalCount: macAddresses.length,
      validCount: validMacs.length,
      invalidCount: invalidMacs.length,
      invalidMacs: invalidMacs
    };

    this.previewData = preview;
    this.currentStep = 'preview';
  }

  // Import execution
  async executeImport(): Promise<void> {
    if (!this.selectedStore) {
      this.showError('Please select a store');
      return;
    }

    let macAddresses: string[] = [];

    if (this.activeTabIndex === 0) { // Manual input
      macAddresses = this.macAddressesInput
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    } else if (this.activeTabIndex === 1 && this.uploadedFile) { // File upload
      if (this.uploadedFile.name.endsWith('.csv') || this.uploadedFile.name.endsWith('.txt')) {
        macAddresses = this.filePreview;
      } else {
        // For Excel files, we need to upload to server
        await this.uploadFileToServer();
        return;
      }
    }

    if (macAddresses.length === 0) {
      this.showError('No MAC addresses to import');
      return;
    }

    await this.processImport(macAddresses);
  }

  private async uploadFileToServer(): Promise<void> {
    if (!this.uploadedFile || !this.selectedStore) {
      return;
    }

    this.isProcessing = true;
    this.currentStep = 'adding';

    try {
      const response = await this.deviceService.uploadBatchDevicesFile(
        this.uploadedFile,
        this.selectedStore,
        this.deviceType,
        1 // User ID from auth service
      ).toPromise();

      this.isProcessing = false;

      if (response?.success && response.result) {
        this.importResult = response.result;
        this.processResults();

        if (this.syncAfterAdd) {
          await this.delayedSyncFromCloud();
        }
      } else {
        this.showError(response?.message || 'Failed to import devices');
      }
    } catch (error) {
      this.isProcessing = false;
      this.showError('Failed to upload file');
    }
  }

  private async processImport(macAddresses: string[]): Promise<void> {
    this.isProcessing = true;
    this.currentStep = 'adding';
    this.stepProgress = 25;

    try {
      const request = {
        storeId: this.selectedStore,
        macAddresses: macAddresses,
        type: this.deviceType,
        userId: 1 // Get from auth service
      };

      const response = await this.deviceService.batchAddDevicesToMinew(request).toPromise();

      if (response?.success && response.result) {
        this.importResult = response.result;
        this.processResults();

        // Update progress
        this.stepProgress = 50;
        this.currentStep = 'waking';

        // Show wake up results
        if (this.importResult.wakeUpResult) {
          const wakeMsg = this.importResult.wakeUpResult.success
            ? `Successfully woke up ${this.importResult.wakeUpResult.wokeCount} devices`
            : `Wake up failed: ${this.importResult.wakeUpResult.message}`;

          this.messageService.add({
            severity: this.importResult.wakeUpResult.success ? 'success' : 'warn',
            summary: 'Wake Up Status',
            detail: wakeMsg,
            life: 5000
          });
        }

        if (this.syncAfterAdd && this.importResult.addedCount > 0) {
          await this.delayedSyncFromCloud();
        } else {
          this.currentStep = 'complete';
          this.stepProgress = 100;
          this.isProcessing = false;
        }
      } else {
        this.isProcessing = false;
        this.showError(response?.message || 'Failed to import devices');
      }
    } catch (error) {
      this.isProcessing = false;
      this.showError('Failed to import devices');
    }
  }

  processResults(): void {
    if (!this.importResult) return;

    this.results = Object.entries(this.importResult.results || {}).map(([mac, message]) => {
      const isFailedToWake = this.importResult?.failedToWakeDevices?.includes(mac) || false;

      return {
        macAddress: mac,
        success: message.toLowerCase() === 'success',
        message: isFailedToWake ? 'Wake up failed - Set to maintenance status' : message,
        status: isFailedToWake ? 'maintenance' : (message.toLowerCase() === 'success' ? 'success' : 'failed')
      };
    });
  }

  private async delayedSyncFromCloud(): Promise<void> {
    this.currentStep = 'syncing';
    this.stepProgress = 75;
    this.isSyncing = true;

    // Show waiting message
    this.messageService.add({
      severity: 'info',
      summary: 'Waiting for Devices',
      detail: `Waiting ${this.wakeDelaySeconds} seconds for devices to wake up...`,
      life: 6000
    });

    // Wait for devices to wake up
    await new Promise(resolve => setTimeout(resolve, this.wakeDelaySeconds * 1000));

    // Perform delayed sync
    try {
      const response = await this.deviceService.delayedSyncAfterWake(
        this.selectedStore,
        this.wakeDelaySeconds
      ).toPromise();

      if (response?.success) {
        const syncedCount = response.result?.devicesSynced || 0;
        const maintenanceCleared = response.result?.maintenanceCleared || 0;

        let successMsg = `Successfully synced ${syncedCount} devices from cloud.`;
        if (maintenanceCleared > 0) {
          successMsg += ` ${maintenanceCleared} devices cleared from maintenance status.`;
        }

        this.showSuccess(successMsg);

        // Emit event to parent component
        if (syncedCount > 0) {
          this.devicesAdded.emit(syncedCount);
        }
      } else {
        this.showWarning(response?.message || 'Failed to sync devices from cloud');
      }
    } catch (error) {
      this.showError('Failed to sync devices from cloud');
    } finally {
      this.currentStep = 'complete';
      this.stepProgress = 100;
      this.isSyncing = false;
      this.isProcessing = false;
    }
  }

  // Manually wake up devices
  async wakeUpDevices(): Promise<void> {
    if (!this.importResult || !this.selectedStore) {
      return;
    }

    // Get all MAC addresses from results
    const macAddresses = this.results.map(r => r.macAddress);

    this.isWakingUp = true;

    try {
      const request: BatchWakeDevicesRequest = {
        storeId: this.selectedStore,
        macAddresses: macAddresses,
        userId: 1
      };

      const response = await this.deviceService.batchWakeDevices(request).toPromise();

      if (response?.success) {
        this.showSuccess(`Successfully woke up ${response.result?.wokeCount} devices`);

        // Update results to show maintenance status cleared
        this.results.forEach(result => {
          if (result.status === 'maintenance') {
            result.status = 'success';
            result.message = 'Woke up successfully';
          }
        });

        // Auto-sync after wake up
        setTimeout(() => {
          this.delayedSyncFromCloud();
        }, 2000);
      } else {
        this.showError(response?.message || 'Failed to wake up devices');
      }
    } catch (error) {
      this.showError('Failed to wake up devices');
    } finally {
      this.isWakingUp = false;
    }
  }

  getStatusSeverity(status: string): string {
    switch (status) {
      case 'success': return 'success';
      case 'failed': return 'danger';
      case 'maintenance': return 'warning';
      default: return 'info';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'success': return 'Success';
      case 'failed': return 'Failed';
      case 'maintenance': return 'Maintenance';
      default: return 'Unknown';
    }
  }

  getStepIcon(step: string): string {
    switch (step) {
      case 'preview': return 'pi-eye';
      case 'adding': return 'pi-plus';
      case 'waking': return 'pi-power-off';
      case 'syncing': return 'pi-cloud-download';
      case 'complete': return 'pi-check';
      default: return 'pi-info-circle';
    }
  }

  getStepClass(step: string): string {
    const stepOrder = ['preview', 'adding', 'waking', 'syncing', 'complete'];
    const currentIndex = stepOrder.indexOf(this.currentStep);
    const stepIndex = stepOrder.indexOf(step);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  }

  showSuccess(message: string): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: message,
      life: 5000
    });
  }

  showError(message: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000
    });
  }

  showWarning(message: string): void {
    this.messageService.add({
      severity: 'warn',
      summary: 'Warning',
      detail: message,
      life: 5000
    });
  }

  getSelectedStoreName(): string {
    const store = this.stores.find(s => s.storeId === this.selectedStore);
    return store?.storeName || 'Unknown Store';
  }

  hasMaintenanceDevices(): boolean {
    return this.results.some(result => result.status === 'maintenance');
  }

  getMaintenanceCount(): number {
    return this.results.filter(result => result.status === 'maintenance').length;
  }
}