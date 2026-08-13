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
    // Accept both `roles: string[]` and the legacy singular `role`, which may be
    // a single role name or an array. Anything else is treated as "no restriction".
    const declared = route.data?.['roles'] ?? route.data?.['role'];
    const requiredRoles: string[] | null = Array.isArray(declared)
      ? declared
      : typeof declared === 'string'
        ? [declared]
        : null;

    return this.authService.currentUser$.pipe(
      take(1),
      map(user => {
        if (!user) {
          this.router.navigate(['/auth']);
          return false;
        }

        // Check if user has any of the required roles
        if (requiredRoles?.length && !this.authService.hasAnyRole(requiredRoles)) {
          this.router.navigate(['/unauthorized']);
          return false;
        }

        return true;
      })
    );
  }
}