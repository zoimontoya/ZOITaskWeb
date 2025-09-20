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
    // Usar POST para edición, añadiendo action: 'update' y el id
    return this.http.post(environment.apiBaseUrl, { ...task, id, action: 'update' });
  }

  deleteTask(id: string) {
    // Enviar petición de borrado por id
    return this.http.post(environment.apiBaseUrl, { action: 'delete', id });
  }

  constructor(private http: HttpClient) {}

  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(this.jsonUrl);
  }

 addTask(tasks: Task[] | Task) {
  // Permitir enviar un array de tareas o una sola tarea
  const tareas = Array.isArray(tasks) ? tasks : [tasks];
  for (const task of tareas) {
    if (!task.invernadero || !task.tipo_tarea || isNaN(task.estimacion_horas)) {
      console.error('Datos de tarea inválidos:', task);
    }
  }
  return this.http.post(environment.apiBaseUrl, { tareas });
 }

  // Ya no se necesita parseCSV, los datos llegan en JSON
}
