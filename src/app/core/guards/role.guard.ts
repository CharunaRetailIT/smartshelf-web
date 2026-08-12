import { inject, Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";
import { map, Observable, take } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  private authService = inject(AuthService);
  private router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    const requiredRoles = route.data?.['roles'] as string[];
    const requiredRole = route.data?.['role'] as string;

    return this.authService.currentUser$.pipe(
      take(1),
      map(user => {
        if (!user) {
          this.router.navigate(['/auth']);
          return false;
        }

        // Check if user has any of the required roles
        if (requiredRoles && !this.authService.hasAnyRole(requiredRoles)) {
          this.router.navigate(['/unauthorized']);
          return false;
        }

        // Check if user has access based on role hierarchy
        if (requiredRole && !this.authService.canAccess(requiredRole)) {
          this.router.navigate(['/unauthorized']);
          return false;
        }

        return true;
      })
    );
  }
}