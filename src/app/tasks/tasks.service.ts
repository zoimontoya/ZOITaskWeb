import { Injectable } from "@angular/core";
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NewTask } from "./task/task.model";
import { environment } from '../../environments/environment';
import { UuidService } from '../core/services/uuid.service';

@Injectable({
  providedIn: 'root'
})

export class TasksService {
  private apiUrl = environment.apiBaseUrl;

  constructor(
    private http: HttpClient,
    private uuidService: UuidService
  ) {
    // Limpiar cache de IDs cada 5 minutos para evitar acumulación
    setInterval(() => {
      this.uuidService.clearIdCache();
    }, 5 * 60 * 1000);
  }

  // Obtener todas las tareas
  getTasks(): Observable<any[]> {
    console.log('🌐 TasksService.getTasks() - Haciendo petición a:', `${this.apiUrl}/tasks`);
    return this.http.get<any[]>(`${this.apiUrl}/tasks`);
  }

  // Agregar nueva tarea con ID único generado en frontend
  addTask(taskData: any, userId?: string): Observable<any> {
    // Asegurar que taskData sea un array
    const tasksArray = Array.isArray(taskData) ? taskData : [taskData];
    
    // Generar IDs únicos para cada tarea
    const tasksWithUniqueIds = tasksArray.map(task => {
      // Solo generar ID si no existe o es temporal/duplicado
      if (!task.id || task.id === '' || task.id.toString().includes('temp')) {
        task.id = this.uuidService.generateUniqueTaskId(userId);
        console.log('🆔 Generado ID único para tarea:', task.id);
      } else {
        console.log('🔄 Preservando ID existente:', task.id);
      }
      return task;
    });

    // El backend espera que las tareas estén en una propiedad 'tareas'
    const payload = {
      tareas: tasksWithUniqueIds
    };
    
    console.log('📤 Enviando tareas con IDs únicos:', payload);
    return this.http.post<any>(`${this.apiUrl}/tasks`, payload);
  }

  // Aceptar tarea (cambiar estado a "Iniciada")
  acceptTask(taskId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tasks/${taskId}/accept`, {});
  }

  // Completar tarea (cambiar estado a "Terminada")
  completeTask(taskId: string, trabajadoresAsignados?: any[], encargadoNombre?: string): Observable<any> {
    const body: any = {};
    
    // Incluir trabajadores asignados para registrar en hoja "Horas"
    if (trabajadoresAsignados && trabajadoresAsignados.length > 0) {
      body.trabajadores_asignados = trabajadoresAsignados;
    }
    
    // Incluir nombre del encargado
    if (encargadoNombre) {
      body.encargado_nombre = encargadoNombre;
    }
    
    return this.http.post<any>(`${this.apiUrl}/tasks/${taskId}/complete`, body);
  }

  // Completar tarea directamente (actualizar progreso al 100% y completar en una sola operación)
  completeTaskDirect(taskId: string, progress: number | string, hectareas: number, jornalesReales?: number, trabajadoresAsignados?: any[], encargadoNombre?: string): Observable<any> {
    const body: any = {
      progreso: progress,
      desarrollo_actual: hectareas
    };
    
    // Solo incluir jornales_reales si se proporciona un valor
    if (jornalesReales !== undefined) {
      body.jornales_reales = jornalesReales;
    }
    
    // Incluir trabajadores asignados para registrar en hoja "Horas"
    if (trabajadoresAsignados && trabajadoresAsignados.length > 0) {
      body.trabajadores_asignados = trabajadoresAsignados;
    }
    
    // Incluir nombre del encargado
    if (encargadoNombre) {
      body.encargado_nombre = encargadoNombre;
    }
    
    return this.http.post<any>(`${this.apiUrl}/tasks/${taskId}/complete-direct`, body);
  }

  // Actualizar solo el progreso de la tarea (sin cambiar estado)
  updateTaskProgress(taskId: string, progress: number | string, hectareas: number, jornalesReales?: number, trabajadoresAsignados?: any[], encargadoNombre?: string): Observable<any> {
    const body: any = {
      action: 'update-progress', 
      id: taskId,
      progreso: progress,
      desarrollo_actual: hectareas
    };
    
    // Solo incluir jornales_reales si se proporciona un valor
    if (jornalesReales !== undefined) {
      body.jornales_reales = jornalesReales;
    }
    
    // Incluir trabajadores asignados para registrar en hoja "Horas"
    if (trabajadoresAsignados && trabajadoresAsignados.length > 0) {
      body.trabajadores_asignados = trabajadoresAsignados;
    }
    
    // Incluir nombre del encargado
    if (encargadoNombre) {
      body.encargado_nombre = encargadoNombre;
    }
    
    return this.http.post<any>(`${this.apiUrl}/tasks`, body);
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