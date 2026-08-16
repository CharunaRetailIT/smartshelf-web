// product-assignment.component.ts - REFACTORED FOR PRIMENG 19
import {
  Component,
  OnInit,
  inject,
  HostListener,
  ChangeDetectorRef,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

// PrimeNG Imports
import { MessageService } from 'primeng/api';

// Services
import { ProductService } from '../../../core/services/product.service';
import { ShelfService } from '../../../core/services/shelf.service';
import { DeviceService } from '../../../core/services/device.service';
import { QueueService } from '../../../core/services/queue.service';
import { CategoryService } from '../../../core/services/category.service';
import { AuthService } from '../../../core/services/auth.service';

// Interfaces
import {
  Product,
  ProductCategory,
  ProductSubCategory,
} from '../../../core/interfaces/product.interface';
import {
  AssignmentDto,
  DeviceAssignmentDto,
  UnifiedBindDataRequest,
} from '../../../core/interfaces/device.interface';
import { Message } from '../../../core/interfaces/message.interface';

// Pipes
import { FilterPipe } from './filter.pipe';
import { ImportsModule } from '../../../imports/imports';
import { DeleteConfirmationComponent } from '../../../shared/components/dialog/delete-confirmation/delete-confirmation.component';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ConfirmationDialogComponent } from '../../../shared/components/dialog/confirmation-dialog/confirmation-dialog.component';
import { Shelf } from '../../../core/interfaces/shelf.interface';
import { SettingsService } from '../../../core/services/settings.service';
import { CustomMessageService } from '../../../core/services/message.service';
interface AssignedProduct extends Product {
  assignmentId?: number;
}

interface LayoutOption {
  label: string;
  value: 'list' | 'grid';
  icon: string;
}

@Component({
  selector: 'app-product-assignment',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,

    // PrimeNG Modules
    ImportsModule,

    // Custom Pipes
    FilterPipe,
  ],
  templateUrl: './product-assignment.component.html',
  styleUrls: ['./product-assignment.component.css'],
})
export class ProductAssignmentComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private shelfService = inject(ShelfService);
  private deviceService = inject(DeviceService);
  private queueService = inject(QueueService);
  private settingsService = inject(SettingsService);
  private categoryService = inject(CategoryService);
  private snackBar = inject(MatSnackBar);
  private messageService = inject(MessageService);
  public auth = inject(AuthService);
  public msgService = inject(CustomMessageService);

  constructor(
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
  ) {}

  //#region Properties
  shelf!: Shelf;
  shelfId!: number;
  currentUserId: number = 1;
  loading = false;
  savingChanges = false;

  // View mode
  viewMode: 'assign' | 'view' = 'view';

  // Layout options
  layoutOptions: LayoutOption[] = [
    { label: 'List View', value: 'list', icon: 'pi pi-list' },
    { label: 'Grid View', value: 'grid', icon: 'pi pi-th-large' },
  ];

  selectedAssignedProductsLayout: 'list' | 'grid' = 'grid';
  selectedDevicesLayout: 'list' | 'grid' = 'grid';

  // Available products (left side) with lazy loading
  availableProducts: Product[] = [];
  filteredAvailableProducts: Product[] = [];
  displayedAvailableProducts: Product[] = [];
  availableProductsLoadCount = 20;
  availableProductsCurrentIndex = 0;

  // Assigned products (right side) with lazy loading
  assignedProducts: AssignedProduct[] = [];
  filteredAssignedProducts: AssignedProduct[] = [];
  displayedAssignedProducts: AssignedProduct[] = [];
  assignedProductsLoadCount = 20;
  assignedProductsCurrentIndex = 0;

  // Categories and subcategories
  categories: ProductCategory[] = [];
  subCategories: ProductSubCategory[] = [];
  selectedCategoryId: number | null = null;
  selectedSubCategoryId: number | null = null;

  // Search
  availableSearchTerm = '';
  assignedSearchTerm = '';

  // Selection tracking
  selectedAvailable: Set<number> = new Set();
  selectedAssigned: Set<number> = new Set();

  // Device assignments
  shelfDevices: DeviceAssignmentDto[] = [];
  productDevices: Map<number, DeviceAssignmentDto[]> = new Map();
  showDevices = false;

  // Active tab
  activeTab = 0; // 0: Shelf Products, 1: Assign Products (if assign mode), 2: Devices

  // Bind message dialog
  showBindDialog = false;
  @ViewChild('bindDialogTpl') bindDialogTpl!: TemplateRef<unknown>;
  private bindDialogRef?: MatDialogRef<unknown>;
  selectedAssignmentForBind: DeviceAssignmentDto | null = null;
  availableMessages: Message[] = [];
  selectedMessageId: number | null = null;
  bindingInProgress = false;

  // Pagination for available products
  currentAvailablePage = 1;
  currentAssignedPage = 1;
  totalAvailablePages = 1;
  totalAssignedPages = 1;
  pageSize = 10;
  isLoadingMoreAvailable = false;
  isLoadingMoreAssigned = false;
  hasMoreAvailable = true;
  hasMoreAssigned = true;

  // Bind message
  searchQuery: string = '';
  filteredMessages: any[] = [];
  loadingMessages: boolean = false;
  showActiveOnly: boolean = false;
  showUnboundOnly: boolean = false;

  // Quick binding tracking
  quickBindingDevices: Set<number> = new Set();

  //product view table
  currentPage: number = 0;
  itemsPerPage: number = 12;

  //Default store
  storeId: number = 0;
  storeName: string = '';

  //lazy laod
  // Category lazy loading properties
  categorySearchTerm: string = '';
  filteredCategories: ProductCategory[] = [];
  displayedCategories: ProductCategory[] = [];
  categoryPageSize: number = 20;
  categoryCurrentPage: number = 1;
  totalCategoryPages: number = 1;
  hasMoreCategories: boolean = true;
  isLoadingCategories: boolean = false;

  subCategorySearchTerm: string = '';
  filteredSubCategories: ProductSubCategory[] = [];
  displayedSubCategories: ProductSubCategory[] = [];
  subCategoryPageSize: number = 20;
  subCategoryCurrentPage: number = 1;
  totalSubCategoryPages: number = 1;
  hasMoreSubCategories: boolean = true;
  isLoadingSubCategories: boolean = false;

  //#endregion

  async ngOnInit(): Promise<void> {
    this.loadDefaultStore();
    this.shelfId = Number(this.route.snapshot.paramMap.get('id'));

    if (!this.shelfId) {
      this.showError('Invalid shelf ID');
      this.router.navigate(['/shelves']);
      return;
    }

    this.viewMode = this.auth.hasAnyRole(['Admin', 'Manager', 'Operator'])
      ? 'assign'
      : 'view';

    await this.loadInitialData();
  }

  //#region Layout Change Handlers
  onAssignedProductsLayoutChange(): void {
    // The layout change is handled automatically by the DataView binding
    // This method can be used for any additional logic when layout changes
  }

  onDevicesLayoutChange(): void {
    // The layout change is handled automatically by the DataView binding
    // This method can be used for any additional logic when layout changes
  }
  //#endregion

  //#region Lazy Loading Scroll Handlers (No changes needed)
  @HostListener('scroll', ['$event'])
  onScroll(event: any): void {
    const element = event.target;
    if (
      element.scrollHeight - element.scrollTop <=
      element.clientHeight + 100
    ) {
      this.loadMoreProducts(element);
    }
  }

  // onAvailableScroll(event: any): void {
  //   const element = event.target;
  //   const scrollPosition = element.scrollTop + element.clientHeight;
  //   const scrollHeight = element.scrollHeight;

  //   const shouldLoadFromAPI =
  //     scrollPosition >= scrollHeight * 0.8 &&
  //     !this.isLoadingMoreAvailable &&
  //     this.hasMoreAvailable &&
  //     (!this.selectedCategoryId || this.filteredAvailableProducts.length < 10);

  //   if (shouldLoadFromAPI) {
  //     this.loadAvailableProducts();
  //   } else if (scrollPosition >= scrollHeight * 0.8 &&
  //              this.displayedAvailableProducts.length < this.filteredAvailableProducts.length) {
  //     this.loadMoreAvailableProducts();
  //   }
  // }
  // onAvailableScroll(event: any): void {
  //   const element = event.target;
  //   const scrollPosition = element.scrollTop + element.clientHeight;
  //   const scrollHeight = element.scrollHeight;

  //   // Load more when reaching 80% of scroll
  //   if (scrollPosition >= scrollHeight * 0.8 &&
  //       !this.isLoadingMoreAvailable &&
  //       this.hasMoreAvailable) {
  //     this.loadMoreAvailableProducts();
  //   }
  // }

  onAvailableScroll(event: any): void {
    const element = event.target;
    const scrollPosition = element.scrollTop + element.clientHeight;
    const scrollHeight = element.scrollHeight;

    // Load more when reaching 90% of scroll
    if (scrollPosition >= scrollHeight * 0.9 && !this.isLoadingMoreAvailable) {
      this.loadMoreAvailableProducts();
    }
  }

  // onAvailableScroll(event: any): void {
  //   const element = event.target;
  //   const scrollPosition = element.scrollTop + element.clientHeight;
  //   const scrollHeight = element.scrollHeight;

  //   console.log(`Scroll - Position: ${scrollPosition}, Height: ${scrollHeight},
  //             Ratio: ${(scrollPosition / scrollHeight).toFixed(2)}`);

  //   // Load more when reaching 90% of scroll (more sensitive)
  //   if (scrollPosition >= scrollHeight * 0.9 &&
  //     !this.isLoadingMoreAvailable &&
  //     this.hasMoreAvailable) {
  //     console.log('Triggering load more...');
  //     this.loadMoreAvailableProducts();
  //   }
  // }

  // Add this method to log current state
  logCurrentState(): void {
    console.log('=== CURRENT STATE ===');
    console.log(`Total in memory: ${this.availableProducts.length}`);
    console.log(`Assigned products: ${this.assignedProducts.length}`);
    console.log(`Filtered available: ${this.filteredAvailableProducts.length}`);
    console.log(`Displayed: ${this.displayedAvailableProducts.length}`);
    console.log(`Current page: ${this.currentAvailablePage}`);
    console.log(`Has more: ${this.hasMoreAvailable}`);
    console.log(`Is loading: ${this.isLoadingMoreAvailable}`);
    console.log('=====================');
  }

  // Call this in key places or add a button to trigger it

  // Add this method to test loading
  async loadMoreForTesting(): Promise<void> {
    console.log('Manual load triggered');
    await this.loadMoreAvailableProducts();
  }

  onAssignedScroll(event: any): void {
    const element = event.target;
    const scrollPosition = element.scrollTop + element.clientHeight;
    const scrollHeight = element.scrollHeight;

    if (
      scrollPosition >= scrollHeight - 50 &&
      this.displayedAssignedProducts.length <
        this.filteredAssignedProducts.length
    ) {
      this.loadMoreAssignedProducts();
    }
  }

  private loadMoreProducts(element: any): void {
    if (element.classList.contains('available-products-list')) {
      this.loadMoreAvailableProducts();
    } else if (element.classList.contains('assigned-products-list')) {
      this.loadMoreAssignedProducts();
    }
  }

  // private loadMoreAvailableProducts(): void {
  //   const nextBatch = this.filteredAvailableProducts.slice(
  //     this.availableProductsCurrentIndex,
  //     this.availableProductsCurrentIndex + this.availableProductsLoadCount
  //   );

  //   this.displayedAvailableProducts = [
  //     ...this.displayedAvailableProducts,
  //     ...nextBatch
  //   ];

  //   this.availableProductsCurrentIndex += this.availableProductsLoadCount;
  // }

  // public async loadMoreAvailableProducts(): Promise<void> {
  //   if (this.isLoadingMoreAvailable || !this.hasMoreAvailable) {
  //     return;
  //   }

  //   this.isLoadingMoreAvailable = true;

  //   try {
  //     // Load next page
  //     await this.loadAvailableProducts(false);
  //   } catch (error) {
  //     console.error('Error loading more products:', error);
  //     this.showError('Failed to load more products');
  //   } finally {
  //     this.isLoadingMoreAvailable = false;
  //   }
  // }

  public async loadMoreAvailableProducts(): Promise<void> {
    if (this.isLoadingMoreAvailable) {
      return;
    }

    // Check if we need to load more from API
    if (
      this.hasMoreAvailable &&
      this.availableProductsCurrentIndex >=
        this.filteredAvailableProducts.length
    ) {
      // We've exhausted local filtered products, load more from API
      await this.loadAvailableProducts(false);
    } else if (
      this.availableProductsCurrentIndex < this.filteredAvailableProducts.length
    ) {
      // We have more filtered products to display locally
      this.updateDisplayedAvailableProducts();
    }
  }

  private loadMoreAssignedProducts(): void {
    const nextBatch = this.filteredAssignedProducts.slice(
      this.assignedProductsCurrentIndex,
      this.assignedProductsCurrentIndex + this.assignedProductsLoadCount,
    );

    this.displayedAssignedProducts = [
      ...this.displayedAssignedProducts,
      ...nextBatch,
    ];

    this.assignedProductsCurrentIndex += this.assignedProductsLoadCount;
  }

  // private resetAvailableProductsDisplay(): void {
  //   this.availableProductsCurrentIndex = 0;

  //   this.displayedAvailableProducts = this.filteredAvailableProducts.slice(
  //     0,
  //     Math.min(this.availableProductsLoadCount, this.filteredAvailableProducts.length)
  //   );

  //   this.availableProductsCurrentIndex = this.displayedAvailableProducts.length;
  // }
  private resetAvailableProductsDisplay(): void {
    // Always show all filtered products
    this.displayedAvailableProducts = [...this.filteredAvailableProducts];

    // Debug log
    console.log(`Display reset - Filtered: ${this.filteredAvailableProducts.length}, 
              Displayed: ${this.displayedAvailableProducts.length}`);
  }

  //   private resetAvailableProductsDisplay(): void {
  //   const startIndex = this.displayedAvailableProducts.length;
  //   const endIndex = startIndex + this.availableProductsLoadCount;

  //   const newProducts = this.filteredAvailableProducts.slice(
  //     startIndex,
  //     endIndex
  //   );

  //   this.displayedAvailableProducts = [
  //     ...this.displayedAvailableProducts,
  //     ...newProducts
  //   ];
  // }
  private resetAssignedProductsDisplay(): void {
    this.assignedProductsCurrentIndex = 0;
    this.displayedAssignedProducts = this.filteredAssignedProducts.slice(
      0,
      this.assignedProductsLoadCount,
    );
    this.assignedProductsCurrentIndex = this.assignedProductsLoadCount;
  }
  //#endregion

  //#region Data Loading (No changes needed)
  private async loadInitialData(): Promise<void> {
    this.loading = true;
    try {
      await this.loadShelfDetails();

      await this.loadAssignedProducts();

      await Promise.all([
        this.loadCategories(),
        this.loadAssignedProducts(),
        this.loadDeviceAssignments(),
        this.loadMessages(),
      ]);

      if (this.viewMode === 'assign') {
        await this.loadAvailableProducts(true);
      }
    } catch (error: any) {
      console.error('Error loading initial data:', error);
      this.showError('Failed to load data: ' + error.message);
    } finally {
      this.loading = false;
    }
  }

  loadDefaultStore() {
    const currentStore = this.settingsService.getCurrentDefaultStore();
    if (currentStore) {
      this.storeId = currentStore.id;
      this.storeName = currentStore.storeName;
      console.log('Current default store:', currentStore);
    }
  }

  private async loadShelfDetails(): Promise<void> {
    try {
      this.shelf = await firstValueFrom(
        this.shelfService.getShelfById(this.shelfId, this.storeId),
      );
    } catch (error: any) {
      console.error('Error loading shelf details:', error);
      throw new Error('Failed to load shelf details');
    }
  }

  private async loadCategories(loadMore: boolean = false): Promise<void> {
    if (!loadMore) {
      // Reset for fresh load
      this.categoryCurrentPage = 1;
      this.filteredCategories = [];
      this.displayedCategories = [];
      this.hasMoreCategories = true;
    }

    if (this.isLoadingCategories || !this.hasMoreCategories) {
      return;
    }

    this.isLoadingCategories = true;

    try {
      const requestParams = {
        pageNumber: this.categoryCurrentPage,
        pageSize: this.categoryPageSize,
        searchTerm: this.categorySearchTerm || undefined,
        storeId: this.storeId,
      };
      console.log('Loading categories with params:', requestParams);
      const pagedResult = await firstValueFrom(
        this.categoryService.getCategoriesPaged(requestParams),
      );

      const newCategories = pagedResult.items || [];
      console.log(newCategories);
      if (loadMore) {
        this.filteredCategories = [
          ...this.filteredCategories,
          ...newCategories,
        ];
        this.displayedCategories = [
          ...this.displayedCategories,
          ...newCategories,
        ];
      } else {
        this.filteredCategories = newCategories;
        this.displayedCategories = newCategories;
      }

      this.totalCategoryPages = pagedResult.totalPages;
      this.hasMoreCategories =
        this.categoryCurrentPage < pagedResult.totalPages;

      if (newCategories.length > 0) {
        this.categoryCurrentPage++;
      }

      console.log(
        `Loaded ${newCategories.length} categories. Total: ${this.filteredCategories.length}, Has more: ${this.hasMoreCategories}`,
      );
    } catch (error: any) {
      console.error('Error loading categories:', error);
      this.showError('Failed to load categories');
    } finally {
      this.isLoadingCategories = false;
    }
  }

  async loadMoreCategories(): Promise<void> {
    await this.loadCategories(true);
  }

  private async loadSubCategories(
    categoryId: number,
    loadMore: boolean = false,
  ): Promise<void> {
    if (!loadMore) {
      // Reset for fresh load
      this.subCategoryCurrentPage = 1;
      this.filteredSubCategories = [];
      this.displayedSubCategories = [];
      this.hasMoreSubCategories = true;
      this.subCategories = []; // Keep this for compatibility
    }

    if (this.isLoadingSubCategories || !this.hasMoreSubCategories) {
      return;
    }

    this.isLoadingSubCategories = true;

    try {
      const requestParams = {
        pageNumber: this.subCategoryCurrentPage,
        pageSize: this.subCategoryPageSize,
        categoryId: categoryId,
        searchTerm: this.subCategorySearchTerm || undefined,
        storeId: this.storeId,
      };
      console.log('Loading subcategories with params:', requestParams);
      const pagedResult = await firstValueFrom(
        this.categoryService.getSubCategoriesPaged(requestParams),
      );

      const newSubCategories = pagedResult.items || [];

      if (loadMore) {
        this.filteredSubCategories = [
          ...this.filteredSubCategories,
          ...newSubCategories,
        ];
        this.displayedSubCategories = [
          ...this.displayedSubCategories,
          ...newSubCategories,
        ];
        this.subCategories = [...this.subCategories, ...newSubCategories];
      } else {
        this.filteredSubCategories = newSubCategories;
        this.displayedSubCategories = newSubCategories;
        this.subCategories = newSubCategories;
      }

      this.totalSubCategoryPages = pagedResult.totalPages;
      this.hasMoreSubCategories =
        this.subCategoryCurrentPage < pagedResult.totalPages;

      if (newSubCategories.length > 0) {
        this.subCategoryCurrentPage++;
      }
    } catch (error: any) {
      console.error('Error loading subcategories:', error);
      this.filteredSubCategories = [];
      this.displayedSubCategories = [];
      this.subCategories = [];
    } finally {
      this.isLoadingSubCategories = false;
    }
  }

  async loadMoreSubCategories(): Promise<void> {
    if (this.selectedCategoryId) {
      await this.loadSubCategories(this.selectedCategoryId, true);
    }
  }

  // Add scroll handlers for category dropdowns
  onCategoryDropdownScroll(event: any): void {
    const element = event.target;
    const scrollPosition = element.scrollTop + element.clientHeight;
    const scrollHeight = element.scrollHeight;

    if (
      scrollPosition >= scrollHeight - 50 &&
      !this.isLoadingCategories &&
      this.hasMoreCategories
    ) {
      this.loadMoreCategories();
    }
  }

  onSubCategoryDropdownScroll(event: any): void {
    const element = event.target;
    const scrollPosition = element.scrollTop + element.clientHeight;
    const scrollHeight = element.scrollHeight;

    if (
      scrollPosition >= scrollHeight - 50 &&
      !this.isLoadingSubCategories &&
      this.hasMoreSubCategories &&
      this.selectedCategoryId
    ) {
      this.loadMoreSubCategories();
    }
  }

  //

  private async loadAvailableProducts(reset: boolean = false): Promise<void> {
    if (reset) {
      this.currentAvailablePage = 1;
      this.availableProducts = [];
      this.filteredAvailableProducts = [];
      this.displayedAvailableProducts = [];
      this.availableProductsCurrentIndex = 0;
      this.hasMoreAvailable = true;
    }

    if (!this.hasMoreAvailable || this.isLoadingMoreAvailable) {
      return;
    }

    this.isLoadingMoreAvailable = true;

    try {
      const requestParams: any = {
        pageNumber: this.currentAvailablePage,
        pageSize: this.pageSize,
        storeId: this.storeId,
        searchTerm: this.availableSearchTerm || undefined,
        categoryId: this.selectedCategoryId || undefined,
        subcategoryId: this.selectedSubCategoryId || undefined,
      };

      const pagedResult = await firstValueFrom(
        this.productService.getProductsPaged(requestParams),
      );

      const newProducts = pagedResult.items || [];

      // Add new products to the master list
      this.availableProducts = [...this.availableProducts, ...newProducts];

      // Update pagination state
      this.totalAvailablePages = pagedResult.totalPages;
      this.hasMoreAvailable =
        this.currentAvailablePage < pagedResult.totalPages;

      // IMPORTANT: Update filtered list with ALL products
      this.filterAvailableProducts();

      // Update displayed products (lazy load)
      this.updateDisplayedAvailableProducts();

      // Increment page counter for next load
      this.currentAvailablePage++;

      console.log(
        `Loaded ${newProducts.length} products. ` +
          `Total in memory: ${this.availableProducts.length}, ` +
          `Filtered: ${this.filteredAvailableProducts.length}, ` +
          `Displayed: ${this.displayedAvailableProducts.length}, ` +
          `Has more: ${this.hasMoreAvailable}`,
      );
    } catch (error: any) {
      console.error('Error loading products:', error);
      this.showError('Failed to load products: ' + error.message);
    } finally {
      this.isLoadingMoreAvailable = false;
    }
  }
  //   private async loadAvailableProducts(reset: boolean = false): Promise<void> {
  //   if (reset) {
  //     this.currentAvailablePage = 1;
  //     this.availableProducts = [];
  //     this.filteredAvailableProducts = [];
  //     this.displayedAvailableProducts = [];
  //     this.hasMoreAvailable = true;
  //   }

  //   if (!this.hasMoreAvailable || this.isLoadingMoreAvailable) {
  //     return;
  //   }

  //   this.isLoadingMoreAvailable = true;

  //   try {
  //     const requestParams: any = {
  //       pageNumber: this.currentAvailablePage,
  //       pageSize: this.pageSize,
  //       searchTerm: this.availableSearchTerm || undefined,
  //       categoryId: this.selectedCategoryId || undefined,
  //       subCategoryId: this.selectedSubCategoryId || undefined
  //     };

  //     const pagedResult = await firstValueFrom(
  //       this.productService.getProductsPaged(requestParams)
  //     );

  //     const newProducts = pagedResult.items || [];

  //     // Filter out already assigned products
  //     const assignedIds = new Set(this.assignedProducts.map(p => p.id));
  //     const filteredNewProducts = newProducts.filter(p => !assignedIds.has(p.id));

  //     this.availableProducts = [...this.availableProducts, ...filteredNewProducts];

  //     this.totalAvailablePages = pagedResult.totalPages;
  //     this.hasMoreAvailable = this.currentAvailablePage < pagedResult.totalPages;

  //     // Apply local filtering
  //     this.filterAvailableProducts();

  //     // Reset display
  //     this.resetAvailableProductsDisplay();

  //     if (newProducts.length > 0) {
  //       this.currentAvailablePage++;
  //     }

  //     // Show loading indicator
  //     if (this.hasMoreAvailable) {
  //       this.showInfo(`Loaded ${newProducts.length} products. Scroll to load more.`);
  //     }

  //   } catch (error: any) {
  //     console.error('Error loading products:', error);
  //     this.showError('Failed to load products: ' + error.message);
  //   } finally {
  //     this.isLoadingMoreAvailable = false;
  //   }
  // }

  //   private async loadAvailableProducts(reset: boolean = false): Promise<void> {
  //     if (reset) {
  //       this.currentAvailablePage = 1;
  //       this.availableProducts = [];
  //       this.displayedAvailableProducts = [];
  //       this.hasMoreAvailable = true;
  //     }

  //     if (!this.hasMoreAvailable || this.isLoadingMoreAvailable) {
  //       return;
  //     }

  //     this.isLoadingMoreAvailable = true;

  //     try {
  //       const requestParams: any = {
  //         pageNumber: this.currentAvailablePage,
  //         pageSize: this.pageSize,
  //         searchTerm: this.availableSearchTerm || undefined,
  //       };
  // console.log('Loading available products with params:', requestParams);
  //       const pagedResult = await firstValueFrom(
  //         this.productService.getProductsPaged(requestParams)
  //       );

  //       const newProducts = pagedResult.items || [];
  //       this.availableProducts = [...this.availableProducts, ...newProducts];

  //       this.totalAvailablePages = pagedResult.totalPages;
  //       this.hasMoreAvailable = this.currentAvailablePage < pagedResult.totalPages;
  //       console.log(`Loaded ${newProducts.length} products. Total available products: ${this.availableProducts.length}. Has more: ${this.hasMoreAvailable} Products:`, this.availableProducts );
  //       this.filterAvailableProducts();
  //       this.resetAvailableProductsDisplay();

  //       if (newProducts.length > 0) {
  //         this.currentAvailablePage++;
  //       }

  //     } catch (error: any) {
  //       console.error('Error loading products:', error);
  //       this.showError('Failed to load products: ' + error.message);
  //     } finally {
  //       this.isLoadingMoreAvailable = false;
  //     }
  //   }

  // private async loadAssignedProducts(): Promise<void> {
  //   try {
  //     const products = await firstValueFrom(
  //       this.shelfService.getProductsByShelf(this.shelf.id!)
  //     );

  //     this.assignedProducts = products.map(p => ({
  //       ...p,
  //       assignmentId: undefined
  //     }));
  //     console.log('Assigned products loaded:', this.assignedProducts);
  //     this.filterAssignedProducts();
  //   } catch (error: any) {
  //     console.error('Error loading assigned products:', error);
  //     this.assignedProducts = [];
  //     this.filteredAssignedProducts = [];
  //     this.displayedAssignedProducts = [];
  //   }
  // }

  private async loadAssignedProducts(): Promise<void> {
    try {
      const products = await firstValueFrom(
        this.shelfService.getProductsByShelf(this.shelf.id!, this.storeId),
      );

      this.assignedProducts = products.map((p) => ({
        ...p,
        assignmentId: undefined,
      }));

      console.log('Assigned products loaded:', this.assignedProducts);
      this.filterAssignedProducts();

      // Force change detection
      this.cdr.detectChanges();
    } catch (error: any) {
      console.error('Error loading assigned products:', error);
      this.assignedProducts = [];
      this.filteredAssignedProducts = [];
      this.displayedAssignedProducts = [];
    }
  }

  private async loadDeviceAssignments(): Promise<void> {
    try {
      // Load shelf devices with pagination
      const shelfParams = {
        pageNumber: 1,
        pageSize: 100,
        locationType: 'Shelf',
        locationId: this.shelf.id!,
        storeId: this.storeId,
      };

      const shelfResult = await firstValueFrom(
        this.deviceService.getAssignmentsPaged(shelfParams),
      );
      this.shelfDevices = shelfResult.items;
      console.log('Shelf devices loaded:', this.shelfDevices);

      // Wait for assignedProducts to be populated (add small delay if needed)
      if (this.assignedProducts.length === 0) {
        console.warn('No assigned products yet, delaying product device load');
        // Add a small delay to ensure assigned products are loaded
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Load devices for each assigned product
      const productDevicePromises = this.assignedProducts.map(
        async (product): Promise<void> => {
          try {
            const productParams = {
              pageNumber: 1,
              pageSize: 100,
              locationType: 'Product',
              locationId: product.id,
              storeId: this.storeId,
            };

            const productResult = await firstValueFrom(
              this.deviceService.getAssignmentsPaged(productParams),
            );

            if (productResult.items.length > 0) {
              this.productDevices.set(product.id, productResult.items);
            }
          } catch (error) {
            console.warn(`No devices found for product ${product.id}`, error);
            // Don't throw here, just log
          }
        },
      );

      // Wait for all product device loads to complete
      await Promise.allSettled(productDevicePromises);

      console.log('Product devices loaded:', this.productDevices);

      // Trigger change detection
      this.cdr.detectChanges();
    } catch (error: any) {
      console.error('Error loading device assignments:', error);
      this.showError('Failed to load device assignments');
    }
  }

  // private async loadDeviceAssignments(): Promise<void> {
  //   try {
  //     // Load shelf devices with pagination
  //     const shelfParams = {
  //       pageNumber: 1,
  //       pageSize: 100, // Adjust as needed
  //       locationType: 'Shelf',
  //       locationId: this.shelf.id!,
  //       storeId: this.storeId // Use the storeId from settings
  //     };

  //     const shelfResult = await firstValueFrom(
  //       this.deviceService.getAssignmentsPaged(shelfParams)
  //     );
  //     this.shelfDevices = shelfResult.items;
  //     console.log('Shelf devices loaded:', this.shelfDevices);
  //     // Load devices for each assigned product
  //     for (const product of this.assignedProducts) {
  //       try {
  //         const productParams = {
  //           pageNumber: 1,
  //           pageSize: 100, // Adjust as needed
  //           locationType: 'Product',
  //           locationId: product.id,
  //           storeId: this.storeId // Use the storeId from settings
  //         };

  //         const productResult = await firstValueFrom(
  //           this.deviceService.getAssignmentsPaged(productParams)
  //         );
  //         console.log("productdevice",productResult)
  //         if (productResult.items.length > 0) {
  //           this.productDevices.set(product.id, productResult.items);
  //         }
  //       } catch (error) {
  //         console.warn(`No devices found for product ${product.id}`, error);
  //       }
  //     }
  //   } catch (error: any) {
  //     console.error('Error loading device assignments:', error);
  //     this.showError('Failed to load device assignments');
  //   }
  // }

  // private async loadDeviceAssignments(): Promise<void> {
  //   try {
  //     this.shelfDevices = await firstValueFrom(
  //       this.deviceService.getAssignmentsByLocation('Shelf', this.shelf.id!)
  //     );

  //     for (const product of this.assignedProducts) {
  //       try {
  //         const devices = await firstValueFrom(
  //           this.deviceService.getAssignmentsByLocation('Product', product.id)
  //         );
  //         if (devices.length > 0) {
  //           this.productDevices.set(product.id, devices);
  //         }
  //       } catch (error) {
  //         console.warn(`No devices found for product ${product.id}`);
  //       }
  //     }
  //   } catch (error: any) {
  //     console.error('Error loading device assignments:', error);
  //   }
  // }

  private async loadMessages(): Promise<void> {
    try {
      this.loadingMessages = true;
      this.filteredMessages = [];

      const messages = await firstValueFrom(
        this.msgService.getMessages(this.storeId),
      );

      if (Array.isArray(messages)) {
        this.availableMessages = messages.map((message) => ({
          ...message,
          contentTypeString: this.getContentTypeString(message.content_type),
          title: message.title || 'Untitled Message',
          duration: message.duration || 0,
          is_active: message.is_active ?? true,
        }));

        this.filterMessages();
      } else {
        console.error('Invalid messages data format:', messages);
        this.availableMessages = [];
        this.showWarning('Received invalid messages format from server');
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
      this.showError('Failed to load messages. Please try again.');
      this.availableMessages = [];
      this.filteredMessages = [];
    } finally {
      this.loadingMessages = false;
    }
  }
  //#endregion

  //#region Filtering and Other Methods (No changes needed)
  filterMessages(): void {
    if (!this.availableMessages || !Array.isArray(this.availableMessages)) {
      this.filteredMessages = [];
      return;
    }

    let filtered = [...this.availableMessages];

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter((message) => {
        const title = (message.title || '').toLowerCase();
        const contentType = (message.contentTypeString || '').toLowerCase();
        const description = (message.content_data || '').toLowerCase();

        return (
          title.includes(query) ||
          contentType.includes(query) ||
          description.includes(query)
        );
      });
    }

    if (this.showActiveOnly) {
      filtered = filtered.filter((message) => message.is_active);
    }

    filtered.sort((a, b) => {
      return (a.title || '').localeCompare(b.title || '');
    });

    this.filteredMessages = filtered;
  }

  getContentTypeString(contentTypeId: number): string {
    switch (contentTypeId) {
      case 1:
        return 'general';
      case 2:
        return 'image';
      case 3:
        return 'video';
      case 4:
        return 'custom_image';
      default:
        return 'unknown';
    }
  }

  getContentTypeDisplayName(contentTypeId: number): string {
    switch (contentTypeId) {
      case 1:
        return 'General';
      case 2:
        return 'Image';
      case 3:
        return 'Video';
      case 4:
        return 'Custom Image';
      default:
        return 'Unknown';
    }
  }

  getContentTypeIcon(contentTypeId: number): string {
    switch (contentTypeId) {
      case 1:
        return 'pi pi-file';
      case 2:
        return 'pi pi-image';
      case 3:
        return 'pi pi-video';
      case 4:
        return 'pi pi-palette';
      default:
        return 'pi pi-question-circle';
    }
  }

  getSelectedMessageTitle(): string {
    if (!this.selectedMessageId) return '';
    const message = this.availableMessages.find(
      (m) => m.id === this.selectedMessageId,
    );
    return message?.title || '';
  }

  getSelectedMessage(): any {
    if (!this.selectedMessageId) return null;
    return this.availableMessages.find((m) => m.id === this.selectedMessageId);
  }

  getPriorityClass(priority: string): string {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-50 text-red-800';
      case 'medium':
        return 'bg-yellow-50 text-yellow-800';
      case 'low':
        return 'bg-blue-50 text-blue-800';
      default:
        return 'bg-gray-50 text-gray-800';
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filterMessages();
  }

  clearFilters(): void {
    // Reset all search terms
    this.searchQuery = '';
    this.showActiveOnly = false;
    this.availableSearchTerm = '';
    this.categorySearchTerm = '';
    this.subCategorySearchTerm = '';

    // Reset category selections
    this.selectedCategoryId = null;
    this.selectedSubCategoryId = null;

    // Reset category data
    this.categoryCurrentPage = 1;
    this.filteredCategories = [];
    this.displayedCategories = [];
    this.hasMoreCategories = true;

    // Reset subcategory data
    this.subCategoryCurrentPage = 1;
    this.filteredSubCategories = [];
    this.displayedSubCategories = [];
    this.subCategories = [];
    this.hasMoreSubCategories = true;

    // Reset and load all products
    this.currentAvailablePage = 1;
    this.availableProducts = [];
    this.filteredAvailableProducts = [];
    this.displayedAvailableProducts = [];
    this.hasMoreAvailable = true;

    // Reload categories and products
    Promise.all([this.loadCategories(true), this.loadAvailableProducts(true)]);

    this.filterMessages();
    this.showSuccess('Filters cleared');
  }

  refreshMessages(): void {
    if (this.loadingMessages) return;
    this.showSuccess('Refreshing messages...');
    this.loadMessages();
  }

  private filterAvailableProducts(): void {
    // Start with all loaded products
    let filtered = [...this.availableProducts];

    // Filter out assigned products
    const assignedIds = new Set(this.assignedProducts.map((p) => p.id));
    filtered = filtered.filter((p) => !assignedIds.has(p.id));

    // Apply category filters
    if (this.selectedCategoryId) {
      const categoryIdNum = Number(this.selectedCategoryId);
      filtered = filtered.filter((p) => p.categoryId === categoryIdNum);
    }

    if (this.selectedSubCategoryId) {
      const subCategoryIdNum = Number(this.selectedSubCategoryId);
      filtered = filtered.filter((p) => p.subCategoryId === subCategoryIdNum);
    }

    // Apply search filter
    if (this.availableSearchTerm.trim()) {
      const term = this.availableSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.productName?.toLowerCase().includes(term) ||
          p.productCode?.toLowerCase().includes(term) ||
          p.barCode?.toLowerCase().includes(term),
      );
    }

    this.filteredAvailableProducts = filtered;

    // Reset lazy loading index when filtering changes
    this.availableProductsCurrentIndex = 0;

    // Update displayed products
    this.updateDisplayedAvailableProducts();
  }

  private updateDisplayedAvailableProducts(): void {
    // Calculate how many more products to display
    const startIndex = this.availableProductsCurrentIndex;
    const endIndex = Math.min(
      startIndex + this.availableProductsLoadCount,
      this.filteredAvailableProducts.length,
    );

    // Get the next batch of products
    const nextBatch = this.filteredAvailableProducts.slice(
      startIndex,
      endIndex,
    );

    // If we're resetting (startIndex = 0), replace the array, otherwise append
    if (startIndex === 0) {
      this.displayedAvailableProducts = nextBatch;
    } else {
      this.displayedAvailableProducts = [
        ...this.displayedAvailableProducts,
        ...nextBatch,
      ];
    }

    // Update the index
    this.availableProductsCurrentIndex = endIndex;

    console.log(
      `Displayed products updated: ${this.displayedAvailableProducts.length} shown, ` +
        `index at ${this.availableProductsCurrentIndex}`,
    );
  }

  // filterAvailableProducts(): void {
  //   let filtered = [...this.availableProducts];

  //   // Filter out already assigned products
  //   const assignedIds = new Set(this.assignedProducts.map(p => p.id));
  //   filtered = filtered.filter(p => !assignedIds.has(p.id));

  //   // Apply category filters
  //   if (this.selectedCategoryId) {
  //     const categoryIdNum = Number(this.selectedCategoryId);
  //     filtered = filtered.filter(p => p.categoryId === categoryIdNum);
  //   }

  //   if (this.selectedSubCategoryId) {
  //     const subCategoryIdNum = Number(this.selectedSubCategoryId);
  //     filtered = filtered.filter(p => p.subCategoryId === subCategoryIdNum);
  //   }

  //   // Apply search filter
  //   if (this.availableSearchTerm.trim()) {
  //     const term = this.availableSearchTerm.toLowerCase();
  //     filtered = filtered.filter(p =>
  //       p.productName?.toLowerCase().includes(term) ||
  //       p.productCode?.toLowerCase().includes(term) ||
  //       p.barCode?.toLowerCase().includes(term)
  //     );
  //   }

  //   this.filteredAvailableProducts = filtered;

  //   // Debug log
  //   console.log(`Filtering - Available: ${this.availableProducts.length},
  //             Assigned: ${this.assignedProducts.length},
  //             Filtered: ${this.filteredAvailableProducts.length}`);
  // }

  // filterAvailableProducts(): void {
  //   let filtered = [...this.availableProducts];

  //   const assignedIds = new Set(this.assignedProducts.map(p => p.id));
  //   filtered = filtered.filter(p => !assignedIds.has(p.id));

  //   if (this.selectedCategoryId) {
  //     const categoryIdNum = Number(this.selectedCategoryId);
  //     filtered = filtered.filter(p => p.categoryId === categoryIdNum);
  //   }

  //   if (this.selectedSubCategoryId) {
  //     const subCategoryIdNum = Number(this.selectedSubCategoryId);
  //     filtered = filtered.filter(p => p.subCategoryId === subCategoryIdNum);
  //   }

  //   if (this.availableSearchTerm.trim()) {
  //     const term = this.availableSearchTerm.toLowerCase();
  //     filtered = filtered.filter(p =>
  //       p.productName?.toLowerCase().includes(term) ||
  //       p.productCode?.toLowerCase().includes(term) ||
  //       p.barCode?.toLowerCase().includes(term)
  //     );
  //   }

  //   this.filteredAvailableProducts = filtered;
  //   this.resetAvailableProductsDisplay();
  // }

  // filterAssignedProducts(): void {
  //   let filtered = [...this.assignedProducts];

  //   if (this.assignedSearchTerm.trim()) {
  //     const term = this.assignedSearchTerm.toLowerCase();
  //     filtered = filtered.filter(p =>
  //       p.productName?.toLowerCase().includes(term) ||
  //       p.productCode?.toLowerCase().includes(term)
  //     );
  //   }

  //   this.filteredAssignedProducts = filtered;
  //   console.log('Filtered assigned products:', this.filteredAssignedProducts);
  //   this.resetAssignedProductsDisplay();
  // }

  filterAssignedProducts(): void {
    console.log('filterAssignedProducts called');

    let filtered = [...this.assignedProducts];

    if (this.assignedSearchTerm.trim()) {
      const term = this.assignedSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.productName?.toLowerCase().includes(term) ||
          p.productCode?.toLowerCase().includes(term),
      );
    }

    this.filteredAssignedProducts = [...filtered];
    this.currentPage = 0; // Reset to first page when filtering

    console.log('Filtered result:', this.filteredAssignedProducts);

    if (this.cdr) {
      this.cdr.detectChanges();
    }
  }

  // async onCategoryChange(): Promise<void> {
  //   this.selectedSubCategoryId = null;
  //   this.subCategorySearchTerm = '';
  //   this.subCategoryCurrentPage = 1;

  //   if (this.selectedCategoryId) {
  //     await this.loadSubCategories(this.selectedCategoryId, false);
  //   } else {
  //     this.subCategories = [];
  //     this.filteredSubCategories = [];
  //     this.displayedSubCategories = [];
  //   }

  //   // Reset and load products for this category
  //   this.currentAvailablePage = 1;
  //   this.availableProducts = [];
  //   this.filteredAvailableProducts = [];
  //   this.displayedAvailableProducts = [];
  //   this.hasMoreAvailable = true;

  //   await this.loadAvailableProducts(true);
  // }

  async onCategoryChange(): Promise<void> {
    this.selectedSubCategoryId = null;
    this.subCategorySearchTerm = '';
    this.subCategoryCurrentPage = 1;

    if (this.selectedCategoryId) {
      await this.loadSubCategories(this.selectedCategoryId, false);
    } else {
      this.subCategories = [];
      this.filteredSubCategories = [];
      this.displayedSubCategories = [];
    }

    // Only reset and load products if we're in assign mode
    if (this.viewMode === 'assign') {
      this.currentAvailablePage = 1;
      this.availableProducts = [];
      this.filteredAvailableProducts = [];
      this.displayedAvailableProducts = [];
      this.availableProductsCurrentIndex = 0;
      this.hasMoreAvailable = true;

      await this.loadAvailableProducts(true);
    }
  }

  onSubCategoryChange(): void {
    // Only reset products if in assign mode
    if (this.viewMode === 'assign') {
      this.currentAvailablePage = 1;
      this.availableProducts = [];
      this.filteredAvailableProducts = [];
      this.displayedAvailableProducts = [];
      this.availableProductsCurrentIndex = 0;
      this.hasMoreAvailable = true;

      this.loadAvailableProducts(true);
    }
  }

  //   async onSubCategoryChange(): Promise<void> {
  //   // Reset and load products for this subcategory
  //   this.currentAvailablePage = 1;
  //   this.availableProducts = [];
  //   this.filteredAvailableProducts = [];
  //   this.displayedAvailableProducts = [];
  //   this.hasMoreAvailable = true;

  //   await this.loadAvailableProducts(true);
  // }

  // Add search methods for categories
  async onCategorySearch(): Promise<void> {
    // Reset search
    this.categoryCurrentPage = 1;
    this.filteredCategories = [];
    this.displayedCategories = [];
    this.hasMoreCategories = true;

    // Load categories with search term
    await this.loadCategories(false);
  }

  async onSubCategorySearch(): Promise<void> {
    if (!this.selectedCategoryId) return;

    // Reset search
    this.subCategoryCurrentPage = 1;
    this.filteredSubCategories = [];
    this.displayedSubCategories = [];
    this.hasMoreSubCategories = true;

    // Load subcategories with search term
    await this.loadSubCategories(this.selectedCategoryId, false);
  }

  // onAvailableSearch(): void {
  //   // Reset to page 1 when search changes
  //   this.currentAvailablePage = 1;
  //   this.availableProducts = [];
  //   this.filteredAvailableProducts = [];
  //   this.displayedAvailableProducts = [];
  //   this.hasMoreAvailable = true;

  //   // Load first page with search
  //   this.loadAvailableProducts(true);

  //   console.log('Search triggered:', this.availableSearchTerm);
  //   //this.filterAvailableProducts();
  // }

  onAvailableSearch(): void {
    // Reset to page 1
    this.currentAvailablePage = 1;
    this.availableProducts = [];
    this.filteredAvailableProducts = [];
    this.displayedAvailableProducts = [];
    this.availableProductsCurrentIndex = 0;
    this.hasMoreAvailable = true;

    // Load first page with search
    this.loadAvailableProducts(true);
  }

  onAssignedSearch(): void {
    this.filterAssignedProducts();
  }

  // Calculate discount percentage
  calculateDiscountPercent(product: any): number {
    if (!product.discountPrice || product.discountPrice <= 0) return 0;
    return Math.round(
      ((product.sellingPrice - product.discountPrice) / product.sellingPrice) *
        100,
    );
  }

  // Get paginated products
  getPaginatedProducts(): any[] {
    const start = this.currentPage * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredAssignedProducts.slice(start, end);
  }

  // Handle page change
  onPageChange(event: any): void {
    this.currentPage = event.page;
    this.itemsPerPage = event.rows;
  }

  // Remove product (for list view)
  // async removeProduct(productId: number): Promise<void> {
  //   if (confirm('Are you sure you want to remove this product from the shelf?')) {
  //     try {
  //       await firstValueFrom(
  //         this.shelfService.removeProduct(this.shelf.id!, productId)
  //       );

  //       this.assignedProducts = this.assignedProducts.filter(p => p.id !== productId);
  //       this.filterAssignedProducts();
  //       this.showSuccess('Product removed successfully');
  //     } catch (error: any) {
  //       this.showError('Failed to remove product: ' + error.message);
  //     }
  //   }
  // }

  removeProduct(product: Product): void {
    console.log('Attempting to delete product assign:', product);
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Delete Product Assign',
        message: `Are you sure you want to delete ${product.productCode}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      },
      panelClass: ['rounded-lg'],
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result)
        this.shelfService.removeProduct(
          this.shelf.id!,
          product.id,
          this.storeId,
          this.currentUserId,
        );
    });
  }

  //#endregion

  //#region Selection Management (No changes needed)
  toggleAvailableSelection(productId: number): void {
    if (this.selectedAvailable.has(productId)) {
      this.selectedAvailable.delete(productId);
    } else {
      this.selectedAvailable.add(productId);
    }
  }

  toggleAssignedSelection(productId: number): void {
    if (this.selectedAssigned.has(productId)) {
      this.selectedAssigned.delete(productId);
    } else {
      this.selectedAssigned.add(productId);
    }
  }

  selectAllAvailable(): void {
    this.filteredAvailableProducts.forEach((p) =>
      this.selectedAvailable.add(p.id),
    );
  }

  deselectAllAvailable(): void {
    this.selectedAvailable.clear();
  }

  selectAllAssigned(): void {
    this.filteredAssignedProducts.forEach((p) =>
      this.selectedAssigned.add(p.id),
    );
  }

  deselectAllAssigned(): void {
    this.selectedAssigned.clear();
  }
  //#endregion

  //#region Assignment Actions (No changes needed)
  async assignSelected(): Promise<void> {
    if (this.selectedAvailable.size === 0) return;

    this.savingChanges = true;
    const errors: string[] = [];

    try {
      const productsToAssign = this.availableProducts.filter((p) =>
        this.selectedAvailable.has(p.id),
      );

      for (const product of productsToAssign) {
        try {
          await firstValueFrom(
            this.shelfService.assignProduct(
              this.shelf.id!,
              product.id,
              this.storeId,
              this.currentUserId,
            ),
          );

          // Add to assigned products
          this.assignedProducts.push(product);

          // Remove from available products immediately
          this.availableProducts = this.availableProducts.filter(
            (p) => p.id !== product.id,
          );
        } catch (error: any) {
          errors.push(`${product.productName}: ${error.message}`);
        }
      }

      this.selectedAvailable.clear();

      // Re-filter both lists
      this.filterAvailableProducts();
      this.filterAssignedProducts();

      if (errors.length === 0) {
        this.showSuccess(
          `Successfully assigned ${productsToAssign.length} product(s)`,
        );
      } else {
        this.showWarning(`Assigned with errors: ${errors.join(', ')}`);
      }
    } catch (error: any) {
      this.showError('Failed to assign products: ' + error.message);
    } finally {
      this.savingChanges = false;
    }
  }

  async unassignSelected(): Promise<void> {
    if (this.selectedAssigned.size === 0) return;

    this.savingChanges = true;
    const errors: string[] = [];

    try {
      const productsToUnassign = this.assignedProducts.filter((p) =>
        this.selectedAssigned.has(p.id),
      );

      for (const product of productsToUnassign) {
        try {
          await firstValueFrom(
            this.shelfService.removeProduct(
              this.shelf.id!,
              product.id,
              this.storeId,
              this.currentUserId,
            ),
          );

          // Remove from assigned products
          this.assignedProducts = this.assignedProducts.filter(
            (p) => p.id !== product.id,
          );
          this.productDevices.delete(product.id);

          // Add back to available products if not already there
          if (!this.availableProducts.some((p) => p.id === product.id)) {
            this.availableProducts.push(product);
          }
        } catch (error: any) {
          errors.push(`${product.productName}: ${error.message}`);
        }
      }

      this.selectedAssigned.clear();
      this.filterAvailableProducts();
      this.filterAssignedProducts();

      if (errors.length === 0) {
        this.showSuccess(
          `Successfully removed ${productsToUnassign.length} product(s)`,
        );
      } else {
        this.showWarning(`Removed with errors: ${errors.join(', ')}`);
      }
    } catch (error: any) {
      this.showError('Failed to remove products: ' + error.message);
    } finally {
      this.savingChanges = false;
    }
  }

  // async assignSelected(): Promise<void> {
  //   if (this.selectedAvailable.size === 0) return;

  //   this.savingChanges = true;
  //   const errors: string[] = [];

  //   try {
  //     const productsToAssign = this.availableProducts.filter(p =>
  //       this.selectedAvailable.has(p.id)
  //     );

  //     for (const product of productsToAssign) {
  //       try {
  //         await firstValueFrom(
  //           this.shelfService.assignProduct(this.shelf.id!, product.id, this.storeId, this.currentUserId)
  //         );

  //         this.assignedProducts.push(product);
  //       } catch (error: any) {
  //         errors.push(`${product.productName}: ${error.message}`);
  //       }
  //     }

  //     this.selectedAvailable.clear();
  //     this.filterAvailableProducts();
  //     this.filterAssignedProducts();

  //     if (errors.length === 0) {
  //       this.showSuccess(`Successfully assigned ${productsToAssign.length} product(s)`);
  //     } else {
  //       this.showWarning(`Assigned with errors: ${errors.join(', ')}`);
  //     }
  //   } catch (error: any) {
  //     this.showError('Failed to assign products: ' + error.message);
  //   } finally {
  //     this.savingChanges = false;
  //   }
  // }

  // async unassignSelected(): Promise<void> {
  //   if (this.selectedAssigned.size === 0) return;

  //   this.savingChanges = true;
  //   const errors: string[] = [];

  //   try {
  //     const productsToUnassign = this.assignedProducts.filter(p =>
  //       this.selectedAssigned.has(p.id)
  //     );

  //     for (const product of productsToUnassign) {
  //       try {
  //         await firstValueFrom(
  //           this.shelfService.removeProduct(this.shelf.id!, product.id, this.storeId, this.currentUserId)
  //         );

  //         this.assignedProducts = this.assignedProducts.filter(p => p.id !== product.id);
  //         this.productDevices.delete(product.id);
  //       } catch (error: any) {
  //         errors.push(`${product.productName}: ${error.message}`);
  //       }
  //     }

  //     this.selectedAssigned.clear();
  //     this.filterAvailableProducts();
  //     this.filterAssignedProducts();

  //     if (errors.length === 0) {
  //       this.showSuccess(`Successfully removed ${productsToUnassign.length} product(s)`);
  //     } else {
  //       this.showWarning(`Removed with errors: ${errors.join(', ')}`);
  //     }
  //   } catch (error: any) {
  //     this.showError('Failed to remove products: ' + error.message);
  //   } finally {
  //     this.savingChanges = false;
  //   }
  // }

  async assignByCategory(): Promise<void> {
    if (!this.selectedCategoryId) {
      this.showWarning('Please select a category first');
      return;
    }

    this.savingChanges = true;

    try {
      await firstValueFrom(
        this.shelfService.assignProductsByCategory(
          this.shelf.id!,
          this.selectedCategoryId,
          this.storeId,
          this.currentUserId,
        ),
      );

      await this.loadAssignedProducts();
      this.filterAvailableProducts();

      this.showSuccess('Successfully assigned all products from category');
    } catch (error: any) {
      this.showError('Failed to assign category: ' + error.message);
    } finally {
      this.savingChanges = false;
    }
  }

  async assignBySubCategory(): Promise<void> {
    if (!this.selectedSubCategoryId) {
      this.showWarning('Please select a subcategory first');
      return;
    }

    this.savingChanges = true;

    try {
      const productsInSubCategory = this.availableProducts.filter(
        (p) => p.subCategoryId === this.selectedSubCategoryId,
      );

      const errors: string[] = [];

      for (const product of productsInSubCategory) {
        try {
          await firstValueFrom(
            this.shelfService.assignProduct(
              this.shelf.id!,
              product.id,
              this.storeId,
              this.currentUserId,
            ),
          );
        } catch (error: any) {
          errors.push(`${product.productName}: ${error.message}`);
        }
      }

      await this.loadAssignedProducts();
      this.filterAvailableProducts();

      if (errors.length === 0) {
        this.showSuccess(
          `Successfully assigned ${productsInSubCategory.length} products from subcategory`,
        );
      } else {
        this.showWarning(`Assigned with some errors: ${errors.join(', ')}`);
      }
    } catch (error: any) {
      this.showError('Failed to assign subcategory: ' + error.message);
    } finally {
      this.savingChanges = false;
    }
  }
  //#endregion

  //#region Device Display & Binding (No changes needed)
  toggleDeviceView(): void {
    this.showDevices = !this.showDevices;
  }

  getProductDeviceCount(productId: number): number {
    return this.productDevices.get(productId)?.length || 0;
  }

  getDeviceDisplayName(assignment: DeviceAssignmentDto): string {
    return assignment.deviceName || assignment.deviceMac || 'Unknown Device';
  }

  openBindDialog(assignment: DeviceAssignmentDto): void {
    this.selectedAssignmentForBind = assignment;
    this.showBindDialog = true;
    this.selectedMessageId = null;
    this.loadMessages();
    this.bindDialogRef = this.dialog.open(this.bindDialogTpl, {
      width: '90vw',
      maxWidth: '1000px',
      maxHeight: '90vh',
    });
    this.bindDialogRef.afterClosed().subscribe(() => {
      this.showBindDialog = false;
      this.bindDialogRef = undefined;
    });
  }

  closeBindDialog(): void {
    this.bindDialogRef?.close();
    this.showBindDialog = false;
    this.selectedAssignmentForBind = null;
    this.selectedMessageId = null;
  }

  async quickBindDevice(assignment: DeviceAssignmentDto): Promise<void> {
    if (!assignment) {
      this.showWarning('No device selected for binding');
      return;
    }
    console.log('bindingty', assignment.locationType);
    const isShelfBinding =
      assignment.locationType.toLocaleUpperCase() === 'SHELF';

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '420px',
      data: {
        title: 'Confirm Quick Bind',
        message: `Are you sure you want to quick bind ${
          isShelfBinding ? 'shelf' : 'product'
        } data to this device without a message?`,
        confirmText: 'Yes, Bind',
        cancelText: 'Cancel',
        confirmColor: 'green',
      },
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());

    if (!confirmed) {
      return;
    }

    this.bindingInProgress = true;

    let comboId: number | undefined;
    // The two ids come from different tables and share a numeric range, so the
    // server has to be told which one this is.
    let comboType: 'TEMPLATE' | 'MESSAGE' = 'TEMPLATE';

    // Use the correct combo ID based on assignment type
    if (assignment.isTemplateAssignment) {
      comboId = assignment.deviceTemplateComboId ?? undefined;
      comboType = 'TEMPLATE';
    } else if (assignment.isMessageAssignment) {
      comboId = assignment.deviceMessageComboId ?? undefined;
      comboType = 'MESSAGE';
    }

    try {
      const bindRequest: UnifiedBindDataRequest = {
        comboId: comboId!,
        comboType,
        bindingType: isShelfBinding ? 'shelf' : 'product',
        messageId: 0,
        color: 1,
        total: 5,
        period: 500,
        interval: 900,
        brightness: 100,
      };

      if (isShelfBinding) {
        bindRequest.shelfId = assignment.locationId;
        bindRequest.shelfName = this.shelf.name;
        bindRequest.shelfCode = `SHELF-${this.shelf.id}`;
      } else {
        const product = this.assignedProducts.find(
          (p) => p.id === assignment.locationId,
        );
        bindRequest.productId = product?.id ?? assignment.locationId;
      }
      console.log('isshelf', isShelfBinding, bindRequest);
      await firstValueFrom(this.deviceService.bindDataUnified(bindRequest));

      this.showSuccess(
        `${isShelfBinding ? 'SHELF' : 'PRODUCT'} data successfully bound to device (no message)`,
      );
    } catch (error: any) {
      console.error('Error in quick bind:', error);

      const errorMsg =
        typeof error === 'string' ? error : error?.message || 'Unknown error';

      this.showError('Failed to quick bind: ' + errorMsg);

      // } catch (error: any) {
      //   console.error('Error in quick bind:', error);
      //   this.showError('Failed to quick bind: ' + (error?.message || 'Unknown error'));
    } finally {
      this.bindingInProgress = false;
    }
  }

  //   async quickBindDevice(assignment: DeviceAssignmentDto): Promise<void> {
  //   if (!assignment) {
  //     this.showWarning('No device selected for binding');
  //     return;
  //   }

  //   const isShelfBinding = assignment.locationType === 'Shelf';

  //   const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
  //     width: '420px',
  //     data: {
  //       title: 'Confirm Quick Bind',
  //       message: `Are you sure you want to quick bind ${
  //         isShelfBinding ? 'shelf' : 'product'
  //       } data to this device without a message?`,
  //       confirmText: 'Yes, Bind',
  //       cancelText: 'Cancel',
  //       confirmColor: 'green'
  //     }
  //   });

  //   const confirmed = await firstValueFrom(dialogRef.afterClosed());

  //   if (!confirmed) {
  //     return;
  //   }

  //   this.bindingInProgress = true;

  //      let comboId: number | undefined;

  //         // Narrow the type
  //         if (assignment.assignmentType === 'TEMPLATE') {
  //             comboId = assignment.deviceTemplateComboId ?? undefined;
  //         }

  //   try {
  //     const bindRequest: UnifiedBindDataRequest = {
  //       comboId: comboId!,
  //       bindingType: isShelfBinding ? 'shelf' : 'product',
  //       messageId: 0,
  //       color: 1,
  //       total: 5,
  //       period: 500,
  //       interval: 900,
  //       brightness: 100
  //     };

  //     if (isShelfBinding) {
  //       bindRequest.shelfId = assignment.locationId;
  //       bindRequest.shelfName = this.shelf.name;
  //       bindRequest.shelfCode = `SHELF-${this.shelf.id}`;
  //     } else {
  //       const product = this.assignedProducts.find(
  //         p => p.id === assignment.locationId
  //       );

  //       bindRequest.productId = product?.id ?? assignment.locationId;
  //     }

  //     await firstValueFrom(this.deviceService.bindDataUnified(bindRequest));

  //     this.showSuccess(
  //       `${isShelfBinding ? 'SHELF' : 'PRODUCT'} data successfully bound to device (no message)`
  //     );

  //   } catch (error: any) {
  //     console.error('Error in quick bind:', error);
  //     this.showError('Failed to quick bind: ' + (error?.message || 'Unknown error'));
  //   } finally {
  //     this.bindingInProgress = false;
  //   }
  // }

  // async quickBindDevice(assignment: AssignmentDto): Promise<void> {
  //   if (!assignment) {
  //     this.showWarning('No device selected for binding');
  //     return;
  //   }

  //   const confirmQuickBind = confirm(
  //     `Are you sure you want to quick bind ${assignment.locationType === 'Shelf' ? 'shelf' : 'product'} data to this device without a message?`
  //   );

  //   if (!confirmQuickBind) {
  //     return;
  //   }

  //   this.bindingInProgress = true;

  //   try {
  //     const isShelfBinding = assignment.locationType === 'Shelf';

  //     const bindRequest: UnifiedBindDataRequest = {
  //       comboId: assignment.deviceTemplateComboId,
  //       bindingType: isShelfBinding ? 'shelf' : 'product',
  //       messageId: 0,
  //       color: 1,
  //       total: 5,
  //       period: 500,
  //       interval: 900,
  //       brightness: 100
  //     };

  //     if (isShelfBinding) {
  //       bindRequest.shelfId = assignment.locationId;
  //       bindRequest.shelfName = this.shelf.name;
  //       bindRequest.shelfCode = `SHELF-${this.shelf.id}`;
  //     } else {
  //       const productId = assignment.locationId;
  //       const product = this.assignedProducts.find(p => p.id === productId);

  //       if (product) {
  //         bindRequest.productId = product.id;
  //       } else {
  //         bindRequest.productId = productId;
  //       }
  //     }

  //     const response = await firstValueFrom(
  //       this.deviceService.bindDataUnified(bindRequest)
  //     );

  //     const bindingType = isShelfBinding ? 'shelf' : 'product';
  //     this.showSuccess(`${bindingType.toUpperCase()} data successfully bound to device (no message)`);

  //   } catch (error: any) {
  //     console.error('Error in quick bind:', error);
  //     this.showError('Failed to quick bind: ' + error.message);
  //   } finally {
  //     this.bindingInProgress = false;
  //   }
  // }

  async bindMessageToDevice(): Promise<void> {
    if (!this.selectedAssignmentForBind || !this.selectedMessageId) {
      this.showWarning('Please select a message to bind');
      return;
    }

    this.bindingInProgress = true;

    try {
      const selectedMessage = this.availableMessages.find(
        (m) => m.id === this.selectedMessageId,
      );

      if (!selectedMessage) {
        throw new Error('Selected message not found');
      }

      const isShelfBinding =
        this.selectedAssignmentForBind.locationType.toLocaleUpperCase() ===
        'SHELF';

      let comboId: number | undefined;
      let comboType: 'TEMPLATE' | 'MESSAGE' = 'TEMPLATE';

      // Narrow the type. A MESSAGE row has no template combo of its own - the
      // server resolves the device's template from the message combo.
      if (this.selectedAssignmentForBind.assignmentType === 'TEMPLATE') {
        comboId =
          this.selectedAssignmentForBind.deviceTemplateComboId ?? undefined;
        comboType = 'TEMPLATE';
      } else {
        comboId =
          this.selectedAssignmentForBind.deviceMessageComboId ?? undefined;
        comboType = 'MESSAGE';
      }

      if (!comboId) {
        this.showError('This assignment has no device combo to bind against');
        return;
      }

      const bindRequest: UnifiedBindDataRequest = {
        comboId,
        comboType,
        bindingType: isShelfBinding ? 'shelf' : 'product',
        messageId: this.selectedMessageId,
        color: 1,
        total: 5,
        period: 500,
        interval: 900,
        brightness: 100,
      };

      if (isShelfBinding) {
        bindRequest.shelfId = this.selectedAssignmentForBind.locationId;
        bindRequest.shelfName = this.shelf.name;
        bindRequest.shelfCode = `SHELF-${this.shelf.id}`;
      } else {
        const productId = this.selectedAssignmentForBind.locationId;
        const product = this.assignedProducts.find((p) => p.id === productId);
        if (product) {
          bindRequest.productId = product.id;
        } else {
          bindRequest.productId = productId;
        }
      }

      const response = await firstValueFrom(
        this.deviceService.bindDataUnified(bindRequest),
      );

      const bindingType = isShelfBinding ? 'shelf' : 'product';
      this.showSuccess(
        `${bindingType.toUpperCase()} message "${selectedMessage.title}" successfully bound to device`,
      );

      this.closeBindDialog();
    } catch (error: any) {
      console.error('Error in bind message:', error);

      const errorMsg =
        typeof error === 'string' ? error : error?.message || 'Unknown error';

      this.showError('Failed to bind message: ' + errorMsg);

      // } catch (error: any) {
      //   console.error('Error binding message:', error);
      //   this.showError('Failed to bind message: ' + error.message);
    } finally {
      this.bindingInProgress = false;
    }
  }

  isDeviceQuickBinding(assignmentId: number): boolean {
    return this.quickBindingDevices.has(assignmentId);
  }
  //#endregion

  //#region Navigation (No changes needed)
  goBack(): void {
    this.router.navigate(['./aisle-management'], {
      relativeTo: this.route.parent,
    });
  }
  //#endregion

  //#region Toast/Snackbar Methods (No changes needed)
  private showSuccess(message: string): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: message,
      life: 5000,
    });
  }

  private showError(message: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000,
    });
  }

  private showWarning(message: string): void {
    this.messageService.add({
      severity: 'warn',
      summary: 'Warning',
      detail: message,
      life: 5000,
    });
  }

  private showInfo(message: string): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Info',
      detail: message,
      life: 5000,
    });
  }
  //#endregion
}
