export interface Task {
  id: string;
  invernadero: string;
  tipo_tarea: string;
  estimacion_horas: number;
  fecha_limite: string;
  encargado_id: string;
  encargado_nombre?: string; // Nuevo campo para el nombre del encargado
  descripcion: string;
  nombre_superior: string;
  fecha_inicio: string;
  fecha_fin: string;
  desarrollo_actual: string;
  dimension_total: string;
  proceso: string;
  progreso?: string; // Propiedad opcional para manejar ambos nombres de columna
}

export interface NewTask {
  invernadero: string;
  tipo_tarea: string;
  estimacion_horas: number;
  fecha_limite: string;
  encargado_id: string;
  descripcion: string;
  nombre_superior: string;
  desarrollo_actual: string;
  dimension_total: string;
  proceso: string;
}