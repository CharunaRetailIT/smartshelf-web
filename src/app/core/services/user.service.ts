import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { User, Role, Department, CreateUserDto, UpdateUserDto, AssignRoleDto, UpdateUserResponse, UserProfile } from '../interfaces/user.interface';
import { ConfigService } from './app-config.service';
import { environment } from '../../../environments/environment';
import { HttpResponseData } from '../interfaces/http-response.interface';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);

  private usersSubject = new BehaviorSubject<User[]>([]);
  public users$ = this.usersSubject.asObservable();

  private readonly API_URL = environment.apiUrl || 'https://localhost:44321/api';

  //#region Users
  getUsers(): void {
    this.http.get<HttpResponseData<any>>(`${this.API_URL}/user`)
      .pipe(
        map(response => {
          if (response.success) {
            const users = response.results || response.result || [];
            console.log('Extracted users:', users);
            return users;
          } else {
            console.error('API error:', response.error || response.message);
            return [];
          }
        }),
        tap(users => {
          console.log('Final users to emit:', users);
          this.usersSubject.next(users);
        }),
        catchError(this.handleError)
      )
      .subscribe();
  }

  getUserById(userId: string): Observable<User> {
    return this.http.get<HttpResponseData<User>>(`${this.API_URL}/user/${userId}`)
      .pipe(
        map(response => {
          if (response.success && response.result) {
            return response.result;
          } else {
            throw new Error(response.error || response.message || 'User not found');
          }
        }),
        catchError(this.handleError)
      );
  }

  createUser(createUserDto: CreateUserDto): Observable<User> {
    return this.http.post<HttpResponseData<User>>(`${this.API_URL}/auth/register`, createUserDto, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      map(response => {
        if (response.success && response.result) {
          return response.result;
        } else {
          throw new Error(response.error || response.message || 'Failed to create user');
        }
      }),
      catchError(this.handleError)
    );
  }

  updateUser(userId: number, dto: UpdateUserDto): Observable<{ statusCode: number; data: any; message: string }> {
    return this.http.put<HttpResponseData<any>>(`${this.API_URL}/user/${userId}`, dto, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      observe: 'response'
    }).pipe(
      map((response: HttpResponse<HttpResponseData<any>>) => {
        const body = response.body;
        if (body?.success) {
          return {
            statusCode: response.status,
            data: body.result,
            message: body.message || 'Update successful'
          };
        } else {
          throw new Error(body?.error || body?.message || 'Update failed');
        }
      }),
      catchError(this.handleError)
    );
  }

  deleteUser(employeeId: number): Observable<void> {
    return this.http.delete<HttpResponseData<void>>(`${this.API_URL}/user/${employeeId}`)
      .pipe(
        map(response => {
          if (response.success) {
            return;
          } else {
            throw new Error(response.error || response.message || 'Failed to delete user');
          }
        }),
        catchError(this.handleError)
      );
  }

  // Restore user (reactivate)
  restoreUser(employeeId: number): Observable<void> {
    return this.http.put<HttpResponseData<void>>(`${this.API_URL}/user/${employeeId}/restore`, {})
      .pipe(
        map(response => {
          if (response.success) {
            return;
          } else {
            throw new Error(response.error || response.message || 'Failed to restore user');
          }
        }),
        catchError(this.handleError)
      );
  }
  assignRole(assignRoleDto: AssignRoleDto): Observable<any> {
    return this.http.post<HttpResponseData<any>>(`${this.API_URL}/user/assign-role`, assignRoleDto, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).pipe(
      map(response => {
        if (response.success) {
          return response.result;
        } else {
          throw new Error(response.error || response.message || 'Failed to assign role');
        }
      }),
      catchError(this.handleError)
    );
  }

  getDepartments(): Observable<Department[]> {
    return this.http.get<HttpResponseData<Department[]>>(`${this.API_URL}/user/departments`)
      .pipe(
        map(response => {
          if (response.success && response.result) {
            return response.result;
          } else {
            console.error('API error:', response.error || response.message);
            return [];
          }
        }),
        catchError(this.handleError)
      );
  }

  getRoles(): Observable<Role[]> {
    return this.http.get<HttpResponseData<Role[]>>(`${this.API_URL}/user/roles`)
      .pipe(
        map(response => {
          if (response.success && response.result) {
            return response.result;
          } else {
            console.error('API error:', response.error || response.message);
            return [];
          }
        }),
        catchError(this.handleError)
      );
  }

  getCurrentUserRole(): Observable<string> {
    return new Observable(observer => observer.next('Admin'));
  }


  /**
   * Get current user's profile
   */
  getMyProfile(): Observable<HttpResponseData<UserProfile>> {
    return this.http.get<HttpResponseData<UserProfile>>(`${this.API_URL}/auth/me`);
  }

  /**
   * Update current user's profile
   */
  updateMyProfile(data: UpdateUserDto): Observable<HttpResponseData<UserProfile>> {
    return this.http.put<HttpResponseData<UserProfile>>(`${this.API_URL}/auth/me`, data);
  }

  /**
   * Upload profile image for current user
   */
  // uploadProfileImage(file: File): Observable<HttpResponseData<string>> {
  //   const formData = new FormData();
  //   formData.append('file', file);

  //   return this.http.post<HttpResponseData<string>>(
  //     `${this.API_URL}/auth/me/profile-image`,
  //     formData
  //   );
  // }

  uploadProfileImage(file: File): Observable<HttpResponseData<{
    profileImagePath: string;
    profileImageUrl: string;
    user: any;
  }>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<HttpResponseData<any>>(
      `${this.API_URL}/auth/me/profile-image`,
      formData
    );
  }


  /**
   * Get profile image URL
   */
  getProfileImageUrl(profileImagePath: string | null): string {
    if (!profileImagePath) {
      return '';
    }
    return `${environment.apiUrl}${profileImagePath}`;
  }

  /**
   * Validate image file
   */
  validateImageFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 20_000_000; // 20MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

    if (file.size > maxSize) {
      return { valid: false, error: 'File size must be less than 20MB' };
    }

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Only image files (JPEG, PNG, GIF) are allowed' };
    }

    return { valid: true };
  }

  //#endregion

  //#region Handle Error
  private handleError(error: any): Observable<never> {
    console.error('API Error:', error);
    const errorMessage = error?.error?.message || error?.message || 'Something went wrong';
    return throwError(() => new Error(errorMessage));
  }
  //#endregion

  testApiCall(): void {
    this.http.get<any>(`${this.API_URL}/user`).subscribe({
      next: (response) => {
        console.log('Direct API test response:', response);
        console.log('Response success:', response.success);
        console.log('Response results:', response.results);
        console.log('Response result:', response.result);
        console.log('Response message:', response.message);
      },
      error: (error) => {
        console.error('Direct API test error:', error);
      }
    });
  }
}
