import { Component, Input, OnInit, OnDestroy, OnChanges } from '@angular/core';
import { TaskService } from './task.service';
import { Task } from './task/task.model';

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
  invernaderos: string[] = [];
  tiposTarea: string[] = [];
  loading = true;
  editingTask: Task | null = null;
  showDeleteModal = false;
  taskToDelete: Task | null = null;

  constructor(private taskService: TaskService) {}

  ngOnInit() {
    this.loadTasks();
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
    if (this.selectedInvernadero) {
      filtered = filtered.filter(t => t.invernadero === this.selectedInvernadero);
    }
    if (this.selectedTipo) {
      filtered = filtered.filter(t => t.tipo_tarea === this.selectedTipo);
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
    this.selectedFechaOrden = 'desc';
    this.applyFilters();
  }

  loadTasks() {
    this.loading = true;
    this.taskService.getTasks().subscribe({
      next: (tasks) => {
        // DEBUG: log userId y encargado_id de cada tarea
        console.log('userId recibido:', this.userId);
        console.log('Tareas recibidas:', tasks.map(t => t.encargado_id));
        if (this.userId) {
          const userIdNorm = String(this.userId).trim().toLowerCase();
          this.tasks = tasks.filter(t => String(t.encargado_id).trim().toLowerCase() === userIdNorm)
            .map(t => ({ ...t, id: String(t.id) }));
        } else {
          this.tasks = tasks.map(t => ({ ...t, id: String(t.id) }));
        }
        this.invernaderos = Array.from(new Set(this.tasks.map(t => t.invernadero).filter(Boolean)));
        this.tiposTarea = Array.from(new Set(this.tasks.map(t => t.tipo_tarea).filter(Boolean)));
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.tasks = [];
        this.filteredTasks = [];
        this.loading = false;
      }
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
    this.taskService.updateTask(id, tarea).subscribe({
      next: (res: any) => {
        this.editingTask = null;
        this.pollForTaskListChange(() => {
          const t = this.tasks.find(t => t.id === id);
          return !!(t && t.tipo_tarea === tarea.tipo_tarea && t.descripcion === tarea.descripcion);
        });
      },
      error: (err) => {
        if (err.status === 200) {
          this.editingTask = null;
          this.pollForTaskListChange(() => {
            const t = this.tasks.find(t => t.id === id);
            return !!(t && t.tipo_tarea === tarea.tipo_tarea && t.descripcion === tarea.descripcion);
          });
        } else {
          alert('No se pudo editar la tarea. Puede que ya no exista.');
          this.editingTask = null;
          this.pollForTaskListChange(() => {
            const t = this.tasks.find(t => t.id === id);
            return !!(t && t.tipo_tarea === tarea.tipo_tarea && t.descripcion === tarea.descripcion);
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
    this.taskService.addTask(taskData).subscribe({
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

  trackById(index: number, item: Task) {
    return item.id;
  }
}