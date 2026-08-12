import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, map, Observable, of, throwError } from 'rxjs';
import { HttpResponseData } from '../interfaces/http-response.interface';
import { Message, MessagePagedRequest, MessageWithUser } from '../interfaces/message.interface';
import { PagedResult, SearchParams } from '../interfaces/pagination-result.interface';

@Injectable({
  providedIn: 'root'
})
export class CustomMessageService {
  private readonly API_URL = environment.apiUrl || 'https://localhost:44321/api';

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }
  constructor(private http: HttpClient) { }

  // ============ MESSAGE PAGINATION ============

  /**
   * Get messages with pagination and filtering
   * @param request Search parameters for pagination and filtering
   * @returns Observable with paged messages response
   */
  getMessagesPaged(request: MessagePagedRequest): Observable<HttpResponseData<PagedResult<MessageWithUser>>> {
    let params = new HttpParams();

    // Add pagination parameters
    if (request.pageNumber !== undefined) {
      params = params.set('PageNumber', request.pageNumber.toString());
    }

    if (request.pageSize !== undefined) {
      params = params.set('PageSize', request.pageSize.toString());
    }

    if (request.sortBy) {
      params = params.set('SortBy', request.sortBy);
    }

    if (request.sortDescending !== undefined) {
      params = params.set('SortDescending', request.sortDescending.toString());
    }

    if (request.searchTerm) {
      params = params.set('SearchTerm', request.searchTerm);
    }

    // Add filter parameters
    if (request.title) {
      params = params.set('Title', request.title);
    }

    if (request.contentType !== undefined) {
      params = params.set('ContentType', request.contentType.toString());
    }

    if (request.isActive !== undefined) {
      params = params.set('IsActive', request.isActive.toString());
    }

    if (request.createdBy !== undefined) {
      params = params.set('CreatedBy', request.createdBy.toString());
    }

    if (request.createdFrom) {
      const date = typeof request.createdFrom === 'string'
        ? request.createdFrom
        : this.formatDate(request.createdFrom);
      params = params.set('CreatedFrom', date);
    }

    if (request.createdTo) {
      const date = typeof request.createdTo === 'string'
        ? request.createdTo
        : this.formatDate(request.createdTo);
      params = params.set('CreatedTo', date);
    }

    if (request.updatedFrom) {
      const date = typeof request.updatedFrom === 'string'
        ? request.updatedFrom
        : this.formatDate(request.updatedFrom);
      params = params.set('UpdatedFrom', date);
    }

    if (request.updatedTo) {
      const date = typeof request.updatedTo === 'string'
        ? request.updatedTo
        : this.formatDate(request.updatedTo);
      params = params.set('UpdatedTo', date);
    }


    if (request.storeId) {
      params = params.set('StoreId', request.storeId);
    }

    return this.http.get<HttpResponseData<PagedResult<MessageWithUser>>>(
      `${this.API_URL}/message/paged`,
      { params }
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get messages with simplified paged response (returns PagedResult directly)
   * @param request Search parameters
   * @returns Observable with PagedResult directly
   */
  getMessagesPagedSimplified(request: MessagePagedRequest): Observable<PagedResult<MessageWithUser>> {
    let params = new HttpParams()
      .set('PageNumber', (request.pageNumber || 1).toString())
      .set('PageSize', (request.pageSize || 10).toString());

    // Add optional parameters
    if (request.sortBy) {
      params = params.set('SortBy', request.sortBy);
    }

    if (request.sortDescending !== undefined) {
      params = params.set('SortDescending', request.sortDescending.toString());
    }

    if (request.searchTerm) {
      params = params.set('SearchTerm', request.searchTerm);
    }

    if (request.title) {
      params = params.set('Title', request.title);
    }

    if (request.contentType !== undefined) {
      params = params.set('ContentType', request.contentType.toString());
    }

    if (request.isActive !== undefined) {
      params = params.set('IsActive', request.isActive.toString());
    }
    if (request.storeId) {
      params = params.set('StoreId', request.storeId);
    }

    return this.http.get<HttpResponseData<PagedResult<MessageWithUser>>>(
      `${this.API_URL}/message/paged`,
      { params }
    ).pipe(
      map(response => {
        const result = response.result;

        if (result) {
          return {
            items: result.items || [],
            totalCount: result.totalCount || 0,
            pageNumber: result.pageNumber || (request.pageNumber || 1),
            pageSize: result.pageSize || (request.pageSize || 10),
            totalPages: result.totalPages || Math.ceil((result.totalCount || 0) / (request.pageSize || 10)),
            searchTerm: result.searchTerm || request.searchTerm || '',
            hasPreviousPage: result.hasPreviousPage || false,
            hasNextPage: result.hasNextPage || false,
            hasResults: (result.items?.length || 0) > 0
          };
        }

        // Fallback empty result
        return {
          items: [],
          totalCount: 0,
          pageNumber: request.pageNumber || 1,
          pageSize: request.pageSize || 10,
          totalPages: 0,
          searchTerm: request.searchTerm || '',
          hasPreviousPage: false,
          hasNextPage: false,
          hasResults: false
        };
      }),
      catchError(error => {
        console.error('Error loading messages:', error);
        return of({
          items: [],
          totalCount: 0,
          pageNumber: request.pageNumber || 1,
          pageSize: request.pageSize || 10,
          totalPages: 0,
          searchTerm: request.searchTerm || '',
          hasPreviousPage: false,
          hasNextPage: false,
          hasResults: false
        });
      })
    );
  }

  /**
   * Get messages with pagination using SearchParams interface
   * @param params Standard search parameters
   * @returns Observable with PagedResult
   */
  getMessagesPagedByParams(params: SearchParams & {
    title?: string;
    contentType?: number;
    isActive?: boolean;
    createdBy?: number;
    storeId?: number;
  }): Observable<PagedResult<MessageWithUser>> {
    let httpParams = new HttpParams()
      .set('PageNumber', (params.pageNumber || 1).toString())
      .set('PageSize', (params.pageSize || 10).toString());

    if (params.searchTerm) {
      httpParams = httpParams.set('SearchTerm', params.searchTerm);
    }

    if (params.sortBy) {
      httpParams = httpParams.set('SortBy', params.sortBy);
    }

    if (params.sortDescending !== undefined) {
      httpParams = httpParams.set('SortDescending', params.sortDescending.toString());
    }

    if (params.title) {
      httpParams = httpParams.set('Title', params.title);
    }

    if (params.contentType !== undefined) {
      httpParams = httpParams.set('ContentType', params.contentType.toString());
    }

    if (params.isActive !== undefined) {
      httpParams = httpParams.set('IsActive', params.isActive.toString());
    }

    if (params.createdBy !== undefined) {
      httpParams = httpParams.set('CreatedBy', params.createdBy.toString());
    }

    if (params.storeId !== undefined) {
      httpParams = httpParams.set('StoreId', params.storeId);
    }

    return this.http
      .get<HttpResponseData<PagedResult<MessageWithUser>>>(
        `${this.API_URL}/message/paged`,
        { params: httpParams }
      )
      .pipe(
        map(response => ({
          items: response.result?.items ?? [],
          totalCount: response.result?.totalCount ?? 0,
          pageNumber: response.result?.pageNumber ?? params.pageNumber ?? 1,
          pageSize: response.result?.pageSize ?? params.pageSize ?? 10,
          totalPages:
            response.result?.totalPages ??
            Math.ceil((response.result?.totalCount ?? 0) / (params.pageSize ?? 10)),
          searchTerm: response.result?.searchTerm ?? params.searchTerm ?? '',
          hasPreviousPage: response.result?.hasPreviousPage ?? false,
          hasNextPage: response.result?.hasNextPage ?? false,
          hasResults: (response.result?.items?.length ?? 0) > 0
        })),
        catchError(() =>
          of({
            items: [],
            totalCount: 0,
            pageNumber: params.pageNumber ?? 1,
            pageSize: params.pageSize ?? 10,
            totalPages: 0,
            searchTerm: params.searchTerm ?? '',
            hasPreviousPage: false,
            hasNextPage: false,
            hasResults: false
          })
        )
      );
  }

  // ============ MESSAGE CRUD OPERATIONS ============

  /**
   * Get message by ID
   * @param id Message ID
   * @param storeId Store ID
   * @returns Observable with message details
   */
  getMessageById(id: number, storeId?: number): Observable<MessageWithUser> {
    // Build query params
    let params = new HttpParams();
    if (storeId != null) {
      params = params.set('storeId', storeId.toString());
    }

    return this.http.get<HttpResponseData<MessageWithUser>>(
      `${this.API_URL}/messages/${id}`,
      { params }
    ).pipe(
      map(response => {
        if (response.success && response.result) {
          return response.result;
        } else {
          throw new Error(response.error || response.message || `Message with ID ${id} not found`);
        }
      }),
      catchError(this.handleError)
    );
  }


  /**
   * Create a new message
   * @param message Message data to create
   * @returns Observable with created message
   */
  createMessage(message: Partial<Message>): Observable<MessageWithUser> {
    return this.http.post<HttpResponseData<MessageWithUser>>(
      `${this.API_URL}/messages`,
      message,
      this.getHttpOptions()
    ).pipe(
      map(response => {
        if (response.success && response.result) {
          return response.result;
        } else {
          throw new Error(response.error || response.message || 'Failed to create message');
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Update an existing message
   * @param id Message ID
   * @param message Updated message data
   * @returns Observable with updated message
   */
  updateMessage(id: number, message: Partial<Message>): Observable<MessageWithUser> {
    return this.http.put<HttpResponseData<MessageWithUser>>(
      `${this.API_URL}/messages/${id}`,
      message,
      this.getHttpOptions()
    ).pipe(
      map(response => {
        if (response.success && response.result) {
          return response.result;
        } else {
          throw new Error(response.error || response.message || 'Failed to update message');
        }
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Delete a message
   * @param id Message ID
   * @returns Observable with delete result
   */
  // deleteMessage(id: number): Observable<HttpResponseData<boolean>> {
  //   return this.http.delete<HttpResponseData<boolean>>(
  //     `${this.API_URL}/messages/${id}`
  //   ).pipe(
  //     catchError(this.handleError)
  //   );
  // }

  /**
   * Toggle message active status
   * @param id Message ID
   * @param isActive New active status
   * @returns Observable with update result
   */
  toggleMessageStatus(id: number, isActive: boolean): Observable<HttpResponseData<boolean>> {
    return this.http.patch<HttpResponseData<boolean>>(
      `${this.API_URL}/messages/${id}/status`,
      { isActive },
      this.getHttpOptions()
    ).pipe(
      catchError(this.handleError)
    );
  }



  getMessagesByIds(ids: number[]): Observable<MessageWithUser[]> {
    return this.http
      .post<HttpResponseData<MessageWithUser[]>>(
        `${this.API_URL}/message/messages/by-ids`,
        ids
      )
      .pipe(
        map(response => {
          if (response.success && response.result) {
            return response.result;
          } else {
            throw new Error(
              response.error ||
              response.message ||
              'Failed to retrieve templates'
            );
          }
        }),
        catchError(this.handleError)
      );
  }


  //#region  message service calls

  getMessages(storeId?: number): Observable<Message[]> {
    let params = new HttpParams();
    if (storeId != null) {
      params = params.set('storeId', storeId.toString());
    }
    return this.http.get<HttpResponseData<Message[]>>(`${this.API_URL}/message`, { params }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch messages');
        }
        return response.result || [];
      }),
      catchError(this.handleError)
    );
  }



  getMessagesWithUser(storeId?: number): Observable<MessageWithUser[]> {
    let params = new HttpParams();
    if (storeId != null) {
      params = params.set('storeId', storeId.toString());
    }
    return this.http.get<HttpResponseData<MessageWithUser[]>>(`${this.API_URL}/message/with-users`, { params }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch messages with users');
        }
        return response.result || [];
      }),
      catchError(this.handleError)
    );
  }


  // getMessagesWithUser(): Observable<MessageWithUser[]> {
  //   return this.http.get<HttpResponseData<MessageWithUser[]>>(`${this.API_URL}/message/with-users`).pipe(
  //     map(response => {
  //       if (!response.success) {
  //         throw new Error(response.message || 'Failed to fetch messages with users');
  //       }
  //       return response.result || [];
  //     }),
  //     catchError(this.handleError)
  //   );
  // }

  createGeneralMessage(data: {
    content_data: string;
    title: string;
    duration: number;
    createdBy: number;
    storeId?: number;
    ScreenSizeId: number;
  }): Observable<Message> {
    return this.http.post(
      `${this.API_URL}/message/general`,
      data,
      {
        observe: 'response',
        responseType: 'text' // Get raw response first for debugging
      }
    ).pipe(
      map(httpResponse => {
        console.log('Raw response:', httpResponse.body);
        console.log('Status:', httpResponse.status);

        try {
          const response = JSON.parse(httpResponse.body || '{}') as HttpResponseData<Message>;

          if (httpResponse.status === 201 || httpResponse.status === 200) {
            if (response.success) {
              return response.result!;
            } else {
              throw new Error(response.message || 'Failed to create general message');
            }
          } else {
            throw new Error(response.message || `HTTP ${httpResponse.status}`);
          }
        } catch (e) {
          console.error('JSON parse error:', e);
          throw new Error('Invalid response format from server');
        }
      }),
      catchError(this.handleError)
    );
  }

  uploadImageMessage(formData: FormData): Observable<Message> {
    return this.http.post<HttpResponseData<Message>>(`${this.API_URL}/message/image`, formData).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to upload image message');
        }
        return response.result!;
      }),
      catchError(this.handleError)
    );
  }

  uploadVideoMessage(formData: FormData): Observable<Message> {
    return this.http.post<HttpResponseData<Message>>(`${this.API_URL}/message/video`, formData).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to upload video message');
        }
        return response.result!;
      }),
      catchError(this.handleError)
    );
  }

  createCustomImageMessage(messageData: {
    title: string;
    fabric_js_data: string;
    image_data: string;
    duration: number;
    createdBy: number;
    storeId?: number;
    screenSizeId: number;
  }): Observable<Message> {
    return this.http.post<HttpResponseData<Message>>(`${this.API_URL}/message/custom-image`, messageData).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to create custom image message');
        }
        return response.result!;
      }),
      catchError(this.handleError)
    );
  }

  updateGeneralMessage(payload: any): Observable<Message> {
    return this.http.put<HttpResponseData<Message>>(
      `${this.API_URL}/message/general/${payload.id}`,
      payload
    ).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to update general message');
        }
        return response.result!;
      }),
      catchError(this.handleError)
    );
  }

  updateImageMessage(formData: FormData): Observable<Message> {
    const id = formData.get('id');
    return this.http.put<HttpResponseData<Message>>(
      `${this.API_URL}/message/image/${id}`,
      formData
    ).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to update image message');
        }
        return response.result!;
      }),
      catchError(this.handleError)
    );
  }

  updateVideoMessage(formData: FormData): Observable<Message> {
    const id = formData.get('id');
    return this.http.put<HttpResponseData<Message>>(
      `${this.API_URL}/message/video/${id}`,
      formData
    ).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to update video message');
        }
        return response.result!;
      }),
      catchError(this.handleError)
    );
  }

  updateCustomImageMessage(messageData: any): Observable<Message> {
    return this.http.put<HttpResponseData<Message>>(
      `${this.API_URL}/message/custom-image/${messageData.id}`,
      messageData
    ).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to update custom image message');
        }
        return response.result!;
      }),
      catchError(this.handleError)
    );
  }

  deleteMessage(id: number, userId: number, storeId?: number): Observable<boolean> {
    let params = new HttpParams();
    if (storeId != null) {
      params = params.set('storeId', storeId.toString());
    }
    return this.http.delete<HttpResponseData<boolean>>(
      `${this.API_URL}/message/${id}?userId=${userId}`, { params }
    ).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to delete message');
        }
        return response.result || false;
      }),
      catchError(this.handleError)
    );
  }
  //#endregion

  // ============ HELPER METHODS ============

  /**
   * Format date for API request
   * @param date Date to format
   * @returns Formatted date string
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  /**
   * Handle HTTP errors
   * @param error Error response
   * @returns Observable with error
   */
  private handleError(error: any): Observable<never> {
    console.error('Message Service Error:', error);

    let errorMessage = 'An unexpected error occurred';

    if (error instanceof HttpErrorResponse) {
      if (error.status === 404) {
        errorMessage = error.error?.message || 'Message not found';
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

    console.error('Message Service Error Details:', {
      message: errorMessage,
      originalError: error,
      timestamp: new Date().toISOString()
    });

    return throwError(() => new Error(errorMessage));
  }
}
