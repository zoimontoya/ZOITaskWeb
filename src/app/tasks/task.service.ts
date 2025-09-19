import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';


export interface Task {
  id: string;
  invernadero: string;
  tipo_tarea: string;
  estimacion_horas: number;
  fecha_limite: string;
  encargado_id: string;
  descripcion: string;
}




@Injectable({ providedIn: 'root' })
export class TaskService {
  // URL de la hoja de cálculo de tareas en formato CSV
  private csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR_l3eDLgV1-W9cmjmg49gEoNn8nrz8OvwYgZ457tMMaGXWmypEmb-HQ2TXTpPNB5lTEHVlEe4AiHbN/pub?gid=1433446737&single=true&output=csv';

  updateTask(id: string, task: Partial<Task>) {
    return this.http.put(`/api-tareas/${id}`, task);
  }

  constructor(private http: HttpClient) {}

  getTasks(): Observable<Task[]> {
    return this.http.get(this.csvUrl, { responseType: 'text' }).pipe(
      map(csv => this.parseCSV(csv))
    );
  }

 addTask(task: Task) {
  if (!task.invernadero || !task.tipo_tarea || isNaN(task.estimacion_horas)) {
    console.error('Datos de tarea inválidos:', task);
  }
  return this.http.post('/api-tareas', task);
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
