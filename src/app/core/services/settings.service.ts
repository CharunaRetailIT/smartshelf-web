// services/settings.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Store } from '../interfaces/store.interface';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private defaultStoreKey = 'defaultStore';
  private defaultStoreSubject = new BehaviorSubject<Store | null>(null);

  constructor() {
    // Load saved store from localStorage on service initialization
    this.loadDefaultStore();
  }

  /**
   * Get observable for default store changes
   */
  getDefaultStore(): Observable<Store | null> {
    return this.defaultStoreSubject.asObservable();
  }

  /**
   * Get current default store value
   */
  getCurrentDefaultStore(): Store | null {
    return this.defaultStoreSubject.value;
  }

  /**
   * Set default store
   */
  setDefaultStore(store: Store): void {
    // Save to localStorage
    localStorage.setItem(this.defaultStoreKey, JSON.stringify(store));
    
    // Update BehaviorSubject
    this.defaultStoreSubject.next(store);
  }

  /**
   * Clear default store
   */
  clearDefaultStore(): void {
    localStorage.removeItem(this.defaultStoreKey);
    this.defaultStoreSubject.next(null);
  }

  /**
   * Load default store from localStorage
   */
  private loadDefaultStore(): void {
    const savedStore = localStorage.getItem(this.defaultStoreKey);
    if (savedStore) {
      try {
        const store = JSON.parse(savedStore);
        this.defaultStoreSubject.next(store);
      } catch (error) {
        console.error('Error parsing saved store:', error);
        this.clearDefaultStore();
      }
    }
  }
}