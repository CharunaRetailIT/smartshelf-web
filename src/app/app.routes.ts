// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AuthComponent } from './pages/users/auth/auth.component';
import { UserManagementComponent } from './pages/users/user-list/user-management.component';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { UnauthorizedComponent } from './pages/unauthorized/unauthorized.component';

import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';
import { GuestGuard } from './core/guards/guest.guard';
// import { ShelfProductAssignmentComponent } from './pages/shelves/product-assign/shelf-product-assignment/shelf-product-assignment.component';
import { AilseManagementComponent } from './pages/warehouse/ailse-management/ailse-management.component';
import { CreateMessageComponent } from './pages/message/create-message/create-message.component';
import { MessageListComponent } from './pages/message/message-list/message-list.component';
// import { AisleOverviewComponent } from './pages/shelves/aisle-overview/aisle-overview.component';
// import { AssignProductPageComponent } from './pages/shelves/product-assign/assign-product-dialog/assign-product-dialog.component';
// import { ViewShelfProductsDialogComponent } from './pages/shelves/product-assign/view-shelf-products-dialog/view-shelf-products-dialog.component';
import { ProductManagementComponent } from './pages/products/product-management/product-management.component';
import { UserProfileComponent } from './pages/users/user-profile/user-profile.component';

export const routes: Routes = [
  // Redirect root to dashboard
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },

  // Auth route (only for non-authenticated users)
  {
    path: 'auth',
    component: AuthComponent,
    canActivate: [GuestGuard],
  },

  // Unauthorized access page
  {
    path: 'unauthorized',
    component: UnauthorizedComponent,
  },
  //profile
  {
    path: 'profile',
    component: UserProfileComponent,
    canActivate: [AuthGuard],
  },

  // Main application routes with authentication
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        component: DashboardComponent,
        data: { showHeader: true }, // Header will show
      },
      {
        path: 'user-management',
        component: UserManagementComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin'], showHeader: false }, // Admin only, matches the sidebar entry
      },
      // {
      //   path: 'shelf-management',
      //   component: ShelfManagementComponent,
      //   canActivate: [RoleGuard],
      //   data: { role: ['Operator','Viewer'], showHeader: false } // Operator and above can access (Operator, Manager, Admin)
      // },
      // {
      //   path: 'aisle-overview',
      //   component: AisleOverviewComponent,
      //   canActivate: [RoleGuard],
      //   data: { role: ['Operator','Viewer','Admin'], showHeader: false } // Operator and above can access (Operator, Manager, Admin)
      // },
      {
        path: 'aisle-management',
        component: AilseManagementComponent,
        canActivate: [RoleGuard],
        data: {
          roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
          showHeader: false,
        }, // All roles; write actions are gated inside the page
      },
      // {
      //   path: 'product-assignment',
      //   component: ShelfProductAssignmentComponent,
      //   canActivate: [RoleGuard],
      //   data: { role: ['Operator','Viewer'], showHeader: false } // Operator and above can access (Operator, Manager, Admin)
      // },
      {
        path: 'create-message',
        component: CreateMessageComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Manager', 'Operator'], showHeader: false }, // Viewer is read-only, no message authoring
      },
      {
        path: 'message-list',
        component: MessageListComponent,
        canActivate: [RoleGuard],
        data: {
          roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
          showHeader: false,
        }, // All roles; edit/delete are gated inside the page
      },
      // {
      //   path: 'queue-management',
      //   component: QueueManagementComponent,
      //   canActivate: [RoleGuard],
      //   data: { role: ['Operator', 'Viewer'], showHeader: false } // Operator and above can access (Operator, Manager, Admin)
      // },
      {
        path: 'minew',
        loadChildren: () =>
          import('./pages/minew-integrate/minew.module').then(
            (m) => m.MinewModule,
          ),
        canActivate: [RoleGuard],
        data: {
          roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
          showHeader: false,
        },
      },
      {
        path: 'product-assignment/:id',
        loadComponent: () =>
          import('./pages/products/product-assignment/product-assignment.component').then(
            (m) => m.ProductAssignmentComponent,
          ),
        canActivate: [RoleGuard],
        data: {
          roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
          showHeader: false,
        }, // Viewer lands in read-only 'view' mode inside the component
      },
      //   {
      //     path: 'assign-products/:type/:id',
      //     component: AssignProductPageComponent ,
      //     canActivate: [RoleGuard],
      //     data: { role: ['Operator','Viewer'], showHeader: false } // Operator and above can access (Operator, Manager, Admin)
      //   },
      //   {
      //     path: 'view-products/:type/:id',
      //     component: ViewShelfProductsDialogComponent,
      //     canActivate: [RoleGuard],
      //     data: { role: ['Operator','Viewer'], showHeader: false }
      // },
      {
        path: 'product-management',
        component: ProductManagementComponent,
        canActivate: [RoleGuard],
        data: {
          roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
          showHeader: false,
        }, // All roles; write actions are gated inside the page
      },
      // The product modal is retired in favour of the full-page product form.
      // These two redirects keep any existing links/bookmarks working.
      {
        path: 'product-management/new',
        redirectTo: 'products/create',
        pathMatch: 'full',
      },
      {
        path: 'product-management/edit/:id',
        redirectTo: 'products/edit/:id',
        pathMatch: 'full',
      },

      {
        path: 'products/create',
        loadComponent: () =>
          import('./pages/products/product-form-page/product-form-page.component').then(
            (m) => m.ProductFormPageComponent,
          ),
        canActivate: [RoleGuard],
        data: {
          mode: 'create',
          roles: ['Admin', 'Manager', 'Operator'], // Viewer cannot create products
          showHeader: false,
          fullScreen: true,
        },
      },
      {
        path: 'products/edit/:id',
        loadComponent: () =>
          import('./pages/products/product-form-page/product-form-page.component').then(
            (m) => m.ProductFormPageComponent,
          ),
        canActivate: [RoleGuard],
        data: {
          mode: 'edit',
          roles: ['Viewer', 'Admin', 'Manager', 'Operator'], // Viewer opens it read-only
          showHeader: false,
          fullScreen: true,
        },
      },
      {
        path: 'device-templates-management',
        loadComponent: () =>
          import('./pages/devices/device-template-management/device-template-management.component').then(
            (m) => m.DeviceTemplateManagementComponent,
          ),
        canActivate: [RoleGuard],
        data: {
          roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
          showHeader: false,
        },
      },
      {
        path: 'device-management',
        loadComponent: () =>
          import('./pages/devices/device-management/device-management.component').then(
            (m) => m.DeviceManagementComponent,
          ),
        canActivate: [RoleGuard],
        data: {
          roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
          showHeader: false,
        },
      },
      {
        path: 'store-management',
        loadComponent: () =>
          import('./pages/store/store-management/store-management.component').then(
            (m) => m.StoreManagementComponent,
          ),
        canActivate: [RoleGuard],
        data: {
          roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
          showHeader: false,
        },
      },
      {
        path: 'queue',
        loadChildren: () =>
          import('./pages/queue/queue.module/queue.module').then(
            (m) => m.QueueModule,
          ),
        canActivate: [RoleGuard],
        data: {
          roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
          showHeader: false,
        },
      },
    ],
  },

  // Wildcard route
  {
    path: '**',
    redirectTo: '/dashboard',
  },
];
