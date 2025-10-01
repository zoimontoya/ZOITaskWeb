import { Component, Input, OnInit, OnDestroy, OnChanges } from '@angular/core';
import { TasksService } from './tasks.service';
import { Task } from './task/task.model';
import { GreenhouseService, Greenhouse } from './greenhouse.service';
import { UserService } from '../user/user.service';
import { TrabajadoresService, TrabajadorAsignado } from '../trabajadores/trabajadores.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { newTaskComponent } from './newTask/newTask.component';
import { AsignarTrabajadoresComponent } from '../trabajadores/asignar-trabajadores/asignar-trabajadores.component';

interface TipoTarea {
  grupo_trabajo: string;
  familia: string;
  tipo: string;
  subtipo: string;
  tarea_nombre: string;
  jornal_unidad: string;
}

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, newTaskComponent, AsignarTrabajadoresComponent],
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.css']
})
export class TasksComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isEncargado: boolean = false;
  @Input() name?: string;
  @Input() userId!: string;
  @Input() loggedUser: any;

  isAddingTask = false;
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  showFilterMenu = false;
  selectedInvernadero: string = '';
  selectedTipo: string = '';
  selectedFechaOrden: string = 'desc';
  selectedEstado: string = 'sin-iniciar'; // Nuevo: estado seleccionado por defecto
  selectedEncargado: string = ''; // Nuevo: encargado seleccionado
  invernaderos: string[] = [];
  tiposTarea: string[] = [];
  encargados: string[] = []; // Nueva: lista de encargados
  encargadosMap: { [id: string]: string } = {}; // Nuevo: mapeo de ID a nombre
  loading = true;
  editingTask: Task | null = null;
  showDeleteModal = false;
  taskToDelete: Task | null = null;
  showCompleteModal = false;
  taskToComplete: Task | null = null;
  progressValue = 0;
  jornalesRealesValue = 0; // Campo para horas reales trabajadas (encargados ingresan horas directamente)
  kilosRecogidosValue = 0; // Campo para kilos recogidos (modo kilos)
  greenhouses: Greenhouse[] = [];

  // Propiedades para asignación de trabajadores
  showWorkersModal = false;
  trabajadoresAsignados: TrabajadorAsignado[] = [];
  trabajadoresValidados = false; // Flag para saber si las horas cuadran
  
  // Encargados del mismo cabezal (para validación de tareas urgentes)
  encargadosDelCabezal: string[] = [];

  // Protección contra double-click
  isProcessing = false;
  
  // Propiedades para Tareas Urgentes
  isUrgentTaskWorkersMode = false;
  showUrgentTaskModal = false;
  urgentTask = {
    invernadero: '',
    tipo_tarea: '',
    horas_trabajadas: 0,
    descripcion: ''
  };
  urgentTaskWorkers: TrabajadorAsignado[] = [];
  isCreatingUrgentTask = false;
  
  // Propiedades para selectores de tarea urgente
  isUrgentInvernaderoOpen = false;
  isUrgentTipoOpen = false;
  urgentInvernaderoSearch = '';
  urgentTipoSearch = '';
  allUrgentInvernaderos: string[] = [];
  allUrgentTipos: string[] = [];
  filteredUrgentInvernaderos: string[] = [];
  filteredUrgentTipos: string[] = [];
  


  constructor(private taskService: TasksService, private greenhouseService: GreenhouseService, private userService: UserService, private trabajadoresService: TrabajadoresService, private http: HttpClient) {}
  
  // ===== MÉTODOS PARA TAREAS URGENTES =====
  
  onStartUrgentTask() {
    this.showUrgentTaskModal = true;
    this.urgentTask = {
      invernadero: '',
      tipo_tarea: '',
      horas_trabajadas: 0,
      descripcion: ''
    };
    this.urgentTaskWorkers = [];
    this.isUrgentTaskWorkersMode = false; // Resetear flag
    
    // Inicializar selectores
    this.isUrgentInvernaderoOpen = false;
    this.isUrgentTipoOpen = false;
    this.urgentInvernaderoSearch = '';
    this.urgentTipoSearch = '';
    this.loadUrgentInvernaderos();
    this.loadUrgentTiposTarea();
  }
  
  onCancelUrgentTask() {
    this.showUrgentTaskModal = false;
    this.urgentTask = {
      invernadero: '',
      tipo_tarea: '',
      horas_trabajadas: 0,
      descripcion: ''
    };
    this.urgentTaskWorkers = [];
    this.isUrgentTaskWorkersMode = false; // Resetear flag
  }
  
  onUrgentTaskModalOverlayClick(event: MouseEvent) {
    // Solo cerrar si se hace clic en el overlay, no en el contenido del modal
    if (event.target === event.currentTarget) {
      this.onCancelUrgentTask();
    }
  }
  
  onOpenWorkersForUrgentTask() {
    // Validar que hay horas especificadas
    if (this.urgentTask.horas_trabajadas <= 0) {
      alert('Por favor, especifica primero las horas trabajadas antes de asignar trabajadores.');
      return;
    }
    
    // Abrir modal de trabajadores para la tarea urgente
    this.isUrgentTaskWorkersMode = true;
    this.trabajadoresAsignados = [...this.urgentTaskWorkers]; // Copiar los trabajadores actuales
    this.jornalesRealesValue = this.urgentTask.horas_trabajadas; // Pasar las horas totales
    this.trabajadoresValidados = false; // Resetear validación
    this.showWorkersModal = true;
  }
  
  onSubmitUrgentTask() {
    if (this.isCreatingUrgentTask) return; // Evitar doble envío
    
    // Validaciones básicas
    if (!this.urgentTask.invernadero.trim() || 
        !this.urgentTask.tipo_tarea.trim() || 
        !this.urgentTask.descripcion.trim() ||
        this.urgentTask.horas_trabajadas <= 0) {
      alert('Por favor, completa todos los campos obligatorios.');
      return;
    }
    
    this.isCreatingUrgentTask = true;
    
    // Crear tarea con estado "Por validar"  
    // Para tareas urgentes, el encargado que la crea será quien aparezca como creador
    const encargadoNombre = this.loggedUser?.nombre_completo || this.name || this.userId || '';
    const tareaUrgente = {
      invernadero: this.urgentTask.invernadero.trim(),
      tipo_tarea: this.urgentTask.tipo_tarea.trim(),
      estimacion_horas: this.urgentTask.horas_trabajadas,  // Horas directas del encargado
      hora_jornal: 0,         // ⭐ SIN cálculos para tareas urgentes
      horas_kilos: 0,         // Hectáreas por defecto
      jornales_reales: this.urgentTask.horas_trabajadas,   // ⭐ Mismas horas directas
      fecha_limite: new Date().toISOString().split('T')[0], // Fecha actual
      encargado_id: this.userId,
      descripcion: this.urgentTask.descripcion.trim(), // Descripción simple, sin trabajadores
      nombre_superior: encargadoNombre, // ⭐ El encargado aparece como creador (CLAVE para detección)
      desarrollo_actual: '',
      dimension_total: '0', // Sin dimensiones para tareas urgentes
      proceso: 'Por validar', // Estado especial para validación
      // Datos para registro directo en hoja "Horas"
      trabajadores_asignados: this.urgentTaskWorkers, // Trabajadores van directos a hoja "Horas"
      encargado_nombre: encargadoNombre,
      es_tarea_urgente: true // Flag para registro directo
    };
    
    console.log('Creando tarea urgente:', tareaUrgente);
    
    this.taskService.addTask([tareaUrgente]).subscribe({
      next: () => {
        this.isCreatingUrgentTask = false;
        this.showUrgentTaskModal = false;
        
        // Si hay trabajadores asignados, registrarlos
        if (this.urgentTaskWorkers.length > 0) {
          // Aquí registrarías las horas de los trabajadores
          console.log('Trabajadores para tarea urgente:', this.urgentTaskWorkers);
        }
        
        this.loadTasks();
        alert('Tarea urgente registrada exitosamente. Esperando validación del superior.');
      },
      error: (err) => {
        this.isCreatingUrgentTask = false;
        if (err.status === 200) {
          // Manejar respuesta exitosa que viene como error
          this.showUrgentTaskModal = false;
          this.loadTasks();
          alert('Tarea urgente registrada exitosamente. Esperando validación del superior.');
        } else {
          console.error('Error creando tarea urgente:', err);
          alert('Error al registrar la tarea urgente. Intenta nuevamente.');
        }
      }
    });
  }

  ngOnInit() {
    this.greenhouseService.getGreenhouses().subscribe(data => this.greenhouses = data);
    document.addEventListener('mousedown', this.handleClickOutside);
    
    // Para superiores, cargar encargados del mismo cabezal PRIMERO, luego las tareas
    if (!this.isEncargado && this.loggedUser?.grupo_trabajo && this.loggedUser?.cabezal) {
      this.loadEncargadosDelCabezal();
    } else {
      // Para encargados, cargar tareas directamente
      this.loadTasks();
    }
  }

  ngOnDestroy() {
    document.removeEventListener('mousedown', this.handleClickOutside);
  }

  ngOnChanges() {
    this.loadTasks();
  }

  toggleFilterMenu() {
    this.showFilterMenu = !this.showFilterMenu;
  }

  handleClickOutside = (event: MouseEvent) => {
    if (this.showFilterMenu) {
      const menu = document.querySelector('.filter-dropdown');
      if (menu && !menu.contains(event.target as Node)) {
        this.showFilterMenu = false;
      }
    }
    
    // Cerrar dropdowns de tarea urgente si se hace clic fuera
    if (this.isUrgentInvernaderoOpen) {
      const invernaderoDropdown = document.querySelector('.urgent-dropdown.open');
      if (invernaderoDropdown && !invernaderoDropdown.contains(event.target as Node)) {
        this.isUrgentInvernaderoOpen = false;
      }
    }
    
    if (this.isUrgentTipoOpen) {
      const tipoDropdown = document.querySelector('.urgent-dropdown.open');
      if (tipoDropdown && !tipoDropdown.contains(event.target as Node)) {
        this.isUrgentTipoOpen = false;
      }
    }
  };

  applyFilters() {
    let filtered = [...this.tasks];
    
    // Filtrar por estado seleccionado (usar progreso para tareas urgentes, proceso para tareas normales)
    switch (this.selectedEstado) {
      case 'sin-iniciar':
        filtered = filtered.filter(t => {
          return this.getTaskState(t) === 'No iniciado';
        });
        break;
      case 'en-progreso':
        // Mostrar tareas que estén iniciadas O que tengan progreso numérico
        filtered = filtered.filter(t => {
          const estado = this.getTaskState(t);
          const esIniciada = estado === 'Iniciada';
          const tieneProgreso = estado && !isNaN(Number(estado)) && Number(estado) > 0;
          return esIniciada || tieneProgreso;
        });
        break;
      case 'terminadas':
        filtered = filtered.filter(t => {
          return this.getTaskState(t) === 'Terminada';
        });
        break;
      case 'por-validar':
        filtered = filtered.filter(t => {
          return this.getTaskState(t) === 'Por validar';
        });
        break;
    }
    
    if (this.selectedInvernadero) {
      filtered = filtered.filter(t => t.invernadero === this.selectedInvernadero);
    }
    if (this.selectedTipo) {
      filtered = filtered.filter(t => t.tipo_tarea === this.selectedTipo);
    }
    if (this.selectedEncargado) {
      filtered = filtered.filter(t => (t.encargado_nombre || t.encargado_id) === this.selectedEncargado);
    }
    if (this.selectedFechaOrden === 'asc') {
      filtered = filtered.sort((a, b) => (a.fecha_limite || '').localeCompare(b.fecha_limite || ''));
    } else {
      filtered = filtered.sort((a, b) => (b.fecha_limite || '').localeCompare(a.fecha_limite || ''));
    }
    this.filteredTasks = filtered;
  }

  resetFilters() {
    this.selectedInvernadero = '';
    this.selectedTipo = '';
    this.selectedEncargado = '';
    this.selectedFechaOrden = 'desc';
    // No resetear selectedEstado para supervisores, mantener el estado activo
    this.applyFilters();
  }

  setEstadoFilter(estado: string) {
    this.selectedEstado = estado;
    this.applyFilters();
  }

  loadTasks() {
    this.loading = true;
    this.taskService.getTasks().subscribe({
      next: (tasks) => {
        
        // CONVERSIÓN DE HORAS A JORNALES EN EL FRONTEND
        const tasksConvertidas = tasks.map(t => {
          const horaJornal = Number(t.hora_jornal) || 0;
          const horasTotales = Number(t.estimacion_horas) || 0;
          
          // Para tareas urgentes: NO hacer conversión (preservar horas directas)
          const esTareaUrgente = this.isUrgentTask(t);
          
          let estimacionParaMostrar;
          if (esTareaUrgente) {
            // Tareas urgentes: mostrar horas directas (SIN conversión)
            estimacionParaMostrar = horasTotales;
            console.log(`🚨 Tarea ${t.id} URGENTE: nombre_superior="${t.nombre_superior}", usuario="${this.loggedUser?.nombre_completo}", horas=${horasTotales}h (SIN división)`);
          } else {
            // Tareas normales: convertir a jornales
            const factorConversion = horaJornal === 1 ? 8 : 6; // 1 = 8h/jornal, 0 = 6h/jornal
            estimacionParaMostrar = horasTotales / factorConversion;
            console.log(`📊 Tarea ${t.id} NORMAL: nombre_superior="${t.nombre_superior}", usuario="${this.loggedUser?.nombre_completo}", horas=${horasTotales}h ÷ ${factorConversion} = ${estimacionParaMostrar} jornales`);
          }
          
          return {
            ...t,
            estimacion_horas: estimacionParaMostrar,
            id: String(t.id)
          };
        });
        
        
        if (this.isEncargado && this.userId) {
          // Para encargados: filtrar solo sus tareas
          const userIdNorm = String(this.userId).trim().toLowerCase();
          this.tasks = tasksConvertidas.filter(t => String(t.encargado_id).trim().toLowerCase() === userIdNorm);
        } else {
          // Para superiores: mostrar TODAS las tareas relacionadas con su cabezal
          const userNameNorm = String(this.name || '').trim().toLowerCase();
          const userFullName = String(this.loggedUser?.nombre_completo || '').trim().toLowerCase();
          const userIdStr = String(this.userId || '').trim().toLowerCase();
          
          this.tasks = tasksConvertidas.filter(t => {
            const taskSuperior = String(t.nombre_superior || '').trim().toLowerCase();
            const encargadoTarea = String(t.encargado_id || '').trim();
            
            // 1. Tareas que el superior ha creado directamente (nombre_superior = él)
            const esCreadorDeLaTarea = taskSuperior === userNameNorm || 
                                       taskSuperior === userFullName ||
                                       taskSuperior === userIdStr;
            
            // 2. Tareas donde el superior aparece como encargado (él debe hacerlas)
            const esTareaPropia = encargadoTarea.toLowerCase() === userIdStr ||
                                  encargadoTarea.toLowerCase() === userNameNorm ||
                                  encargadoTarea.toLowerCase() === userFullName;
            
            // 3. Tareas de encargados que pertenecen a su cabezal (TODAS, no solo urgentes)
            const encargadoEsDelCabezal = this.encargadosDelCabezal.length > 0 && 
                                          this.encargadosDelCabezal.includes(encargadoTarea);
            
            return esCreadorDeLaTarea || esTareaPropia || encargadoEsDelCabezal;
          });
        }
        this.invernaderos = Array.from(new Set(this.tasks.map(t => t.invernadero).filter(Boolean)));
        this.tiposTarea = Array.from(new Set(this.tasks.map(t => t.tipo_tarea).filter(Boolean)));
        this.encargados = Array.from(new Set(this.tasks.map(t => t.encargado_id).filter(Boolean)));
        
        // Cargar nombres de encargados para supervisores
        if (!this.isEncargado) {
          this.loadEncargadosNames();
        } else {
          this.applyFilters();
          this.loading = false;
        }
      },
      error: () => {
        this.tasks = [];
        this.filteredTasks = [];
        this.loading = false;
      }
    });
  }

  loadEncargadosNames() {
    const uniqueEncargadoIds = Array.from(new Set(this.tasks.map(t => t.encargado_id).filter(Boolean)));
    let loadedCount = 0;
    
    if (uniqueEncargadoIds.length === 0) {
      this.applyFilters();
      this.loading = false;
      return;
    }
    
    uniqueEncargadoIds.forEach(encargadoId => {
      this.userService.getUserById(encargadoId).subscribe({
        next: (response) => {
          if (response.success && response.user) {
            this.encargadosMap[encargadoId] = response.user.name;
            
            // Actualizar las tareas con el nombre del encargado
            this.tasks.forEach(task => {
              if (task.encargado_id === encargadoId) {
                task.encargado_nombre = response.user!.name;
              }
            });
          } else {
            // Si no se encuentra el usuario, usar el ID como nombre
            this.encargadosMap[encargadoId] = encargadoId;
            this.tasks.forEach(task => {
              if (task.encargado_id === encargadoId) {
                task.encargado_nombre = encargadoId;
              }
            });
          }
          
          loadedCount++;
          if (loadedCount === uniqueEncargadoIds.length) {
            // Actualizar la lista de encargados para el filtro con los nombres
            this.encargados = Array.from(new Set(Object.values(this.encargadosMap)));
            this.applyFilters();
            this.loading = false;
          }
        },
        error: () => {
          // En caso de error, usar el ID como nombre
          this.encargadosMap[encargadoId] = encargadoId;
          this.tasks.forEach(task => {
            if (task.encargado_id === encargadoId) {
              task.encargado_nombre = encargadoId;
            }
          });
          
          loadedCount++;
          if (loadedCount === uniqueEncargadoIds.length) {
            // Actualizar la lista de encargados para el filtro con los nombres
            this.encargados = Array.from(new Set(Object.values(this.encargadosMap)));
            this.applyFilters();
            this.loading = false;
          }
        }
      });
    });
  }

  pollForTaskListChange(predicate: () => boolean, maxAttempts = 5, delayMs = 1000) {
    let attempts = 0;
    const poll = () => {
      this.loadTasks();
      attempts++;
      setTimeout(() => {
        if (!predicate() && attempts < maxAttempts) {
          poll();
        }
      }, delayMs);
    };
    poll();
  }

  onDeleteTask(task: Task) {
    this.taskService.deleteTask(task.id).subscribe({
      next: () => {
        this.loadTasks();
      },
      error: () => {
        this.loadTasks();
      }
    });
  }

  onConfirmDeleteTask(task: Task) {
    // Verificar que la tarea no esté terminada
    if (this.isTaskCompleted(task)) {
      alert('No se puede eliminar una tarea terminada.');
      return;
    }
    this.taskToDelete = task;
    this.showDeleteModal = true;
  }

  cancelDeleteTask() {
    this.showDeleteModal = false;
    this.taskToDelete = null;
  }

  confirmDeleteTask() {
    if (this.taskToDelete) {
      this.onDeleteTask(this.taskToDelete);
    }
    this.showDeleteModal = false;
    this.taskToDelete = null;
  }

  onStartEditTask(task: Task) {
    // Verificar que la tarea no esté terminada
    if (this.isTaskCompleted(task)) {
      alert('No se puede editar una tarea terminada.');
      return;
    }
    this.editingTask = { ...task };
  }

  onCancelEditTask() {
    this.editingTask = null;
  }

  onEditTask(updatedTask: any) {
    if (!this.editingTask) return;
    const tarea = Array.isArray(updatedTask) ? updatedTask[0] : updatedTask;
    const id = tarea.id || this.editingTask.id;
    
    // CORRECCIÓN: Usar el dimension_total del formulario, no del invernadero
    // El usuario puede haber editado el área de trabajo específica
    const superiorId = this.loggedUser?.nombre_completo || this.name || this.userId || '';
    
    const tareaCompleta = {
      ...tarea,
      nombre_superior: superiorId,
      // Usar el dimension_total que viene del formulario de edición
      dimension_total: tarea.dimension_total || this.editingTask.dimension_total || '0'
    };
    
    this.taskService.updateTask(id, tareaCompleta).subscribe({
      next: (res: any) => {
        this.editingTask = null;
        this.pollForTaskListChange(() => {
          const t = this.tasks.find(t => t.id === id);
          return !!(t && t.tipo_tarea === tareaCompleta.tipo_tarea && t.descripcion === tareaCompleta.descripcion);
        });
      },
      error: (err) => {
        if (err.status === 200) {
          this.editingTask = null;
          this.pollForTaskListChange(() => {
            const t = this.tasks.find(t => t.id === id);
            return !!(t && t.tipo_tarea === tareaCompleta.tipo_tarea && t.descripcion === tareaCompleta.descripcion);
          });
        } else {
          alert('No se pudo editar la tarea. Puede que ya no exista.');
          this.editingTask = null;
          this.pollForTaskListChange(() => {
            const t = this.tasks.find(t => t.id === id);
            return !!(t && t.tipo_tarea === tareaCompleta.tipo_tarea && t.descripcion === tareaCompleta.descripcion);
          });
        }
      }
    });
  }

  onStartAddTask() {
    this.isAddingTask = true;
  }

  onCancelAddTask() {
    this.isAddingTask = false;
  }

  onAddTask(taskData: any) {
    // taskData es un array de tareas. Agregar nombre_superior a cada una
    const superiorId = this.loggedUser?.nombre_completo || this.name || this.userId || '';
    
    const tareasConSuperior = Array.isArray(taskData) 
      ? taskData.map(tarea => ({
          ...tarea,
          nombre_superior: superiorId
        }))
      : [{
          ...taskData,
          nombre_superior: superiorId
        }];
    
    this.taskService.addTask(tareasConSuperior).subscribe({
      next: () => {
        this.isAddingTask = false;
        this.loadTasks();
      },
      error: (err) => {
        if (err.status === 200) {
          this.isAddingTask = false;
          this.loadTasks();
        }
      }
    });
  }

  onAcceptTask(task: Task) {
    // Verificar que la tarea no esté terminada
    if (this.isTaskCompleted(task)) {
      alert('No se puede aceptar una tarea terminada.');
      return;
    }
    
    this.taskService.acceptTask(task.id).subscribe({
      next: () => {
        console.log('Tarea aceptada correctamente');
        this.loadTasks(); // Recargar para ver cambios
      },
      error: (err) => {
        console.error('Error al aceptar tarea:', err);
        alert('Error al aceptar la tarea. Inténtalo de nuevo.');
      }
    });
  }

  onOpenProgressModal(task: Task) {
    // Verificar que la tarea no esté terminada
    if (this.isTaskCompleted(task)) {
      alert('No se puede actualizar el progreso de una tarea terminada.');
      return;
    }
    
    this.taskToComplete = task;
    this.progressValue = Number(this.getTaskState(task)) || 0; // Usar el estado unificado para el porcentaje
    this.jornalesRealesValue = 0; // Siempre empezar vacío para que el encargado ingrese las horas del día
    
    // Resetear validación de trabajadores
    this.trabajadoresValidados = false;
    this.trabajadoresAsignados = [];
    
    // Si está en modo kilos, inicializar kilos recogidos desde desarrollo_actual
    if (this.isKilosMode(task)) {
      this.kilosRecogidosValue = Number(task.desarrollo_actual) || 0;
    }
    
    this.showCompleteModal = true;
  }

  onUpdateProgressOnly() {
    if (!this.taskToComplete || this.isProcessing) return;
    this.isProcessing = true;
    
    // Validar que se haya ingresado el número de horas reales
    if (!this.jornalesRealesValue || this.jornalesRealesValue <= 0) {
      alert('Por favor, ingresa el número de horas realmente trabajadas.');
      this.isProcessing = false;
      return;
    }

    // Validar que se hayan asignado trabajadores
    if (!this.canProceedWithUpdate()) {
      alert('Debe asignar trabajadores y validar que las horas cuadren antes de actualizar el progreso.');
      this.isProcessing = false;
      return;
    }
    
    let progressValue: number | string;
    let desarrolloValue: number;
    
    if (this.isKilosMode(this.taskToComplete)) {
      // MODO KILOS: Solo registrar kilos recogidos sin calcular porcentaje ni meta
      if (!this.kilosRecogidosValue || this.kilosRecogidosValue <= 0) {
        alert('Por favor, ingresa los kilos recogidos.');
        return;
      }
      
      // En modo kilos: progreso siempre permanece como "Iniciada"
      progressValue = "Iniciada"; // Mantener como "Iniciada" para tareas de kilos
      desarrolloValue = this.kilosRecogidosValue;
      
      console.log(`MODO KILOS: ${this.kilosRecogidosValue} kg registrados (progreso: Iniciada)`);
    } else {
      // MODO HECTÁREAS: Como antes
      if (this.progressValue === (Number(this.taskToComplete.progreso) || 0)) {
        return; // No hay cambios
      }
      
      const totalHectares = this.parseDimension(this.taskToComplete.dimension_total);
      const hectareasActuales = (totalHectares * this.progressValue) / 100;
      
      progressValue = this.progressValue;
      desarrolloValue = hectareasActuales;
      
      console.log(`MODO HECTÁREAS: ${this.progressValue}% = ${hectareasActuales}/${totalHectares} Ha`);
    }
    
    this.taskService.updateTaskProgress(this.taskToComplete.id, progressValue, desarrolloValue, this.jornalesRealesValue, this.trabajadoresAsignados, this.name).subscribe({
        next: () => {
          console.log('Progreso actualizado correctamente');
          this.showCompleteModal = false;
          this.taskToComplete = null;
          this.progressValue = 0;
          this.jornalesRealesValue = 0; // Limpiar jornales reales
          this.kilosRecogidosValue = 0; // Limpiar kilos recogidos
          this.loadTasks(); // Recargar para ver cambios
          this.isProcessing = false;
        },
        error: (err: any) => {
          console.error('Error al actualizar progreso:', err);
          alert('Error al actualizar el progreso. Inténtalo de nuevo.');
          this.isProcessing = false;
        }
      });
  }

  onConfirmCompleteTask() {
    if (!this.taskToComplete || this.isProcessing) return;
    this.isProcessing = true;
    
    // Validar que se haya ingresado el número de horas reales
    if (!this.jornalesRealesValue || this.jornalesRealesValue <= 0) {
      alert('Por favor, ingresa el número de horas realmente trabajadas para completar la tarea.');
      this.isProcessing = false;
      return;
    }

    // Validar que se hayan asignado trabajadores
    if (!this.canProceedWithUpdate()) {
      alert('Debe asignar trabajadores y validar que las horas cuadren antes de completar la tarea.');
      this.isProcessing = false;
      return;
    }
    
    let progressValue: number | string = 100;
    let desarrolloValue: number;
    
    if (this.isKilosMode(this.taskToComplete)) {
      // MODO KILOS: Sin restricciones de meta, solo registrar kilos recogidos
      // Para completar, mantener como "Iniciada" hasta que se termine
      progressValue = "Iniciada"; // Mantener "Iniciada" incluso al completar
      desarrolloValue = this.kilosRecogidosValue || 0;
      console.log(`COMPLETANDO MODO KILOS: ${desarrolloValue} kg recogidos (progreso: Iniciada)`);
    } else {
      // MODO HECTÁREAS: Validar que el progreso sea 100%
      if (this.progressValue !== 100) {
        alert('Para completar la tarea el progreso debe estar al 100%.');
        return;
      }
      const totalHectares = this.parseDimension(this.taskToComplete.dimension_total);
      desarrolloValue = totalHectares; // 100% = todas las hectáreas
      console.log(`COMPLETANDO MODO HECTÁREAS: ${desarrolloValue} Ha (100%)`);
    }
    
    // Completar directamente (actualizar progreso al 100% y completar en una sola operación)
    this.taskService.completeTaskDirect(this.taskToComplete.id, progressValue, desarrolloValue, this.jornalesRealesValue, this.trabajadoresAsignados, this.name).subscribe({
        next: () => {
          console.log('Tarea completada correctamente (operación única)');
          this.showCompleteModal = false;
          this.taskToComplete = null;
          this.progressValue = 0;
          this.jornalesRealesValue = 0; // Limpiar jornales reales
          this.kilosRecogidosValue = 0; // Limpiar kilos recogidos
          this.loadTasks(); // Recargar para ver cambios
          this.isProcessing = false;
        },
        error: (err: any) => {
          console.error('Error al completar tarea:', err);
          alert('Error al completar la tarea. Inténtalo de nuevo.');
          this.isProcessing = false;
        }
      });
  }

  onCancelCompleteTask() {
    this.showCompleteModal = false;
    this.taskToComplete = null;
    this.progressValue = 0;
    this.jornalesRealesValue = 0; // Limpiar jornales reales
  }

  onModalOverlayClick(event: MouseEvent) {
    // Cerrar modal al hacer clic en el overlay (fuera del modal)
    this.onCancelCompleteTask();
  }

  onDeleteModalOverlayClick(event: MouseEvent) {
    // Cerrar modal de borrar al hacer clic en el overlay
    this.cancelDeleteTask();
  }

  getHectaresFromProgress(): string {
    if (!this.taskToComplete?.dimension_total) return '0';
    
    const totalHectares = this.parseDimension(this.taskToComplete.dimension_total);
    if (totalHectares === 0) return '0';
    
    const currentHectares = (totalHectares * this.progressValue) / 100;
    
    // Usar el mismo formato que formatDimensionTotal para consistencia
    return this.formatDimensionTotal(currentHectares);
  }

  // Verificar si la tarea está en modo kilos (horas_kilos = 1)
  isKilosMode(task: Task | null): boolean {
    if (!task) return false;
    // Comparación flexible para manejar tanto números como strings
    const horasKilos = task.horas_kilos;
    return horasKilos == 1 || String(horasKilos) === '1' || Number(horasKilos) === 1;
  }

  trackById(index: number, item: Task) {
    return item.id;
  }

  isNumber(value: any): boolean {
    return !isNaN(Number(value));
  }

  toNumber(value: any): number {
    return Number(value);
  }
  
  // Método para validar tareas urgentes (solo superiores)
  onValidateUrgentTask(task: Task) {
    if (this.isEncargado) {
      alert('Solo los superiores pueden validar tareas.');
      return;
    }
    
    const confirmValidation = confirm(
      `¿Confirmas que quieres validar esta tarea urgente?\n\n` +
      `Tarea: ${task.tipo_tarea}\n` +
      `Invernadero: ${task.invernadero}\n` +
      `Descripción: ${task.descripcion}\n\n` +
      `Al validar, la tarea pasará a estado "Terminada".`
    );
    
    if (!confirmValidation) return;
    
    // Actualizar la tarea urgente a estado terminado con campos específicos
    const fechaActual = new Date().toISOString().split('T')[0];
    const fechaActualizacion = new Date().toLocaleDateString('es-ES'); // DD/MM/YYYY
    
    const tareaValidada = {
      ...task,
      proceso: 'Terminada',           // Solo cambiar estado a terminada
      fecha_fin: fechaActual,
      fecha_inicio: fechaActual,      // Fecha inicio = fecha fin para tareas urgentes
      fecha_actualizacion: fechaActualizacion,
      // Para tareas urgentes: las horas van directas SIN cálculos de 6h/8h
      estimacion_horas: task.estimacion_horas, // Las horas originales pasan a estimación
      jornales_reales: task.estimacion_horas,  // Las mismas horas van a jornales_reales (DIRECTAS)
      hora_jornal: 0                          // Siempre 0 para tareas urgentes (NO hay cálculo)
      // NO enviamos trabajadores - ya están en hoja "Horas" desde la creación
    };
    
    this.taskService.updateTask(task.id, tareaValidada).subscribe({
      next: () => {
        this.loadTasks();
        alert('Tarea validada exitosamente. Ahora aparece como terminada.');
      },
      error: (err) => {
        if (err.status === 200) {
          this.loadTasks();
          alert('Tarea validada exitosamente. Ahora aparece como terminada.');
        } else {
          console.error('Error validando tarea:', err);
          alert('Error al validar la tarea. Intenta nuevamente.');
        }
      }
    });
  }
  
  // Método para extraer trabajadores de la descripción de la tarea
  extraerTrabajadoresDeTarea(task: Task): any[] {
    try {
      // Buscar trabajadores en la descripción (formato: descripcion||WORKERS:json)
      const descripcion = task.descripcion || '';
      const workersPart = descripcion.split('||WORKERS:')[1];
      
      if (workersPart) {
        const trabajadoresData = JSON.parse(workersPart);
        console.log('👥 Trabajadores encontrados en tarea:', trabajadoresData);
        return trabajadoresData;
      }
      
      console.log('⚠️ No se encontraron trabajadores en la tarea, usando datos por defecto');
      return [];
    } catch (error) {
      console.error('❌ Error extrayendo trabajadores:', error);
      return [];
    }
  }

  // ===== MÉTODOS PARA SELECTORES DE TAREA URGENTE =====
  
  toggleUrgentInvernadero() {
    this.isUrgentInvernaderoOpen = !this.isUrgentInvernaderoOpen;
    if (this.isUrgentInvernaderoOpen) {
      this.isUrgentTipoOpen = false;
      this.loadUrgentInvernaderos();
      this.filterUrgentInvernaderos();
    }
  }
  
  toggleUrgentTipo() {
    this.isUrgentTipoOpen = !this.isUrgentTipoOpen;
    if (this.isUrgentTipoOpen) {
      this.isUrgentInvernaderoOpen = false;
      if (this.allUrgentTipos.length === 0) {
        this.loadUrgentTiposTarea();
      } else {
        this.filterUrgentTipos();
      }
    }
  }
  
  loadUrgentInvernaderos() {
    // Cargar invernaderos filtrados por cabezal del usuario
    if (this.loggedUser?.cabezal) {
      this.greenhouseService.getGreenhousesByCabezal(this.loggedUser.cabezal).subscribe({
        next: (data) => {
          const invernaderos = data.cabezales.flatMap(cabezal => cabezal.invernaderos);
          this.allUrgentInvernaderos = invernaderos.map(inv => inv.nombre).sort();
          this.filterUrgentInvernaderos();
        },
        error: (err) => {
          console.error('Error cargando invernaderos por cabezal:', err);
          // Fallback: usar invernaderos de tareas existentes
          const allInvernaderos = new Set<string>();
          this.tasks.forEach(task => {
            if (task.invernadero && task.invernadero.trim()) {
              allInvernaderos.add(task.invernadero);
            }
          });
          this.allUrgentInvernaderos = Array.from(allInvernaderos).sort();
          this.filterUrgentInvernaderos();
        }
      });
    } else {
      // Fallback: usar invernaderos de tareas existentes
      const allInvernaderos = new Set<string>();
      this.tasks.forEach(task => {
        if (task.invernadero && task.invernadero.trim()) {
          allInvernaderos.add(task.invernadero);
        }
      });
      this.allUrgentInvernaderos = Array.from(allInvernaderos).sort();
      this.filterUrgentInvernaderos();
    }
  }
  
  loadUrgentTiposTarea() {
    // Cargar tipos de tarea por grupo_trabajo del usuario
    if (this.loggedUser?.grupo_trabajo) {
      this.http.get<TipoTarea[]>(`${environment.apiBaseUrl}/tipos-tarea/${this.loggedUser.grupo_trabajo}`).subscribe({
        next: (tiposTarea) => {
          // Extraer tipos únicos (incluyendo subtipos como opciones separadas)
          const tiposSet = new Set<string>();
          
          tiposTarea.forEach(tarea => {
            if (tarea.tipo) {
              tiposSet.add(tarea.tipo);
            }
            if (tarea.subtipo) {
              tiposSet.add(`${tarea.tipo} - ${tarea.subtipo}`);
            }
          });
          
          this.allUrgentTipos = Array.from(tiposSet).sort();
          this.filterUrgentTipos();
        },
        error: (err) => {
          console.error('Error cargando tipos de tarea por grupo_trabajo:', err);
          // Fallback: usar tipos predefinidos
          this.allUrgentTipos = [
            'Reparación urgente',
            'Limpieza imprevista', 
            'Mantenimiento correctivo',
            'Control de plagas urgente',
            'Riego de emergencia',
            'Fertilización urgente',
            'Reparación de sistemas',
            'Limpieza de equipos',
            'Revisión técnica',
            'Trabajo de emergencia',
            'Otro'
          ];
          this.filterUrgentTipos();
        }
      });
    } else {
      // Fallback: usar tipos predefinidos
      this.allUrgentTipos = [
        'Reparación urgente',
        'Limpieza imprevista',
        'Mantenimiento correctivo', 
        'Control de plagas urgente',
        'Riego de emergencia',
        'Fertilización urgente',
        'Reparación de sistemas',
        'Limpieza de equipos',
        'Revisión técnica',
        'Trabajo de emergencia',
        'Otro'
      ];
      this.filterUrgentTipos();
    }
  }
  
  filterUrgentInvernaderos() {
    if (!this.urgentInvernaderoSearch.trim()) {
      this.filteredUrgentInvernaderos = [...this.allUrgentInvernaderos];
    } else {
      const search = this.urgentInvernaderoSearch.toLowerCase();
      this.filteredUrgentInvernaderos = this.allUrgentInvernaderos.filter(inv => 
        inv.toLowerCase().includes(search)
      );
    }
  }
  
  filterUrgentTipos() {
    if (!this.urgentTipoSearch.trim()) {
      this.filteredUrgentTipos = [...this.allUrgentTipos];
    } else {
      const search = this.urgentTipoSearch.toLowerCase();
      this.filteredUrgentTipos = this.allUrgentTipos.filter(tipo => 
        tipo.toLowerCase().includes(search)
      );
    }
  }
  
  selectUrgentInvernadero(invernadero: string) {
    this.urgentTask.invernadero = invernadero;
    this.isUrgentInvernaderoOpen = false;
    this.urgentInvernaderoSearch = '';
  }
  
  selectUrgentTipo(tipo: string) {
    this.urgentTask.tipo_tarea = tipo;
    this.isUrgentTipoOpen = false;
    this.urgentTipoSearch = '';
  }

  // Cargar encargados del mismo cabezal para validación de tareas urgentes
  loadEncargadosDelCabezal() {
    if (this.loggedUser?.grupo_trabajo && this.loggedUser?.cabezal) {
      this.http.get<any[]>(`${environment.apiBaseUrl}/encargados/${this.loggedUser.grupo_trabajo}/${this.loggedUser.cabezal}`).subscribe({
        next: (encargados) => {
          this.encargadosDelCabezal = encargados.map(e => e.nombre_completo || e.nombre || e.id).filter(Boolean);
          console.log('Encargados del cabezal cargados:', this.encargadosDelCabezal);
          // Recargar tareas para aplicar el filtrado con la nueva información
          this.loadTasks();
        },
        error: (err) => {
          console.error('Error cargando encargados del cabezal:', err);
          this.encargadosDelCabezal = [];
        }
      });
    }
  }

  // Método para detectar si una tarea está vencida
  isTaskOverdue(task: Task): boolean {
    // Solo considerar vencidas las tareas que NO están terminadas
    if (this.isTaskCompleted(task)) {
      return false;
    }
    
    // Verificar si tiene fecha límite
    if (!task.fecha_limite) {
      return false;
    }
    
    try {
      const today = new Date();
      const dueDate = new Date(task.fecha_limite);
      
      // Normalizar las fechas para comparar solo la fecha (sin hora)
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      
      // La tarea está vencida si la fecha límite es anterior a hoy
      return dueDate < today;
    } catch (error) {
      // Si hay error al parsear la fecha, no considerar vencida
      return false;
    }
  }

  // Formatear dimension_total para mostrar con coma decimal (hasta 4 decimales)
  formatDimensionTotal(value: string | number): string {
    if (!value || value === 0) return '0,00';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // Si es NaN o 0, mostrar 0,00
    if (isNaN(numValue) || numValue === 0) return '0,00';
    
    // Mostrar hasta 4 decimales, eliminando ceros innecesarios al final
    let formatted = numValue.toFixed(4);
    
    // Eliminar ceros innecesarios al final
    formatted = formatted.replace(/\.?0+$/, '');
    
    // Si no hay decimales, agregar ",00"
    if (!formatted.includes('.')) {
      formatted += '.00';
    }
    
    // Reemplazar punto por coma
    return formatted.replace('.', ',');
  }

  // Método helper para convertir dimensión a número de manera consistente
  private parseDimension(value: any): number {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    // Convertir string a número manejando comas europeas
    return parseFloat(String(value).replace(',', '.')) || 0;
  }

  // Método para mostrar progreso detallado como "7,8/14,35 (45%)"
  getDetailedProgress(task: any): string {
    const estado = this.getTaskState(task);
    if (!task.dimension_total || !task.desarrollo_actual || !estado) {
      return '';
    }

    // Solo mostrar para tareas con progreso numérico (no "No iniciado", "Terminada", etc.)
    const progressNum = parseFloat(estado);
    if (isNaN(progressNum)) {
      return '';
    }

    const desarrolloActual = this.formatDimensionTotal(task.desarrollo_actual);
    const dimensionTotal = this.formatDimensionTotal(task.dimension_total);
    
    return `${desarrolloActual}/${dimensionTotal} (${estado}%)`;
  }



  // Obtener información de última actualización (solo informativo, sin restricciones)
  getLastUpdateInfo(task: any): string {
    if (!task.fecha_actualizacion) return '';
    return `Última actualización: ${task.fecha_actualizacion}`;
  }

  // Métodos para asignación de trabajadores
  onOpenWorkersModal(): void {
    if (this.jornalesRealesValue <= 0) {
      alert('Primero debe especificar las horas realmente trabajadas.');
      return;
    }
    this.showWorkersModal = true;
  }

  onCloseWorkersModal(): void {
    this.showWorkersModal = false;
    this.isUrgentTaskWorkersMode = false; // Resetear flag
  }

  onSaveWorkerAssignments(asignaciones: TrabajadorAsignado[]): void {
    if (this.isUrgentTaskWorkersMode) {
      // Modo tarea urgente
      this.urgentTaskWorkers = asignaciones;
      this.isUrgentTaskWorkersMode = false;
      console.log('Trabajadores asignados a tarea urgente:', asignaciones);
    } else {
      // Modo tarea normal
      this.trabajadoresAsignados = asignaciones;
    }
    
    this.trabajadoresValidados = true;
    this.showWorkersModal = false;
  }

  // Verificar si se pueden actualizar/completar las tareas
  canProceedWithUpdate(): boolean {
    return this.trabajadoresValidados && this.jornalesRealesValue > 0;
  }

  // Obtener el estado unificado de la tarea (solo proceso ahora)
  getTaskState(task: Task): string {
    return task.proceso || 'No iniciado';
  }

  // Verificar si una tarea está terminada (unificando ambos campos)
  isTaskCompleted(task: Task): boolean {
    return this.getTaskState(task) === 'Terminada';
  }

  // Verificar si es tarea urgente: detectar por características únicas
  isUrgentTask(task: Task): boolean {
    // Tareas urgentes tienen características específicas:
    // - hora_jornal === 0 (sin cálculos de división)
    // - jornales_reales > 0 (ya tienen horas desde la creación)
    // - proceso === 'Por validar' (estado inicial de urgentes) O 'Terminada' (si ya fueron validadas)
    const horaJornal = Number(task.hora_jornal) || 0;
    const jornalesReales = Number(task.jornales_reales) || 0;
    const estadoUrgente = task.proceso === 'Por validar' || 
                         (task.proceso === 'Terminada' && jornalesReales > 0 && horaJornal === 0);
    
    return horaJornal === 0 && jornalesReales > 0 && estadoUrgente;
  }

  getWorkersValidationMessage(): string {
    if (this.jornalesRealesValue <= 0) {
      return 'Especifique las horas trabajadas';
    }
    if (!this.trabajadoresValidados) {
      return 'Debe asignar trabajadores antes de continuar';
    }
    return `✅ ${this.trabajadoresAsignados.length} trabajador(es) asignado(s)`;
  }

  // Resetear validación cuando cambian las horas
  onJornalesRealesChange(): void {
    this.trabajadoresValidados = false;
    this.trabajadoresAsignados = [];
  }
}