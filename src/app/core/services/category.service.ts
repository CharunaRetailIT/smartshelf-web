// category.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ConfigService } from './app-config.service';
import { environment } from '../../../environments/environment';
import { HttpResponseData } from '../interfaces/http-response.interface';
import { ProductCategory, ProductSubCategory } from '../interfaces/product.interface';
import { PagedResult, SearchParams } from '../interfaces/pagination-result.interface';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private config = inject(ConfigService);
  private http = inject(HttpClient);

  private readonly API_URL = environment.apiUrl || 'https://localhost:44321/api';

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  //#region Category Handling with Pagination

  /** Get categories with pagination and search */
  // getCategoriesPaged(searchParams: SearchParams): Observable<PagedResult<ProductCategory>> {
  //   let params = new HttpParams()
  //     .set('pageNumber', searchParams.pageNumber?.toString() || '1')
  //     .set('pageSize', searchParams.pageSize?.toString() || '10')
  //     .set('searchTerm', searchParams.searchTerm || '')
  //     if (searchParams.storeId != null) {
  //       params = params.set('storeId', searchParams.storeId.toString());
  //     }
  //   return this.http.get<HttpResponseData<PagedResult<ProductCategory>>>(
  //     `${this.API_URL}/products/all-categories`,
  //     { params, observe: 'response' }
  //   ).pipe(
  //     map(response => {
  //       if (response.status === 200 || response.status === 404) {
  //         const body = response.body;
  //         if (body?.success && body.result) {
  //           return body.result;
  //         } else {
  //           throw new Error(body?.error || body?.message || 'Failed to load categories');
  //         }
  //       } else {
  //         throw new Error(`HTTP ${response.status}: Failed to load categories`);
  //       }
  //     }),
  //     catchError(this.handleError)
  //   );
  // }

  // category.service.ts - Add these methods
  getCategoriesPaged(params: {
    pageNumber?: number;
    pageSize?: number;
    searchTerm?: string;
    storeId?: number;
  }): Observable<PagedResult<ProductCategory>> {

    let httpParams = new HttpParams()
      .set('pageNumber', params.pageNumber?.toString() || '1')
      .set('pageSize', params.pageSize?.toString() || '10')
      .set('searchTerm', params.searchTerm || '');

    if (params.storeId != null) {
      httpParams = httpParams.set('storeId', params.storeId.toString());
    }

    return this.http
      .get<HttpResponseData<PagedResult<ProductCategory>>>(
        `${this.API_URL}/products/all-categories`,
        { params: httpParams }
      )
      .pipe(
        map(res => {
          if (res.success && res.result) {
            return res.result;
          }
          throw new Error(res.error || res.message || 'Failed to load categories');
        })
      );
  }


  getSubCategoriesPaged(params: {
    pageNumber?: number;
    pageSize?: number;
    categoryId?: number;
    searchTerm?: string;
    storeId?: number;
  }): Observable<PagedResult<ProductSubCategory>> {
    let httpParams = new HttpParams()
      .set('pageNumber', params.pageNumber?.toString() || '1')
      .set('pageSize', params.pageSize?.toString() || '10')
      .append('searchTerm', params.searchTerm || '');
    if (params.categoryId != null) {
      httpParams = httpParams.set('categoryId', params.categoryId.toString());
    }

    if (params.storeId != null) {
      httpParams = httpParams.set('storeId', params.storeId.toString());
    }

    return this.http.get<HttpResponseData<PagedResult<ProductSubCategory>>>(
      `${this.API_URL}/products/active-subcategories`,
      { params: httpParams }
    ).pipe(
      map(body => {
        if (body.success && body.result) {
          return body.result;
        }
        throw new Error(body.error || body.message || 'Failed to load subcategories');
      }),
      catchError(this.handleError)
    );
  }

  getCategoryById(id: number, storeId?: number): Observable<HttpResponseData<ProductCategory>> {
    let params = new HttpParams();

    if (storeId != null) {
      params = params.set('storeId', storeId.toString());
    }

    return this.http.get<HttpResponseData<ProductCategory>>(
      `${this.API_URL}/products/category/${id}`,
      { params }
    );
  }


  /** Get all categories (legacy - for backward compatibility) */
  // getAllCategories(storeId?: number): Observable<ProductCategory[]> {
  //   return this.getCategoriesPaged({ pageNumber: 1, pageSize: 1000 }).pipe(
  //     map(pagedResult => pagedResult.items)
  //   );
  // }

  createCategory(category: ProductCategory): Observable<HttpResponseData<ProductCategory>> {
    return this.http.post<HttpResponseData<ProductCategory>>(
      `${this.API_URL}/products/category`,
      category,
      this.getHttpOptions()
    ).pipe(
      map(response => {
        if (response.success && response.result) {
          console.log('Product category created successfully:', response.result);
          return response;
        } else {
          throw new Error(response.error || response.message || 'Failed to update product category');
        }
      }),
      catchError(this.handleError)
    );
  }

  updateCategory(id: number, category: ProductCategory): Observable<HttpResponseData<ProductCategory>> {
    return this.http.put<HttpResponseData<ProductCategory>>(
      `${this.API_URL}/products/category/${id}`,
      category
    );
  }

  deleteCategory(id: number, storeId: number): Observable<HttpResponseData<boolean>> {
    const params = new HttpParams()
      .set('storeId', storeId.toString());

    return this.http.delete<HttpResponseData<boolean>>(
      `${this.API_URL}/products/category/${id}`, { params }
    );
  }

  //#endregion

  //#region Sub Category Handling with Pagination

  /** Get subcategories with pagination and search */
  // getSubCategoriesPaged(searchParams: SearchParams): Observable<PagedResult<ProductSubCategory>> {
  //   let params = new HttpParams()
  //     .set('pageNumber', searchParams.pageNumber?.toString() || '1')
  //     .set('pageSize', searchParams.pageSize?.toString() || '10')
  //     .set('searchTerm', searchParams.searchTerm || '');
  //     if (searchParams.storeId != null) {
  //       params = params.set('storeId', searchParams.storeId.toString());
  //     }
  //   return this.http.get<HttpResponseData<PagedResult<ProductSubCategory>>>(
  //     `${this.API_URL}/products/active-subcategories`,
  //     { params, observe: 'response' }
  //   ).pipe(
  //     map(response => {
  //       if (response.status === 200 || response.status === 404) {
  //         const body = response.body;
  //         if (body?.success && body.result) {
  //           return body.result;
  //         } else {
  //           throw new Error(body?.error || body?.message || 'Failed to load subcategories');
  //         }
  //       } else {
  //         throw new Error(`HTTP ${response.status}: Failed to load subcategories`);
  //       }
  //     }),
  //     catchError(this.handleError)
  //   );
  // }

  /** Get all subcategories (legacy - for backward compatibility) */
  getAllSubCategories(storeId?: number): Observable<HttpResponseData<ProductSubCategory[]>> {
    let params = new HttpParams();
    if (storeId != null) {
      params = params.set('storeId', storeId.toString());
    }
    return this.http.get<HttpResponseData<ProductSubCategory[]>>(
      `${this.API_URL}/products/subcategories`,
      { params }
    );
  }

  getSubCategoryById(categoryId: number, storeId?: number): Observable<HttpResponseData<ProductSubCategory>> {
    let params = new HttpParams();
    if (storeId != null) {
      params = params.set('storeId', storeId.toString());
    }
    return this.http.get<HttpResponseData<ProductSubCategory>>(
      `${this.API_URL}/products/subcategories/category/${categoryId}`,
      { params }
    );
  }

  createSubCategory(subCategory: ProductSubCategory): Observable<HttpResponseData<ProductSubCategory>> {
    return this.http.post<HttpResponseData<ProductSubCategory>>(
      `${this.API_URL}/products/subcategory`,
      subCategory
    );
  }

  updateSubCategory(id: number, subCategory: ProductSubCategory): Observable<HttpResponseData<ProductSubCategory>> {
    return this.http.put<HttpResponseData<ProductSubCategory>>(
      `${this.API_URL}/products/subcategory/${id}`,
      subCategory
    );
  }

  deleteSubCategory(id: number, storeId?: number): Observable<HttpResponseData<boolean>> {
    let params = new HttpParams();
    if (storeId != null) {
      params = params.set('storeId', storeId.toString());
    }
    return this.http.delete<HttpResponseData<boolean>>(
      `${this.API_URL}/products/subcategory/${id}`,
      { params }
    );
  }

  //#endregion

  //#region Error handling
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Client error: ${error.error.message}`;
    } else {
      errorMessage = `Server error: ${error.status} - ${error.message}`;
    }
    console.error('CategoryService error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
  //#endregion
}