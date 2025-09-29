import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Greenhouse {
  nombre: string;
  dimensiones: string;
}

export interface Cabezal {
  nombre: string;
  invernaderos: Greenhouse[];
}

export interface GreenhouseResponse {
  cabezales: Cabezal[];
}

@Injectable({ providedIn: 'root' })
export class GreenhouseService {
  private apiUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  // Obtener todos los invernaderos (mantener para compatibilidad)
  getGreenhouses(): Observable<Greenhouse[]> {
    return this.http.get<GreenhouseResponse>(`${this.apiUrl}/invernaderos`).pipe(
      map(response => {
        // Aplanar todos los invernaderos de todos los cabezales
        return response.cabezales.flatMap(cabezal => cabezal.invernaderos);
      })
    );
  }
  
  // Obtener invernaderos filtrados por cabezal
  getGreenhousesByCabezal(cabezal: string): Observable<GreenhouseResponse> {
    return this.http.get<GreenhouseResponse>(`${this.apiUrl}/invernaderos/${cabezal}`);
  }
  
  // Obtener todos los invernaderos agrupados por cabezal
  getGreenhousesGrouped(): Observable<GreenhouseResponse> {
    return this.http.get<GreenhouseResponse>(`${this.apiUrl}/invernaderos`);
  }
}
