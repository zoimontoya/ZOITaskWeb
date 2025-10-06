import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './auth.service';
import { Observable, of } from 'rxjs';
import { map, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    console.log('🛡️ AuthGuard - Verificando acceso a:', state.url);
    
    // Verificar inmediatamente el token del localStorage
    const token = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('currentUser');
    
    console.log('🛡️ AuthGuard - Token en localStorage:', !!token);
    console.log('🛡️ AuthGuard - Usuario en localStorage:', !!userStr);
    
    if (token && userStr) {
      console.log('✅ AuthGuard - Token y usuario presentes, acceso permitido');
      return of(true);
    } else {
      console.log('🚫 AuthGuard - Sin token o usuario, redirigiendo a /login');
      this.router.navigate(['/login']);
      return of(false);
    }
  }
}

@Injectable({
  providedIn: 'root'
})
export class LoginGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    console.log('🔐 LoginGuard - Verificando acceso a:', state.url);
    
    // Verificar inmediatamente el token del localStorage
    const token = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('currentUser');
    
    console.log('🔐 LoginGuard - Token en localStorage:', !!token);
    console.log('🔐 LoginGuard - Usuario en localStorage:', !!userStr);
    
    if (!token || !userStr) {
      console.log('✅ LoginGuard - Sin autenticación, acceso permitido a /login');
      return of(true);
    } else {
      console.log('🚫 LoginGuard - Ya autenticado, redirigiendo a /app');
      this.router.navigate(['/app']);
      return of(false);
    }
  }
}