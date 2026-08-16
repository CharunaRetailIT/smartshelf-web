import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { MinewIntegrationComponent } from './minew-main/minew-integration.component';

const routes: Routes = [
  {
    path: '',
    component: MinewIntegrationComponent,
    data: {
      showHeader: false,
      roles: ['Viewer', 'Admin', 'Manager', 'Operator'],
    },
  },
];

@NgModule({
  imports: [CommonModule, RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MinewModule {}
