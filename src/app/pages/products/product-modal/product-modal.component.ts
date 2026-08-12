import {
  Component,
  OnInit,
  Inject,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  NgForm,
} from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

// PrimeNG Imports

import {
  Product,
  ProductCategory,
  ProductSubCategory,
} from '../../../core/interfaces/product.interface';
import {
  LocalDeviceDto,
  LocalTemplateDto,
  DeviceTemplateComboDto,
  AssignmentDto,
  DeviceAssignmentDto,
} from '../../../core/interfaces/device.interface';
import { ProductService } from '../../../core/services/product.service';
import { DeviceService } from '../../../core/services/device.service';
import { SettingsService } from '../../../core/services/settings.service';
import {
  CustomSnackbarComponent,
  SnackbarData,
} from '../../../shared/components/alert/custom-snackbar.component';
import {
  PagedResult,
  SearchParams,
} from '../../../core/interfaces/pagination-result.interface';
import {
  BehaviorSubject,
  debounceTime,
  distinctUntilChanged,
  Subject,
  firstValueFrom,
  Subscription,
} from 'rxjs';
import { CustomMessageService } from '../../../core/services/message.service';
import { MessageWithUser } from '../../../core/interfaces/message.interface';
import { ImportsModule } from '../../../imports/imports';
import { TruncatePipe } from '../../../pipes/truncate.pipe';
import { AuthService } from '../../../core/services/auth.service';
import { CategoryService } from '../../../core/services/category.service';
import { MessageService } from 'primeng/api';
import { HttpResponseData } from '../../../core/interfaces/http-response.interface';

// ============ INTERFACES ============
interface ComboModeOption {
  label: string;
  value: 'device-template' | 'device-message';
  icon: string;
}

interface DeviceComboForm {
  deviceId: number;
  templateId?: string;
  messageId?: number;
  displayOrder: number;
  isActive: boolean;
  isDefault?: boolean;
  deviceTemplateComboId?: number;
  deviceMessageComboId?: number;
  assignmentType?: 'TEMPLATE' | 'MESSAGE';
}

export interface ProductModalData {
  product?: Product;
  categories: ProductCategory[];
  subCategories: ProductSubCategory[];
  isEditMode: boolean;
}

interface ExistingComboForPrimeNG {
  id: number;
  deviceId: number;
  deviceName: string;
  deviceMac?: string;
  templateId: string;
  templateName: string;
  screenSize?: string;
  screenWidth?: number;
  screenHeight?: number;
  screenInch?: number;
  status: string;
  isDefault: boolean;
  battery?: number;
}

interface ExistingMessageComboForPrimeNG {
  id: number;
  deviceId: number;
  deviceName: string;
  deviceMac?: string;
  messageId: number;
  messageTitle: string;
  contentType?: number;
  duration?: number;
  status: string;
  isActive: boolean;
}

// Add this interface for device message combo search params
interface DeviceMessageComboSearchParams extends SearchParams {
  deviceId?: number;
  messageId?: number;
  isActive?: boolean;
}

@Component({
  selector: 'app-product-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ImportsModule,
    TruncatePipe,
  ],
  templateUrl: './product-modal.component.html',
  styleUrls: ['./product-modal.component.css'],
})
export class ProductModalComponent implements OnInit, AfterViewInit {
  @ViewChild('productFormEl') productFormEl!: NgForm;

  // ============ CATEGORY DROPDOWN PROPERTIES ============
  scrollheight: string = '300';
  categoryOptions: ProductCategory[] = [];
  categoryPagination = {
    pageNumber: 1,
    pageSize: 10,
    totalCount: 0,
    searchTerm: '',
    hasMore: true,
    loading: false,
  };

  // ============ SUBCATEGORY DROPDOWN PROPERTIES ============
  subCategoryOptions: ProductSubCategory[] = [];
  subCategoryPagination = {
    pageNumber: 1,
    pageSize: 10,
    totalCount: 0,
    searchTerm: '',
    hasMore: true,
    loading: false,
  };

  // ============ SUBCATEGORY LAZY LOAD STORE ============
  public subCategoryStore: { [categoryId: number]: ProductSubCategory[] } = {};
  public subCategoryPaginationStore: { [categoryId: number]: any } = {};

  // ============ FORM PROPERTIES ============
  productForm!: Product;
  loading = false;
  isEditMode = false;
  // categories: ProductCategory[] = [];
  // subCategories: ProductSubCategory[] = [];
  // filteredSubCategories: ProductSubCategory[] = [];
  isSubcategoryLoading = false;

  // ============ DEVICE ASSIGNMENT PROPERTIES ============
  deviceCombos: any[] = [];
  deviceComboGroups: FormGroup[] = [];
  isLoadingAssignments = false;
  deviceAssignments: AssignmentDto[] = [];

  // ============ DROPDOWN OPTIONS ============
  deviceOptions: { [key: number]: LocalDeviceDto[] } = {};
  templateOptions: { [key: number]: LocalTemplateDto[] } = {};
  messageOptions: { [key: number]: MessageWithUser[] } = {};
  unitOfMeasureOptions = [
    { label: 'Each', value: 'EA', supportsDecimal: false },
    { label: 'Piece', value: 'PC', supportsDecimal: false },
    { label: 'Pair', value: 'PR', supportsDecimal: false },
    { label: 'Set', value: 'SET', supportsDecimal: false },
    { label: 'Pack', value: 'PK', supportsDecimal: false },
    { label: 'Dozen', value: 'DZ', supportsDecimal: false },
    { label: 'Case', value: 'CS', supportsDecimal: false },
    { label: 'Box', value: 'BX', supportsDecimal: false },
    { label: 'Bag', value: 'BG', supportsDecimal: true },
    { label: 'Roll', value: 'RL', supportsDecimal: true },
    { label: 'Meter', value: 'M', supportsDecimal: true },
    { label: 'Centimeter', value: 'CM', supportsDecimal: true },
    { label: 'Kilogram', value: 'KG', supportsDecimal: true },
    { label: 'Gram', value: 'G', supportsDecimal: true },
    { label: 'Liter', value: 'L', supportsDecimal: true },
    { label: 'Milliliter', value: 'ML', supportsDecimal: true },
    { label: 'Foot', value: 'FT', supportsDecimal: true },
    { label: 'Inch', value: 'IN', supportsDecimal: true },
    { label: 'Yard', value: 'YD', supportsDecimal: true },
    { label: 'Square Meter', value: 'SQM', supportsDecimal: true },
    { label: 'Square Foot', value: 'SQFT', supportsDecimal: true },
    { label: 'Cubic Meter', value: 'CBM', supportsDecimal: true },
    { label: 'Unit', value: 'UNIT', supportsDecimal: false },
    { label: 'Bundle', value: 'BDL', supportsDecimal: false },
    { label: 'Pallet', value: 'PLT', supportsDecimal: false },
    { label: 'Carton', value: 'CTN', supportsDecimal: false },
  ];

  // ============ PAGINATION ============
  devicePagination: {
    [key: number]: {
      pageNumber: number;
      pageSize: number;
      totalCount: number;
      searchTerm: string;
      hasMore: boolean;
      loading: boolean;
    };
  } = {};
  templatePagination: {
    [key: number]: {
      pageNumber: number;
      pageSize: number;
      totalCount: number;
      searchTerm: string;
      hasMore: boolean;
      loading: boolean;
    };
  } = {};
  messagePagination: {
    [key: number]: {
      pageNumber: number;
      pageSize: number;
      totalCount: number;
      searchTerm: string;
      hasMore: boolean;
      loading: boolean;
    };
  } = {};

  // ============ COMBO MODE CONFIGURATION ============
  comboMode: 'device-template' | 'device-message' = 'device-template';
  comboModeOptions: ComboModeOption[] = [
    {
      label: 'Device + Template',
      value: 'device-template',
      icon: 'pi pi-sliders-h',
    },
    {
      label: 'Device + Message',
      value: 'device-message',
      icon: 'pi pi-comment',
    },
  ];

  // ============ EXISTING COMBO SELECTION ============
  // Device-Template Combos
  combosList: ExistingComboForPrimeNG[] = [];
  selectedExistingCombos: ExistingComboForPrimeNG[] = [];
  showPrimeNGCombos = false;
  currentComboPage = 1;
  comboPageSize = 10;
  hasMoreCombos = true;
  totalComboCount = 0;
  comboSearchTerm = '';
  existingComboLoading = false; // Add this

  // Device-Message Combos
  messageCombosList: ExistingMessageComboForPrimeNG[] = [];
  selectedExistingMessageCombos: ExistingMessageComboForPrimeNG[] = [];
  showPrimeNGMessageCombos = false;
  currentMessageComboPage = 1;
  messageComboPageSize = 10;
  hasMoreMessageCombos = true;
  totalMessageComboCount = 0;
  messageComboSearchTerm = '';
  existingMessageComboLoading = false; // Add this

  // ============ FILTER SUBJECTS ============
  private deviceFilterSubject = new Subject<string>();
  private templateFilterSubject = new Subject<string>();
  private messageFilterSubject = new Subject<string>();
  private comboFilterSubject = new Subject<string>();
  private messageComboFilterSubject = new Subject<string>();

  // ============ STORE CONFIG ============
  storeId: number = 0;

  // ============ MESSAGES ============
  messages: MessageWithUser[] = [];

  // ============ EXISTING ASSIGNMENTS ============
  allAssignments: any[] = [];

  // ============ DIALOG ============
  isDialogVisible = true;

  //Current user
  currentUserId: number = 0;

  //Disable form
  isFormDisabled = false;

  private subscriptions: Subscription = new Subscription();

  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private deviceService: DeviceService,
    private settingsService: SettingsService,
    private messageService: CustomMessageService,
    private primemessageService: MessageService,
    public auth: AuthService,
    private categoryService: CategoryService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ProductModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ProductModalData,
  ) {}

  // ============ LIFECYCLE METHODS ============
  ngOnInit(): void {
    this.initCurrentUser();
    this.setDefaultStore();
    this.initializeProductForm();
    this.setupFilterSubjects();
    this.loadInitialCategories();
    this.loadExistingAssignments();

    // Now you can use productFormEl
    if (!this.canEdit() && this.productFormEl) {
      this.productFormEl.form.disable();
    }
  }

  ngAfterViewInit(): void {
    // Apply form state after view is initialized
    setTimeout(() => {
      this.applyFormPermissions();
    });
  }

  applyFormPermissions(): void {
    if (!this.canEdit()) {
      this.disableEntireForm();
    }
  }

  disableEntireForm(): void {
    // Disable template-driven form
    if (this.productFormEl?.form) {
      this.productFormEl.form.disable();
    }

    // Disable reactive form groups for device combos
    this.deviceComboGroups.forEach((group, index) => {
      group.disable();
    });

    // Set readonly mode flag for UI indicators
    this.isFormDisabled = true;
  }

  enableEntireForm(): void {
    if (this.productFormEl?.form) {
      this.productFormEl.form.enable();
    }

    this.deviceComboGroups.forEach((group) => {
      group.enable();
    });

    this.isFormDisabled = false;
  }

  initCurrentUser() {
    const user = this.auth.getCurrentUserValue();
    if (!user) {
      this.showError('User not authenticated');
      return;
    }
    this.currentUserId = user.id;
  }

  canEdit(): boolean {
    return this.auth.hasAnyRole(['Admin', 'Manager', 'Operator']);
  }

  isReadOnlyMode(): boolean {
    return !this.canEdit();
  }

  getProductHeaderText(): string {
    if (!this.data?.product) {
      return 'Add New Product';
    }

    return this.canEdit() ? 'Edit Product' : 'View Product';
  }

  getProductDescriptionText(): string {
    if (!this.data?.product) {
      return 'Create a new product with complete details and pricing';
    }
    return this.canEdit()
      ? 'Update existing product information'
      : 'View product details and pricing';
  }

  // ============ CATEGORY METHODS ============
  private loadInitialCategories(): void {
    this.categoryPagination.loading = true;
    const params: SearchParams = {
      pageNumber: 1,
      pageSize: 10,
      storeId: this.storeId,
      searchTerm: '',
    };

    this.categoryService.getCategoriesPaged(params).subscribe({
      next: (response) => {
        // Response is already PagedResult<ProductCategory> after mapping
        this.categoryOptions = response.items || [];
        this.categoryPagination.totalCount = response.totalCount || 0;
        this.categoryPagination.hasMore =
          (response.items?.length || 0) < (response.totalCount || 0);
        this.categoryPagination.loading = false;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.categoryPagination.loading = false;
        this.showError('Failed to load categories');
      },
    });
  }

  loadMoreCategories(): void {
    if (this.categoryPagination.loading || !this.categoryPagination.hasMore)
      return;

    this.categoryPagination.loading = true;
    this.categoryPagination.pageNumber++;

    const params: SearchParams = {
      pageNumber: this.categoryPagination.pageNumber,
      pageSize: this.categoryPagination.pageSize,
      storeId: this.storeId,
      searchTerm: this.categoryPagination.searchTerm,
    };

    this.categoryService.getCategoriesPaged(params).subscribe({
      next: (response) => {
        const newCategories = response.items || [];
        this.categoryOptions = [...this.categoryOptions, ...newCategories];
        this.categoryPagination.hasMore =
          this.categoryOptions.length < (response.totalCount || 0);
        this.categoryPagination.loading = false;
      },
      error: (error) => {
        console.error('Error loading more categories:', error);
        this.categoryPagination.pageNumber--;
        this.categoryPagination.loading = false;
      },
    });
  }

  loadPreviousCategories(): void {
    if (
      this.categoryPagination.pageNumber <= 1 ||
      this.categoryPagination.loading
    )
      return;

    this.categoryPagination.loading = true;
    this.categoryPagination.pageNumber = Math.max(
      1,
      this.categoryPagination.pageNumber - 1,
    );

    const params: SearchParams = {
      pageNumber: this.categoryPagination.pageNumber,
      pageSize: this.categoryPagination.pageSize,
      storeId: this.storeId,
      searchTerm: this.categoryPagination.searchTerm,
    };

    this.categoryService.getCategoriesPaged(params).subscribe({
      next: (response: PagedResult<ProductCategory>) => {
        this.categoryOptions = response.items || [];
        this.categoryPagination.totalCount = response.totalCount || 0;
        this.categoryPagination.hasMore =
          this.categoryOptions.length < this.categoryPagination.totalCount;
        this.categoryPagination.loading = false;
      },
      error: (error) => {
        console.error('Error loading previous categories:', error);
        this.categoryPagination.loading = false;
      },
    });
  }

  onCategoryFilter(event: any): void {
    const searchTerm = event.filter || '';
    this.categoryPagination.searchTerm = searchTerm;
    this.categoryPagination.pageNumber = 1;
    this.loadInitialCategories();
  }

  // ============ SUBCATEGORY METHODS ============

  private loadSubCategoriesByCategory(
    categoryId: number,
    reset: boolean = true,
  ): void {
    console.log('Loading subcategories for categoryId:', categoryId);

    if (!categoryId) {
      this.subCategoryOptions = [];
      return;
    }

    // Check if we have cached data for this category
    if (!this.subCategoryStore[categoryId]) {
      this.subCategoryStore[categoryId] = [];
      this.subCategoryPaginationStore[categoryId] = {
        pageNumber: 1,
        pageSize: 10,
        totalCount: 0,
        searchTerm: '',
        hasMore: true,
        loading: false,
      };
    }

    const pagination = this.subCategoryPaginationStore[categoryId];

    if (reset) {
      pagination.pageNumber = 1;
      pagination.searchTerm = '';
      this.subCategoryStore[categoryId] = [];
    }

    pagination.loading = true;
    this.isSubcategoryLoading = true;

    const params: SearchParams = {
      pageNumber: pagination.pageNumber,
      pageSize: pagination.pageSize,
      categoryId: categoryId,
      storeId: this.storeId,
      searchTerm: pagination.searchTerm,
    };

    console.log('Subcategory API params:', params);

    this.categoryService.getSubCategoriesPaged(params).subscribe({
      next: (response: PagedResult<ProductSubCategory>) => {
        console.log('Subcategory API response:', response);

        const newSubCategories = response.items || [];

        if (reset) {
          this.subCategoryStore[categoryId] = newSubCategories;
        } else {
          this.subCategoryStore[categoryId] = [
            ...this.subCategoryStore[categoryId],
            ...newSubCategories,
          ];
        }

        this.subCategoryOptions = this.subCategoryStore[categoryId];
        pagination.totalCount = response.totalCount || 0;
        pagination.hasMore =
          this.subCategoryStore[categoryId].length < pagination.totalCount;

        console.log('Updated subCategoryOptions:', this.subCategoryOptions);
        console.log('Pagination:', pagination);

        // Ensure selected subcategory is in options
        const currentSubCategoryId = this.productForm.subCategoryId;
        if (
          currentSubCategoryId &&
          !this.subCategoryStore[categoryId].some(
            (s) => s.id === currentSubCategoryId,
          )
        ) {
          this.ensureSubCategoryInOptions(categoryId, currentSubCategoryId);
        }

        pagination.loading = false;
        this.isSubcategoryLoading = false;
      },
      error: (error) => {
        console.error('Error loading subcategories:', error);
        pagination.loading = false;
        this.isSubcategoryLoading = false;
        this.showError('Failed to load subcategories');
      },
    });
  }
  // private loadSubCategoriesByCategory(categoryId: number, reset: boolean = true): void {
  //   if (!categoryId) {
  //     this.subCategoryOptions = [];
  //     return;
  //   }

  //   // Check if we have cached data for this category
  //   if (!this.subCategoryStore[categoryId]) {
  //     this.subCategoryStore[categoryId] = [];
  //     this.subCategoryPaginationStore[categoryId] = {
  //       pageNumber: 1,
  //       pageSize: 10,
  //       totalCount: 0,
  //       searchTerm: '',
  //       hasMore: true,
  //       loading: false
  //     };
  //   }

  //   const pagination = this.subCategoryPaginationStore[categoryId];

  //   if (reset) {
  //     pagination.pageNumber = 1;
  //     pagination.searchTerm = '';
  //     this.subCategoryStore[categoryId] = [];
  //   }

  //   pagination.loading = true;

  //   const params: SearchParams = {
  //     pageNumber: pagination.pageNumber,
  //     pageSize: pagination.pageSize,
  //     categoryId: categoryId,
  //     storeId: this.storeId,
  //     searchTerm: pagination.searchTerm
  //   };

  //   this.categoryService.getSubCategoriesPaged(params).subscribe({
  //     next: (response) => {
  //       const newSubCategories = response.items || [];
  //       console.log("subcategory", newSubCategories)
  //       if (reset) {
  //         this.subCategoryStore[categoryId] = newSubCategories;
  //       } else {
  //         this.subCategoryStore[categoryId] = [...this.subCategoryStore[categoryId], ...newSubCategories];
  //       }

  //       this.subCategoryOptions = this.subCategoryStore[categoryId];
  //       pagination.totalCount = response.totalCount || 0;
  //       pagination.hasMore = this.subCategoryStore[categoryId].length < pagination.totalCount;

  //       // Ensure selected subcategory is in options
  //       const currentSubCategoryId = this.productForm.subCategoryId;
  //       if (currentSubCategoryId && !this.subCategoryStore[categoryId].some(s => s.id === currentSubCategoryId)) {
  //         this.ensureSubCategoryInOptions(categoryId, currentSubCategoryId);
  //       }

  //       pagination.loading = false;
  //     },
  //     error: (error) => {
  //       console.error('Error loading subcategories:', error);
  //       pagination.loading = false;
  //     }
  //   });
  // }

  loadMoreSubCategories(): void {
    const categoryId = this.productForm.categoryId;
    if (!categoryId) return;

    const pagination = this.getSubCategoryPagination();
    if (pagination.loading || !pagination.hasMore) return;

    pagination.pageNumber++;
    this.loadSubCategoriesByCategory(categoryId, false);
  }

  loadPreviousSubCategories(): void {
    const categoryId = this.productForm.categoryId;
    if (!categoryId) return;

    const pagination = this.getSubCategoryPagination();
    if (pagination.loading || pagination.pageNumber <= 1) return;

    pagination.pageNumber = Math.max(1, pagination.pageNumber - 1);
    this.loadSubCategoriesByCategory(categoryId, false);
  }

  onSubCategoryFilter(event: any): void {
    const categoryId = this.productForm.categoryId;
    if (!categoryId) return;

    const searchTerm = event.filter || '';
    const pagination = this.getSubCategoryPagination();

    pagination.searchTerm = searchTerm;
    pagination.pageNumber = 1;

    this.loadSubCategoriesByCategory(categoryId, true);
  }

  private ensureSubCategoryInOptions(
    categoryId: number,
    subCategoryId: number,
  ): void {
    const subCategoryInOptions = this.subCategoryStore[categoryId]?.some(
      (s) => s.id === subCategoryId,
    );
    if (!subCategoryInOptions && subCategoryId) {
      this.categoryService
        .getSubCategoryById(subCategoryId, this.storeId)
        .subscribe({
          next: (response) => {
            if (response.success && response.result) {
              const subCategory = response.result;
              if (!this.subCategoryStore[categoryId]) {
                this.subCategoryStore[categoryId] = [];
              }
              if (
                !this.subCategoryStore[categoryId].some(
                  (s) => s.id === subCategory.id,
                )
              ) {
                this.subCategoryStore[categoryId] = [
                  subCategory,
                  ...this.subCategoryStore[categoryId],
                ];
                this.subCategoryOptions = this.subCategoryStore[categoryId];
              }
            }
          },
          error: (error) => {
            console.error('Error loading subcategory details:', error);
          },
        });
    }
  }

  getSubCategoryPagination(): any {
    if (!this.productForm.categoryId) return null;
    return (
      this.subCategoryPaginationStore[this.productForm.categoryId] || {
        pageNumber: 1,
        pageSize: 10,
        totalCount: 0,
        searchTerm: '',
        hasMore: true,
        loading: false,
      }
    );
  }

  // Update the onCategoryChange method
  onCategoryChange(event: any): void {
    const categoryId = event.value;
    console.log('Category changed to:', categoryId);

    // Reset subcategory when category changes
    this.productForm.subCategoryId = 0;
    this.productForm.subCategoryName = '';

    if (categoryId) {
      // Load subcategories for the selected category
      this.loadSubCategoriesByCategory(categoryId, true);
    } else {
      // If no category selected, clear subcategories
      this.subCategoryOptions = [];
      console.log('Cleared subCategoryOptions');
    }
  }

  // ============ INITIALIZATION METHODS ============
  private initializeProductForm(): void {
    if (this.data && this.data.isEditMode && this.data.product) {
      this.isEditMode = true;
      // Safely handle old product data with missing properties

      const oldProduct = this.data.product;
      this.productForm = {
        ...oldProduct,
        categoryId: oldProduct.categoryId || 0,
        subCategoryId: oldProduct.subCategoryId || 0,
        discountPercentage: oldProduct.discountPercentage || 0,
        discountedPrice:
          oldProduct.discountedPrice ||
          this.calculateDiscountedPriceFromOldProduct(oldProduct),
        unitOfMeasure: oldProduct.unitOfMeasure || '',
        quantity: oldProduct.quantity || 0,
      };

      // Load category details if we have categoryId
      if (this.productForm.categoryId) {
        this.ensureCategoryInOptions(this.productForm.categoryId);
        this.loadSubCategoriesByCategory(this.productForm.categoryId);
      }

      // Load subcategory details if we have subCategoryId
      if (this.productForm.subCategoryId && this.productForm.categoryId) {
        this.ensureSubCategoryInOptions(
          this.productForm.categoryId,
          this.productForm.subCategoryId,
        );
      }
    } else {
      this.isEditMode = false;
      this.productForm = this.getEmptyProductForm();
      this.subCategoryOptions = [];
    }
  }

  private ensureCategoryInOptions(categoryId: number): void {
    const categoryInOptions = this.categoryOptions?.some(
      (c) => c.id === categoryId,
    );
    if (!categoryInOptions && categoryId) {
      this.categoryService.getCategoryById(categoryId, this.storeId).subscribe({
        next: (response: HttpResponseData<ProductCategory>) => {
          if (response.success && response.result) {
            const category = response.result;
            if (!this.categoryOptions.some((c) => c.id === category.id)) {
              this.categoryOptions = [category, ...this.categoryOptions];

              // Also update the productForm with the category name if needed
              if (
                this.productForm.categoryId === category.id &&
                !this.productForm.categoryName
              ) {
                this.productForm.categoryName = category.categoryName;
              }
            }
          }
        },
        error: (error) => {
          console.error('Error loading category details:', error);
          this.showError('Failed to load category details');
        },
      });
    }
  }

  onCategoryLazyLoad(event: any): void {
    const { first, rows, filter } = event;
    const pageNumber = Math.floor(first / rows) + 1;

    if (filter && filter !== this.categoryPagination.searchTerm) {
      this.categoryPagination.searchTerm = filter;
      this.loadInitialCategories();
    } else if (
      first + rows >= this.categoryOptions.length &&
      this.categoryPagination.hasMore
    ) {
      this.loadMoreCategories();
    }
  }

  onSubCategoryLazyLoad(event: any): void {
    const { first, rows, filter } = event;
    const categoryId = this.productForm.categoryId;

    if (!categoryId) return;

    const pagination = this.getSubCategoryPagination();
    if (!pagination) return;

    const pageNumber = Math.floor(first / rows) + 1;

    if (filter && filter !== pagination.searchTerm) {
      pagination.searchTerm = filter;
      this.loadSubCategoriesByCategory(categoryId, true);
    } else if (
      first + rows >= this.subCategoryOptions.length &&
      pagination.hasMore
    ) {
      this.loadMoreSubCategories();
    }
  }

  // Add this helper method to calculate discounted price from old product data
  private calculateDiscountedPriceFromOldProduct(oldProduct: any): number {
    if (!oldProduct) return 0;

    // If old product has discountPrice, use that
    if (oldProduct.discountPrice && oldProduct.discountPrice > 0) {
      const sellingPrice = oldProduct.sellingPrice || 0;
      return Math.max(0, sellingPrice - oldProduct.discountPrice);
    }

    // Otherwise, return selling price
    return oldProduct.sellingPrice || 0;
  }

  // Also update your getEmptyProductForm() to ensure all properties exist
  private getEmptyProductForm(): Product {
    const defaultStore = this.settingsService.getCurrentDefaultStore();
    return {
      id: 0,
      productCode: '',
      barCode: '',
      productName: '',
      quantity: 0,
      unitOfMeasure: '',
      categoryId: 0,
      subCategoryId: 0,
      categoryName: '',
      subCategoryName: '',
      costPrice: 0,
      sellingPrice: 0,
      discountPrice: 0,
      discountedPrice: 0,
      discountPercentage: 0,
      wholesalePrice: 0,
      minimumPrice: 0,
      maximumPrice: 0,
      description: '',
      isActive: true,
      createdUser: 0,
      updatedUser: 0,
      storeId: defaultStore?.id || undefined,
    };
  }

  // private getEmptyProductForm(): Product {
  //   const defaultStore = this.settingsService.getCurrentDefaultStore();
  //   return {
  //     id: 0,
  //     productCode: '',
  //     barCode: '',
  //     productName: '',
  //     quantity:0,
  //     unitOfMeasure:'',
  //     categoryId: 0,
  //     subCategoryId: 0,
  //     categoryName: '',
  //     subCategoryName: '',
  //     costPrice:0,
  //     sellingPrice: 0,
  //     discountPrice: 0,
  //     discountedPrice:0,
  //     discountPercentage:0,
  //     wholesalePrice: 0,
  //     minimumPrice: 0,
  //     maximumPrice: 0,
  //     description: '',
  //     isActive: true,
  //     createdUser: 0,
  //     updatedUser: 0,
  //     storeId: defaultStore?.id || undefined
  //   };
  // }

  private setDefaultStore(): void {
    const currentStore = this.settingsService.getCurrentDefaultStore();
    if (currentStore) {
      this.storeId = currentStore.id;
    }
  }

  private setupFilterSubjects(): void {
    // Combo filter with debounce
    this.comboFilterSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((searchTerm) => {
        this.loadPrimeNGCombos(1, searchTerm);
      });

    // Message combo filter with debounce
    this.messageComboFilterSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((searchTerm) => {
        this.loadPrimeNGMessageCombos(1, searchTerm);
      });
  }

  // ============ CATEGORY/SUBCATEGORY METHODS ============
  // private findCategoryIdByName(categoryName: string): number {
  //   if (!categoryName || !this.categories.length) return 0;
  //   const category = this.categories.find(cat => cat.categoryName.toLowerCase() === categoryName.toLowerCase());
  //   return category ? Number(category.id) : 0;
  // }

  // private findSubCategoryIdByName(subCategoryName: string): number {
  //   if (!subCategoryName || !this.subCategories.length) return 0;
  //   const subCategory = this.subCategories.find(sub => sub.subCategoryName.toLowerCase() === subCategoryName.toLowerCase());
  //   return subCategory ? Number(subCategory.id) : 0;
  // }

  // ============ EXISTING ASSIGNMENTS LOADING ============
  private async loadExistingAssignments(): Promise<void> {
    if (!this.productForm.id) return;

    this.isLoadingAssignments = true;

    try {
      const params: SearchParams = {
        pageNumber: 1,
        pageSize: 50,
        locationType: 'Product',
        locationId: this.productForm.id,
        storeId: this.storeId,
      };
      console.log('params', params);
      const response = await firstValueFrom(
        this.deviceService.getAssignmentsPaged(params),
      );
      console.log('assignments', response.items);
      if (response.items && response.items.length > 0) {
        this.allAssignments = response.items;
        this.processAssignmentsForCurrentMode();
      }
    } catch (error) {
      console.error('Error loading assignments:', error);
      this.showError('Failed to load existing assignments');
    } finally {
      this.isLoadingAssignments = false;
    }
  }

  private processAssignmentsForCurrentMode(): void {
    // Clear existing combos
    while (this.deviceComboGroups.length) {
      this.removeDeviceCombo(0);
    }

    // Filter assignments for current mode
    const filteredAssignments = this.allAssignments.filter(
      (a) =>
        (this.comboMode === 'device-template' &&
          a.assignmentType === 'TEMPLATE') ||
        (this.comboMode === 'device-message' && a.assignmentType === 'MESSAGE'),
    );

    // Process filtered assignments
    filteredAssignments.forEach((assignment, index) => {
      if (this.comboMode === 'device-template') {
        this.processTemplateAssignment(assignment, index);
      } else {
        this.processMessageAssignment(assignment, index);
      }
    });
  }

  private processTemplateAssignment(assignment: any, index: number): void {
    console.log('Processing template assignment:', assignment);

    const comboData: DeviceComboForm = {
      deviceId: assignment.deviceId,
      templateId: assignment.templateId || '',
      displayOrder: assignment.displayOrder || index + 1,
      isActive: assignment.isActive !== false,
      isDefault: assignment.displayOrder === 1,
      deviceTemplateComboId: assignment.deviceTemplateComboId,
      assignmentType: 'TEMPLATE',
    };

    // Add the combo first
    this.addDeviceCombo(comboData);

    // Then ensure the device and template are in options
    const comboIndex = this.deviceComboGroups.length - 1;

    // Ensure device is in options
    if (assignment.deviceId) {
      this.ensureDeviceInOptions(comboIndex, assignment.deviceId);
      // Set the device in the form control
      setTimeout(() => {
        this.deviceComboGroups[comboIndex].patchValue({
          deviceId: assignment.deviceId,
        });
      }, 100);
    }

    // Ensure template is in options
    if (assignment.templateId) {
      this.ensureTemplateInOptions(comboIndex, assignment.templateId);
      // Set the template in the form control
      setTimeout(() => {
        this.deviceComboGroups[comboIndex].patchValue({
          templateId: assignment.templateId,
        });
      }, 100);
    }

    console.log(
      'After processing - device combo group value:',
      this.deviceComboGroups[comboIndex].value,
    );
  }

  private processMessageAssignment(assignment: any, index: number): void {
    console.log('Processing message assignment:', assignment);

    const comboData: DeviceComboForm = {
      deviceId: assignment.deviceId,
      messageId: assignment.messageId || 0,
      displayOrder: assignment.displayOrder || index + 1,
      isActive: assignment.isActive !== false,
      isDefault: false,
      deviceMessageComboId: assignment.deviceMessageComboId,
      assignmentType: 'MESSAGE',
    };

    // Add the combo first
    this.addDeviceCombo(comboData);

    // Then ensure the device and message are in options
    const comboIndex = this.deviceComboGroups.length - 1;

    // Ensure device is in options
    if (assignment.deviceId) {
      this.ensureDeviceInOptions(comboIndex, assignment.deviceId);
      // Set the device in the form control
      setTimeout(() => {
        this.deviceComboGroups[comboIndex].patchValue({
          deviceId: assignment.deviceId,
        });
      }, 100);
    }

    // Ensure message is in options
    if (assignment.messageId) {
      this.ensureMessageInOptions(comboIndex, assignment.messageId);
      // Set the message in the form control
      setTimeout(() => {
        this.deviceComboGroups[comboIndex].patchValue({
          messageId: assignment.messageId,
        });
      }, 100);
    }

    console.log(
      'After processing - device combo group value:',
      this.deviceComboGroups[comboIndex].value,
    );
  }

  // private processTemplateAssignment(assignment: any, index: number): void {
  //   const comboData: DeviceComboForm = {
  //     deviceId: assignment.deviceId,
  //     templateId: assignment.templateId || '',
  //     displayOrder: assignment.displayOrder || index + 1,
  //     isActive: assignment.isActive !== false,
  //     isDefault: assignment.displayOrder === 1,
  //     deviceTemplateComboId: assignment.deviceTemplateComboId,
  //     assignmentType: 'TEMPLATE'
  //   };

  //   this.addDeviceCombo(comboData);
  // }

  // private processMessageAssignment(assignment: any, index: number): void {
  //   const comboData: DeviceComboForm = {
  //     deviceId: assignment.deviceId,
  //     messageId: assignment.messageId || 0,
  //     displayOrder: assignment.displayOrder || index + 1,
  //     isActive: assignment.isActive !== false,
  //     isDefault: false,
  //     deviceMessageComboId: assignment.deviceMessageComboId,
  //     assignmentType: 'MESSAGE'
  //   };

  //   this.addDeviceCombo(comboData);
  // }

  // ============ COMBO MODE HANDLING ============
  toggleComboMode(): void {
    // Store previous mode
    const previousMode = this.comboMode;

    // Clear existing combos
    while (this.deviceComboGroups.length) {
      this.removeDeviceCombo(0);
    }

    // Reset selections
    this.selectedExistingCombos = [];
    this.selectedExistingMessageCombos = [];

    // If we have stored assignments, process them for the new mode
    if (this.allAssignments && this.allAssignments.length > 0) {
      this.processAssignmentsForCurrentMode();
    } else {
      // Otherwise add a new empty combo
      this.addDeviceCombo();
    }
  }

  // ============ DEVICE COMBO METHODS ============
  addDeviceCombo(initialData?: DeviceComboForm): void {
    let comboGroup: FormGroup;

    if (this.comboMode === 'device-template') {
      comboGroup = this.fb.group({
        deviceId: [initialData?.deviceId || '', Validators.required],
        templateId: [initialData?.templateId || '', Validators.required],
        displayOrder: [
          initialData?.displayOrder || this.deviceCombos.length + 1,
          [Validators.required, Validators.min(1)],
        ],
        isActive: [
          initialData?.isActive !== undefined ? initialData.isActive : true,
        ],
        isDefault: [initialData?.isDefault || false],
        deviceTemplateComboId: [initialData?.deviceTemplateComboId || null],
        assignmentType: ['TEMPLATE'],
      });
    } else {
      comboGroup = this.fb.group({
        deviceId: [initialData?.deviceId || '', Validators.required],
        messageId: [initialData?.messageId || '', Validators.required],
        displayOrder: [
          initialData?.displayOrder || this.deviceCombos.length + 1,
          [Validators.required, Validators.min(1)],
        ],
        isActive: [
          initialData?.isActive !== undefined ? initialData.isActive : true,
        ],
        isDefault: [initialData?.isDefault || false],
        deviceMessageComboId: [initialData?.deviceMessageComboId || null],
        assignmentType: ['MESSAGE'],
      });
    }

    this.deviceComboGroups.push(comboGroup);
    this.deviceCombos.push(comboGroup.value);

    const index = this.deviceComboGroups.length - 1;
    this.initializeDropdownStates(index);
  }
  // addDeviceCombo(initialData?: DeviceComboForm): void {
  //   let comboGroup: FormGroup;

  //   if (this.comboMode === 'device-template') {
  //     comboGroup = this.fb.group({
  //       deviceId: [initialData?.deviceId || '', Validators.required],
  //       templateId: [initialData?.templateId || '', Validators.required],
  //       displayOrder: [initialData?.displayOrder || this.deviceCombos.length + 1, [Validators.required, Validators.min(1)]],
  //       isActive: [initialData?.isActive !== undefined ? initialData.isActive : true],
  //       isDefault: [initialData?.isDefault || false],
  //       deviceTemplateComboId: [initialData?.deviceTemplateComboId || null],
  //       assignmentType: ['TEMPLATE']
  //     });
  //   } else {
  //     comboGroup = this.fb.group({
  //       deviceId: [initialData?.deviceId || '', Validators.required],
  //       messageId: [initialData?.messageId || '', Validators.required],
  //       displayOrder: [initialData?.displayOrder || this.deviceCombos.length + 1, [Validators.required, Validators.min(1)]],
  //       isActive: [initialData?.isActive !== undefined ? initialData.isActive : true],
  //       isDefault: [initialData?.isDefault || false],
  //       deviceMessageComboId: [initialData?.deviceMessageComboId || null],
  //       assignmentType: ['MESSAGE']
  //     });
  //   }

  //   this.deviceComboGroups.push(comboGroup);
  //   const index = this.deviceComboGroups.length - 1;
  //   this.initializeDropdownStates(index);
  // }

  removeDeviceCombo(index: number): void {
    this.deviceComboGroups.splice(index, 1);
    this.deviceCombos.splice(index, 1);
    delete this.deviceOptions[index];
    delete this.templateOptions[index];
    delete this.messageOptions[index];
    delete this.devicePagination[index];
    delete this.templatePagination[index];
    delete this.messagePagination[index];
  }

  private initializeDropdownStates(index: number): void {
    // Get the current form values
    const formValues = this.deviceComboGroups[index]?.value;

    // Initialize device options and pagination
    this.deviceOptions[index] = [];
    this.devicePagination[index] = {
      pageNumber: 1,
      pageSize: 10,
      totalCount: 0,
      searchTerm: '',
      hasMore: true,
      loading: false,
    };

    // Load initial devices
    this.loadDevicesForCombo(index);

    // If there's already a deviceId in the form, ensure it's in options
    if (formValues?.deviceId) {
      this.ensureDeviceInOptions(index, formValues.deviceId);
    }

    // Initialize based on combo mode
    if (this.comboMode === 'device-template') {
      this.templateOptions[index] = [];
      this.templatePagination[index] = {
        pageNumber: 1,
        pageSize: 10,
        totalCount: 0,
        searchTerm: '',
        hasMore: true,
        loading: false,
      };

      // Load initial templates
      this.loadTemplatesForCombo(index);

      // If there's already a templateId in the form, ensure it's in options
      if (formValues?.templateId) {
        this.ensureTemplateInOptions(index, formValues.templateId);
      }
    } else {
      this.messageOptions[index] = [];
      this.messagePagination[index] = {
        pageNumber: 1,
        pageSize: 10,
        totalCount: 0,
        searchTerm: '',
        hasMore: true,
        loading: false,
      };

      // Load initial messages
      this.loadMessagesForCombo(index);

      // If there's already a messageId in the form, ensure it's in options
      if (formValues?.messageId) {
        this.ensureMessageInOptions(index, formValues.messageId);
      }
    }
  }
  // private initializeDropdownStates(index: number): void {
  //   // Initialize device options and pagination
  //   this.deviceOptions[index] = [];
  //   this.devicePagination[index] = {
  //     pageNumber: 1,
  //     pageSize: 10,
  //     totalCount: 0,
  //     searchTerm: '',
  //     hasMore: true,
  //     loading: false
  //   };

  //   // Load initial devices
  //   this.loadDevicesForCombo(index);

  //   // Initialize based on combo mode
  //   if (this.comboMode === 'device-template') {
  //     this.templateOptions[index] = [];
  //     this.templatePagination[index] = {
  //       pageNumber: 1,
  //       pageSize: 10,
  //       totalCount: 0,
  //       searchTerm: '',
  //       hasMore: true,
  //       loading: false
  //     };
  //     this.loadTemplatesForCombo(index);
  //   } else {
  //     this.messageOptions[index] = [];
  //     this.messagePagination[index] = {
  //       pageNumber: 1,
  //       pageSize: 10,
  //       totalCount: 0,
  //       searchTerm: '',
  //       hasMore: true,
  //       loading: false
  //     };
  //     this.loadMessagesForCombo(index);
  //   }
  // }

  // ============ DROPDOWN LOADING METHODS ============
  private loadDevicesForCombo(index: number, append: boolean = false): void {
    const pagination = this.devicePagination[index];
    if (pagination.loading) return;
    pagination.loading = true;

    const request: SearchParams = {
      pageNumber: pagination.pageNumber,
      pageSize: pagination.pageSize,
      searchTerm: pagination.searchTerm,
    };

    this.deviceService.getLocalDevicesPaged(request).subscribe({
      next: (response) => {
        if (response.success && response.result) {
          const newDevices = response.result.items || [];

          if (append) {
            this.deviceOptions[index] = [
              ...(this.deviceOptions[index] || []),
              ...newDevices,
            ];
          } else {
            this.deviceOptions[index] = newDevices;
          }

          pagination.totalCount = response.result.totalCount;
          pagination.hasMore = response.result.hasNextPage;

          // Ensure selected device is in options
          const currentDeviceId =
            this.deviceComboGroups[index]?.value?.deviceId;
          if (
            currentDeviceId &&
            !this.deviceOptions[index]?.some((d) => d.id === currentDeviceId)
          ) {
            this.ensureDeviceInOptions(index, currentDeviceId);
          }
        }
        pagination.loading = false;
      },
      error: (error) => {
        console.error('Error loading devices:', error);
        pagination.loading = false;
        this.showError('Failed to load devices');
      },
    });
  }

  private loadTemplatesForCombo(index: number, append: boolean = false): void {
    const pagination = this.templatePagination[index];
    if (pagination.loading) return;
    pagination.loading = true;

    const request: SearchParams = {
      pageNumber: pagination.pageNumber,
      pageSize: pagination.pageSize,
      searchTerm: pagination.searchTerm,
    };

    this.deviceService.getLocalTemplatesPaged(request).subscribe({
      next: (response) => {
        if (response.success && response.result) {
          const newTemplates = response.result.items || [];

          if (append) {
            this.templateOptions[index] = [
              ...(this.templateOptions[index] || []),
              ...newTemplates,
            ];
          } else {
            this.templateOptions[index] = newTemplates;
          }

          pagination.totalCount = response.result.totalCount;
          pagination.hasMore = response.result.hasNextPage;

          // Ensure selected template is in options
          const currentTemplateId =
            this.deviceComboGroups[index]?.value?.templateId;
          if (
            currentTemplateId &&
            !this.templateOptions[index]?.some(
              (t) => t.id === currentTemplateId,
            )
          ) {
            this.ensureTemplateInOptions(index, currentTemplateId);
          }
        }
        pagination.loading = false;
      },
      error: (error) => {
        console.error('Error loading templates:', error);
        pagination.loading = false;
        this.showError('Failed to load templates');
      },
    });
  }

  private loadMessagesForCombo(index: number, append: boolean = false): void {
    const pagination = this.messagePagination[index];
    if (pagination.loading) return;
    pagination.loading = true;

    const request: SearchParams = {
      pageNumber: pagination.pageNumber,
      pageSize: pagination.pageSize,
      searchTerm: pagination.searchTerm,
    };

    this.messageService.getMessagesPaged(request).subscribe({
      next: (response) => {
        if (response.success && response.result) {
          const newMessages = response.result.items || [];
          console.log('messages', newMessages);
          if (!this.messageOptions[index]) {
            this.messageOptions[index] = [];
          }

          if (append) {
            this.messageOptions[index] = [
              ...this.messageOptions[index],
              ...newMessages,
            ];
          } else {
            this.messageOptions[index] = newMessages;
          }

          pagination.totalCount = response.result.totalCount || 0;
          pagination.hasMore =
            this.messageOptions[index].length < pagination.totalCount;

          // Ensure selected message is in options
          const currentMessageId =
            this.deviceComboGroups[index]?.value?.messageId;
          if (
            currentMessageId &&
            !this.messageOptions[index]?.some((m) => m.id === currentMessageId)
          ) {
            this.ensureMessageInOptions(index, currentMessageId);
          }
        }
        pagination.loading = false;
      },
      error: (error) => {
        console.error('Error loading messages:', error);
        pagination.loading = false;
      },
    });
  }

  // private loadSubCategoriesByCategory(categoryId: number): void {
  //   console.log('Loading subcategories for categoryId:', categoryId);
  //   if (!categoryId) {
  //     this.filteredSubCategories = [];
  //     return;
  //   }

  //   this.isSubcategoryLoading = true;

  //   // Clear any existing subscription
  //   const subCatSub = this.categoryService.getSubCategoriesPaged({
  //     pageNumber: 1,
  //     pageSize: 100,
  //     categoryId: categoryId,
  //     storeId: this.storeId
  //   }).subscribe({
  //     next: (response) => {
  //       this.filteredSubCategories = response.items || [];
  //       this.isSubcategoryLoading = false;
  //       console.log('Loaded subcategories:', this.filteredSubCategories);
  //     },
  //     error: (error) => {
  //       console.error('Error loading subcategories:', error);
  //       this.filteredSubCategories = [];
  //       this.isSubcategoryLoading = false;
  //       this.showError('Failed to load subcategories');
  //     }
  //   });

  //   this.subscriptions.add(subCatSub);
  // }

  // ============ ENSURE SELECTED VALUES IN OPTIONS ============
  private ensureDeviceInOptions(index: number, deviceId: number): void {
    const deviceInOptions = this.deviceOptions[index]?.some(
      (d) => d.id === deviceId,
    );
    if (!deviceInOptions && deviceId) {
      this.deviceService.getDeviceById(deviceId).subscribe({
        next: (device) => {
          if (
            device &&
            !this.deviceOptions[index]?.some((d) => d.id === device.id)
          ) {
            this.deviceOptions[index] = [
              device,
              ...(this.deviceOptions[index] || []),
            ];
          }
        },
      });
    }
  }

  private ensureTemplateInOptions(index: number, templateId: string): void {
    const templateInOptions = this.templateOptions[index]?.some(
      (t) => t.id === templateId,
    );
    if (!templateInOptions && templateId) {
      this.deviceService.getTemplateById(templateId).subscribe({
        next: (template) => {
          if (
            template &&
            !this.templateOptions[index]?.some((t) => t.id === template.id)
          ) {
            this.templateOptions[index] = [
              template,
              ...(this.templateOptions[index] || []),
            ];
          }
        },
      });
    }
  }

  private ensureMessageInOptions(index: number, messageId: number): void {
    const messageInOptions = this.messageOptions[index]?.some(
      (m) => m.id === messageId,
    );
    if (!messageInOptions && messageId) {
      this.messageService.getMessageById(messageId, this.storeId).subscribe({
        next: (message) => {
          if (
            message &&
            !this.messageOptions[index]?.some((m) => m.id === message.id)
          ) {
            this.messageOptions[index] = [
              message,
              ...(this.messageOptions[index] || []),
            ];
          }
        },
      });
    }
  }

  // ============ EXISTING COMBO SELECTION (PRIMENG) ============
  togglePrimeNGCombos(): void {
    this.showPrimeNGCombos = !this.showPrimeNGCombos;
    if (this.showPrimeNGCombos && this.combosList.length === 0) {
      this.loadPrimeNGCombos();
    }
  }

  togglePrimeNGMessageCombos(): void {
    this.showPrimeNGMessageCombos = !this.showPrimeNGMessageCombos;
    if (this.showPrimeNGMessageCombos && this.messageCombosList.length === 0) {
      this.loadPrimeNGMessageCombos();
    }
  }

  loadPrimeNGCombos(pageNumber: number = 1, searchTerm: string = ''): void {
    if (pageNumber === 1) {
      this.currentComboPage = 1;
      this.combosList = [];
      this.hasMoreCombos = true;
    }

    const params: SearchParams = {
      pageNumber: pageNumber,
      pageSize: this.comboPageSize,
      searchTerm: searchTerm,
      sortBy: 'createdDate',
      sortDescending: true,
    };

    this.deviceService.getCombosPaged(params).subscribe({
      next: (response: any) => {
        if (response.success) {
          const newCombos = response.result.items;
          console.log('combos', newCombos);
          const mappedCombos: ExistingComboForPrimeNG[] = newCombos.map(
            (combo: any) => ({
              id: combo.id,
              deviceId: combo.deviceId,
              deviceName: combo.deviceName || 'Unknown Device',
              deviceMac: combo.deviceMac,
              templateId: combo.templateId,
              templateName: combo.templateName || 'Unknown Template',
              screenSize:
                combo.device?.screenSize ||
                `${combo.screenWidth}x${combo.screenHeight}`,
              screenWidth: combo.screenWidth,
              screenHeight: combo.screenHeight,
              screenInch: combo.screenInch,
              status: 'Active',
              isDefault: combo.isDefault || false,
              battery: combo.battery,
            }),
          );

          if (pageNumber === 1) {
            this.combosList = mappedCombos;
          } else {
            this.combosList = [...this.combosList, ...mappedCombos];
          }

          this.hasMoreCombos =
            this.currentComboPage < response.result.totalPages;
          this.currentComboPage = pageNumber;
          this.totalComboCount = response.result.totalCount || 0;
        }
      },
      error: (error) => {
        console.error('Error loading PrimeNG combos:', error);
        this.showError('Failed to load existing combos');
      },
    });
  }

  loadPrimeNGMessageCombos(
    pageNumber: number = 1,
    searchTerm: string = '',
  ): void {
    if (pageNumber === 1) {
      this.currentMessageComboPage = 1;
      this.messageCombosList = [];
      this.hasMoreMessageCombos = true;
    }

    // Fix the type error by using the extended interface
    const params: DeviceMessageComboSearchParams = {
      pageNumber: pageNumber,
      pageSize: this.messageComboPageSize,
      searchTerm: searchTerm,
      sortBy: 'createdDate',
      sortDescending: true,
      isActive: true,
    };

    this.deviceService.getDeviceMessageCombosPagedByParams(params).subscribe({
      next: (response: any) => {
        if (response.success) {
          const newCombos = response.result?.items || response.items || [];
          console.log('message combo', newCombos);
          const mappedCombos: ExistingMessageComboForPrimeNG[] = newCombos.map(
            (combo: any) => ({
              id: combo.id,
              deviceId: combo.deviceId,
              deviceName: combo.deviceName || 'Unknown Device',
              deviceMac: combo.deviceMac || combo.deviceMAC,
              messageId: combo.messageId,
              messageTitle: combo.messageTitle || 'Unknown Message',
              contentType: combo.contentType,
              duration: combo.duration,
              status: combo.isActive ? 'Active' : 'Inactive',
              isActive: combo.isActive !== false,
            }),
          );

          if (pageNumber === 1) {
            this.messageCombosList = mappedCombos;
          } else {
            this.messageCombosList = [
              ...this.messageCombosList,
              ...mappedCombos,
            ];
          }

          this.hasMoreMessageCombos =
            this.messageCombosList.length <
            (response.result?.totalCount || response.totalCount || 0);
          this.currentMessageComboPage = pageNumber;
          this.totalMessageComboCount =
            response.result?.totalCount || response.totalCount || 0;
        }
      },
      error: (error) => {
        console.error('Error loading PrimeNG message combos:', error);
        this.showError('Failed to load existing message combos');
      },
    });
  }

  // ============ ADD SELECTED EXISTING COMBOS ============
  addSelectedPrimeNGCombos(): void {
    if (this.comboMode === 'device-template') {
      if (this.selectedExistingCombos.length === 0) {
        this.showInfo('Please select at least one combo');
        return;
      }

      const selectedCombos = [...this.selectedExistingCombos];

      selectedCombos.forEach((combo) => {
        const existingIndex = this.deviceComboGroups.findIndex(
          (group) => group.get('deviceTemplateComboId')?.value === combo.id,
        );

        if (existingIndex === -1) {
          this.addDeviceCombo({
            deviceId: combo.deviceId,
            templateId: combo.templateId || '',
            displayOrder: this.deviceComboGroups.length + 1,
            isActive: true,
            isDefault: combo.isDefault,
            deviceTemplateComboId: combo.id,
            assignmentType: 'TEMPLATE',
          });
        }
      });

      this.showSuccess(
        `Added ${selectedCombos.length} template combo(s) from selection`,
      );
      this.selectedExistingCombos = [];
      this.showPrimeNGCombos = false;
    } else {
      if (this.selectedExistingMessageCombos.length === 0) {
        this.showInfo('Please select at least one message combo');
        return;
      }

      const selectedCombos = [...this.selectedExistingMessageCombos];

      selectedCombos.forEach((combo) => {
        const existingIndex = this.deviceComboGroups.findIndex(
          (group) => group.get('deviceMessageComboId')?.value === combo.id,
        );

        if (existingIndex === -1) {
          this.addDeviceCombo({
            deviceId: combo.deviceId,
            messageId: combo.messageId,
            displayOrder: this.deviceComboGroups.length + 1,
            isActive: combo.isActive,
            isDefault: false,
            deviceMessageComboId: combo.id,
            assignmentType: 'MESSAGE',
          });
        }
      });

      this.showSuccess(
        `Added ${selectedCombos.length} message combo(s) from selection`,
      );
      this.selectedExistingMessageCombos = [];
      this.showPrimeNGMessageCombos = false;
    }
  }

  // ============ SELECTED COMBO REMOVAL METHODS ============
  removeSelectedCombo(comboId: number): void {
    this.selectedExistingCombos = this.selectedExistingCombos.filter(
      (c) => c.id !== comboId,
    );
  }

  removeSelectedMessageCombo(comboId: number): void {
    this.selectedExistingMessageCombos =
      this.selectedExistingMessageCombos.filter((c) => c.id !== comboId);
  }

  // ============ DROPDOWN EVENT HANDLERS ============
  onDeviceFilter(event: any, index: number): void {
    const searchTerm = event.filter || '';
    this.devicePagination[index].searchTerm = searchTerm;
    this.devicePagination[index].pageNumber = 1;
    this.devicePagination[index].hasMore = true;
    this.loadDevicesForCombo(index);
  }

  onTemplateFilter(event: any, index: number): void {
    const searchTerm = event.filter || '';
    this.templatePagination[index].searchTerm = searchTerm;
    this.templatePagination[index].pageNumber = 1;
    this.templatePagination[index].hasMore = true;
    this.loadTemplatesForCombo(index);
  }

  onMessageFilter(event: any, index: number): void {
    const searchTerm = event.filter || '';
    if (!this.messagePagination[index]) {
      this.messagePagination[index] = {
        pageNumber: 1,
        pageSize: 10,
        totalCount: 0,
        searchTerm: '',
        hasMore: true,
        loading: false,
      };
    }
    this.messagePagination[index].searchTerm = searchTerm;
    this.messagePagination[index].pageNumber = 1;
    this.messagePagination[index].hasMore = true;
    this.loadMessagesForCombo(index);
  }

  onDeviceChange(event: any, index: number): void {
    const selectedDevice = event.value;
    if (selectedDevice) {
      const deviceId =
        typeof selectedDevice === 'object' ? selectedDevice.id : selectedDevice;
      const numericDeviceId =
        typeof deviceId === 'string' ? parseInt(deviceId, 10) : deviceId;

      this.deviceComboGroups[index].patchValue({
        deviceId: numericDeviceId,
      });
    }
  }

  onTemplateChange(event: any, index: number): void {
    const selectedTemplate = event.value;
    if (selectedTemplate) {
      const templateId =
        typeof selectedTemplate === 'object'
          ? selectedTemplate.id
          : selectedTemplate;

      this.deviceComboGroups[index].patchValue({
        templateId: templateId,
      });
    }
  }

  onMessageChange(event: any, index: number): void {
    const selectedMessage = event.value;
    if (selectedMessage) {
      const messageId =
        typeof selectedMessage === 'object'
          ? selectedMessage.id
          : selectedMessage;
      const numericMessageId =
        typeof messageId === 'string' ? parseInt(messageId, 10) : messageId;

      this.deviceComboGroups[index].patchValue({
        messageId: numericMessageId,
      });
    }
  }

  // onCategoryChange(event: any): void {
  //   const categoryId = event.value;

  //   // Reset subcategory when category changes
  //   this.productForm.subCategoryId = 0;
  //   this.productForm.subCategoryName = '';

  //   if (categoryId) {
  //     // Load subcategories for the selected category
  //     this.loadSubCategoriesByCategory(categoryId);
  //   } else {
  //     // If no category selected, clear subcategories
  //     this.filteredSubCategories = [];
  //   }
  // }

  onSellingPriceChange(): void {
    this.calculateDiscountedPrice();
  }

  // ============ LAZY LOADING HANDLERS ============
  onDeviceLazyLoad(event: any, index: number): void {
    const { first, rows } = event;
    const pageNumber = Math.floor(first / rows) + 1;

    const pagination = this.devicePagination[index];
    if (
      first + rows >= this.deviceOptions[index]?.length &&
      pagination.hasMore &&
      !pagination.loading
    ) {
      pagination.pageNumber = pageNumber;
      this.loadDevicesForCombo(index, true);
    }
  }

  onTemplateLazyLoad(event: any, index: number): void {
    const { first, rows } = event;
    const pageNumber = Math.floor(first / rows) + 1;

    const pagination = this.templatePagination[index];
    if (
      first + rows >= this.templateOptions[index]?.length &&
      pagination.hasMore &&
      !pagination.loading
    ) {
      pagination.pageNumber = pageNumber;
      this.loadTemplatesForCombo(index, true);
    }
  }

  onMessageLazyLoad(event: any, index: number): void {
    const { first, rows } = event;
    const pageNumber = Math.floor(first / rows) + 1;

    const pagination = this.messagePagination[index];
    if (
      first + rows >= this.messageOptions[index]?.length &&
      pagination.hasMore &&
      !pagination.loading
    ) {
      pagination.pageNumber = pageNumber;
      this.loadMessagesForCombo(index, true);
    }
  }

  onCombosLazyLoad(event: any): void {
    const { first, rows, filter } = event;
    const pageNumber = Math.floor(first / rows) + 1;

    if (filter && filter !== this.comboSearchTerm) {
      this.comboSearchTerm = filter;
      this.loadPrimeNGCombos(1, filter);
    } else if (first + rows >= this.combosList.length && this.hasMoreCombos) {
      this.loadPrimeNGCombos(pageNumber + 1, this.comboSearchTerm);
    }
  }

  onMessageCombosLazyLoad(event: any): void {
    const { first, rows, filter } = event;
    const pageNumber = Math.floor(first / rows) + 1;

    if (filter && filter !== this.messageComboSearchTerm) {
      this.messageComboSearchTerm = filter;
      this.loadPrimeNGMessageCombos(1, filter);
    } else if (
      first + rows >= this.messageCombosList.length &&
      this.hasMoreMessageCombos
    ) {
      this.loadPrimeNGMessageCombos(
        pageNumber + 1,
        this.messageComboSearchTerm,
      );
    }
  }

  // ============ HELPER METHODS ============
  getDeviceComboFieldError(index: number, fieldName: string): string {
    const control = this.deviceComboGroups[index].get(fieldName);
    if (control?.invalid && control?.touched) {
      if (control.errors?.['required']) return 'This field is required';
    }
    return '';
  }

  findDeviceById(deviceId: number): LocalDeviceDto | undefined {
    for (const key in this.deviceOptions) {
      const device = this.deviceOptions[key].find((d) => d.id === deviceId);
      if (device) return device;
    }
    return undefined;
  }

  findTemplateById(templateId: string): LocalTemplateDto | undefined {
    for (const key in this.templateOptions) {
      const template = this.templateOptions[key].find(
        (t) => t.id === templateId,
      );
      if (template) return template;
    }
    return undefined;
  }

  // Add this method to fix the template error
  getTemplateById(templateId: string): LocalTemplateDto | undefined {
    return this.findTemplateById(templateId);
  }

  getMessageById(messageId: number): MessageWithUser | undefined {
    for (const key in this.messageOptions) {
      const message = this.messageOptions[key].find((m) => m.id === messageId);
      if (message) return message;
    }
    return undefined;
  }

  getDeviceName(deviceId: number): string {
    const device = this.findDeviceById(deviceId);
    return device ? device.deviceName : '';
  }

  getDeviceMac(deviceId: number): string {
    const device = this.findDeviceById(deviceId);
    return device ? device.mac : '';
  }

  getTemplateName(templateId: string): string {
    const template = this.findTemplateById(templateId);
    return template ? template.name : '';
  }

  getMessageTitle(messageId: number): string {
    const message = this.getMessageById(messageId);
    return message ? message.title : `Message ID: ${messageId}`;
  }

  getDeviceStatus(deviceId: number): string {
    const device = this.findDeviceById(deviceId);
    return device ? device.status : '';
  }

  getContentTypeString(contentType: number): string {
    const types: { [key: number]: string } = {
      0: 'General',
      1: 'Image',
      2: 'Video',
      3: 'Custom Image',
    };
    return types[contentType] || 'General';
  }

  // ============ COMPARISON FUNCTIONS FOR DROPDOWNS ============
  compareDeviceIds(device1: any, device2: any): boolean {
    if (!device1 || !device2) return false;

    const id1 = typeof device1 === 'object' ? device1.id : device1;
    const id2 = typeof device2 === 'object' ? device2.id : device2;

    const num1 = typeof id1 === 'string' ? parseInt(id1, 10) : Number(id1);
    const num2 = typeof id2 === 'string' ? parseInt(id2, 10) : Number(id2);

    return num1 === num2;
  }

  compareTemplateIds(template1: any, template2: any): boolean {
    if (!template1 || !template2) return false;

    const id1 = typeof template1 === 'object' ? template1.id : template1;
    const id2 = typeof template2 === 'object' ? template2.id : template2;

    return String(id1) === String(id2);
  }

  compareMessageIds(message1: any, message2: any): boolean {
    if (!message1 || !message2) return false;

    const id1 = typeof message1 === 'object' ? message1.id : message1;
    const id2 = typeof message2 === 'object' ? message2.id : message2;

    const num1 = typeof id1 === 'string' ? parseInt(id1, 10) : Number(id1);
    const num2 = typeof id2 === 'string' ? parseInt(id2, 10) : Number(id2);

    return num1 === num2;
  }

  // Calculate discounted price based on discount percentage or discount amount
  calculateDiscountedPrice(): void {
    if (this.productForm.discountPercentage > 0) {
      const discountAmount =
        (this.productForm.sellingPrice * this.productForm.discountPercentage) /
        100;
      this.productForm.discountedPrice = Math.max(
        0,
        this.productForm.sellingPrice - discountAmount,
      );
      this.productForm.discountPrice = discountAmount;
    } else {
      // If discount percentage is 0, use discountPrice if provided
      this.productForm.discountedPrice = Math.max(
        0,
        this.productForm.sellingPrice - this.productForm.discountPrice,
      );
    }
  }

  // Calculate discount percentage based on discount amount
  calculateDiscountPercentage(): void {
    if (
      this.productForm.sellingPrice > 0 &&
      this.productForm.discountPrice > 0
    ) {
      this.productForm.discountPercentage =
        (this.productForm.discountPrice / this.productForm.sellingPrice) * 100;
      this.productForm.discountedPrice = Math.max(
        0,
        this.productForm.sellingPrice - this.productForm.discountPrice,
      );
    } else {
      this.productForm.discountPercentage = 0;
      this.productForm.discountedPrice = this.productForm.sellingPrice;
    }
  }
  private calculateDiscountedPriceValue(): number {
    if (this.productForm.discountPercentage > 0) {
      const discountAmount =
        (this.productForm.sellingPrice * this.productForm.discountPercentage) /
        100;
      return Math.max(0, this.productForm.sellingPrice - discountAmount);
    } else if (this.productForm.discountPrice > 0) {
      return Math.max(
        0,
        this.productForm.sellingPrice - this.productForm.discountPrice,
      );
    }
    return this.productForm.sellingPrice;
  }

  // Helper method to get quantity step based on unit of measure
  getQuantityStep(): number {
    const selectedUnit = this.unitOfMeasureOptions.find(
      (unit) => unit.value === this.productForm.unitOfMeasure,
    );

    if (selectedUnit?.supportsDecimal) {
      return 0.001; // Allow 3 decimal places for precise measurements
    } else {
      return 1; // Integer only for discrete items
    }
  }

  // Helper to get unit label
  getUnitLabel(unitValue: string): string {
    const unit = this.unitOfMeasureOptions.find((u) => u.value === unitValue);
    return unit?.label || unitValue;
  }

  // Method to handle unit of measure change
  onUnitOfMeasureChange(): void {
    // If unit doesn't support decimals, round quantity to nearest integer
    const selectedUnit = this.unitOfMeasureOptions.find(
      (unit) => unit.value === this.productForm.unitOfMeasure,
    );

    if (!selectedUnit?.supportsDecimal && this.productForm.quantity % 1 !== 0) {
      this.productForm.quantity = Math.round(this.productForm.quantity);
    }
  }

  // Get fraction digits based on unit
  getQuantityFractionDigits(): number {
    const selectedUnit = this.unitOfMeasureOptions.find(
      (unit) => unit.value === this.productForm.unitOfMeasure,
    );

    return selectedUnit?.supportsDecimal ? 3 : 0;
  }
  // ============ SUBMIT METHODS ============
  onSubmit(): void {
    if (this.loading) return;
    this.loading = true;

    if (this.isEditMode) {
      this.handleEditModeSubmit();
    } else {
      this.handleCreateModeSubmit();
    }
  }

  private handleCreateModeSubmit(): void {
    this.productService
      .createProduct({
        ...this.productForm,
        createdUser: this.currentUserId,
        updatedUser: this.currentUserId,
      })
      .subscribe({
        next: (newProduct) => {
          this.handleDeviceTemplateAssignment(
            newProduct.id,
            this.currentUserId,
          );
        },
        error: (error) => {
          console.error('Error creating product:', error);
          this.loading = false;
          this.showError('Failed to create product');
        },
      });
  }

  private handleEditModeSubmit(): void {
    const productId = this.productForm.id;
    this.productService
      .updateProduct(productId, {
        ...this.productForm,
        updatedUser: this.currentUserId,
      })
      .subscribe({
        next: (updatedProduct) => {
          this.handleDeviceTemplateAssignment(
            updatedProduct.id,
            this.currentUserId,
          );
        },
        error: (error) => {
          console.error('Error updating product:', error);
          this.loading = false;
          this.showError('Failed to update product');
        },
      });
  }

  isSubcategoryDisabled(): boolean {
    if (!this.isEditMode) {
      return !this.productForm.categoryId;
    }
    return false;
  }

  private handleDeviceTemplateAssignment(
    productId: number,
    userId: number,
  ): void {
    const validCombos = this.deviceComboGroups
      .filter((group) => group.valid)
      .map((group) => group.value)
      .filter(
        (combo) => combo.deviceId && (combo.templateId || combo.messageId),
      );

    if (validCombos.length === 0) {
      this.loading = false;
      this.showSuccess('Product saved successfully');
      this.dialogRef.close(true);
      return;
    }

    this.handleMultipleAssignments(productId, userId, validCombos);
  }

  private handleMultipleAssignments(
    productId: number,
    userId: number,
    combos: any[],
  ): void {
    const assignmentPromises = combos.map((combo) => {
      if (combo.assignmentType === 'TEMPLATE') {
        return this.handleTemplateAssignment(productId, userId, combo);
      } else {
        return this.handleMessageAssignment(productId, userId, combo);
      }
    });

    Promise.all(assignmentPromises)
      .then(() => {
        this.loading = false;
        this.showSuccess('Product saved successfully');
        this.dialogRef.close(true);
      })
      .catch((error) => {
        console.error('Error assigning combos:', error);
        this.loading = false;
        this.showSuccess('Product saved, but some assignments may have failed');
        this.dialogRef.close(true);
      });
  }

  private handleTemplateAssignment(
    productId: number,
    userId: number,
    combo: any,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (combo.deviceTemplateComboId && combo.deviceTemplateComboId > 0) {
        this.deviceService
          .assignComboToLocationWithDetails(
            'TEMPLATE',
            combo.deviceTemplateComboId,
            'Product',
            productId,
            userId,
            combo.displayOrder,
            this.storeId,
            combo.isActive,
          )
          .subscribe({
            next: (assignment) => resolve(assignment),
            error: (error) => reject(error),
          });
      } else {
        this.deviceService
          .createDeviceTemplateCombo(
            combo.deviceId,
            combo.templateId,
            combo.isDefault || false,
          )
          .subscribe({
            next: (newCombo) => {
              this.deviceService
                .assignComboToLocationWithDetails(
                  'TEMPLATE',
                  newCombo.id,
                  'Product',
                  productId,
                  userId,
                  combo.displayOrder,
                  this.storeId,
                  combo.isActive,
                )
                .subscribe({
                  next: (assignment) => resolve(assignment),
                  error: (error) => reject(error),
                });
            },
            error: (error) => reject(error),
          });
      }
    });
  }

  private handleMessageAssignment(
    productId: number,
    userId: number,
    combo: any,
  ): Promise<any> {
    console.log('Handling message assignment for combo:', combo);
    return new Promise((resolve, reject) => {
      if (combo.deviceMessageComboId && combo.deviceMessageComboId > 0) {
        this.deviceService
          .assignComboToLocationWithDetails(
            'MESSAGE',
            combo.deviceMessageComboId,
            'Product',
            productId,
            userId,
            combo.displayOrder,
            this.storeId,
            combo.isActive,
          )
          .subscribe({
            next: (assignment) => resolve(assignment),
            error: (error) => reject(error),
          });
      } else {
        this.deviceService
          .createDeviceMessageCombo({
            deviceId: combo.deviceId,
            messageId: combo.messageId,
            storeId: this.storeId,
            isActive: combo.isActive,
          })
          .subscribe({
            next: (response) => {
              if (response.success && response.result) {
                this.deviceService
                  .assignComboToLocationWithDetails(
                    'MESSAGE',
                    response.result.id,
                    'Product',
                    productId,
                    userId,
                    combo.displayOrder,
                    this.storeId,
                    combo.isActive,
                  )
                  .subscribe({
                    next: (assignment) => resolve(assignment),
                    error: (error) => reject(error),
                  });
              } else {
                reject(new Error('Failed to create message combo'));
              }
            },
            error: (error) => reject(error),
          });
      }
    });
  }

  // ============ BIND DATA METHOD ============
  bindDataToDevice(): void {
    // Implement this method based on your requirements
    this.showInfo('Bind data functionality not implemented');
  }

  // ============ DIALOG METHODS ============
  onCancel(): void {
    this.dialogRef.close(false);
  }

  // ============ SNACKBAR METHODS ============
  private showSuccess(message: string): void {
    this.primemessageService.add({
      severity: 'success',
      summary: 'Success',
      detail: message,
      life: 5000,
    });
  }

  private showError(message: string): void {
    this.primemessageService.add({
      severity: 'error',
      summary: 'Error',
      detail: message,
      life: 5000,
    });
  }

  private showWarning(message: string): void {
    this.primemessageService.add({
      severity: 'warn',
      summary: 'Warning',
      detail: message,
      life: 5000,
    });
  }

  private showInfo(message: string): void {
    this.primemessageService.add({
      severity: 'info',
      summary: 'Info',
      detail: message,
      life: 5000,
    });
  }
  // private showSuccess(message: string): void {
  //   this.openSnackbar({ message: message, icon: 'fa-check-circle', type: 'success' });
  // }

  // private showError(message: string): void {
  //   this.openSnackbar({ message: message, icon: 'fas fa-times-circle', type: 'error' });
  // }

  // private showInfo(message: string): void {
  //   this.openSnackbar({ message: message, icon: 'fa-info-circle', type: 'info' });
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
}
