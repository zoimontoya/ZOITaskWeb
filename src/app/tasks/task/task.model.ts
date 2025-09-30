export interface Task {
  id: string;
  invernadero: string;
  tipo_tarea: string;
  estimacion_horas: number; // Se muestra en jornales (dividido por 6), se almacena en horas (multiplicado por 6)
  hora_jornal?: number; // Nueva columna para hora/jornal
  horas_kilos?: number; // Nueva columna para horas/kilos
  jornales_reales?: number; // Horas reales trabajadas (encargados ingresan horas directamente)
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
  fecha_actualizacion?: string; // Nueva columna para fecha de última actualización
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