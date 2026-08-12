import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Shelf, ShelfImportResult } from '../interfaces/shelf.interface';
import { ConfigService } from './app-config.service';
import { environment } from '../../../environments/environment';
import { HttpResponseData } from '../interfaces/http-response.interface';
import { Product } from '../interfaces/product.interface';

@Injectable({
  providedIn: 'root'
})
export class ShelfService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);

  private readonly API_URL = environment.apiUrl || 'https://localhost:44321/api';

  //#region Shelf Operations

  getAllShelves(storeId?:number): Observable<Shelf[]> {

   let httpParams = new HttpParams();
     if(storeId){
      httpParams = httpParams.set('storeId',storeId)
     }

    return this.http.get<HttpResponseData<Shelf[]>>(`${this.API_URL}/shelf`,{ params: httpParams})
      .pipe(
        map(response => {
          if (response.success) {
            return response.result || response.results || [];
          } else {
            throw new Error(response.error || response.message || 'Failed to load shelves');
          }
        }),
        catchError(this.handleError)
      );
  }

  getShelfWithAssignments(shelfId: number,storeId?:number): Observable<Shelf> {
    let httpParams = new HttpParams();
     if(storeId){
      httpParams = httpParams.set('storeId',storeId)
     }
    return this.http.get<any>(`${this.API_URL}/shelf/with-assignments/${shelfId}`, { params: httpParams }).pipe(
      map(response => {
        // Extract the Shelf object from the response wrapper
        if (response && response.result) {
          return response.result as Shelf;
        } else if (response && response.id) {
          // If it's already a Shelf object
          return response as Shelf;
        } else {
          throw new Error('Invalid response structure from server');
        }
      }),
      catchError(error => {
        console.error('Error fetching shelf with assignments:', error);
        throw error;
      })
    );
  }

  getShelfById(id: number,storeId?:number): Observable<Shelf> {
    console.log("get shelf by id",storeId)
    let httpParams = new HttpParams();
     if(storeId){
      httpParams = httpParams.set('storeId',storeId)
     }
    return this.http.get<HttpResponseData<Shelf>>(`${this.API_URL}/shelf/${id}`, { params:httpParams })
      .pipe(
        map(response => {
          if (response.success && response.result) {
            return response.result;
          } else {
            throw new Error(response.error || response.message || `Shelf with ID ${id} not found`);
          }
        }),
        catchError(this.handleError)
      );
  }

  createShelf(shelf: Omit<Shelf, 'shelfID'>): Observable<Shelf> {
    return this.http.post<HttpResponseData<Shelf>>(`${this.API_URL}/shelf/create`, shelf, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      map(response => {
        if (response.success && response.result) {
          return response.result;
        } else {
          throw new Error(response.error || response.message || 'Failed to create shelf');
        }
      }),
      catchError(this.handleError)
    );
  }

  updateShelf(shelf: Shelf): Observable<Shelf> {
    return this.http.put<HttpResponseData<Shelf>>(`${this.API_URL}/shelf/${shelf.id}`, shelf, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      map(response => {
        if (response.success && response.result) {
          return response.result;
        } else {
          throw new Error(response.error || response.message || 'Failed to update shelf');
        }
      }),
      catchError(this.handleError)
    );
  }

  deleteShelf(id: number, user: number, storeId?:number): Observable<void> {
    return this.http.delete<HttpResponseData<void>>(`${this.API_URL}/shelf/${id}/store/${storeId}/user/${user}`)
      .pipe(
        map(response => {
          if (response.success) {
            return;
          } else {
            throw new Error(response.error || response.message || 'Failed to delete shelf');
          }
        }),
        catchError(this.handleError)
      );
  }

// Restore shelf (soft delete reversal)
restoreShelf(id: number, user: number, storeId?:number): Observable<void> {
  return this.http.put<HttpResponseData<void>>(`${this.API_URL}/shelf/${id}/restore/store/${storeId}/user/${user}`, {})
    .pipe(
      map(response => {
        if (response.success) {
          return;
        } else {
          throw new Error(response.error || response.message || 'Failed to restore shelf');
        }
      }),
      catchError(this.handleError)
    );
}

  bulkDeleteShelves(ids: number[]): Observable<void> {
    return this.http.request<HttpResponseData<void>>('delete', `${this.API_URL}/shelf/bulk-delete`, {
      body: { ids }
    }).pipe(
      map(response => {
        if (response.success) {
          return;
        } else {
          throw new Error(response.error || response.message || 'Failed to delete shelves');
        }
      }),
      catchError(this.handleError)
    );
  }

  //#endregion

  //#region Product Assignment

  assignProduct(shelfId: number, productId: number,storeId?:number,userId?:number): Observable<any> {
    return this.http.post<HttpResponseData<any>>(`${this.API_URL}/shelf/${shelfId}/store/${storeId}/assign/${productId}/user/${userId}`, {}, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      map(response => {
        if (response.success) {
          return response.result;
        } else {
          throw new Error(response.error || response.message || 'Failed to assign product');
        }
      }),
      catchError(this.handleError)
    );
  }

  removeProduct(shelfId: number, productId: number,storeId?:number, userId?:number): Observable<any> {
    return this.http.delete<HttpResponseData<any>>(`${this.API_URL}/shelf/${shelfId}/store/${storeId}/remove/${productId}/user/${userId}`)
      .pipe(
        map(response => {
          if (response.success) {
            return response.result;
          } else {
            throw new Error(response.error || response.message || 'Failed to remove product');
          }
        }),
        catchError(this.handleError)
      );
  }

  assignProductsByCategory(shelfId: number, categoryId: number, storeId?:number, userId?:number): Observable<any> {
    return this.http.post<HttpResponseData<any>>(`${this.API_URL}/shelf/${shelfId}/store/${storeId}/assign/category/${categoryId}/user/${userId}`, {}, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      map(response => {
        if (response.success) {
          return response.result;
        } else {
          throw new Error(response.error || response.message || 'Failed to assign products by category');
        }
      }),
      catchError(this.handleError)
    );
  }

  getProductsByShelf(shelfId: number,storeId?:number): Observable<Product[]> {
    return this.http.get<HttpResponseData<Product[]>>(`${this.API_URL}/shelf/${shelfId}/store/${storeId}/products`)
      .pipe(
        map(response => {
          if (response.success) {
            return response.result || response.results || [];
          } else {
            throw new Error(response.error || response.message || 'Failed to load products');
          }
        }),
        catchError(this.handleError)
      );
  }

  //#endregion

  //#region CSV Import/Export

  importShelvesFromCSV(file: File): Observable<ShelfImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<HttpResponseData<ShelfImportResult>>(`${this.API_URL}/shelf/import`, formData)
      .pipe(
        map(response => {
          if (response.success && response.result) {
            return response.result;
          } else {
            throw new Error(response.error || response.message || 'Failed to import shelves');
          }
        }),
        catchError(this.handleError)
      );
  }

  exportShelvesToCSV(shelfIds?: number[]): Observable<Blob> {
    const url = shelfIds?.length
      ? `${this.API_URL}/shelf/export?ids=${shelfIds.join(',')}`
      : `${this.API_URL}/shelf/export`;
    
    return this.http.get<HttpResponseData<Blob>>(url, { 
      responseType: 'blob' as 'json'
    }).pipe(
      map(response => {
        if (response.success && response.result) {
          return response.result;
        } else {
          throw new Error(response.error || response.message || 'Failed to export shelves');
        }
      }),
      catchError(this.handleError)
    );
  }

  //#endregion

  //#region Search

  searchShelves(query: string): Observable<Shelf[]> {
    return this.http.get<HttpResponseData<Shelf[]>>(`${this.API_URL}/shelf/search?q=${encodeURIComponent(query)}`)
      .pipe(
        map(response => {
          if (response.success) {
            return response.result || response.results || [];
          } else {
            throw new Error(response.error || response.message || 'Failed to search shelves');
          }
        }),
        catchError(this.handleError)
      );
  }

  //#endregion

  //#region Error Handling

  private handleError(error: any): Observable<never> {
    console.error('Shelf Service Error:', error);
    
    let errorMessage = 'An unexpected error occurred';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    return throwError(() => new Error(errorMessage));
  }

  //#endregion
}