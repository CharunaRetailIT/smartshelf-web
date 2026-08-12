// components/settings/settings.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DeviceService } from '../../core/services/device.service';
import { SettingsService } from '../../core/services/settings.service';

// PrimeNG Imports
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { StoreService } from '../../core/services/store.service';
import { Store } from '../../core/interfaces/store.interface';
import { ImportsModule } from '../../imports/imports';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ImportsModule

  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  stores: Store[] = [];
  selectedStore: Store | null = null;
  currentDefaultStore: Store | null = null;
  initialLoading = false;

  // Pagination for lazy loading
  private pageNumber = 1;
  private pageSize = 20;
  private hasMoreData = true;
  private isLoadingMore = false;

  //Current User
  currentUserId: number = 0;

  constructor(
    private deviceService: DeviceService,
    private storeService: StoreService,
    private settingsService: SettingsService,
    public auth: AuthService,
    private router: Router,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.getCurrentUser();
    this.loadCurrentDefaultStore();
    this.loadInitialStores();
  }
  getCurrentUser() {
    const user = this.auth.getCurrentUserValue();
    if (!user) {
      console.log("User not authenticated");
      return;
    }
    this.currentUserId = user.id;
  }

  loadInitialStores(): void {
    this.initialLoading = true;
    this.pageNumber = 1;

    this.storeService.getStores({
      pageNumber: this.pageNumber,
      pageSize: this.pageSize,
      isActive: true
    }).subscribe({
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
          detail: 'Failed to load stores'
        });
        this.initialLoading = false;
      }
    });
  }

  onLazyLoad(event: any): void {
    // Check if we need to load more data based on scroll position
    if (!this.hasMoreData || this.isLoadingMore) {
      return;
    }

    this.isLoadingMore = true;
    this.pageNumber++;

    this.storeService.getStores({
      pageNumber: this.pageNumber,
      pageSize: this.pageSize,
      isActive: true,
      searchTerm: event.filter || undefined
    }).subscribe({
      next: (response) => {
        this.stores = [...this.stores, ...response.items];
        this.hasMoreData = response.hasNextPage;
        this.isLoadingMore = false;
      },
      error: (error) => {
        console.error('Error loading more stores:', error);
        this.isLoadingMore = false;
        this.pageNumber--; // Revert page number on error
      }
    });
  }

  // loadCurrentDefaultStore(): void {
  //   this.settingsService.getDefaultStore().subscribe(store => {
  //     this.currentDefaultStore = store;
  //     if (store) {
  //       // Find and set the selected store in the dropdown
  //       const matchingStore = this.stores.find(s => s.id === store.id);
  //       if (matchingStore) {
  //         this.selectedStore = matchingStore;
  //       }
  //     }
  //   });
  // }


  // onStoreChange(): void {
  //   if (this.selectedStore) {
  //     this.settingsService.setDefaultStore(this.selectedStore);
  //     this.messageService.add({
  //       severity: 'success',
  //       summary: 'Success',
  //       detail: `Default store set to: ${this.selectedStore.storeName}`
  //     });
  //     this.currentDefaultStore = this.selectedStore;
  //   }
  // }

  loadCurrentDefaultStore(): void {
    this.settingsService.getDefaultStore().subscribe(store => {
      if (store) {
        // Map the stored data to match the Store interface
        this.currentDefaultStore = this.mapToStoreInterface(store);
        console.log('Mapped current default store:', this.currentDefaultStore);
        if (this.currentDefaultStore) {
          // Find and set the selected store in the dropdown
          const matchingStore = this.stores.find(s => s.id === this.currentDefaultStore?.id);
          if (matchingStore) {
            this.selectedStore = matchingStore;
          }
        }
      } else {
        this.currentDefaultStore = null;
      }
    });
  }

  private mapToStoreInterface(storedData: any): Store | null {
    try {
      // If the data already has the correct interface, return it
      if (storedData.id) return storedData;

      // Otherwise, map the properties
      return {
        id: storedData.storeId || storedData.id,
        storeName: storedData.storeName,
        storeCode: storedData.storeCode || '',
        address: storedData.address,
        phone: storedData.phone || '',
        email: storedData.email || '',
        contactPerson: storedData.contactPerson || '',
        storeType: storedData.storeType || '',
        minewStoreId: storedData.minewStoreId,
        minewTemplateId: storedData.minewTemplateId,
        latitude: storedData.latitude,
        longitude: storedData.longitude,
        isActive: storedData.active === 1 || storedData.isActive,
        isSynced: storedData.isSynced || false,
        lastSyncDate: storedData.lastSyncDate ? new Date(storedData.lastSyncDate) : undefined,
        syncStatus: storedData.syncStatus || 'Pending',
        createdDate: storedData.createdDate ? new Date(storedData.createdDate) : new Date(),
        updatedDate: storedData.updatedDate ? new Date(storedData.updatedDate) : undefined,
        deviceCount: storedData.deviceCount || 0
      };
    } catch (error) {
      console.error('Error mapping store data:', error);
      return null;
    }
  }

  onStoreChange(): void {
    if (this.selectedStore) {
      // Make sure we're saving the complete store object
      this.settingsService.setDefaultStore(this.selectedStore);
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: `Default store set to: ${this.selectedStore.storeName}`
      });
      this.currentDefaultStore = this.selectedStore;
    }
  }

  clearDefaultStore(): void {
    this.settingsService.clearDefaultStore();
    this.selectedStore = null;
    this.currentDefaultStore = null;
    this.messageService.add({
      severity: 'info',
      summary: 'Cleared',
      detail: 'Default store has been cleared'
    });
  }

  navigateToStoreManagement(): void {
    this.router.navigate(['/store-management']);
  }
}