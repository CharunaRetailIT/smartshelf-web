// product.service.ts
import { inject, Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { Observable, throwError, Subject, EMPTY } from 'rxjs';
import {
  catchError,
  map,
  debounceTime,
  distinctUntilChanged,
  expand,
  reduce,
} from 'rxjs/operators';
import { ProductDeviceInfo } from '../interfaces/shelf.interface';
import { ConfigService } from './app-config.service';
import { environment } from '../../../environments/environment';
import { HttpResponseData } from '../interfaces/http-response.interface';
import {
  ProductCategory,
  Product,
  ProductViewDto,
  ImportProductsResult,
} from '../interfaces/product.interface';
import {
  PagedResult,
  SearchParams,
} from '../interfaces/pagination-result.interface';
import {
  LocalDeviceDto,
  LocalTemplateDto,
  DeviceTemplateComboDto,
  AssignmentDto,
} from '../interfaces/device.interface';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private config = inject(ConfigService);
  private http = inject(HttpClient);

  private readonly API_URL =
    environment.apiUrl || 'https://localhost:44321/api';

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
      }),
    };
  }

  //#region Product API Methods

  /** Get products with pagination and search */
  getProductsPaged(
    searchParams: SearchParams,
  ): Observable<PagedResult<Product>> {
    let params = new HttpParams()
      .set('pageNumber', searchParams.pageNumber?.toString() || '1')
      .set('pageSize', searchParams.pageSize?.toString() || '10')
      .set('searchTerm', searchParams.searchTerm || '');
    if (searchParams.storeId !== undefined && searchParams.storeId !== null) {
      params = params.set('storeId', searchParams.storeId.toString());
    }
    if (
      searchParams.categoryId !== undefined &&
      searchParams.categoryId !== null
    ) {
      params = params.set('categoryId', searchParams.categoryId.toString());
    }
    if (
      searchParams.subcategoryId !== undefined &&
      searchParams.subcategoryId !== null
    ) {
      params = params.set(
        'subcategoryId',
        searchParams.subcategoryId.toString(),
      );
    }
    if (searchParams.isActive !== undefined && searchParams.isActive !== null) {
      params = params.set('isActive', searchParams.isActive.toString());
    }

    return this.http
      .get<
        HttpResponseData<PagedResult<Product>>
      >(`${this.API_URL}/products`, { params, observe: 'response' })
      .pipe(
        map((response) => {
          // Handle both 200 (success) and 404 (no results) as successful responses
          if (response.status === 200 || response.status === 404) {
            const body = response.body;
            if (body?.success && body.result) {
              return body.result;
            } else {
              throw new Error(
                body?.error || body?.message || 'Failed to load products',
              );
            }
          } else {
            throw new Error(`HTTP ${response.status}: Failed to load products`);
          }
        }),
        catchError(this.handleError),
      );
  }

  /** Get all products (legacy - consider removing) */
  getAllProducts(): Observable<Product[]> {
    return this.getProductsPaged({ pageNumber: 1, pageSize: 1000 }).pipe(
      map((pagedResult) => pagedResult.items),
    );
  }

  getAllProductsTemp(
    categoryId?: number,
    isActive?: boolean,
  ): Observable<Product[]> {
    return this.getProductsPage(1, categoryId, isActive).pipe(
      expand((pageResult) => {
        // If there are more pages, get the next one
        if (pageResult.totalPages > pageResult.pageNumber) {
          return this.getProductsPage(
            pageResult.pageNumber + 1,
            categoryId,
            isActive,
          );
        }
        return EMPTY;
      }),
      reduce((allProducts, pageResult) => {
        return [...allProducts, ...pageResult.items];
      }, [] as Product[]),
    );
  }

  private getProductsPage(
    pageNumber: number,
    categoryId?: number,
    isActive?: boolean,
  ): Observable<PagedResult<Product>> {
    let url = `${this.API_URL}/products`;
    const params: string[] = [`pageNumber=${pageNumber}`, `pageSize=100`];

    if (categoryId !== undefined) {
      params.push(`categoryId=${categoryId}`);
    }

    if (isActive !== undefined) {
      params.push(`isActive=${isActive}`);
    }

    url += '?' + params.join('&');

    return this.http.get<HttpResponseData<PagedResult<Product>>>(url).pipe(
      map((response) => {
        if (response.success && response.result) {
          return response.result;
        } else {
          throw new Error(
            response.error || response.message || 'Failed to load products',
          );
        }
      }),
      catchError(this.handleError),
    );
  }

  /** Get products with filters */
  getProductsWithFilters(
    categoryId?: number,
    isActive?: boolean,
  ): Observable<Product[]> {
    let url = `${this.API_URL}/products`;
    const params: string[] = [];

    if (categoryId !== undefined) {
      params.push(`categoryId=${categoryId}`);
    }

    if (isActive !== undefined) {
      params.push(`isActive=${isActive}`);
    }

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    return this.http.get<HttpResponseData<Product[]>>(url).pipe(
      map((response) => {
        if (response.success) {
          return response.result || response.results || [];
        } else {
          throw new Error(
            response.error ||
              response.message ||
              'Failed to load filtered products',
          );
        }
      }),
      catchError(this.handleError),
    );
  }

  /** Create a new product */
  createProduct(product: Product): Observable<Product> {
    return this.http
      .post<
        HttpResponseData<Product>
      >(`${this.API_URL}/products/product`, product, this.getHttpOptions())
      .pipe(
        map((response) => {
          if (response.success && response.result) {
            console.log('Product created successfully:', response.result);
            return response.result;
          } else {
            throw new Error(
              response.error || response.message || 'Failed to create product',
            );
          }
        }),
        catchError(this.handleError),
      );
  }

  /** Update an existing product */
  updateProduct(id: number, product: Product): Observable<Product> {
    console.log('Sending update for product ID:', id);
    console.log('Product data being sent:', JSON.stringify(product, null, 2));

    return this.http
      .put<
        HttpResponseData<Product>
      >(`${this.API_URL}/products/product/${id}`, product, this.getHttpOptions())
      .pipe(
        map((response) => {
          console.log('Update response received:', response);

          if (response.success) {
            // Even if result is null/undefined, the operation was successful
            if (response.result) {
              return response.result;
            } else {
              // Handle case where result might be null but operation succeeded
              // Return the original product or a minimal success response
              return product;
            }
          } else {
            // Only throw error if success is explicitly false
            throw new Error(
              response.message || response.error || 'Failed to update product',
            );
          }
        }),
        catchError(this.handleError),
      );
  }
  /** Delete a product */
  deleteProduct(id: number, storeId: number): Observable<boolean> {
    let params = new HttpParams().set('storeId', storeId.toString());
    return this.http
      .delete<
        HttpResponseData<boolean>
      >(`${this.API_URL}/products/product/${id}`, { params })
      .pipe(
        map((response) => {
          if (response.success) {
            return response.result || true;
          } else {
            throw new Error(
              response.error || response.message || 'Failed to delete product',
            );
          }
        }),
        catchError(this.handleError),
      );
  }

  /** Get products by category ID */
  getProductsByCategory(categoryId: number): Observable<Product[]> {
    return this.http
      .get<
        HttpResponseData<Product[]>
      >(`${this.API_URL}/products/category/${categoryId}`)
      .pipe(
        map((response) => {
          if (response.success) {
            return response.result || response.results || [];
          } else {
            throw new Error(
              response.error ||
                response.message ||
                `Failed to load products for category ${categoryId}`,
            );
          }
        }),
        catchError(this.handleError),
      );
  }

  /** Get a single product by ID */
  getProductById(id: number, storeId: number): Observable<Product> {
    let params = new HttpParams().set('storeId', storeId.toString());
    return this.http
      .get<
        HttpResponseData<Product>
      >(`${this.API_URL}/products/${id}`, { params })
      .pipe(
        map((response) => {
          if (response.success && response.result) {
            return response.result;
          } else {
            throw new Error(
              response.error ||
                response.message ||
                `Product with ID ${id} not found`,
            );
          }
        }),
        catchError(this.handleError),
      );
  }

  /** Get all active categories */
  getCategories(): Observable<ProductCategory[]> {
    return this.http
      .get<
        HttpResponseData<ProductCategory[]>
      >(`${this.API_URL}/products/all-categories`)
      .pipe(
        map((response) => {
          if (response.success) {
            return response.result || response.results || [];
          } else {
            throw new Error(
              response.error || response.message || 'Failed to load categories',
            );
          }
        }),
        catchError(this.handleError),
      );
  }

  /** Update product device information */
  updateProductDevice(
    productId: number,
    deviceInfo: ProductDeviceInfo,
    userId: number,
  ): Observable<boolean> {
    console.log('Updating product device info:', {
      productId,
      deviceInfo,
      userId,
    });

    return this.http
      .put<
        HttpResponseData<boolean>
      >(`${this.API_URL}/products/${productId}/user/${userId}/device`, deviceInfo, this.getHttpOptions())
      .pipe(
        map((response) => {
          if (response.success) {
            return response.result || true;
          } else {
            throw new Error(
              response.error ||
                response.message ||
                'Failed to update product device',
            );
          }
        }),
        catchError(this.handleError),
      );
  }

  /** Sync products in bulk */
  syncProducts(products: Product[]): Observable<boolean> {
    return this.http
      .post<
        HttpResponseData<boolean>
      >(`${this.API_URL}/products/sync`, products, this.getHttpOptions())
      .pipe(
        map((response) => {
          if (response.success) {
            return response.result || true;
          } else {
            throw new Error(
              response.error || response.message || 'Failed to sync products',
            );
          }
        }),
        catchError(this.handleError),
      );
  }

  /**
   * Create/update a product and all of its ESL device+template/message
   * assignments in one atomic backend transaction - if any part fails
   * (bad category, invalid device, etc.) nothing is saved.
   */
  createProductWithEsl(payload: {
    product: any;
    eslAssignments: any[];
    userId: number;
  }): Observable<Product> {
    return this.http
      .post<
        HttpResponseData<Product>
      >(`${this.API_URL}/products/with-esl`, payload, this.getHttpOptions())
      .pipe(
        map((response) => {
          if (response.success && response.result) {
            return response.result;
          }
          throw new Error(
            response.error ||
              response.message ||
              'Failed to create product with ESL assignments',
          );
        }),
        catchError(this.handleError),
      );
  }

  updateProductWithEsl(
    productId: number,
    payload: { product: any; eslAssignments: any[]; userId: number },
  ): Observable<Product> {
    return this.http
      .put<
        HttpResponseData<Product>
      >(`${this.API_URL}/products/${productId}/with-esl`, payload, this.getHttpOptions())
      .pipe(
        map((response) => {
          if (response.success && response.result) {
            return response.result;
          }
          throw new Error(
            response.error ||
              response.message ||
              'Failed to update product with ESL assignments',
          );
        }),
        catchError(this.handleError),
      );
  }

  //#endregion

  //#region Excel Import / Export

  /** Download the blank import template (with example row + categories reference sheet) */
  downloadImportTemplate(storeId: number): Observable<Blob> {
    const params = new HttpParams().set('storeId', storeId.toString());
    return this.http
      .get(`${this.API_URL}/products/import-template`, {
        params,
        responseType: 'blob',
      })
      .pipe(catchError(this.handleError));
  }

  /** Export all products (for the given store) to an Excel file */
  exportProducts(storeId: number, searchTerm: string = ''): Observable<Blob> {
    let params = new HttpParams().set('storeId', storeId.toString());
    if (searchTerm) {
      params = params.set('searchTerm', searchTerm);
    }
    return this.http
      .get(`${this.API_URL}/products/export`, {
        params,
        responseType: 'blob',
      })
      .pipe(catchError(this.handleError));
  }

  /** Bulk create/update products from an uploaded Excel file */
  importProducts(
    file: File,
    storeId: number,
    userId: number,
  ): Observable<ImportProductsResult> {
    const formData = new FormData();
    formData.append('file', file);

    const params = new HttpParams()
      .set('storeId', storeId.toString())
      .set('userId', userId.toString());

    return this.http
      .post<
        HttpResponseData<ImportProductsResult>
      >(`${this.API_URL}/products/import`, formData, { params })
      .pipe(
        map((response) => {
          if (response.success && response.result) {
            return response.result;
          }
          throw new Error(
            response.error || response.message || 'Failed to import products',
          );
        }),
        catchError(this.handleError),
      );
  }

  /** Trigger a browser download for a Blob returned by the API */
  downloadBlob(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  //#endregion

  //#region Error Handling
  private handleError(error: any): Observable<never> {
    console.error('Product Service Error:', error);

    let errorMessage = 'An unexpected error occurred';

    if (error instanceof HttpErrorResponse) {
      if (error.status === 404) {
        // Handle "no results" as a special case, not necessarily an error
        errorMessage = error.error?.message || 'No products found';
      } else if (error.error instanceof ErrorEvent) {
        errorMessage = `Network error: ${error.error.message}`;
      } else {
        const serverError = error.error;
        if (serverError && typeof serverError === 'object') {
          errorMessage =
            serverError.error ||
            serverError.message ||
            `Server error: ${error.status}`;
        } else {
          errorMessage = `HTTP error: ${error.status} - ${error.message}`;
        }
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    console.error('Product Service Error Details:', {
      message: errorMessage,
      originalError: error,
      timestamp: new Date().toISOString(),
    });

    return throwError(() => new Error(errorMessage));
  }
  //#endregion
}
