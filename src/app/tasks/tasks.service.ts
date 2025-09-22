import { Injectable } from "@angular/core";
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NewTask } from "./task/task.model";

@Injectable({
  providedIn: 'root'
})

export class TasksService {
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  // Obtener todas las tareas
  getTasks(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/tasks`);
  }

  // Agregar nueva tarea
  addTask(taskData: any): Observable<any> {
    // El backend espera que las tareas estén en una propiedad 'tareas'
    const payload = {
      tareas: Array.isArray(taskData) ? taskData : [taskData]
    };
    return this.http.post<any>(`${this.apiUrl}/tasks`, payload);
  }

  // Aceptar tarea (cambiar estado a "Iniciada")
  acceptTask(taskId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tasks/${taskId}/accept`, {});
  }

  // Completar tarea (cambiar estado a "Terminada")
  completeTask(taskId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tasks/${taskId}/complete`, {});
  }

  // Actualizar solo el progreso de la tarea (sin cambiar estado)
  updateTaskProgress(taskId: string, progress: number, hectareas: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tasks`, { 
      action: 'update-progress', 
      id: taskId,
      progreso: progress,
      desarrollo_actual: hectareas
    });
  }

  // Eliminar tarea
  deleteTask(taskId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tasks`, { 
      action: 'delete', 
      id: taskId 
    });
  }

  // Actualizar tarea
  updateTask(taskId: string, taskData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tasks`, { 
      action: 'update', 
      id: taskId,
      ...taskData 
    });
  }

  // Métodos legacy mantenidos por compatibilidad (pero ahora usan la API)
  getUserTasks(userId: string): Observable<any[]> {
    // Ahora obtenemos todas las tareas y filtramos en el frontend
    return this.getTasks();
  }

  removeTask(taskId: string): Observable<any> {
    // Implementar endpoint DELETE si es necesario
    return this.http.delete<any>(`${this.apiUrl}/tasks/${taskId}`);
  }
}