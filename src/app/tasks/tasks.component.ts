import { Component, computed, Input, Output, EventEmitter, output } from '@angular/core';
import { TaskComponent } from "./task/task.component";
import { newTaskComponent } from './newTask/newTask.component';
import { Task, type NewTask } from './task/task.model';
import { TasksService } from './tasks.service';

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
  
  constructor(private tasksService: TasksService) {}

  get selectedUserTasks() {
    return this.tasksService.getUserTasks(this.userId);
  }

  onCompleteTask(taskId: string) {
    return this.tasksService.removeTask(taskId);
  }

  onStartAddTask() {
    this.isAddingTask = true;
  }

  onCancelAddTask() {
    this.isAddingTask = false;
  }

  onAddTask(taskData: NewTask) {
    this.tasksService.addTask(taskData, this.userId);
    this.isAddingTask = false;
  }
}
