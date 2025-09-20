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

  // URL del backend Node.js para todas las operaciones
  private backendUrl = environment.apiBaseUrl; // http://localhost:3000 o tu backend

  updateTask(id: string, task: Partial<Task>) {
    // Usar POST para edición, añadiendo action: 'update' y el id como string
    return this.http.post(this.backendUrl + '/tasks', { ...task, id: String(id), action: 'update' });
  }

  deleteTask(id: string) {
    // Enviar petición de borrado por id como string, forzando Content-Type JSON
    return this.http.post(
      this.backendUrl + '/tasks',
      { action: 'delete', id: String(id) },
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  constructor(private http: HttpClient) {}


  getTasks(): Observable<Task[]> {
    // Leer tareas desde el backend Node.js
    return this.http.get<Task[]>(this.backendUrl + '/tasks').pipe(
      map(tasks => tasks.map(t => ({ ...t, id: String(t.id) })))
    );
  }


  addTask(tasks: Task[] | Task) {
    // Siempre enviar al backend Node.js
    if (Array.isArray(tasks)) {
      return this.http.post(this.backendUrl + '/tasks', { tareas: tasks });
    } else {
      return this.http.post(this.backendUrl + '/tasks', { tareas: [tasks] });
    }
  }

  // Ya no se necesita parseCSV, los datos llegan en JSON
}
