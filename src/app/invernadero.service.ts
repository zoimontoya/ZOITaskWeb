import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface Invernadero {
  nombre: string;
  dimension: number;
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

  getInvernaderos(): Observable<InvernaderosResponse> {
    return this.http.get<InvernaderosResponse>(`${this.baseUrl}/invernaderos`);
  }
}