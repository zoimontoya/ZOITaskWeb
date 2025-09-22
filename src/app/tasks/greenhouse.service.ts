import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Greenhouse {
  nombre: string;
  dimensiones: string;
}

@Injectable({ providedIn: 'root' })
export class GreenhouseService {
  // Reemplaza esta URL por la de tu hoja de cálculo publicada como CSV para invernaderos
  private csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR_l3eDLgV1-W9cmjmg49gEoNn8nrz8OvwYgZ457tMMaGXWmypEmb-HQ2TXTpPNB5lTEHVlEe4AiHbN/pub?gid=1539495508&single=true&output=csv';

  constructor(private http: HttpClient) {}

  getGreenhouses(): Observable<Greenhouse[]> {
    return this.http.get(this.csvUrl, { responseType: 'text' }).pipe(
      map(csv => this.parseCSV(csv))
    );
  }

  private parseCSV(csv: string): Greenhouse[] {
    const lines = csv.split('\n');
    const headers = lines[0].split(',');
    return lines.slice(1).filter(line => line.trim()).map(line => {
      const data = line.split(',');
      const greenhouse: any = {};
      headers.forEach((header, i) => {
        greenhouse[header.trim()] = data[i]?.trim();
      });
      return greenhouse as Greenhouse;
    });
  }
}
