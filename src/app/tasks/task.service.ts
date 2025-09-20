import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';


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
  // URL del endpoint Apps Script que devuelve las tareas en JSON
  private jsonUrl = environment.apiBaseUrl; // Usa tu URL de Apps Script aquí

  updateTask(id: string, task: Partial<Task>) {
    // Usar POST para edición, añadiendo action: 'update' y el id como string
    return this.http.post(environment.apiBaseUrl, { ...task, id: String(id), action: 'update' });
  }

  deleteTask(id: string) {
    // Enviar petición de borrado por id como string
    return this.http.post(environment.apiBaseUrl, { action: 'delete', id: String(id) });
  }

  constructor(private http: HttpClient) {}

  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(this.jsonUrl).pipe(
      map(tasks => tasks.map(t => ({ ...t, id: String(t.id) })))
    );
  }

 addTask(tasks: Task[] | Task) {
  if (Array.isArray(tasks) && tasks.length === 1) {
    // Si es un array de una sola tarea, envía como objeto plano
    tasks = tasks[0];
  }
  if (Array.isArray(tasks)) {
    // Enviar array de tareas (creación múltiple)
    return this.http.post(environment.apiBaseUrl, { tareas: tasks });
  } else {
    // Enviar objeto plano (alta nueva)
    return this.http.post(environment.apiBaseUrl, tasks);
  }
 }

  // Ya no se necesita parseCSV, los datos llegan en JSON
}
