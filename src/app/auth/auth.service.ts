import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: string;
  name: string;
  rol: string;
  grupo_trabajo: string;
  cabezal: string;
  nombre_completo: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient
  ) {
    // Al iniciar el servicio, verificar si hay un token guardado
    this.checkStoredToken();
  }

  /**
   * Verificar si hay un token guardado y si es válido
   */
  private checkStoredToken() {
    const token = this.getToken();
    if (token) {
      // Verificar si el token es válido
      this.verifyToken(token).subscribe({
        next: (response) => {
          if (response.success) {
            this.currentUserSubject.next(response.user);
            console.log('✅ Sesión restaurada automáticamente:', response.user);
          } else {
            // Token inválido, limpiar
            this.logout();
          }
        },
        error: () => {
          // Error verificando token, limpiar
          this.logout();
        }
      });
    }
  }

  /**
   * Iniciar sesión
   */
  login(credentials: { id: string; password: string }): Observable<any> {
    console.log('🔐 AuthService.login() - Iniciando login con:', credentials.id);
    
    return new Observable(observer => {
      this.http.post<any>(`${environment.apiBaseUrl}/login`, credentials).subscribe({
        next: (response) => {
          console.log('🔄 Login response recibida:', response);
          
          if (response.success && response.token) {
            // Guardar token y usuario
            localStorage.setItem('authToken', response.token);
            localStorage.setItem('currentUser', JSON.stringify(response.user));
            
            console.log('💾 Token guardado en localStorage:', !!localStorage.getItem('authToken'));
            console.log('👤 Usuario guardado en localStorage:', !!localStorage.getItem('currentUser'));
            
            // Actualizar el usuario actual
            this.currentUserSubject.next(response.user);
            
            console.log('✅ Login exitoso con JWT:', response.user);
            console.log('🎫 Token disponible después del login:', !!this.getToken());
            
            observer.next(response);
            observer.complete();
          } else {
            console.log('❌ Login fallido:', response);
            observer.next(response);
            observer.complete();
          }
        },
        error: (error) => {
          observer.error(error);
        }
      });
    });
  }

  /**
   * Verificar si un token es válido
   */
  private verifyToken(token: string): Observable<any> {
    return this.http.post<any>(`${environment.apiBaseUrl}/verify-token`, { token });
  }

  /**
   * Manejar errores de autenticación
   */
  handleAuthError(error: any): boolean {
    if (error.status === 401 || error.error?.requiresAuth) {
      console.log('🚫 Error de autenticación detectado - Cerrando sesión');
      this.logout();
      return true;
    }
    return false;
  }

  /**
   * Cerrar sesión
   */
  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    console.log('🚪 Sesión cerrada');
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    return this.getToken() !== null && this.getCurrentUser() !== null;
  }

  /**
   * Obtener el token actual
   */
  getToken(): string | null {
    const token = localStorage.getItem('authToken');
    console.log('🎫 AuthService.getToken() llamado - Token disponible:', !!token);
    return token;
  }

  /**
   * Obtener el usuario actual
   */
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * Obtener el usuario actual como Observable
   */
  getCurrentUser$(): Observable<User | null> {
    return this.currentUser$;
  }

  /**
   * Verificar si el usuario es encargado
   */
  isEncargado(): boolean {
    const user = this.getCurrentUser();
    return user?.rol === 'encargado';
  }

  /**
   * Verificar si el usuario es superior
   */
  isSuperior(): boolean {
    const user = this.getCurrentUser();
    return user?.rol === 'superior';
  }
}