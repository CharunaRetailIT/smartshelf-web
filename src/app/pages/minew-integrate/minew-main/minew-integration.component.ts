import { Component, Renderer2 } from '@angular/core';
import { MinewStore } from '../../../core/interfaces/minew.interface';
import { MinewService } from '../../../core/services/minew.service';
import { MinewLoginComponent } from '../minew-login/minew-login.component';
import { MinewStoresComponent } from '../minew-stores/minew-stores.component';
import { MinewProductsComponent } from '../minew-products/minew-products.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-minew-integration',
  imports: [CommonModule,MinewLoginComponent,MinewStoresComponent,MinewProductsComponent],
  templateUrl: './minew-integration.component.html',
  styleUrl: './minew-integration.component.css'
})
export class MinewIntegrationComponent {
  
selectedStore: MinewStore | null = null;
  isAuthenticated$: any;

  constructor(private minewService: MinewService, private renderer: Renderer2) {
    this.isAuthenticated$ = this.minewService.token$;
  }

  onStoreSelected(store: MinewStore) {
    this.selectedStore = store;
  }

  onLogout() {
    this.minewService.logout();
    this.selectedStore = null;
  }
}
