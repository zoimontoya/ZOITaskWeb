import { Component, Input, OnInit, OnDestroy, OnChanges } from '@angular/core';
import { TasksService } from './tasks.service';
import { Task } from './task/task.model';
import { GreenhouseService, Greenhouse } from './greenhouse.service';
import { UserService } from '../user/user.service';

import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { newTaskComponent } from './newTask/newTask.component';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, newTaskComponent],
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.css']
})
export class TasksComponent implements OnInit, OnDestroy, OnChanges {
  @Input() isEncargado: boolean = false;
  @Input() name?: string;
  @Input() userId!: string;

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
  greenhouses: Greenhouse[] = [];

  constructor(private taskService: TasksService, private greenhouseService: GreenhouseService, private userService: UserService) {}

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
        
        if (this.isEncargado && this.userId) {
          // Para encargados: filtrar solo sus tareas
          const userIdNorm = String(this.userId).trim().toLowerCase();
          this.tasks = tasks.filter(t => String(t.encargado_id).trim().toLowerCase() === userIdNorm)
            .map(t => ({ ...t, id: String(t.id) }));
        } else {
          // Para supervisores: mostrar todas las tareas
          this.tasks = tasks.map(t => ({ ...t, id: String(t.id) }));
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
    this.showCompleteModal = true;
  }

  onUpdateProgressOnly() {
    if (this.taskToComplete && this.progressValue !== (Number(this.taskToComplete.progreso) || 0)) {
      // Calcular hectáreas basadas en el porcentaje
      const totalHectares = parseFloat((this.taskToComplete.dimension_total || '0').replace(',', '.'));
      const hectareasActuales = (totalHectares * this.progressValue) / 100;
      
      this.taskService.updateTaskProgress(this.taskToComplete.id, this.progressValue, hectareasActuales).subscribe({
        next: () => {
          console.log('Progreso actualizado correctamente');
          this.showCompleteModal = false;
          this.taskToComplete = null;
          this.progressValue = 0;
          this.loadTasks(); // Recargar para ver cambios
        },
        error: (err: any) => {
          console.error('Error al actualizar progreso:', err);
          alert('Error al actualizar el progreso. Inténtalo de nuevo.');
        }
      });
    }
  }

  onConfirmCompleteTask() {
    if (this.taskToComplete && this.progressValue === 100) {
      // Calcular hectáreas para 100% de progreso
      const totalHectares = parseFloat((this.taskToComplete.dimension_total || '0').replace(',', '.'));
      const hectareasCompletas = totalHectares; // 100% = todas las hectáreas
      
      // Primero actualizar el progreso al 100% y las hectáreas
      this.taskService.updateTaskProgress(this.taskToComplete.id, 100, hectareasCompletas).subscribe({
        next: () => {
          console.log('Progreso actualizado al 100%');
          // Después completar la tarea (cambiar estado)
          if (this.taskToComplete) {
            this.taskService.completeTask(this.taskToComplete.id).subscribe({
              next: () => {
                console.log('Tarea completada correctamente');
                this.showCompleteModal = false;
                this.taskToComplete = null;
                this.progressValue = 0;
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
  }

  onCancelCompleteTask() {
    this.showCompleteModal = false;
    this.taskToComplete = null;
    this.progressValue = 0;
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
    
    const totalHectares = parseFloat(this.taskToComplete.dimension_total.replace(',', '.'));
    const currentHectares = (totalHectares * this.progressValue) / 100;
    
    // Formatear con comas como separador de miles si es necesario
    return currentHectares.toLocaleString('es-ES', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 3 
    });
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
}