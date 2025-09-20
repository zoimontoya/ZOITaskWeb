import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserService {
  private apiUrl = 'http://localhost:3000'; // Cambia si despliegas el backend en otro sitio

  constructor(private http: HttpClient) {}

  login(id: string, password: string): Observable<{ success: boolean; id?: string; rol?: string; name?: string; error?: string }> {
    return this.http.post<{ success: boolean; id?: string; rol?: string; name?: string; error?: string }>(
      `${this.apiUrl}/login`,
      { id, password }
    );
  }
}
