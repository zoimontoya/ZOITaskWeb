import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UserService {
  private apiUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  login(id: string, password: string): Observable<{ success: boolean; id?: string; rol?: string; name?: string; grupo_trabajo?: string; error?: string }> {
    return this.http.post<{ success: boolean; id?: string; rol?: string; name?: string; grupo_trabajo?: string; error?: string }>(
      `${this.apiUrl}/login`,
      { id, password }
    );
  }

  getUserById(id: string): Observable<{ success: boolean; user?: { id: string; name: string; rol?: string }; error?: string }> {
    return this.http.get<{ success: boolean; user?: { id: string; name: string; rol?: string }; error?: string }>(
      `${this.apiUrl}/user/${id}`
    );
  }
}
