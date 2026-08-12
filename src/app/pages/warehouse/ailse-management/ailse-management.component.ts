import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { firstValueFrom, debounceTime, Subject, distinctUntilChanged } from 'rxjs';
import { AisleMaster } from '../../../core/interfaces/aisle.interface';
import { AisleService } from '../../../core/services/aisle.service';
import { AuthService } from '../../../core/services/auth.service';
import { DeleteConfirmationComponent } from '../../../shared/components/dialog/delete-confirmation/delete-confirmation.component';
import { CreateAisleComponent } from '../create-aisle/create-aisle.component';
import { EditAisleComponent } from '../edit-aisle/edit-aisle.component';
import { ShelfService } from '../../../core/services/shelf.service';
// import { EditShelfComponent } from '../edit-shelf/edit-shelf.component';
import { CustomSnackbarComponent, SnackbarData } from '../../../shared/components/alert/custom-snackbar.component';
import { RestoreConfirmationComponent } from '../../../shared/components/dialog/restore-confirmation/restore-confirmation.component';
import { SearchParams } from '../../../core/interfaces/pagination-result.interface';
import { ProductAssignmentComponent } from '../../products/product-assignment/product-assignment.component';
import { Router, RouterModule } from '@angular/router';
import { ShelfModalComponent } from '../shelf-modal/shelf-modal.component';
import { Shelf } from '../../../core/interfaces/shelf.interface';
import { SettingsService } from '../../../core/services/settings.service';
import { MinewService } from '../../../core/services/minew.service';
import { CreateRackComponent } from '../create-rack/create-rack.component';
import { MessageService } from 'primeng/api';
import { ImportsModule } from '../../../imports/imports';

export interface AisleWithShelves extends AisleMaster {
  shelfCount?: number;
  shelves?: Shelf[];
  expanded?: boolean;
}

@Component({
  selector: 'app-ailse-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatExpansionModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    RouterModule,
    ImportsModule
  ],
  templateUrl: './ailse-management.component.html',
  styleUrl: './ailse-management.component.css'
})
export class AilseManagementComponent implements OnInit {
  private messageService = inject(MessageService);

  //#region Data Properties
  public aisles: AisleWithShelves[] = [];
  loading = false;
  searchValue = '';
  statusFilter = 'active';

  // Pagination properties
  currentPage: number = 1;
  pageSize: number = 10;
  totalCount: number = 0;
  totalPages: number = 0;

  // Search debounce
  private searchSubject = new Subject<string>();
  //#endregion

  //#region User & Selection
  currentUserId!: number;
  selectedAisles: Set<number> = new Set();
  selectedShelves: Set<number> = new Set();
  //#endregion

  //#region Shelf Search & Filter
  shelfSearchValue: string = '';
  shelfStatusFilter: string = 'active';
  //#endregion

  //Default stroe
  storeId: number = 0;

  //minew sync
  syncing = false;

  //#region Constructor
  constructor(
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private aisleService: AisleService,
    private shelfService: ShelfService,
    public auth: AuthService,
    private settingsService: SettingsService,
    private minewService: MinewService,
    public router: Router
  ) { }
  //#endregion

  //#region Lifecycle Hooks
  ngOnInit(): void {
    this.initCurrentUser();
    this.setDefaultStore();
    this.loadAisles();

    // Setup search debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadAisles();
    });
  }


  //#endregion

  //#region Initializations
  private initCurrentUser(): void {
    const user = this.auth.getCurrentUserValue();
    if (!user) {
      this.showError('User not authenticated');
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
  //#endregion

  //#region Data Loading with Server-side Pagination
  loadAisles(): void {
    this.loading = true;

    // Create search params without status
    const searchParams: SearchParams = {
      pageNumber: this.currentPage,
      pageSize: this.pageSize,
      searchTerm: this.searchValue
    };

    this.aisleService.getAislesWithShelves(searchParams, this.storeId).subscribe({
      next: (pagedResult) => {
        // First, ensure pagedResult and items exist
        if (!pagedResult || !pagedResult.items) {
          console.error('Invalid response structure:', pagedResult);
          this.aisles = [];
          this.totalCount = 0;
          this.totalPages = 0;
          this.loading = false;
          return;
        }

        // Ensure items is an array
        const items = Array.isArray(pagedResult.items) ? pagedResult.items : [];

        // Apply status filter client-side
        let filteredItems = items;

        if (this.statusFilter !== 'all') {
          const isActive = this.statusFilter === 'active';
          filteredItems = filteredItems.filter(aisle => aisle.isActive === isActive);
        }

        // Then map the filtered items
        this.aisles = filteredItems.map(aisle => ({
          ...aisle,
          shelfCount: aisle.shelves?.length || 0,
          expanded: false
        }));

        // Update pagination info
        // Use the original total count for pagination, not filtered count
        this.totalCount = pagedResult.totalCount || 0;
        this.totalPages = pagedResult.totalPages || Math.ceil(this.totalCount / this.pageSize);

        console.log('Aisles loaded successfully:', {
          totalAisles: this.aisles.length,
          totalCount: this.totalCount,
          totalPages: this.totalPages
        });
        this.loading = false;
      },
      error: (error: Error) => {
        console.error('Error loading aisles:', error);
        this.showError(`Error loading aisles: ${error.message}`);
        this.loading = false;

        // Reset to empty state on error
        this.aisles = [];
        this.totalCount = 0;
        this.totalPages = 0;
      }
    });
  }
  // loadAisles(): void {
  //   this.loading = true;

  //   // Create search params without status
  //   const searchParams: SearchParams = {
  //     pageNumber: this.currentPage,
  //     pageSize: this.pageSize,
  //     searchTerm: this.searchValue
  //   };

  //   this.aisleService.getAislesWithShelves(searchParams).subscribe({
  //     next: (pagedResult) => {
  //       // First, apply status filter client-side
  //       let filteredItems = pagedResult.items;

  //       if (this.statusFilter !== 'all') {
  //         const isActive = this.statusFilter === 'active';
  //         filteredItems = filteredItems.filter(aisle => aisle.isActive === isActive);
  //       }

  //       // Then map the filtered items
  //       this.aisles = filteredItems.map(aisle => ({
  //         ...aisle,
  //         shelfCount: aisle.shelves?.length || 0,
  //         expanded: false
  //       }));

  //       // Update pagination info based on filtered items
  //       this.totalCount = filteredItems.length; // Note: this is filtered count, not total
  //       this.totalPages = Math.ceil(filteredItems.length / this.pageSize);

  //       console.log('Aisles loaded and filtered successfully:', this.aisles);
  //       this.loading = false;
  //     },
  //     error: (error: Error) => {
  //       console.error('Error loading aisles:', error);
  //       this.showError(`Error loading aisles: ${error.message}`);
  //       this.loading = false;

  //       // Reset to empty state on error
  //       this.aisles = [];
  //       this.totalCount = 0;
  //       this.totalPages = 0;
  //     }
  //   });
  // }
  //#endregion

  //#region Selection Helpers
  get hasSelection(): boolean {
    return this.selectedAisles.size > 0 || this.selectedShelves.size > 0;
  }

  get selectionCount(): number {
    return this.selectedAisles.size + this.selectedShelves.size;
  }
  //#endregion

  //#region Navigation

  navigateToProductAssignment(shelfId: number | undefined): void {
    if (!shelfId) {
      // Handle the undefined case - show error or return early
      console.error('Shelf ID is undefined');
      this.showError('Cannot navigate: Shelf ID is missing');
      return;
    }
    this.router.navigate(['/product-assignment', shelfId]);
  }

  //#endregion

  //#region Filtering with Debounced Search
  applyFilter(event?: Event): void {
    const filterValue = event ? (event.target as HTMLInputElement).value : this.searchValue || '';
    this.searchValue = filterValue;
    this.searchSubject.next(filterValue);
  }

  applyStatusFilter(status: string): void {
    this.statusFilter = status;
    this.currentPage = 1;
    this.loadAisles();
  }

  //#region Shelf Filtering
  filterShelves(aisle: AisleWithShelves): Shelf[] {
    let filteredShelves = aisle.shelves || [];

    // Apply search filter
    if (this.shelfSearchValue.trim()) {
      const term = this.shelfSearchValue.trim().toLowerCase();
      filteredShelves = filteredShelves.filter(shelf => {
        const searchData = [
          shelf.name?.toLowerCase() || '',
          shelf.location?.toLowerCase() || '',
          shelf.description?.toLowerCase() || '',
        ].join(' ');
        return searchData.includes(term);
      });
    }

    // Apply status filter
    if (this.shelfStatusFilter !== 'all') {
      const isActive = this.shelfStatusFilter === 'active';
      filteredShelves = filteredShelves.filter(shelf => shelf.isActive === isActive);
    }

    return filteredShelves;
  }

  applyShelfSearch(event?: Event): void {
    const filterValue = event ? (event.target as HTMLInputElement).value : this.shelfSearchValue || '';
    this.shelfSearchValue = filterValue;
  }

  applyShelfStatusFilter(status: string): void {
    this.shelfStatusFilter = status;
  }

  clearShelfFilters(): void {
    this.shelfSearchValue = '';
    this.shelfStatusFilter = 'all';
  }

  getFilteredShelfCount(aisle: AisleWithShelves): number {
    return this.filterShelves(aisle).length;
  }
  //#endregion

  //#region Pagination Methods
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadAisles();
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadAisles();
    }
  }

  goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadAisles();
    }
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 1;
    this.loadAisles();
  }

  getDisplayStart(): number {
    return Math.min((this.currentPage - 1) * this.pageSize + 1, this.totalCount);
  }

  getDisplayEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalCount);
  }

  getTotalShelves(): number {
    return this.aisles.reduce((total, aisle) => total + (aisle.shelfCount || 0), 0);
  }
  //#endregion

  //#region CRUD Operations
  async bulkDelete(): Promise<void> {
    const aisleIds = Array.from(this.selectedAisles);
    const shelfIds = Array.from(this.selectedShelves);

    if (aisleIds.length === 0 && shelfIds.length === 0) return;

    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Delete Items',
        message: `Are you sure you want to delete ${aisleIds.length + shelfIds.length} items?`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      },
      panelClass: ['rounded-lg'],
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result === true) {
        this.loading = true;

        try {
          if (shelfIds.length > 0) {
            await firstValueFrom(this.shelfService.bulkDeleteShelves(shelfIds));
          }
          if (aisleIds.length > 0) {
            await firstValueFrom(this.aisleService.bulkDeleteAisles(aisleIds));
          }

          this.selectedAisles.clear();
          this.selectedShelves.clear();
          await this.loadAisles();
          this.showSuccess('Items deleted successfully');
        } catch (error: any) {
          console.error('Error in bulk delete:', error);
          this.showError(`Failed to delete items: ${error.message}`);
        } finally {
          this.loading = false;
        }
      }
    });
  }

  deleteAisle(aisle: AisleWithShelves): void {
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Delete Aisle',
        message: `Are you sure you want to delete "${aisle.name}"?`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      },
      panelClass: ['rounded-lg'],
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result === true) {
        try {
          await firstValueFrom(this.aisleService.deleteAisle(aisle.id!, this.currentUserId));
          this.showSuccess('Aisle deleted successfully');
          this.loadAisles();
        } catch (error: any) {
          console.error(error);
          this.showError(`Failed to delete Aisle: ${error.message}`);
        }
      }
    });
  }

  deleteShelf(shelf?: Shelf): void {
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Delete Shelf',
        message: `Are you sure you want to delete "${shelf?.name}"?`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      },
      panelClass: ['rounded-lg'],
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result === true && shelf) {
        try {
          await firstValueFrom(this.shelfService.deleteShelf(shelf.id!, this.currentUserId, this.storeId));
          this.showSuccess('Shelf deleted successfully');
          this.loadAisles();
        } catch (error: any) {
          console.error(error);
          this.showError(`Failed to delete Shelf: ${error.message}`);
        }
      }
    });
  }

  editAisle(aisle: AisleWithShelves): void {
    const dialogRef = this.dialog.open(EditAisleComponent, {
      width: '90vw',
      maxWidth: '600px',
      height: 'auto',
      maxHeight: '90vh',
      panelClass: 'custom-dialog-container',
      disableClose: true,
      data: { aisle, currentUserId: this.auth.getCurrentUserValue()?.id }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadAisles();
      }
    });
  }

  openShelfModal(mode: 'create' | 'edit', shelfData?: any, aisleId?: number): void {
    const dialogRef = this.dialog.open(ShelfModalComponent, {
      width: 'auto',
      height: 'auto',
      maxWidth: '1200px',
      data: mode === 'edit' ? { shelf: shelfData } : { aisleID: aisleId }
    });
    console.log("open with", mode, shelfData)
    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        // Handle success
        // this.loadShelves(); // Reload shelf list
        this.loadAisles();
      }
    });
  }

  async editShelf(shelf: Shelf): Promise<void> {
    // console.log('Opening edit dialog for shelf:', shelf);

    // try {
    //   // Load shelf with assignments before opening dialog
    //   const shelfWithAssignments = await firstValueFrom(
    //     this.shelfService.getShelfWithAssignments(shelf.id!)
    //   );

    //   console.log('Shelf with assignments loaded:', shelfWithAssignments);

    //   const dialogRef = this.dialog.open(EditShelfComponent, {
    //     width: '90vw',
    //     maxWidth: '600px',
    //     height: 'auto',
    //     maxHeight: '90vh',
    //     panelClass: 'custom-dialog-container',
    //     disableClose: true,
    //     data: { 
    //       shelf: shelfWithAssignments,
    //       currentUserId: this.auth.getCurrentUserValue()?.id 
    //     }
    //   });

    //   dialogRef.afterClosed().subscribe(result => {
    //     if (result) {
    //       this.showSuccess('Shelf updated successfully!');
    //       this.loadAisles();
    //     }
    //   });

    // } catch (error) {
    //   console.error('Error loading shelf with assignments:', error);
    //   // Fallback to original shelf data if API fails
    //   this.showWarning('Could not load device assignments. Showing basic shelf info.');

    //   const dialogRef = this.dialog.open(EditShelfComponent, {
    //     width: '90vw',
    //     maxWidth: '600px',
    //     height: 'auto',
    //     maxHeight: '90vh',
    //     panelClass: 'custom-dialog-container',
    //     disableClose: true,
    //     data: { 
    //       shelf,
    //       currentUserId: this.auth.getCurrentUserValue()?.id 
    //     }
    //   });

    //   dialogRef.afterClosed().subscribe(result => {
    //     if (result) {
    //       this.showSuccess('Shelf updated successfully!');
    //       this.loadAisles();
    //     }
    //   });
    // }
  }

  // In your component
  openCreateRackModal(): void {
    const dialogRef = this.dialog.open(CreateRackComponent, {
      width: '900px',
      maxHeight: '90vh'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        console.log('Rack created:', result.data);
        // Refresh
        this.loadAisles();
      }
    });
  }

  openAddAisleDialog(): void {
    const isCollapsed = document.querySelector('.sidenav')?.classList.contains('sidenav-collapsed');
    const sidebarWidthRem = isCollapsed ? 5 : 16.5625;
    const remInPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const sidebarWidth = sidebarWidthRem * remInPx;
    const dialogWidth = 1000;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const left = sidebarWidth + (viewportWidth - sidebarWidth - dialogWidth) / 2;
    const top = (viewportHeight - 800) / 2;

    const dialogRef = this.dialog.open(CreateAisleComponent, {
      width: `${dialogWidth}px`,
      height: '90vh',
      maxHeight: '800px',
      panelClass: 'custom-dialog-container',
      position: {
        left: `${left}px`,
        top: `${Math.max(top, 50)}px`
      },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.showSuccess('Aisle created successfully!');
        this.loadAisles();
      }
    });
  }

  toggleExpansion(element: AisleWithShelves): void {
    element.expanded = !element.expanded;
  }

  exportData(): void {
    this.snackBar.open('Export functionality to be implemented', 'Close', { duration: 2000 });
  }

  importData(): void {
    this.snackBar.open('Import functionality to be implemented', 'Close', { duration: 2000 });
  }

  // addShelf(aisle: AisleWithShelves): void {
  //   const dialogRef = this.dialog.open(CreateShelfComponent, {
  //     maxWidth: '1000px',
  //     height: 'auto',
  //     maxHeight: '90vh',
  //     panelClass: 'custom-dialog-container',
  //     disableClose: true,
  //     data: { aisleID: aisle.id }  
  //   });

  //   dialogRef.afterClosed().subscribe(result => {
  //     if (result) {
  //       this.showSuccess('Shelf created successfully!');
  //       this.loadAisles();
  //     }
  //   });
  // }

  restoreAisle(aisle: AisleWithShelves): void {
    const dialogRef = this.dialog.open(RestoreConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Restore Aisle',
        message: `Are you sure you want to restore "${aisle.name}"?`,
        confirmText: 'Restore',
        cancelText: 'Cancel'
      },
      panelClass: ['rounded-lg'],
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result === true) {
        try {
          await firstValueFrom(this.aisleService.restoreAisle(aisle.id!, this.currentUserId));
          this.showSuccess('Aisle restored successfully');
          this.loadAisles();
        } catch (error: any) {
          console.error(error);
          this.showError(`Failed to restore Aisle: ${error.message}`);
        }
      }
    });
  }

  restoreShelf(shelf: Shelf): void {
    const dialogRef = this.dialog.open(RestoreConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Restore Shelf',
        message: `Are you sure you want to restore "${shelf.name}"?`,
        confirmText: 'Restore',
        cancelText: 'Cancel'
      },
      panelClass: ['rounded-lg'],
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result === true) {
        try {
          await firstValueFrom(this.shelfService.restoreShelf(shelf.id!, this.currentUserId, this.storeId));
          this.showSuccess('Shelf restored successfully');
          this.loadAisles();
        } catch (error: any) {
          console.error(error);
          this.showError(`Failed to restore Shelf: ${error.message}`);
        }
      }
    });
  }

  toggleAisleSelection(aisleId: number): void {
    if (this.selectedAisles.has(aisleId)) {
      this.selectedAisles.delete(aisleId);
    } else {
      this.selectedAisles.add(aisleId);
    }
  }

  // Also add this for shelf selection if needed
  toggleShelfSelection(shelfId: number): void {
    if (this.selectedShelves.has(shelfId)) {
      this.selectedShelves.delete(shelfId);
    } else {
      this.selectedShelves.add(shelfId);
    }
  }

  //open product assignment dialog
  openProductAssignment(shelf: Shelf): void {
    const dialogRef = this.dialog.open(ProductAssignmentComponent, {
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      maxHeight: '900px',
      panelClass: 'custom-dialog-container',
      disableClose: true,
      data: {
        shelf: shelf,
        currentUserId: this.auth.getCurrentUserValue()?.id
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.showSuccess('Product assignments updated successfully!');
        // Optionally reload the shelf data to show updated product count
        this.loadAisles();
      }
    });
  }

  syncToCloud(): void {
    this.loading = true;
    this.syncing = true;
    this.minewService.syncShelfs(this.storeId).subscribe({
      next: (res) => {
        this.loading = false;
        this.syncing = false;
        this.showSuccess(res?.message ?? 'Shelfs synced successfully');
      },
      error: (err) => {
        const errorMessage = err?.error?.message ?? 'Failed to sync to cloud';
        console.log(errorMessage);
        this.showError(errorMessage);
        this.loading = false;
        this.syncing = false;
      }
    });
  }
  //#endregion

  //#region Snackbar Methods
  private showSuccess(message: string): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: message,
      life: 5000
    });
  }

  private showError(message: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000
    });
  }

  private showWarning(message: string): void {
    this.messageService.add({
      severity: 'warn',
      summary: 'Warning',
      detail: message,
      life: 5000
    });
  }

  private showInfo(message: string): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Info',
      detail: message,
      life: 5000
    });
  }
  // private showSuccess(message: string): void {
  //   this.openSnackbar({
  //     message: message,
  //     icon: 'fa-check-circle',
  //     type: 'success'
  //   });
  // }

  // private showError(message: string): void {
  //   this.openSnackbar({
  //     message: message,
  //     icon: 'fas fa-times-circle',
  //     type: 'error'
  //   });
  // }

  // private showWarning(message: string): void {
  //   this.openSnackbar({
  //     message: message,
  //     icon: 'fas fa-exclamation-triangle',
  //     type: 'warning'
  //   });
  // }

  // private openSnackbar(data: SnackbarData): void {
  //   this.snackBar.openFromComponent(CustomSnackbarComponent, {
  //     data: data,
  //     duration: 5000,
  //     horizontalPosition: 'end',
  //     verticalPosition: 'top',
  //     panelClass: [`${data.type}-snackbar`]
  //   });
  // }
  //#endregion
}