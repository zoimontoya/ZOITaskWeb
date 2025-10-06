import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, debounceTime } from 'rxjs';
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
  public currentUser$ = this.currentUserSubject.asObservable().pipe(
    debounceTime(100) // Evita múltiples emisiones rápidas durante cambios de usuario
  );
  
  private isProcessingAuth = false; // Flag para evitar múltiples procesados simultáneos

  constructor(
    private http: HttpClient
  ) {
    console.log('🏗️ AuthService constructor iniciado');
    
    // Pequeño delay para asegurar que localStorage está disponible
    setTimeout(() => {
      // Restaurar usuario inmediatamente del localStorage si existe
      this.restoreUserFromStorage();
      // Luego verificar si hay un token guardado
      this.checkStoredToken();
    }, 10);
    
    console.log('🏗️ AuthService constructor completado');
  }

  /**
   * Restaurar usuario del localStorage inmediatamente
   */
  private restoreUserFromStorage() {
    console.log('🔄 restoreUserFromStorage() iniciado');
    const token = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('currentUser');
    
    console.log('🔍 Token en localStorage:', !!token);
    console.log('🔍 Usuario en localStorage:', !!userStr);
    
    const user = this.getCurrentUser();
    if (user) {
      console.log('👤 Usuario restaurado del localStorage:', user.name, '| Rol:', user.rol);
      this.currentUserSubject.next(user);
    } else {
      console.log('❌ No se pudo restaurar usuario del localStorage');
    }
  }

  /**
   * Verificar si hay un token guardado y si es válido
   */
  private checkStoredToken() {
    if (this.isProcessingAuth) {
      console.log('🔄 Ya procesando autenticación, saltando verificación duplicada');
      return;
    }
    
    const token = this.getToken();
    if (token) {
      this.isProcessingAuth = true;
      // Verificar si el token es válido
      this.verifyToken(token).subscribe({
        next: (response) => {
          this.isProcessingAuth = false;
          if (response.success) {
            this.currentUserSubject.next(response.user);
            console.log('✅ Sesión restaurada automáticamente:', response.user);
          } else {
            // Token inválido, limpiar
            this.logout();
          }
        },
        error: () => {
          this.isProcessingAuth = false;
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
    
    // Evitar múltiples logins simultáneos
    if (this.isProcessingAuth) {
      console.log('🔄 Login ya en proceso, rechazando duplicado');
      return new Observable(observer => {
        observer.next({ success: false, message: 'Login ya en proceso' });
        observer.complete();
      });
    }
    
    this.isProcessingAuth = true;
    
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
            
            // Actualizar el usuario actual con delay para evitar race conditions
            setTimeout(() => {
              this.currentUserSubject.next(response.user);
              this.isProcessingAuth = false;
            }, 50);
            
            console.log('✅ Login exitoso con JWT:', response.user);
            console.log('🎫 Token disponible después del login:', !!this.getToken());
            
            observer.next(response);
            observer.complete();
          } else {
            this.isProcessingAuth = false;
            console.log('❌ Login fallido:', response);
            observer.next(response);
            observer.complete();
          }
        },
        error: (error) => {
          this.isProcessingAuth = false;
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
    this.isProcessingAuth = false; // Reset del flag
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    // Delay para evitar race conditions con login inmediato
    setTimeout(() => {
      this.currentUserSubject.next(null);
    }, 50);
    
    console.log('🚪 Sesión cerrada');
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();
    
    console.log('🔍 isAuthenticated() - Token presente:', !!token);
    console.log('🔍 isAuthenticated() - Usuario presente:', !!user);
    console.log('🔍 isAuthenticated() - Token valor:', token ? token.substring(0, 20) + '...' : 'null');
    
    // Solo verificar token - el usuario se carga asíncronamente
    const result = token !== null;
    console.log('🔍 isAuthenticated() - Resultado:', result);
    return result;
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