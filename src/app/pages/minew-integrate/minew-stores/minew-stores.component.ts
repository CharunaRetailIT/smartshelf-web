import { Component, EventEmitter, Output } from '@angular/core';
import { MinewStore } from '../../../core/interfaces/minew.interface';
import { MinewService } from '../../../core/services/minew.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-minew-stores',
  standalone: true,
  imports: [CommonModule, FormsModule, MatProgressSpinnerModule],
  templateUrl: './minew-stores.component.html',
  styleUrl: './minew-stores.component.css',
})
export class MinewStoresComponent {
  @Output() storeSelected = new EventEmitter<MinewStore>();
  @Output() logout = new EventEmitter<void>();
  stores: MinewStore[] = [];
  newStore: Partial<MinewStore> = { storeName: '', address: '', active: 1 };
  isLoading = false;
  errorMessage: string | null = null;

  constructor(private minewService: MinewService) {
    this.loadStores();
  }

  loadStores() {
    this.isLoading = true;
    this.minewService.getStores().subscribe({
      next: (stores) => {
        this.stores = stores;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load stores';
        this.isLoading = false;
      },
    });
  }
  addStore() {
    this.minewService.addStore(this.newStore).subscribe({
      next: () => {
        this.loadStores();
        this.newStore = { storeName: '', address: '', active: 1 };
      },
      error: () => (this.errorMessage = 'Failed to add store'),
    });
  }

  toggleStore(store: MinewStore) {
    this.minewService
      .openOrCloseStore(store.storeId, store.active ? 0 : 1)
      .subscribe({
        next: () => this.loadStores(),
        error: () => (this.errorMessage = 'Failed to update store status'),
      });
  }

  selectStore(store: MinewStore) {
    this.storeSelected.emit(store);
  }

  onLogout() {
    this.logout.emit();
  }
}
