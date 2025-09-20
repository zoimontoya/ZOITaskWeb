// ...existing code...
// ...existing code...
// ...existing code...
import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskService, Task } from './task.service';
import { TaskComponent } from './task/task.component';
import { newTaskComponent } from './newTask/newTask.component';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, newTaskComponent],
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.css']
})
export class TasksComponent implements OnInit, OnChanges {
  // Recarga la lista de tareas hasta que el cambio se refleje o se agoten los intentos
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
    if (confirm(`¿Seguro que quieres eliminar la tarea "${task.tipo_tarea}" de invernadero ${task.invernadero}?`)) {
      this.onDeleteTask(task);
    }
  }
  @Input() isEncargado: boolean = false;
  @Input() name?: string;
  @Input() userId!: string;

  isAddingTask = false;
  tasks: Task[] = [];
  loading = true;
  editingTask: Task | null = null;

  constructor(private taskService: TaskService) {}

  ngOnInit() {
    this.loadTasks();
  }

  ngOnChanges() {
    this.loadTasks();
  }

  loadTasks() {
    this.loading = true;
    this.taskService.getTasks().subscribe({
      next: (tasks) => {
        this.tasks = tasks.filter(t => t.encargado_id === this.userId);
        this.loading = false;
      },
      error: () => {
        this.tasks = [];
        this.loading = false;
      }
    });
  }

  onStartEditTask(task: Task) {
    this.editingTask = { ...task };
  }

  onCancelEditTask() {
    this.editingTask = null;
  }

  onEditTask(updatedTask: any) {
    if (!this.editingTask) return;
    // Si updatedTask es un array, toma la primera tarea (edición)
    const tarea = Array.isArray(updatedTask) ? updatedTask[0] : updatedTask;
    const id = tarea.id || this.editingTask.id;
    this.taskService.updateTask(id, tarea).subscribe({
      next: (res: any) => {
        this.editingTask = null;
        // Reintenta recargar hasta que la tarea editada tenga los nuevos datos
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
    // taskData puede ser un array de tareas o una sola tarea
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
}