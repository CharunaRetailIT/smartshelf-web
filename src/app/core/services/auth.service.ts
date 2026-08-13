import { Injectable, inject, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { ConfigService } from '../services/app-config.service';
import { SettingsService } from '../services/settings.service';
import { JwtPayload, LoginApiResponse, LoginRequest, LoginResponse, RegisterRequest, User } from '../interfaces/auth.interface';
import { environment } from '../../../environments/environment';
import { HttpResponseData } from '../interfaces/http-response.interface';



@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private config = inject(ConfigService);
  private settingsService = inject(SettingsService);

  // private get API_URL(): string {
  //   return this.config.getConfig().authUrl;
  // }
  private readonly API_URL = environment.apiUrl || 'https://localhost:44321/api';
  private readonly TOKEN_KEY = 'auth_token';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);

  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.currentUser$.pipe(map(user => !!user));

  constructor(@Inject(PLATFORM_ID) private platformId: any) {
    this.loadTokenFromStorage();
  }

  //#region Token & Cookie Management
  private getStoredToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return this.getCookie(this.TOKEN_KEY) || localStorage.getItem(this.TOKEN_KEY);
  }

  private getCookie(name: string): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const match = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
    return match ? match.split('=')[1] : null;
  }

  private setCookie(name: string, value: string, days: number = 7): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value};expires=${expires};path=/;secure;samesite=strict`;
  }

  private deleteCookie(name: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/`;
  }
  //#endregion

  //#region Token Decode & User Management
  private isTokenExpired(token: string): boolean {
    try {
      const decoded: JwtPayload = jwtDecode(token);
      return decoded.exp < Math.floor(Date.now() / 1000);
    } catch {
      return true;
    }
  }

  private loadUserFromToken(token: string): void {
    try {
      const decoded: any = jwtDecode(token);
      const user: User = {
        id: parseInt(decoded.id),
        employeeId: decoded.unique_name,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        email: decoded.email,
        departmentId: decoded.departmentId,
        profileImageUrl: decoded.profileImageUrl,
        roles: [decoded.role]
      };
      this.currentUserSubject.next(user);
    } catch {
      this.clearAuth();
    }
  }

  private loadTokenFromStorage(): void {
    const token = this.getStoredToken();
    if (token && !this.isTokenExpired(token)) {
      this.tokenSubject.next(token);
      this.loadUserFromToken(token);
    } else {
      this.clearAuth();
    }
  }
  //#endregion

  //#region API Calls
  login(credentials: LoginRequest): Observable<HttpResponseData<LoginResponse>> {
    return this.http.post<HttpResponseData<LoginResponse>>(`${this.API_URL}/auth/login`, credentials)
      .pipe(map(res => {
        const loginData = res.result;
        this.setAuth(loginData.token, loginData.user);
        // Force a fresh pick of the default store on every login so a stale
        // cached copy (e.g. one saved before a store field like MinewStoreId
        // was added to the API response) never lingers across sessions.
        this.settingsService.clearDefaultStore();
        return res;
      }));
  }

  register(userData: RegisterRequest): Observable<any> {
    return this.http.post(`${this.API_URL}/auth/register`, userData);
  }

  getCurrentUser(): Observable<User> {
    const token = this.getStoredToken();
    if (!token) throw new Error('No token available');

    return this.http
      .get<HttpResponseData<User>>(`${this.API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .pipe(
        map(res => {
          if (res.success && res.result) {
            this.currentUserSubject.next(res.result);
            return res.result;
          }
          throw new Error(res.message);
        })
      );
  }

  // getCurrentUser(): Observable<User> {
  //   const token = this.getStoredToken();
  //   if (!token) throw new Error('No token available');
  //   return this.http.get<User>(`${this.API_URL}/auth/me`, {
  //     headers: { Authorization: `Bearer ${token}` }
  //   }).pipe(map(user => { this.currentUserSubject.next(user); return user; }));
  // }
  //#endregion

  //#region Auth Helpers
  private setAuth(token: string, user: User): void {
    if (isPlatformBrowser(this.platformId)) {
      this.setCookie(this.TOKEN_KEY, token, 7);
      localStorage.setItem(this.TOKEN_KEY, token);
    }
    this.tokenSubject.next(token);
    this.currentUserSubject.next(user);
  }

  logout(): void {
    this.clearAuth();
    this.router.navigate(['/auth']);
  }

  private clearAuth(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.deleteCookie(this.TOKEN_KEY);
      localStorage.removeItem(this.TOKEN_KEY);
    }
    this.tokenSubject.next(null);
    this.currentUserSubject.next(null);
  }

  getToken(): string | null { return this.tokenSubject.value; }
  getCurrentUserValue(): User | null { return this.currentUserSubject.value; }
  //#endregion

  //#region Role Checks
  hasRole(role: string): boolean {
    const user = this.getCurrentUserValue();
    return user?.roles.includes(role) || false;
  }

  hasAnyRole(roles: string[]): boolean {
    const user = this.getCurrentUserValue();
    return !!user && roles.some(role => user.roles.includes(role));
  }

  canAccess(requiredRole: string): boolean {
    const user = this.getCurrentUserValue();
    if (!user) return false;
    const roleHierarchy: Record<string, number> = { 'Viewer': 1, 'User': 1, 'Operator': 2, 'Manager': 3, 'Admin': 4 };
    return (roleHierarchy[user.roles[0]] || 0) >= (roleHierarchy[requiredRole] || 0);
  }
  //#endregion
}
