import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/services/auth.service';
import { SettingsService } from '../../../core/services/settings.service';
import { Observable } from 'rxjs';
import { User } from '../../../core/interfaces/auth.interface';
import { Store } from '../../../core/interfaces/store.interface';

interface SidebarItem {
  routeLink: string;
  icon: string;
  label: string;
  roles: string[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatTooltipModule,
    MatButtonModule,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  isLeftSidebarCollapsed = input.required<boolean>();
  changeIsLeftSidebarCollapsed = output<boolean>();

  items: SidebarItem[] = [];

  currentUser$!: Observable<User | null>;
  /** Store the app is scoped to, shown under the brand name. */
  defaultStore$!: Observable<Store | null>;

  constructor(
    public auth: AuthService,
    private settingsService: SettingsService,
  ) {}

  ngOnInit() {
    this.currentUser$ = this.auth.currentUser$;
    this.defaultStore$ = this.settingsService.getDefaultStore();
    const allItems: SidebarItem[] = [
      {
        routeLink: 'dashboard',
        icon: 'pi pi-home',
        label: 'Dashboard',
        roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
      },
      {
        routeLink: 'user-management',
        icon: 'pi pi-users',
        label: 'User Management',
        roles: ['Admin'],
      },
      {
        routeLink: 'aisle-management',
        icon: 'pi pi-warehouse',
        label: 'Warehouse Management',
        roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
      },
      {
        routeLink: 'product-management',
        icon: 'pi pi-shopping-cart',
        label: 'Product Management',
        roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
      },
      {
        routeLink: 'create-message',
        icon: 'pi pi-comment',
        label: 'Create Message',
        roles: ['Admin', 'Manager', 'Operator'],
      },
      {
        routeLink: 'message-list',
        icon: 'pi pi-inbox',
        label: 'Message List',
        roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
      },
      {
        routeLink: 'device-management',
        icon: 'pi pi-server',
        label: 'Device Management',
        roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
      },
      {
        routeLink: 'queue',
        icon: 'pi pi-list',
        label: 'Queue Management',
        roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
      },
      {
        routeLink: 'store-management',
        icon: 'pi pi-building',
        label: 'Store Management',
        roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
      },
      {
        routeLink: 'settings',
        icon: 'pi pi-cog',
        label: 'Settings',
        roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
      },
    ];
    this.items = allItems.filter((item) => this.auth.hasAnyRole(item.roles));
  }

  toggleCollapse(): void {
    this.changeIsLeftSidebarCollapsed.emit(!this.isLeftSidebarCollapsed());
  }

  closeSidenav(): void {
    this.changeIsLeftSidebarCollapsed.emit(true);
  }
}
