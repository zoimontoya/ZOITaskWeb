import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface TaskType {
  tipo: string;
}

@Injectable({ providedIn: 'root' })
export class TaskTypeService {
  // URL configurada en environment.ts por entorno
  private csvUrl = environment.googleSheetsTaskTypesUrl;

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
