import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface TaskType {
  tipo: string;
}

@Injectable({ providedIn: 'root' })
export class TaskTypeService {
  // Reemplaza esta URL por la de tu hoja de cálculo publicada como CSV para tipos de tarea
  private csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR_l3eDLgV1-W9cmjmg49gEoNn8nrz8OvwYgZ457tMMaGXWmypEmb-HQ2TXTpPNB5lTEHVlEe4AiHbN/pub?gid=506405967&single=true&output=csv';

  constructor(private http: HttpClient) {}

  getTaskTypes(): Observable<TaskType[]> {
    return this.http.get(this.csvUrl, { responseType: 'text' }).pipe(
      map(csv => this.parseCSV(csv))
    );
  }

  private parseCSV(csv: string): TaskType[] {
    const lines = csv.split('\n');
    const headers = lines[0].split(',');
    return lines.slice(1).filter(line => line.trim()).map(line => {
      const data = line.split(',');
      const type: any = {};
      headers.forEach((header, i) => {
        type[header.trim()] = data[i]?.trim();
      });
      return type as TaskType;
    });
  }
}
