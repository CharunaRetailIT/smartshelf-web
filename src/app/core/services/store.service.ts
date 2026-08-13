import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { MinewStore } from '../interfaces/minew.interface';
import { environment } from '../../../environments/environment';
import { HttpResponseData } from '../interfaces/http-response.interface';
import { PagedResult } from '../interfaces/pagination-result.interface';
import { StoreFilterParams, Store, StoreLookup, StoreSyncRequest, StoreSyncResult } from '../interfaces/store.interface';

@Injectable({
  providedIn: 'root'
})
export class StoreService {
  private readonly API_URL = environment.apiUrl || 'https://localhost:44321/api';

  constructor(private http: HttpClient) {} 
 
 /**
   * Get a specific store by ID
   * @param storeId - The store ID to retrieve
   */
  getStoreById(storeId: string): Observable<MinewStore | null> {
   this.http.get<any>(`${this.API_URL}/MinewIntegration/store/list`).pipe(
      map(res => {
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        const store = list.find((s: any) => s.id === storeId);
        return store ? {
          storeId: store.id,
          storeName: store.name,
          address: store.address,
          active: store.active
        } : null;
      }),
      catchError(() => of(null))
    );
    return of(null);
  }

  /**
   * Get only active stores
   */
// Get stores
getActiveStores(): Observable<MinewStore[]> {
  return this.http.get<any>(`${this.API_URL}/minew-integration/stores`).pipe(
    map(res => {
      // Access the data array from the response
      const list = res?.data ?? [];
      console.log('Fetched stores:', list);
      
      return list
        .filter((s: any) => s.active)
        .map((s: any) => ({
          storeId: s.id,
          storeName: s.name,
          address: s.address,
          active: s.active
        }));
    }),
    catchError((error) => {
      console.error('Error fetching stores:', error);
      return of([]);
    })
  );
}

/**
 * Check if a store exists and is active
 * @param storeId - The store ID to check
 */
isStoreActive(storeId: string): Observable<boolean> {
  return this.http.get<any>(`${this.API_URL}/MinewIntegration/store/list`).pipe(
    map(res => {
      const list = Array.isArray(res) ? res : (res?.data ?? []);
      const store = list.find((s: any) => s.id === storeId);
      return store ? store.active : false;
    }),
    catchError(() => of(false))
  );
}

  getStores(params: StoreFilterParams): Observable<PagedResult<Store>> {
    let httpParams = new HttpParams()
      .set('pageNumber', params.pageNumber.toString())
      .set('pageSize', params.pageSize.toString());

    if (params.searchTerm) {
      httpParams = httpParams.set('searchTerm', params.searchTerm);
    }
    if (params.storeType) {
      httpParams = httpParams.set('storeType', params.storeType);
    }
    if (params.isActive !== undefined) {
      httpParams = httpParams.set('isActive', params.isActive.toString());
    }
    if (params.isSynced !== undefined) {
      httpParams = httpParams.set('isSynced', params.isSynced.toString());
    }
    if (params.createdFrom) {
      httpParams = httpParams.set('createdFrom', params.createdFrom.toISOString());
    }
    if (params.createdTo) {
      httpParams = httpParams.set('createdTo', params.createdTo.toISOString());
    }
    if (params.sortBy) {
      httpParams = httpParams.set('sortBy', params.sortBy);
    }
    if (params.sortDirection) {
      httpParams = httpParams.set('sortDirection', params.sortDirection);
    }

    return this.http.get<HttpResponseData<PagedResult<Store>>>(this.API_URL + '/Store', { params: httpParams })
      .pipe(
        map(response => {
          if (response.success) {
            return response.result;
          } else {
            throw new Error(response.message);
          }
        })
      );
  }

  /**
   * Minimal id/name list of active stores. Anonymous endpoint, used by the
   * registration form before the user has a token.
   */
  getStoreLookup(): Observable<StoreLookup[]> {
    return this.http.get<HttpResponseData<StoreLookup[]>>(`${this.API_URL}/Store/lookup`)
      .pipe(
        map(response => {
          if (response.success) {
            return response.result;
          } else {
            throw new Error(response.message);
          }
        })
      );
  }

  getStore(id: number): Observable<Store> {
    return this.http.get<HttpResponseData<Store>>(`${this.API_URL}/Store/${id}`)
      .pipe(
        map(response => {
          if (response.success) {
            return response.result;
          } else {
            throw new Error(response.message);
          }
        })
      );
  }

  createStore(store: Partial<Store>): Observable<Store> {
    return this.http.post<HttpResponseData<Store>>(`${this.API_URL}/Store`, store)
      .pipe(
        map(response => {
          if (response.success) {
            return response.result;
          } else {
            throw new Error(response.message);
          }
        })
      );
  }

  updateStore(id: number, store: Partial<Store>): Observable<Store> {
    return this.http.put<HttpResponseData<Store>>(`${this.API_URL}/Store/${id}`, store)
      .pipe(
        map(response => {
          if (response.success) {
            return response.result;
          } else {
            throw new Error(response.message);
          }
        })
      );
  }

  deleteStore(id: number): Observable<void> {
    return this.http.delete<HttpResponseData<void>>(`${this.API_URL}/Store/${id}`)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message);
          }
        })
      );
  }

  syncStores(request: StoreSyncRequest): Observable<StoreSyncResult> {
    return this.http.post<HttpResponseData<StoreSyncResult>>(`${this.API_URL}/Store/sync`, request)
      .pipe(
        map(response => {
          if (response.success) {
            return response.result;
          } else {
            throw new Error(response.message);
          }
        })
      );
  }


  getStoreStatistics(): Observable<any> {
    return this.http.get<HttpResponseData<any>>(`${this.API_URL}/Store/statistics`)
      .pipe(
        map(response => {
          if (response.success) {
            return response.result;
          } else {
            throw new Error(response.message);
          }
        })
      );
  }

  getStoresLazy(params: StoreFilterParams): Observable<PagedResult<Store>> {
  let httpParams = new HttpParams()
    .set('PageNumber', params.pageNumber.toString())
    .set('PageSize', params.pageSize.toString());

  if (params.searchTerm) {
    httpParams = httpParams.set('SearchTerm', params.searchTerm);
  }
  if (params.storeType) {
    httpParams = httpParams.set('StoreType', params.storeType);
  }
  if (params.isActive !== undefined) {
    httpParams = httpParams.set('IsActive', params.isActive.toString());
  }
  if (params.isSynced !== undefined) {
    httpParams = httpParams.set('IsSynced', params.isSynced.toString());
  }
  if (params.createdFrom) {
    httpParams = httpParams.set('CreatedFrom', params.createdFrom.toISOString().split('T')[0]);
  }
  if (params.createdTo) {
    httpParams = httpParams.set('CreatedTo', params.createdTo.toISOString().split('T')[0]);
  }
  if (params.sortBy) {
    httpParams = httpParams.set('SortBy', params.sortBy);
  }
  if (params.sortDirection) {
    httpParams = httpParams.set('SortDirection', params.sortDirection);
  }

  return this.http.get<HttpResponseData<PagedResult<Store>>>(
    `${this.API_URL}/Store`,
    { params: httpParams }
  ).pipe(
    map(response => {
      if (response.success && response.result) {
        return response.result;
      }
      throw new Error(response.message || 'Failed to load stores');
    }),
    catchError(error => {
      console.error('Error loading stores:', error);
      return of({
        items: [],
        totalCount: 0,
        pageNumber: params.pageNumber,
        pageSize: params.pageSize,
        totalPages: 0,
        searchTerm: params.searchTerm,
        hasPreviousPage: false,
        hasNextPage: false,
        hasResults: false
      });
    })
  );
}
}   