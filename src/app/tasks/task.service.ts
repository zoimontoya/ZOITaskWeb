import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Reemplaza esta URL por la de tu Apps Script Web App
const TASKS_WEBAPP_URL = 'TU_URL_WEB_APP';

export interface Task {
  invernadero: string;
  tipo_tarea: string;
  estimacion_horas: string;
  fecha_limite: string;
  encargado_id: string;
  descripcion: string;
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  // Reemplaza esta URL por la de tu hoja de cálculo publicada como CSV para tareas
  private csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR_l3eDLgV1-W9cmjmg49gEoNn8nrz8OvwYgZ457tMMaGXWmypEmb-HQ2TXTpPNB5lTEHVlEe4AiHbN/pub?gid=1433446737&single=true&output=csv';

  constructor(private http: HttpClient) {}

  getTasks(): Observable<Task[]> {
    return this.http.get(this.csvUrl, { responseType: 'text' }).pipe(
      map(csv => this.parseCSV(csv))
    );
  }

  addTask(task: Task) {
    return this.http.post('https://script.google.com/macros/s/AKfycbzGCVEH8OisazCNYGF3u2CZKrArzjNICAxrhGz8sNV9teI6w8PIDY0owIyTGI0lBCzNhg/exec', task);
  }

  private parseCSV(csv: string): Task[] {
    const lines = csv.split('\n');
    const headers = lines[0].split(',');
    return lines.slice(1).filter(line => line.trim()).map(line => {
      const data = line.split(',');
      const task: any = {};
      headers.forEach((header, i) => {
        task[header.trim()] = data[i]?.trim();
      });
      return task as Task;
    });
  }
}
