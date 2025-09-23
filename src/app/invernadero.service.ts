import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) { }

  getInvernaderos(): Observable<InvernaderosResponse> {
    return this.http.get<InvernaderosResponse>(`${this.baseUrl}/invernaderos`);
  }
}