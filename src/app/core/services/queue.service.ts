// queue.service.ts - Updated service with proper error handling
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { catchError, map, Observable, throwError } from 'rxjs';
import { Shelf } from '../interfaces/shelf.interface';
import { AisleMaster } from '../interfaces/aisle.interface';
import { Message, MessageWithUser } from '../interfaces/message.interface';
import { CreateDirectQueueRequest, CreateQueueFromAssignmentRequest, CreateQueueRequest, Priority, QueueDetailDto, QueueDto, QueueItem, QueuePagedRequest, UpdateQueueRequest } from '../interfaces/queue.interface';
import { environment } from '../../../environments/environment';
import { HttpResponseData } from '../interfaces/http-response.interface';
import { Product } from '../interfaces/product.interface';
import { PagedResult } from '../interfaces/pagination-result.interface';

@Injectable({
  providedIn: 'root'
})
export class QueueService {
  private baseUrl = environment.apiUrl || 'https://localhost:44321/api';

  constructor(private http: HttpClient) { }

  //#region Aisle operations
  getAisles(): Observable<AisleMaster[]> {
    return this.http.get<HttpResponseData<AisleMaster[]>>(`${this.baseUrl}/aisle`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch aisles');
        }
        return response.result || [];
      }),
      catchError(this.handleError)
    );
  }

  getAislesWithShelves(): Observable<AisleMaster[]> {
    return this.http.get<HttpResponseData<AisleMaster[]>>(`${this.baseUrl}/aisle/with-shelves`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch aisles with shelves');
        }
        return response.result || [];
      }),
      catchError(this.handleError)
    );
  }

  getAisleById(id: number): Observable<AisleMaster> {
    return this.http.get<HttpResponseData<AisleMaster>>(`${this.baseUrl}/aisle/${id}`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || `Aisle with ID ${id} not found`);
        }
        return response.result!;
      }),
      catchError(this.handleError)
    );
  }
  //#endregion

  //#region Shelf operations
  getShelves(): Observable<Shelf[]> {
    return this.http.get<HttpResponseData<Shelf[]>>(`${this.baseUrl}/shelf`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch shelves');
        }
        return response.result || [];
      }),
      catchError(this.handleError)
    );
  }

  getShelvesByAisle(aisleId: number): Observable<Shelf[]> {
    return this.http.get<HttpResponseData<Shelf[]>>(`${this.baseUrl}/aisle/${aisleId}/shelves`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || `Failed to fetch shelves for aisle ${aisleId}`);
        }
        return response.result || [];
      }),
      catchError(this.handleError)
    );
  }

  getShelfById(id: number): Observable<Shelf> {
    return this.http.get<HttpResponseData<Shelf>>(`${this.baseUrl}/shelf/${id}`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || `Shelf with ID ${id} not found`);
        }
        return response.result!;
      }),
      catchError(this.handleError)
    );
  }
  //#endregion

  //#region Product operations
  getProducts(): Observable<Product[]> {
    return this.http.get<HttpResponseData<Product[]>>(`${this.baseUrl}/products`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch products');
        }
        return response.result || [];
      }),
      catchError(this.handleError)
    );
  }

  getProductsByShelf(shelfId: number): Observable<Product[]> {
    return this.http.get<HttpResponseData<Product[]>>(`${this.baseUrl}/shelf/${shelfId}/products`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || `Failed to fetch products for shelf ${shelfId}`);
        }
        return response.result || [];
      }),
      catchError(this.handleError)
    );
  }

  getProductsByCategory(categoryId: number): Observable<Product[]> {
    return this.http.get<HttpResponseData<Product[]>>(`${this.baseUrl}/products/category/${categoryId}`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || `Failed to fetch products for category ${categoryId}`);
        }
        return response.result || [];
      }),
      catchError(this.handleError)
    );
  }

  getProductById(id: number): Observable<Product> {
    return this.http.get<HttpResponseData<Product>>(`${this.baseUrl}/products/${id}`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || `Product with ID ${id} not found`);
        }
        return response.result!;
      }),
      catchError(this.handleError)
    );
  }

  updateProductNetwork(productId: string, networkData: {
    ip_address: string;
    network_name: string;
    device_name: string;
  }): Observable<boolean> {
    return this.http.put<HttpResponseData<boolean>>(
      `${this.baseUrl}/products/${productId}/network`,
      networkData
    ).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to update product network');
        }
        return response.result || false;
      }),
      catchError(this.handleError)
    );
  }
  //#endregion

  //#region Queue operations
  getQueuesPaged(request: QueuePagedRequest): Observable<PagedResult<QueueDto>> {
    const params = this.createParams(request);
    return this.http.get<PagedResult<QueueDto>>(`${this.baseUrl}/queue`, { params });
  }

  getQueueById(id: number): Observable<QueueDetailDto> {
    return this.http.get<QueueDetailDto>(`${this.baseUrl}/queue/${id}`);
  }

  createDirectQueue(request: CreateDirectQueueRequest): Observable<QueueDto> {
    return this.http.post<QueueDto>(`${this.baseUrl}/queue/direct`, request);
  }

  createQueueFromAssignment(request: CreateQueueFromAssignmentRequest): Observable<QueueDto> {
    return this.http.post<QueueDto>(`${this.baseUrl}/queue/from-assignment`, request);
  }

  updateQueue(id: number, request: UpdateQueueRequest): Observable<QueueDto> {
    return this.http.put<QueueDto>(`${this.baseUrl}/queue/${id}`, request);
  }

  deleteQueue(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/queue/${id}`);
  }

  activateQueue(id: number): Observable<QueueDto> {
    return this.http.post<QueueDto>(`${this.baseUrl}/queue/${id}/activate`, {});
  }

  deactivateQueue(id: number): Observable<QueueDto> {
    return this.http.post<QueueDto>(`${this.baseUrl}/queue/${id}/deactivate`, {});
  }

  getUpcomingQueues(hours: number = 24): Observable<QueueDto[]> {
    return this.http.get<QueueDto[]>(`${this.baseUrl}/queue/upcoming`, {
      params: { hours: hours.toString() }
    });
  }

  getActiveQueues(): Observable<QueueDto[]> {
    return this.http.get<QueueDto[]>(`${this.baseUrl}/queue/active`);
  }

  getQueuesByDevice(deviceId: number): Observable<QueueDto[]> {
    return this.http.get<QueueDto[]>(`${this.baseUrl}/queue/device/${deviceId}`);
  }

  getQueuesByLocation(locationType: string, locationId: number): Observable<QueueDto[]> {
    return this.http.get<QueueDto[]>(
      `${this.baseUrl}/queue/location/${locationType}/${locationId}`
    );
  }

  getQueueStatistics(storeId?: number): Observable<any> {
    const params = storeId ? new HttpParams().set('storeId', storeId.toString()) : new HttpParams();
    return this.http.get(`${this.baseUrl}/queue/stats`, { params });
  }

  private createParams(request: any): HttpParams {
    let params = new HttpParams();

    Object.keys(request).forEach(key => {
      const value = request[key];
      if (value !== null && value !== undefined && value !== '') {
        params = params.set(key, value.toString());
      }
    });

    return params;
  }

  getPriorityTypes(): Observable<Priority[]> {
    return this.http.get<HttpResponseData<Priority[]>>(`${this.baseUrl}/queue/prioritytypes`,).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch priority types');
        }
        return response.result || [];
      }),
      catchError(this.handleError)
    );
  }

  generatePreview(request: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/preview`, request);
  }

  //#endregion

  //#region Error handling
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side/network error
      errorMessage = `Client error: ${error.error.message}`;
    } else if (error.error && typeof error.error === 'object' && 'message' in error.error) {
      // Backend returned error response with message
      const backendError = error.error as HttpResponseData<any>;
      errorMessage = backendError.message || `Server error: ${error.status}`;
    } else {
      // Backend returned unsuccessful response code
      errorMessage = `Server error: ${error.status} - ${error.message}`;
    }

    console.error('QueueService error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
  //#endregion
}