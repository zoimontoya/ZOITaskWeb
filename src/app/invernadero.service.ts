import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface Invernadero {
  nombre: string;
  dimensiones: string;
}

export interface Cabezal {
  nombre: string;
  invernaderos: Invernadero[];
}

export interface InvernaderosResponse {
  cabezales: Cabezal[];
}

@Injectable({
  providedIn: 'root'
})
export class InvernaderoService {
  private baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) { }

  // Obtener todos los invernaderos agrupados por cabezal
  getInvernaderos(): Observable<InvernaderosResponse> {
    return this.http.get<InvernaderosResponse>(`${this.baseUrl}/invernaderos`);
  }
  
  // Obtener invernaderos filtrados por cabezal específico
  getInvernaderosByCabezal(cabezal: string): Observable<InvernaderosResponse> {
    return this.http.get<InvernaderosResponse>(`${this.baseUrl}/invernaderos/${cabezal}`);
  }
}