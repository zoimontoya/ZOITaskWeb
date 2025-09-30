import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Trabajador {
  codigo: string;
  nombre: string;
  empresa: string;
}

export interface TrabajadorAsignado {
  trabajador: Trabajador;
  horas: number;
}

@Injectable({
  providedIn: 'root'
})
export class TrabajadoresService {
  private apiUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  // Obtener todos los trabajadores
  getTrabajadores(): Observable<Trabajador[]> {
    return this.http.get<Trabajador[]>(`${this.apiUrl}/trabajadores`);
  }
}