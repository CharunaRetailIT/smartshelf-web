import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AisleMaster, AssignmentIdsResponse, ProductSummaryRequest, ProductSummaryResponse } from '../interfaces/aisle.interface';
import { environment } from '../../../environments/environment';
import { HttpResponseData } from '../interfaces/http-response.interface';
import { PagedResult, SearchParams } from '../interfaces/pagination-result.interface';
import { Shelf } from '../interfaces/shelf.interface';

export interface CreateAisleWithShelvesRequest {
  aisle: AisleMaster;
  shelves: Shelf[];
}

@Injectable({
  providedIn: 'root'
})
export class AisleService {
  private readonly baseUrl = environment.apiUrl || 'https://localhost:44321/api';

  constructor(private http: HttpClient) {}

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  //#region Aisle Operations

  // Get all aisles
  getAllAisles(storeId?:number): Observable<AisleMaster[]> {
     let httpParams = new HttpParams();
     if(storeId){
      httpParams = httpParams.set('storeId',storeId)
     }
    return this.http.get<HttpResponseData<AisleMaster[]>>(`${this.baseUrl}/aisle`,{ params: httpParams })
      .pipe(
        map(response => {
          if (response.success) {
            return response.result || response.results || [];
          } else {
            throw new Error(response.error || response.message || 'Failed to load aisles');
          }
        }),
        catchError(this.handleError)
      );
  }

  // Get all aisles with shelves
  // getAisleswithShelves(): Observable<AisleMaster[]> {
  //   return this.http.get<HttpResponseData<AisleMaster[]>>(`${this.baseUrl}/aisle/with-shelves`)
  //     .pipe(
  //       map(response => {
  //         console.log('Raw aisles with shelves response:', response);
  //         if (response.success) {
  //           return response.result || response.results || [];
  //         } else {
  //           console.error('API error loading aisles:', response.error || response.message);
  //           throw new Error(response.error || response.message || 'Failed to load aisles with shelves');
  //         }
  //       }),
  //       catchError(this.handleError)
  //     );
  // }

 getAislesWithShelves(params: SearchParams = {}, storeId?: number): Observable<PagedResult<AisleMaster>> {
    let httpParams = new HttpParams();
    
    // Set default values if not provided
    const pageNumber = params.pageNumber || 1;
    const pageSize = params.pageSize || 10;
    const searchTerm = params.searchTerm || '';

    httpParams = httpParams
      .set('page', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (searchTerm) {
      httpParams = httpParams.set('search', searchTerm);
    }
    if(storeId){
     httpParams = httpParams.set('storeId',storeId)
    }
    
    // Add status filter if needed
    if (params['status']) {
      httpParams = httpParams.set('status', params['status']);
    }

    return this.http.get<HttpResponseData<PagedResult<AisleMaster>>>(`${this.baseUrl}/aisle/with-shelves`, { params: httpParams })
      .pipe(
        map(response => {
          console.log('Raw paginated aisles response:', response);
          
          if (response.success && response.result) {
            // Ensure the result matches PagedResult interface
            const pagedResult: PagedResult<AisleMaster> = {
              items: response.result.items || [],
              totalCount: response.result.totalCount || 0,
              pageNumber: response.result.pageNumber || pageNumber,
              pageSize: response.result.pageSize || pageSize,
              totalPages: response.result.totalPages || Math.ceil((response.result.totalCount || 0) / pageSize),
              searchTerm: searchTerm,
              hasPreviousPage: response.result.hasPreviousPage !== undefined ? response.result.hasPreviousPage : (pageNumber > 1),
              hasNextPage: response.result.hasNextPage !== undefined ? response.result.hasNextPage : (pageNumber * pageSize < (response.result.totalCount || 0)),
              hasResults: (response.result.items?.length || 0) > 0
            };
            return pagedResult;
          } else {
            // Throw an error with the API's error message
            const errorMessage = response.error || response.message || 'Failed to load paginated aisles';
            throw new Error(errorMessage);
          }
        }),
        catchError(this.handleError) // Use existing error handler
      );
  }

  // Get aisle by ID
  getAisleById(id: number): Observable<AisleMaster> {
    return this.http.get<HttpResponseData<AisleMaster>>(`${this.baseUrl}/aisle/${id}`)
      .pipe(
        map(response => {
          if (response.success && response.result) {
            return response.result;
          } else {
            throw new Error(response.error || response.message || `Aisle with ID ${id} not found`);
          }
        }),
        catchError(this.handleError)
      );
  }

  // Create aisle
  createAisle(aisle: AisleMaster): Observable<AisleMaster> {
  return this.http.post(
    `${this.baseUrl}/aisle/create`, 
    aisle,
    { 
      observe: 'response',
      responseType: 'text'
    }
  ).pipe(
    map(httpResponse => {
      console.log('Raw response text:', httpResponse.body);
      console.log('Status:', httpResponse.status);
      
      try {
        const response = JSON.parse(httpResponse.body || '{}') as HttpResponseData<AisleMaster>;
        
        if (httpResponse.status === 201 || httpResponse.status === 200) {
          if (response.success && response.result) {
            return response.result;
          } else {
            throw new Error(response.message || response.error || 'Failed to create aisle');
          }
        } else {
          throw new Error(response.message || `HTTP ${httpResponse.status}`);
        }
      } catch (e) {
        console.error('JSON parse error:', e);
        console.error('Raw response that failed to parse:', httpResponse.body);
        throw new Error('Invalid JSON response from server');
      }
    }),
    catchError(this.handleError)
  );
}
//   createAisle(aisle: AisleMaster): Observable<AisleMaster> {
//   return this.http.post<HttpResponseData<AisleMaster>>(
//     `${this.baseUrl}/aisle/create`, 
//     aisle, 
//     this.getHttpOptions()
//   ).pipe(
//     map(response => {
//       console.log('Raw create aisle response:', response);
      
//       if (response.success && response.result) {
//         return response.result;
//       } else {
//         throw new Error(response.error || response.message || 'Failed to create aisle');
//       }
//     }),
//     catchError((error: HttpErrorResponse) => {
//       console.error('Create aisle error details:', error);
      
//       // Check if it's a 500 error but the operation actually succeeded
//       if (error.status === 500 && error.error?.success) {
//         console.warn('Server returned 500 but operation succeeded:', error.error);
//         // If the backend indicates success despite 500 status, return the result
//         if (error.error.result) {
//           return of(error.error.result);
//         }
//       }
      
//       let errorMessage = 'An unexpected error occurred';
//       if (error.error?.message) {
//         errorMessage = error.error.message;
//       } else if (error.message) {
//         errorMessage = error.message;
//       }
      
//       return throwError(() => new Error(errorMessage));
//     })
//   );
// }
  // createAisle(aisle: AisleMaster): Observable<AisleMaster> {
  //   return this.http.post<HttpResponseData<AisleMaster>>(`${this.baseUrl}/aisle/create`, aisle, this.getHttpOptions())
  //     .pipe(
  //       map(response => {
  //         if (response.success && response.result) {
  //           return response.result;
  //         } else {
  //           throw new Error(response.error || response.message || 'Failed to create aisle');
  //         }
  //       }),
  //       catchError(this.handleError)
  //     );
  // }

  // Update aisle
  updateAisle(id: number, aisle: AisleMaster): Observable<AisleMaster> {
    return this.http.put<HttpResponseData<AisleMaster>>(`${this.baseUrl}/aisle`, aisle, this.getHttpOptions())
      .pipe(
        map(response => {
          if (response.success && response.result) {
            return response.result;
          } else {
            throw new Error(response.error || response.message || 'Failed to update aisle');
          }
        }),
        catchError(this.handleError)
      );
  }

  // Delete aisle (soft delete with user)
  deleteAisle(id: number, userId: number): Observable<void> {
    return this.http.delete<HttpResponseData<void>>(`${this.baseUrl}/aisle/${id}/user/${userId}`)
      .pipe(
        map(response => {
          if (response.success) {
            return;
          } else {
            throw new Error(response.error || response.message || 'Failed to delete aisle');
          }
        }),
        catchError(this.handleError)
      );
  }

// Restore aisle (soft delete reversal)
restoreAisle(id: number, userId: number): Observable<void> {
  return this.http.put<HttpResponseData<void>>(`${this.baseUrl}/aisle/${id}/restore/user/${userId}`, {})
    .pipe(
      map(response => {
        if (response.success) {
          return;
        } else {
          throw new Error(response.error || response.message || 'Failed to restore aisle');
        }
      }),
      catchError(this.handleError)
    );
}

  //#endregion

  //#region Shelf Operations

  // Get shelves by aisle
  getShelvesByAisle(aisleId: number): Observable<Shelf[]> {
    return this.http.get<HttpResponseData<Shelf[]>>(`${this.baseUrl}/aisle/${aisleId}/shelves`)
      .pipe(
        map(response => {
          if (response.success) {
            return response.result || response.results || [];
          } else {
            console.error(`API error loading shelves for aisle ${aisleId}:`, response.error || response.message);
            return []; // Return empty array instead of throwing error for better UX
          }
        }),
        catchError(this.handleError)
      );
  }

  // Create shelf
  createShelf(shelf: Shelf): Observable<Shelf> {
    return this.http.post<HttpResponseData<Shelf>>(`${this.baseUrl}/shelf/create`, shelf, this.getHttpOptions())
      .pipe(
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

  // Update shelf
  updateShelf(id: number, shelf: Shelf): Observable<Shelf> {
    return this.http.put<HttpResponseData<Shelf>>(`${this.baseUrl}/shelf/${id}`, shelf, this.getHttpOptions())
      .pipe(
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

  // Delete shelf
  deleteShelf(id: number): Observable<void> {
    return this.http.delete<HttpResponseData<void>>(`${this.baseUrl}/shelf/${id}`)
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

  //#endregion

  //#region Product Operations

  // Assign product to aisle
  assignProductToAisle(aisleId: number, productId: number): Observable<void> {
    return this.http.post<HttpResponseData<void>>(`${this.baseUrl}/aisle/${aisleId}/assign/${productId}`, {})
      .pipe(
        map(response => {
          if (response.success) {
            return;
          } else {
            throw new Error(response.error || response.message || 'Failed to assign product to aisle');
          }
        }),
        catchError(this.handleError)
      );
  }

  // Remove product from aisle
  removeProductFromAisle(aisleId: number, productId: number, userId: number): Observable<void> {
    return this.http.delete<HttpResponseData<void>>(`${this.baseUrl}/aisle/${aisleId}/remove/${productId}/user/${userId}`)
      .pipe(
        map(response => {
          if (response.success) {
            return;
          } else {
            throw new Error(response.error || response.message || 'Failed to remove product from aisle');
          }
        }),
        catchError(this.handleError)
      );
  }

  // Get products by aisle
  getProductsByAisle(aisleId: number): Observable<any[]> {
    return this.http.get<HttpResponseData<any[]>>(`${this.baseUrl}/aisle/${aisleId}/products`)
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

  // Assign products by category to aisle
  assignProductsByCategoryToAisle(aisleId: number, categoryId: number): Observable<void> {
    return this.http.post<HttpResponseData<void>>(`${this.baseUrl}/aisle/${aisleId}/assign/category/${categoryId}`, {})
      .pipe(
        map(response => {
          if (response.success) {
            return;
          } else {
            throw new Error(response.error || response.message || 'Failed to assign products by category');
          }
        }),
        catchError(this.handleError)
      );
  }

  //#endregion

  //#region Advanced Operations

  // Get Unique Assignment Aisle & Shelf IDs
  getUniqueAssignmentIds(): Observable<AssignmentIdsResponse> {
    return this.http.get<HttpResponseData<AssignmentIdsResponse>>(`${this.baseUrl}/aisle/assignment-ids`)
      .pipe(
        map(response => {
          if (response.success && response.result) {
            return response.result;
          } else {
            throw new Error(response.error || response.message || 'Failed to load assignment IDs');
          }
        }),
        catchError(this.handleError)
      );
  }

  // Product Summary
  getProductSummary(request: ProductSummaryRequest): Observable<ProductSummaryResponse> {
    return this.http.post<HttpResponseData<ProductSummaryResponse>>(
      `${this.baseUrl}/aisle/summary`,
      request,
      this.getHttpOptions()
    ).pipe(
      map(response => {
        if (response.success && response.result) {
          return response.result;
        } else {
          throw new Error(response.error || response.message || 'Failed to load product summary');
        }
      }),
      catchError(this.handleError)
    );
  }

  // Bulk delete aisles
  bulkDeleteAisles(aisleIds: number[]): Observable<void> {
    return this.http.delete<HttpResponseData<void>>(`${this.baseUrl}/aisle/bulk`, {
      body: { aisleIds }
    }).pipe(
      map(response => {
        if (response.success) {
          return;
        } else {
          throw new Error(response.error || response.message || 'Failed to delete aisles');
        }
      }),
      catchError(this.handleError)
    );
  }

  //#endregion

  //#region Import/Export

  importAislesFromCSV(file: File): Observable<{ success: number; errors: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.http.post<HttpResponseData<{ success: number; errors: string[] }>>(
      `${this.baseUrl}/aisle/import`, 
      formData
    ).pipe(
      map(response => {
        if (response.success && response.result) {
          return response.result;
        } else {
          throw new Error(response.error || response.message || 'Failed to import aisles');
        }
      }),
      catchError(this.handleError)
    );
  }

  async exportAislesToCSV(aisleIds: number[]): Promise<void> {
    const response = await this.http.post<HttpResponseData<Blob>>(
      `${this.baseUrl}/aisle/export`, 
      { aisleIds },
      { 
        responseType: 'blob' as 'json',
        headers: { 'Accept': 'text/csv' }
      }
    ).toPromise();

    if (response && response.success && response.result) {
      const blob = new Blob([response.result], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aisles_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } else {
      throw new Error('Failed to export aisles');
    }
  }

  //#endregion

  //#region Error Handling

  private handleError(error: any): Observable<never> {
    console.error('Aisle Service Error:', error);
    
    let errorMessage = 'An unexpected error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else if (error.error?.message) {
      // Backend error with message
      errorMessage = error.error.message;
    } else if (error.message) {
      // JavaScript error
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    return throwError(() => new Error(errorMessage));
  }

  //#endregion
}