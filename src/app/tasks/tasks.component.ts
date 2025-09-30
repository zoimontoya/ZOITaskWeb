import { Component, Input, OnInit, OnDestroy, OnChanges } from '@angular/core';
import { TasksService } from './tasks.service';
import { Task } from './task/task.model';
import { GreenhouseService, Greenhouse } from './greenhouse.service';
import { UserService } from '../user/user.service';
import { TrabajadoresService, TrabajadorAsignado } from '../trabajadores/trabajadores.service';

import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { newTaskComponent } from './newTask/newTask.component';
import { AsignarTrabajadoresComponent } from '../trabajadores/asignar-trabajadores/asignar-trabajadores.component';

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

  constructor(private taskService: TasksService, private greenhouseService: GreenhouseService, private userService: UserService, private trabajadoresService: TrabajadoresService) {}

  ngOnInit() {
    this.loadTasks();
    this.greenhouseService.getGreenhouses().subscribe(data => this.greenhouses = data);
    document.addEventListener('mousedown', this.handleClickOutside);
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
  };

  applyFilters() {
    let filtered = [...this.tasks];
    console.log('DEBUG applyFilters - tasks originales:', this.tasks.length);
    console.log('DEBUG applyFilters - isEncargado:', this.isEncargado);
    console.log('DEBUG applyFilters - userId:', this.userId);
    
    // Debug: Mostrar todas las tareas con sus estados y progresos
    console.log('DEBUG: Todas las tareas y sus estados:');
    this.tasks.forEach(t => {
      console.log(`  Tarea ${t.id}: proceso="${t.proceso}", progreso="${t.progreso}"`);
    });
    
    // Filtrar por estado seleccionado (usando solo el campo progreso)
    switch (this.selectedEstado) {
      case 'sin-iniciar':
        filtered = filtered.filter(t => t.progreso === 'No iniciado');
        break;
      case 'en-progreso':
        // Mostrar tareas que estén iniciadas O que tengan progreso numérico
        filtered = filtered.filter(t => {
          const esIniciada = t.progreso === 'Iniciada';
          const tieneProgreso = t.progreso && !isNaN(Number(t.progreso)) && Number(t.progreso) > 0;
          const resultado = esIniciada || tieneProgreso;
          
          if (resultado) {
            console.log(`DEBUG: Tarea incluida en "en-progreso" - ID: ${t.id}, progreso: "${t.progreso}", esIniciada: ${esIniciada}, tieneProgreso: ${tieneProgreso}`);
          }
          
          return resultado;
        });
        break;
      case 'terminadas':
        filtered = filtered.filter(t => t.progreso === 'Terminada');
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
    console.log('DEBUG applyFilters - filteredTasks final:', this.filteredTasks.length);
    console.log('DEBUG applyFilters - primeras tareas:', this.filteredTasks.slice(0, 2));
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
        // DEBUG: log userId y encargado_id de cada tarea
        console.log('userId recibido:', this.userId);
        console.log('Tareas recibidas:', tasks.map(t => t.encargado_id));
        
        // CONVERSIÓN DE HORAS A JORNALES EN EL FRONTEND
        const tasksConvertidas = tasks.map(t => {
          const horaJornal = Number(t.hora_jornal) || 0;
          const factorConversion = horaJornal === 1 ? 8 : 6; // 1 = 8h/jornal, 0 = 6h/jornal
          const horasTotales = Number(t.estimacion_horas) || 0;
          const jornalesCalculados = horasTotales / factorConversion;
          
          return {
            ...t,
            estimacion_horas: jornalesCalculados, // Convertido a jornales para mostrar
            id: String(t.id)
          };
        });
        
        // DEBUG: Verificar conversión
        console.log('DEBUG conversión:', tasksConvertidas.slice(0, 2).map(t => ({ 
          id: t.id, 
          hora_jornal: t.hora_jornal,
          horas_almacenadas: tasks.find(orig => orig.id === t.id)?.estimacion_horas,
          jornales_calculados: t.estimacion_horas,
          factor: t.hora_jornal === 1 ? '8h' : '6h'
        })));
        

        
        if (this.isEncargado && this.userId) {
          // Para encargados: filtrar solo sus tareas
          const userIdNorm = String(this.userId).trim().toLowerCase();
          this.tasks = tasksConvertidas.filter(t => String(t.encargado_id).trim().toLowerCase() === userIdNorm);
        } else {
          // Para supervisores: mostrar todas las tareas
          this.tasks = tasksConvertidas;
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
    const tareaCompleta = {
      ...tarea,
      nombre_superior: this.name || '',
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
    const tareasConSuperior = Array.isArray(taskData) 
      ? taskData.map(tarea => ({
          ...tarea,
          nombre_superior: this.name || ''
        }))
      : [{
          ...taskData,
          nombre_superior: this.name || ''
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
    this.taskToComplete = task;
    this.progressValue = Number(task.progreso) || 0; // Usar el campo progreso para el porcentaje
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
    if (!this.taskToComplete) return;
    
    // Validar que se haya ingresado el número de horas reales
    if (!this.jornalesRealesValue || this.jornalesRealesValue <= 0) {
      alert('Por favor, ingresa el número de horas realmente trabajadas.');
      return;
    }

    // Validar que se hayan asignado trabajadores
    if (!this.canProceedWithUpdate()) {
      alert('Debe asignar trabajadores y validar que las horas cuadren antes de actualizar el progreso.');
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
        },
        error: (err: any) => {
          console.error('Error al actualizar progreso:', err);
          alert('Error al actualizar el progreso. Inténtalo de nuevo.');
        }
      });
  }

  onConfirmCompleteTask() {
    if (!this.taskToComplete) return;
    
    // Validar que se haya ingresado el número de horas reales
    if (!this.jornalesRealesValue || this.jornalesRealesValue <= 0) {
      alert('Por favor, ingresa el número de horas realmente trabajadas para completar la tarea.');
      return;
    }

    // Validar que se hayan asignado trabajadores
    if (!this.canProceedWithUpdate()) {
      alert('Debe asignar trabajadores y validar que las horas cuadren antes de completar la tarea.');
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
    
    // Actualizar el progreso al 100% y completar
    this.taskService.updateTaskProgress(this.taskToComplete.id, progressValue, desarrolloValue, this.jornalesRealesValue, this.trabajadoresAsignados, this.name).subscribe({
        next: () => {
          console.log('Progreso actualizado al 100%');
          // Después completar la tarea (cambiar estado)
          if (this.taskToComplete) {
            this.taskService.completeTask(this.taskToComplete.id, this.trabajadoresAsignados, this.name).subscribe({
              next: () => {
                console.log('Tarea completada correctamente');
                this.showCompleteModal = false;
                this.taskToComplete = null;
                this.progressValue = 0;
                this.jornalesRealesValue = 0; // Limpiar jornales reales
                this.kilosRecogidosValue = 0; // Limpiar kilos recogidos
                this.loadTasks(); // Recargar para ver cambios
              },
              error: (err) => {
                console.error('Error al completar tarea:', err);
                alert('Error al completar la tarea. Inténtalo de nuevo.');
              }
            });
          }
        },
        error: (err: any) => {
          console.error('Error al actualizar progreso final:', err);
          alert('Error al actualizar el progreso final. Inténtalo de nuevo.');
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

  // Método para detectar si una tarea está vencida
  isTaskOverdue(task: Task): boolean {
    // Solo considerar vencidas las tareas que NO están terminadas
    if (task.progreso === 'Terminada') {
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
    if (!task.dimension_total || !task.desarrollo_actual || !task.progreso) {
      return '';
    }

    // Solo mostrar para tareas con progreso numérico (no "No iniciado", "Terminada", etc.)
    const progressNum = parseFloat(task.progreso);
    if (isNaN(progressNum)) {
      return '';
    }

    const desarrolloActual = this.formatDimensionTotal(task.desarrollo_actual);
    const dimensionTotal = this.formatDimensionTotal(task.dimension_total);
    
    return `${desarrolloActual}/${dimensionTotal} (${task.progreso}%)`;
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
  }

  onSaveWorkerAssignments(asignaciones: TrabajadorAsignado[]): void {
    this.trabajadoresAsignados = asignaciones;
    this.trabajadoresValidados = true;
    this.showWorkersModal = false;
    console.log('Trabajadores asignados:', asignaciones);
  }

  // Verificar si se pueden actualizar/completar las tareas
  canProceedWithUpdate(): boolean {
    return this.trabajadoresValidados && this.jornalesRealesValue > 0;
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