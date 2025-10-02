import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  
  // Obtener el token actual
  const token = authService.getToken();
  
  console.log('🔄 HTTP Request:', request.method, request.url);
  console.log('🎫 Token disponible:', !!token);
  
  // Si hay token, agregarlo a las headers
  if (token) {
    const authRequest = request.clone({
      headers: request.headers.set('Authorization', `Bearer ${token}`)
    });
    
    console.log('✅ Token agregado a headers para:', request.url);
    
    return next(authRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        // Manejar errores de autenticación
        if (authService.handleAuthError(error)) {
          // Error de autenticación manejado, no propagar
          return throwError(() => new Error('Sesión expirada'));
        }
        // Propagar otros errores
        return throwError(() => error);
      })
    );
  }
  
  // Si no hay token, continuar con la request original
  console.log('⚠️ Sin token - Request sin autorización para:', request.url);
  
  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      // Aún así, verificar si es un error de autenticación
      authService.handleAuthError(error);
      return throwError(() => error);
    })
  );
};