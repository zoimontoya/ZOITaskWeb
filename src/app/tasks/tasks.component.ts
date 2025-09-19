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
    this.taskService.updateTask(this.editingTask.id, updatedTask).subscribe({
      next: () => {
        this.editingTask = null;
        this.loadTasks();
      },
      error: (err) => {
        if (err.status === 200) {
          this.editingTask = null;
          this.loadTasks();
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
}