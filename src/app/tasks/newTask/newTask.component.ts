import { Component, Output, EventEmitter, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GreenhouseService, Greenhouse } from '../greenhouse.service';
import { TaskTypeService, TaskType } from '../task-type.service';
import { UserService } from '../../user/user.service';
import { User } from '../../user/user.model';

@Component({
  selector: 'app-newTask',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './newTask.component.html',
  styleUrls: ['./newTask.component.css']
})

export class newTaskComponent implements OnInit, OnChanges {
  @Input() task: any = null;
  @Output() cancel = new EventEmitter<void>();
  @Output() add = new EventEmitter<any>();

  greenhouses: Greenhouse[] = [];
  taskTypes: TaskType[] = [];
  encargados: User[] = [];

  selectedGreenhouse = '';
  selectedTaskType = '';
  estimation = '';
  dueDate = '';
  selectedEncargado = '';
  description = '';

  ngOnInit() {
    this.greenhouseService.getGreenhouses().subscribe(data => this.greenhouses = data);
    this.taskTypeService.getTaskTypes().subscribe(data => {
      this.taskTypes = data;
    });
    this.userService.getUsers().subscribe(users => {
      this.encargados = users.filter((u: any) => !u.rol || u.rol.toLowerCase() === 'encargado');
    });
    this.initFormFromTask();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['task']) {
      this.initFormFromTask();
    }
  }

  constructor(
    private greenhouseService: GreenhouseService,
    private taskTypeService: TaskTypeService,
    private userService: UserService
  ) {}

  initFormFromTask() {
    if (this.task) {
      this.selectedGreenhouse = this.task.invernadero || '';
      this.selectedTaskType = this.task.tipo_tarea || '';
      this.estimation = this.task.estimacion_horas || '';
      this.dueDate = this.task.fecha_limite || '';
      this.selectedEncargado = this.task.encargado_id || '';
      this.description = this.task.descripcion || '';
    } else {
      this.selectedGreenhouse = '';
      this.selectedTaskType = '';
      this.estimation = '';
      this.dueDate = '';
      this.selectedEncargado = '';
      this.description = '';
    }
  }

  onCancel() {
    this.cancel.emit();
  }

  onSubmit() {
    const data: any = {
      invernadero: this.selectedGreenhouse,
      tipo_tarea: this.selectedTaskType,
      estimacion_horas: this.estimation,
      fecha_limite: this.dueDate,
      encargado_id: this.selectedEncargado,
      descripcion: this.description
    };
    if (this.task && this.task.id) {
      data.id = this.task.id;
    }
    this.add.emit(data);
  }
}
