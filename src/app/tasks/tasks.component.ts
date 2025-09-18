import { Component, computed, Input, Output, EventEmitter, output } from '@angular/core';
import { TaskComponent } from "./task/task.component";
import { newTaskComponent } from './newTask/newTask.component';
import { Task } from './task/task.model';
import { TaskService } from './task.service';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [TaskComponent, newTaskComponent],
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.css']
})

export class TasksComponent {
  @Input({required: true}) name? : string;
  @Input({required: true}) userId!: string;
  isAddingTask = false;
  
  constructor(private taskService: TaskService) {}

  // Aquí podrías implementar la recarga de tareas desde Google Sheets si lo deseas



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
        alert('Tarea guardada correctamente');
      },
      error: () => {
        alert('Error al guardar la tarea');
      }
    });
  }
}
