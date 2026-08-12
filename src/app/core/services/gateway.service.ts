import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { GatewayPagedRequest, GatewayDto, CreateGatewayRequest, UpdateGatewayRequest, AddGatewayToMinewRequest } from '../interfaces/gateway.interface';
import { HttpResponseData } from '../interfaces/http-response.interface';
import { PagedResult } from '../interfaces/pagination-result.interface';

@Injectable({
  providedIn: 'root'
})
export class GatewayService {

    private readonly API_URL = environment.apiUrl || 'https://localhost:44321/api';    

    private getHttpOptions() {
        return {
            headers: new HttpHeaders({
                'Content-Type': 'application/json'
            })
        };
    }
    
  constructor(private http: HttpClient) { }

  // services/device.service.ts - Add these methods
// Gateway Management
getGatewaysPaged(request: GatewayPagedRequest): Observable<HttpResponseData<PagedResult<GatewayDto>>> {
  let params = new HttpParams()
    .set('PageNumber', (request.pageNumber || 1).toString())
    .set('PageSize', (request.pageSize || 10).toString());

  if (request.searchTerm) params = params.set('SearchTerm', request.searchTerm);
  if (request.sortBy) params = params.set('SortBy', request.sortBy);
  if (request.sortDescending !== undefined) params = params.set('SortDescending', request.sortDescending.toString());
  if (request.storeId) params = params.set('StoreId', request.storeId.toString());
  if (request.isOnline !== undefined) params = params.set('IsOnline', request.isOnline.toString());
  if (request.minBattery) params = params.set('MinBattery', request.minBattery.toString());
  if (request.maxBattery) params = params.set('MaxBattery', request.maxBattery.toString());
  if (request.lastSeenFrom) params = params.set('LastSeenFrom', request.lastSeenFrom);
  if (request.lastSeenTo) params = params.set('LastSeenTo', request.lastSeenTo);
  if (request.status) params = params.set('Status', request.status);
  if (request.gatewayType) params = params.set('GatewayType', request.gatewayType);

  return this.http.get<HttpResponseData<PagedResult<GatewayDto>>>(
    `${this.API_URL}/device/gateways/paged`,
    { params }
  ).pipe(
    catchError(this.handleError)
  );
}

getGatewayById(id: number): Observable<GatewayDto> {
  return this.http.get<HttpResponseData<GatewayDto>>(`${this.API_URL}/device/gateway/${id}`)
    .pipe(
      map(response => {
        if (response.success && response.result) {
          return response.result;
        } else {
          throw new Error(response.error || response.message || `Gateway with ID ${id} not found`);
        }
      }),
      catchError(this.handleError)
    );
}

createGateway(request: CreateGatewayRequest): Observable<GatewayDto> {
  return this.http.post<HttpResponseData<GatewayDto>>(
    `${this.API_URL}/device/gateway`,
    request
  ).pipe(
    map(response => {
      if (response.success && response.result) {
        return response.result;
      }
      throw new Error(response.message || 'Failed to create gateway');
    })
  );
}

updateGateway(id: number, request: UpdateGatewayRequest): Observable<GatewayDto> {
  return this.http.put<HttpResponseData<GatewayDto>>(
    `${this.API_URL}/device/gateway/${id}`,
    request
  ).pipe(
    map(response => {
      if (response.success && response.result) {
        return response.result;
      }
      throw new Error(response.message || 'Failed to update gateway');
    })
  );
}

deleteGateway(id: number, userId: number): Observable<{ success: boolean; message: string }> {
  return this.http.delete<HttpResponseData<boolean>>(
    `${this.API_URL}/device/gateway/${id}/user/${userId}`
  ).pipe(
    map(response => ({ success: response.success, message: response.message })),
    catchError(() => of({ success: false, message: 'Failed to delete gateway' }))
  );
}

syncGateways(storeId: number): Observable<any> {
  const params = new HttpParams().set('storeId', storeId.toString());
  return this.http.get<any>(
    `${this.API_URL}/device/gateways/sync`,
    { params }
  );
}

addGatewayToMinew(request: AddGatewayToMinewRequest): Observable<any> {
  return this.http.post<any>(
    `${this.API_URL}/device/gateway/add-to-minew`,
    request
  );
 }
   private handleError(error: any): Observable<never> {
        console.error('Product Service Error:', error);
        
        let errorMessage = 'An unexpected error occurred';
        
        if (error instanceof HttpErrorResponse) {
            if (error.status === 404) {
                errorMessage = error.error?.message || 'No products found';
            } else if (error.error instanceof ErrorEvent) {
                errorMessage = `Network error: ${error.error.message}`;
            } else {
                const serverError = error.error;
                if (serverError && typeof serverError === 'object') {
                    errorMessage = serverError.error || serverError.message || `Server error: ${error.status}`;
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
            timestamp: new Date().toISOString()
        });

        return throwError(() => new Error(errorMessage));
    }
}

