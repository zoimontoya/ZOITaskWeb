import { Component, Output, EventEmitter } from '@angular/core';
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

export class newTaskComponent {
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

  constructor(
    private greenhouseService: GreenhouseService,
    private taskTypeService: TaskTypeService,
    private userService: UserService
  ) {
    this.greenhouseService.getGreenhouses().subscribe(data => this.greenhouses = data);
    this.taskTypeService.getTaskTypes().subscribe(data => {
      console.log('Tipos de tarea:', data);
      this.taskTypes = data;
    });
    this.userService.getUsers().subscribe(users => {
      // Filtrar solo encargados si hay columna 'rol' en la hoja
      this.encargados = users.filter((u: any) => !u.rol || u.rol.toLowerCase() === 'encargado');
    });
  }

  onCancel() {
    this.cancel.emit();
  }

  onSubmit() {
    this.add.emit({
      invernadero: this.selectedGreenhouse,
      tipo_tarea: this.selectedTaskType,
      estimacion_horas: this.estimation,
      fecha_limite: this.dueDate,
      encargado_id: this.selectedEncargado,
      descripcion: this.description
    });
  }
}
