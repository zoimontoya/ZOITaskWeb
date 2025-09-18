import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { User } from '../user/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  // Reemplaza esta URL por la de tu hoja de cálculo publicada como CSV
  private csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR_l3eDLgV1-W9cmjmg49gEoNn8nrz8OvwYgZ457tMMaGXWmypEmb-HQ2TXTpPNB5lTEHVlEe4AiHbN/pub?gid=0&single=true&output=csv';

  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get(this.csvUrl, { responseType: 'text' }).pipe(
      map(csv => this.parseCSV(csv))
    );
  }

  private parseCSV(csv: string): User[] {
    const lines = csv.split('\n');
    const headers = lines[0].split(',');
    return lines.slice(1).filter(line => line.trim()).map(line => {
      const data = line.split(',');
      const user: any = {};
      headers.forEach((header, i) => {
        user[header.trim()] = data[i]?.trim();
      });
      // Eliminar la propiedad avatar si existe
      if ('avatar' in user) {
        delete user.avatar;
      }
      return user as User;
    });
  }
}
