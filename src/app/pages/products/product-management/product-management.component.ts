// product-management.component.ts
import {
  Component,
  OnInit,
  ViewChild,
  AfterViewInit,
  TemplateRef,
  inject,
} from '@angular/core';
import {
  ProductCategory,
  Product,
  ProductSubCategory,
} from '../../../core/interfaces/product.interface';
import { ProductService } from '../../../core/services/product.service';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CategoryService } from '../../../core/services/category.service';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { debounceTime, distinctUntilChanged, forkJoin, Subject } from 'rxjs';
import { CategoryModalComponent } from '../category-modal/category-modal.component';
import { SubcategoryModalComponent } from '../subcategory-modal/subcategory-modal.component';
import { SearchParams } from '../../../core/interfaces/pagination-result.interface';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { DeleteConfirmationComponent } from '../../../shared/components/dialog/delete-confirmation/delete-confirmation.component';
import { MinewService } from '../../../core/services/minew.service';
import {
  CustomSnackbarComponent,
  SnackbarData,
} from '../../../shared/components/alert/custom-snackbar.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CreateProductComponent } from '../create-product/create-product.component';
import { DialogService } from 'primeng/dynamicdialog';
import { AuthService } from '../../../core/services/auth.service';
import { ImportsModule } from '../../../imports/imports';
import { SettingsService } from '../../../core/services/settings.service';
import { MessageService } from 'primeng/api';
import { ActivatedRoute, Router } from '@angular/router';
import { DeviceService } from '../../../core/services/device.service';
import { DeviceAssignmentDto } from '../../../core/interfaces/device.interface';

@Component({
  selector: 'app-product-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    ReactiveFormsModule,
    ImportsModule,
  ],
  providers: [DialogService],
  templateUrl: './product-management.component.html',
  styleUrl: './product-management.component.css',
})
export class ProductManagementComponent implements OnInit {
  private messageService = inject(MessageService);

  /**
   * Each grid is lazy, and PrimeNG emits one onLazyLoad as it initialises.
   * `loadAllData()` already fetches the first page of all three tabs on init,
   * so that very first event is swallowed rather than repeating the request.
   */
  private categoryGridReady = false;
  private subCategoryGridReady = false;
  private productGridReady = false;

  activeTab: 'categories' | 'subcategories' | 'products' = 'categories';

  // Categories - Server-side pagination
  categories: ProductCategory[] = [];
  categoryDataSource: ProductCategory[] = [];
  categoryDisplayedColumns = [
    'name',
    'code',
    'description',
    'status',
    'created',
    'actions',
  ];
  categorySearchTerm = '';
  categoryTotalCount = 0;
  categoryPageSize = 10;
  categoryPageSizeOptions = [5, 10, 20];
  categoryCurrentPage = 0;
  loadingCategories = false;
  categorySearchMessage = '';
  hasCategoryResults = true;

  // SubCategories - Server-side pagination
  subCategories: ProductSubCategory[] = [];
  subCategoryDataSource: ProductSubCategory[] = [];
  subCategoryDisplayedColumns = [
    'name',
    'category',
    'code',
    'description',
    'status',
    'actions',
  ];
  subCategorySearchTerm = '';
  subCategoryTotalCount = 0;
  subCategoryPageSize = 10;
  subCategoryPageSizeOptions = [5, 10, 20];
  subCategoryCurrentPage = 0;
  loadingSubCategories = false;
  subCategorySearchMessage = '';
  hasSubCategoryResults = true;

  // Products - Server-side pagination
  products: Product[] = [];
  productDataSource: Product[] = [];
  productDisplayedColumns = [
    'name',
    'code',
    'barcode',
    'category',
    'price',
    'status',
    'actions',
  ];
  productSearchTerm = '';
  productTotalCount = 0;
  productPageSize = 10;
  productPageSizeOptions = [5, 10, 20, 50];
  productCurrentPage = 0;
  loadingProducts = false;
  productSearchMessage = '';
  hasProductResults = true;
  showProductModal = false;
  editingProduct: Product | null = null;

  // Search subjects for debouncing
  private categorySearchSubject = new Subject<string>();
  private subCategorySearchSubject = new Subject<string>();
  private productSearchSubject = new Subject<string>();

  //minew sync
  loading = false;
  syncing = false;

  //excel import/export
  exporting = false;
  importing = false;
  @ViewChild('importFileInput') importFileInput: any;

  //Current user
  currentUserId: number = 0;

  //Default stroe
  storeId: number = 0;

  constructor(
    private productService: ProductService,
    private categoryService: CategoryService,
    private minewService: MinewService,
    private snackBar: MatSnackBar,
    public auth: AuthService,
    private settingsService: SettingsService,
    private dialog: MatDialog,
    private dialogService: DialogService,
    private router: Router,
    private route: ActivatedRoute,
    private deviceService: DeviceService,
  ) {
    // Setup search with debounce for all tabs
    this.categorySearchSubject
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe((searchTerm) => {
        this.categorySearchTerm = searchTerm;
        this.loadCategories();
      });

    this.subCategorySearchSubject
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe((searchTerm) => {
        this.subCategorySearchTerm = searchTerm;
        this.loadSubCategories();
      });

    this.productSearchSubject
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe((searchTerm) => {
        this.productSearchTerm = searchTerm;
        this.loadProducts();
      });
  }

  ngOnInit(): void {
    this.initCurrentUser();
    this.setDefaultStore();
    if (!this.currentUserId || !this.storeId) {
      this.showError('Missing user or store');
      return;
    }

    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'categories' || tab === 'subcategories' || tab === 'products') {
      this.activeTab = tab;
    }

    this.loadAllData();
  }
  loadAllData() {
    this.loadCategories();
    this.loadSubCategories();
    this.loadProducts();
  }

  setDefaultStore() {
    const currentStore = this.settingsService.getCurrentDefaultStore();
    if (currentStore) {
      this.storeId = currentStore.id;
    }
  }

  initCurrentUser() {
    const user = this.auth.getCurrentUserValue();
    if (!user) {
      this.showError('User not authenticated');
      return;
    }
    this.currentUserId = user.id;
  }

  // Categories with Server-side Pagination
  loadCategories(): void {
    this.loadingCategories = true;
    this.categorySearchMessage = '';
    this.hasCategoryResults = true;

    const searchParams: SearchParams = {
      pageNumber: this.categoryCurrentPage + 1,
      pageSize: this.categoryPageSize,
      searchTerm: this.categorySearchTerm,
      storeId: this.storeId,
    };
    this.categoryService.getCategoriesPaged(searchParams).subscribe({
      next: (pagedResult) => {
        this.categories = pagedResult.items;
        this.categoryDataSource = this.categories;
        this.categoryTotalCount = pagedResult.totalCount;
        this.hasCategoryResults = pagedResult.totalCount > 0;

        console.log('categoriees', this, this.categories);
        // Set appropriate message
        if (pagedResult.totalCount === 0 && this.categorySearchTerm) {
          this.categorySearchMessage = `No categories found matching "${this.categorySearchTerm}". Try different keywords.`;
        } else if (pagedResult.totalCount === 0) {
          this.categorySearchMessage = 'No categories available.';
        } else if (this.categorySearchTerm) {
          this.categorySearchMessage = `Found ${pagedResult.totalCount} category(s) matching "${this.categorySearchTerm}"`;
        } else {
          this.categorySearchMessage = `Showing ${pagedResult.totalCount} category(s)`;
        }

        this.loadingCategories = false;
      },
      error: (error) => {
        console.error('Error loading categories:', error);

        if (error.message.includes('No categories found')) {
          this.categories = [];
          this.categoryDataSource = [];
          this.categoryTotalCount = 0;
          this.hasCategoryResults = false;
          this.categorySearchMessage = error.message;
        } else {
          this.categorySearchMessage =
            'Error loading categories. Please try again.';
        }

        this.loadingCategories = false;
      },
    });
  }

  onCategoryLazyLoad(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? this.categoryPageSize;
    this.categoryPageSize = rows;
    this.categoryCurrentPage = Math.floor((event.first ?? 0) / rows);
    if (!this.categoryGridReady) {
      this.categoryGridReady = true;
      return;
    }
    this.loadCategories();
  }

  onCategorySearchChange(searchTerm: string): void {
    this.categorySearchSubject.next(searchTerm);
  }

  searchCategories(): void {
    this.categoryCurrentPage = 0;
    this.loadCategories();
  }

  clearCategorySearch(): void {
    this.categorySearchTerm = '';
    this.categoryCurrentPage = 0;
    this.loadCategories();
  }

  openCategoryModal(category?: ProductCategory): void {
    console.log('Opening category modal with:', category); // Debug log

    const dialogRef = this.dialog.open(CategoryModalComponent, {
      width: '600px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      panelClass: 'custom-dialog-container',
      data: {
        category: category ? { ...category } : undefined, // Pass a copy
        isEditMode: !!category,
      },
    });

    dialogRef.afterClosed().subscribe((result: boolean) => {
      console.log('Category modal closed with result:', result);
      if (result) {
        this.loadCategories();
      }
    });
  }
  // openCategoryModal(category?: ProductCategory): void {
  //   const dialogRef = this.dialog.open(CategoryModalComponent, {
  //     width: '600px',
  //     maxWidth: '90vw',
  //     maxHeight: '90vh',
  //     panelClass: 'custom-dialog-container',
  //     data: {
  //       category: category || null,
  //       isEditMode: !!category
  //     }
  //   });

  //   dialogRef.afterClosed().subscribe((result: boolean) => {
  //     console.log('Category modal closed with result:', result);
  //     if (result) {
  //       this.loadCategories();
  //     }
  //   });
  // }

  deleteCategory(category: ProductCategory): void {
    console.log('Attempting to delete user:', category);
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Delete Category',
        message: `Are you sure you want to delete ${category.categoryCode}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      },
      panelClass: ['rounded-lg'],
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;
      this.categoryService
        .deleteCategory(category.id!, this.storeId)
        .subscribe({
          next: () => {
            this.showSuccess(
              `Category ${category.categoryCode} deleted successfully`,
            );
            this.loadCategories();
          },
          error: (error) => {
            console.error('Error deleting category:', error);
            this.showError(
              `Failed to delete category ${category.categoryCode}. Please try again.`,
            );
          },
        });
    });
  }

  // deleteCategory(category: ProductCategory): void {
  //   if (confirm(`Are you sure you want to delete category "${category.categoryName}"?`)) {
  //     this.categoryService.deleteCategory(category.id!).subscribe({
  //       next: () => this.loadCategories(),
  //       error: (error) => console.error('Error deleting category:', error)
  //     });
  //   }
  // }

  // SubCategories with Server-side Pagination
  loadSubCategories(): void {
    this.loadingSubCategories = true;
    this.subCategorySearchMessage = '';
    this.hasSubCategoryResults = true;

    const searchParams: SearchParams = {
      pageNumber: this.subCategoryCurrentPage + 1,
      pageSize: this.subCategoryPageSize,
      searchTerm: this.subCategorySearchTerm,
      storeId: this.storeId,
    };

    this.categoryService.getSubCategoriesPaged(searchParams).subscribe({
      next: (pagedResult) => {
        this.subCategories = pagedResult.items;
        this.subCategoryDataSource = this.subCategories;
        this.subCategoryTotalCount = pagedResult.totalCount;
        this.hasSubCategoryResults = pagedResult.totalCount > 0;

        // Set appropriate message
        if (pagedResult.totalCount === 0 && this.subCategorySearchTerm) {
          this.subCategorySearchMessage = `No subcategories found matching "${this.subCategorySearchTerm}". Try different keywords.`;
        } else if (pagedResult.totalCount === 0) {
          this.subCategorySearchMessage = 'No subcategories available.';
        } else if (this.subCategorySearchTerm) {
          this.subCategorySearchMessage = `Found ${pagedResult.totalCount} subcategory(s) matching "${this.subCategorySearchTerm}"`;
        } else {
          this.subCategorySearchMessage = `Showing ${pagedResult.totalCount} subcategory(s)`;
        }

        this.loadingSubCategories = false;
      },
      error: (error) => {
        console.error('Error loading subcategories:', error);

        if (error.message.includes('No subcategories found')) {
          this.subCategories = [];
          this.subCategoryDataSource = [];
          this.subCategoryTotalCount = 0;
          this.hasSubCategoryResults = false;
          this.subCategorySearchMessage = error.message;
        } else {
          this.subCategorySearchMessage =
            'Error loading subcategories. Please try again.';
        }

        this.loadingSubCategories = false;
      },
    });
  }

  onSubCategoryLazyLoad(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? this.subCategoryPageSize;
    this.subCategoryPageSize = rows;
    this.subCategoryCurrentPage = Math.floor((event.first ?? 0) / rows);
    if (!this.subCategoryGridReady) {
      this.subCategoryGridReady = true;
      return;
    }
    this.loadSubCategories();
  }

  onSubCategorySearchChange(searchTerm: string): void {
    this.subCategorySearchSubject.next(searchTerm);
  }

  searchSubCategories(): void {
    this.subCategoryCurrentPage = 0;
    this.loadSubCategories();
  }

  clearSubCategorySearch(): void {
    this.subCategorySearchTerm = '';
    this.subCategoryCurrentPage = 0;
    this.loadSubCategories();
  }

  // Updated openSubCategoryModal method
  openSubCategoryModal(subCategory?: ProductSubCategory): void {
    const dialogRef = this.dialog.open(SubcategoryModalComponent, {
      width: '600px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      panelClass: 'custom-dialog-container',
      data: {
        subCategory: subCategory || null,
        categories: this.categories,
        isEditMode: !!subCategory,
      },
    });

    dialogRef.afterClosed().subscribe((result: boolean) => {
      console.log('Subcategory modal closed with result:', result);
      if (result) {
        this.loadSubCategories();
      }
    });
  }

  deleteSubCategory(subCategory: ProductSubCategory): void {
    console.log('Attempting to delete user:', subCategory);
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Delete Subcategory',
        message: `Are you sure you want to delete ${subCategory.subCategoryCode}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      },
      panelClass: ['rounded-lg'],
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;

      this.categoryService
        .deleteSubCategory(subCategory.id!, this.storeId)
        .subscribe({
          next: () => {
            this.showSuccess(
              `Subcategory ${subCategory.subCategoryCode} deleted successfully`,
            );
            this.loadSubCategories();
          },
          error: (error) => {
            console.error('Error deleting subcategory:', error);
            this.showError(
              `Failed to delete subcategory ${subCategory.subCategoryCode}. Please try again.`,
            );
          },
        });
    });
  }

  // deleteSubCategory(subCategory: ProductSubCategory): void {
  //   if (confirm(`Are you sure you want to delete subcategory "${subCategory.subCategoryName}"?`)) {
  //     this.categoryService.deleteSubCategory(subCategory.id!).subscribe({
  //       next: () => this.loadSubCategories(),
  //       error: (error) => console.error('Error deleting subcategory:', error)
  //     });
  //   }
  // }

  // Products with Server-side Pagination
  loadProducts(): void {
    this.loadingProducts = true;
    this.productSearchMessage = '';
    this.hasProductResults = true;

    const searchParams: SearchParams = {
      pageNumber: this.productCurrentPage + 1,
      pageSize: this.productPageSize,
      searchTerm: this.productSearchTerm,
    };

    this.productService.getProductsPaged(searchParams).subscribe({
      next: (pagedResult) => {
        this.products = pagedResult.items;
        console.log('products', this.products);
        this.productDataSource = this.products;
        this.productTotalCount = pagedResult.totalCount;
        this.hasProductResults = pagedResult.totalCount > 0;
        console.log('products', this.products);
        // Set appropriate message
        if (pagedResult.totalCount === 0 && this.productSearchTerm) {
          this.productSearchMessage = `No products found matching "${this.productSearchTerm}". Try different keywords.`;
        } else if (pagedResult.totalCount === 0) {
          this.productSearchMessage = 'No products available.';
        } else if (this.productSearchTerm) {
          this.productSearchMessage = `Found ${pagedResult.totalCount} product(s) matching "${this.productSearchTerm}"`;
        } else {
          this.productSearchMessage = `Showing ${pagedResult.totalCount} product(s)`;
        }

        this.loadingProducts = false;
      },
      error: (error) => {
        console.error('Error loading products:', error);

        if (error.message.includes('No products found')) {
          this.products = [];
          this.productDataSource = [];
          this.productTotalCount = 0;
          this.hasProductResults = false;
          this.productSearchMessage = error.message;
        } else {
          this.productSearchMessage =
            'Error loading products. Please try again.';
        }

        this.loadingProducts = false;
      },
    });
  }

  onProductLazyLoad(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? this.productPageSize;
    this.productPageSize = rows;
    this.productCurrentPage = Math.floor((event.first ?? 0) / rows);
    if (!this.productGridReady) {
      this.productGridReady = true;
      return;
    }
    this.loadProducts();
  }

  onProductSearchChange(searchTerm: string): void {
    this.productSearchSubject.next(searchTerm);
  }

  searchProducts(): void {
    this.productCurrentPage = 0;
    this.loadProducts();
  }

  clearProductSearch(): void {
    this.productSearchTerm = '';
    this.productCurrentPage = 0;
    this.loadProducts();
  }

  // ============ ESL BIND / DEVICE LIST (per product row) ============
  bindingProductId: number | null = null;
  deviceListDialogVisible = false;
  @ViewChild('deviceListDialogTpl') deviceListDialogTpl!: TemplateRef<unknown>;
  private deviceListDialogRef?: MatDialogRef<unknown>;
  deviceListLoading = false;
  deviceListProduct: Product | null = null;
  deviceListItems: DeviceAssignmentDto[] = [];

  private getProductAssignments(productId: number) {
    const params: SearchParams = {
      pageNumber: 1,
      pageSize: 100,
      locationType: 'Product',
      locationId: productId,
      storeId: this.storeId,
    };
    return this.deviceService.getAssignmentsPaged(params);
  }

  // Binds every ESL template assignment for this product to Minew, one
  // device at a time, through the same /device/bind-unified endpoint the
  // per-row "Bind" button on the product edit page already uses. That
  // endpoint resolves the device's own store (and its MinewStoreId) straight
  // from the DeviceTemplateCombos -> Device -> StoreMaster chain server-side,
  // so unlike the earlier batchBindAndUpdateWithTemplate approach it never
  // depends on the frontend's cached "default store" setting - which may not
  // even be the store this product's devices actually belong to.
  bindProductEsl(product: Product): void {
    if (!product?.id || this.bindingProductId) return;

    this.bindingProductId = product.id;

    this.getProductAssignments(product.id).subscribe({
      next: (response) => {
        const items = response?.items || [];
        const bindableRows = items.filter(
          (a) => a.assignmentType === 'TEMPLATE' && a.deviceTemplateComboId,
        );

        if (bindableRows.length === 0) {
          this.bindingProductId = null;
          this.showError(
            'No ESL template assignments to bind for this product.',
          );
          return;
        }

        const binds = bindableRows.map((a) =>
          this.deviceService.bindDataUnified({
            comboId: a.deviceTemplateComboId as number,
            comboType: 'TEMPLATE',
            bindingType: 'product',
            productId: product.id,
            messageId: 0,
            color: 1,
            total: 5,
            period: 500,
            interval: 900,
            brightness: 100,
          }),
        );

        forkJoin(binds).subscribe({
          next: () => {
            this.bindingProductId = null;
            this.showSuccess(
              `Bound ${bindableRows.length} ESL device(s) to Minew for "${product.productName}".`,
            );
          },
          error: (error) => {
            this.bindingProductId = null;
            console.error(error);
            const detail = typeof error === 'string' ? error : error?.message;
            this.showError(detail || 'Failed to bind ESL devices to Minew');
          },
        });
      },
      error: (error) => {
        this.bindingProductId = null;
        console.error(error);
        this.showError('Failed to load device assignments');
      },
    });
  }

  // Opens a popup listing every device assigned to this product.
  openDeviceListDialog(product: Product): void {
    if (!product?.id) return;

    this.deviceListProduct = product;
    this.deviceListItems = [];
    this.deviceListLoading = true;
    this.deviceListDialogVisible = true;
    this.deviceListDialogRef = this.dialog.open(this.deviceListDialogTpl, {
      width: '32rem',
      maxWidth: '95vw',
      maxHeight: '90vh',
    });
    this.deviceListDialogRef.afterClosed().subscribe(() => {
      this.deviceListDialogVisible = false;
      this.deviceListDialogRef = undefined;
    });

    this.getProductAssignments(product.id).subscribe({
      next: (response) => {
        this.deviceListItems = response?.items || [];
        this.deviceListLoading = false;
      },
      error: (error) => {
        console.error(error);
        this.deviceListLoading = false;
        this.showError('Failed to load assigned devices');
      },
    });
  }

  closeDeviceListDialog(): void {
    this.deviceListDialogRef?.close();
    this.deviceListDialogVisible = false;
    this.deviceListProduct = null;
    this.deviceListItems = [];
  }

  getAssignmentBindingLabel(item: DeviceAssignmentDto): string {
    return item.assignmentType === 'TEMPLATE'
      ? item.templateName || 'Template'
      : item.messageTitle || 'Message';
  }

  //sync to cloud
  syncToCloud(): void {
    this.loading = true;
    this.syncing = true;
    this.minewService.syncProducts(this.storeId).subscribe({
      next: (res) => {
        this.loading = false;
        this.syncing = false;
        this.showSuccess(res?.message ?? 'Products synced successfully');
      },
      error: (err) => {
        const errorMessage = err?.error?.message ?? 'Failed to sync to cloud';
        this.showError(errorMessage);
        this.loading = false;
        this.syncing = false;
      },
    });

    // if (unsyncedProducts.length === 0) {
    //   this.loading = false;
    //   this.showSuccess('All products are already synced to the cloud.');
    //   return;
    // }
  }
  //#region Excel Import / Export

  downloadImportTemplate(): void {
    this.productService.downloadImportTemplate(this.storeId).subscribe({
      next: (blob) => {
        this.saveBlobAsFile(blob, 'product-import-template.xlsx');
      },
      error: (error) => {
        console.error('Error downloading template:', error);
        this.showError('Failed to download import template. Please try again.');
      },
    });
  }

  exportProducts(): void {
    this.exporting = true;
    this.productService
      .exportProducts(this.storeId, this.productSearchTerm)
      .subscribe({
        next: (blob) => {
          this.exporting = false;
          const stamp = new Date().toISOString().slice(0, 10);
          this.saveBlobAsFile(blob, `products-export-${stamp}.xlsx`);
        },
        error: (error) => {
          this.exporting = false;
          console.error('Error exporting products:', error);
          this.showError('Failed to export products. Please try again.');
        },
      });
  }

  triggerImportFile(): void {
    this.importFileInput?.nativeElement?.click();
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importing = true;
    this.productService
      .importProducts(file, this.storeId, this.currentUserId)
      .subscribe({
        next: (result) => {
          this.importing = false;
          input.value = '';

          if (result.failed > 0) {
            this.showWarning(
              `Import finished: ${result.created} created, ${result.updated} updated, ${result.failed} failed. See console for row-level errors.`,
            );
            console.warn('Product import errors:', result.errors);
          } else {
            this.showSuccess(
              `Import finished: ${result.created} created, ${result.updated} updated.`,
            );
          }

          this.loadProducts();
        },
        error: (error) => {
          this.importing = false;
          input.value = '';
          console.error('Error importing products:', error);
          this.showError(
            error?.message || 'Failed to import products. Please try again.',
          );
        },
      });
  }

  private saveBlobAsFile(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  //#endregion

  openAddProductModal(): void {
    this.router.navigate(['/products/create']);
  }
  openEditProductModal(product: Product): void {
    this.router.navigate(['/products/edit', product.id]);
  }

  // Updated openProductModal method
  // openProductModal(product?: Product): void {
  //   console.log('Opening product modal with:', product); // Debug log
  //   const dialogRef = this.dialog.open(CreateProductComponent, {
  //     width: '800px',
  //     maxWidth: '90vw',
  //     maxHeight: '90vh',
  //     panelClass: 'custom-dialog-container',
  //     data: {
  //       product: product || null,
  //       categories: this.categories,
  //       subCategories: this.subCategories,
  //       isEditMode: !!product
  //     }
  //   });

  //   dialogRef.afterClosed().subscribe((result: boolean) => {
  //     console.log('Product modal closed with result:', result);
  //     if (result) {
  //       this.loadProducts();
  //     }
  //   });
  // }

  deleteProduct(product: Product): void {
    console.log('Attempting to delete Product:', product);
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: {
        title: 'Delete Product',
        message: `Are you sure you want to delete ${product.productCode}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      },
      panelClass: ['rounded-lg'],
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;
      this.productService.deleteProduct(product.id, this.storeId).subscribe({
        next: () => {
          this.showSuccess(
            `Product ${product.productCode} deleted successfully`,
          );
          this.loadProducts();
        },
        error: (error) => {
          console.error('Error deleting product:', error);
          this.showError(
            `Failed to delete product ${product.productCode}. Please try again.`,
          );
        },
      });
    });
  }

  // deleteProduct(product: Product): void {
  //   if (confirm(`Are you sure you want to delete product "${product.productName}"?`)) {
  //     this.productService.deleteProduct(product.id).subscribe({
  //       next: () => this.loadProducts(),
  //       error: (error) => console.error('Error deleting product:', error)
  //     });
  //   }
  // }

  // Helper methods
  getCategoryName(categoryId: number): string {
    const category = this.categories.find((c) => c.id === categoryId);
    return category ? category.categoryName : 'N/A';
  }

  getStatusColor(isActive: boolean): string {
    return isActive
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-red-100 text-red-800 border-red-200';
  }

  onTabChange(tab: 'categories' | 'subcategories' | 'products'): void {
    this.activeTab = tab;
    // Reload data when switching tabs
    if (tab === 'categories') {
      this.loadCategories();
    } else if (tab === 'subcategories') {
      this.loadSubCategories();
    } else if (tab === 'products') {
      this.loadProducts();
    }
  }
  //#region Snackbar Methods
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

  createProduct() {
    this.router.navigate(['/products/create']);
  }
}
