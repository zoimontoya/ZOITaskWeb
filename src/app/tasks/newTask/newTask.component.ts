import { Component, Output, EventEmitter, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { GreenhouseService, Greenhouse } from '../greenhouse.service';
import { TaskTypeService, TaskType } from '../task-type.service';
import { HttpClient } from '@angular/common/http';
import { User } from '../../user/user.model';

@Component({
  selector: 'app-newTask',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSelectModule, MatCheckboxModule],
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

  selectedGreenhouses: string[] = [];
  selectedTaskType = '';
  estimation = '';
  dueDates: { [greenhouse: string]: string } = {};
  selectedEncargado = '';
  description = '';

  ngOnInit() {
    this.greenhouseService.getGreenhouses().subscribe(data => this.greenhouses = data);
    this.taskTypeService.getTaskTypes().subscribe(data => {
      this.taskTypes = data;
    });
    // Obtener encargados desde el backend
    this.http.get<User[]>('http://localhost:3000/encargados').subscribe(encargados => {
      this.encargados = encargados;
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
    private http: HttpClient
  ) {}

  initFormFromTask() {
    if (this.task) {
      // Si la tarea tiene varios invernaderos (en el futuro), soportar array o string
      if (Array.isArray(this.task.invernadero)) {
        this.selectedGreenhouses = this.task.invernadero.map(String);
      } else if (this.task.invernadero) {
        this.selectedGreenhouses = [String(this.task.invernadero)];
      } else {
        this.selectedGreenhouses = [];
      }
      this.selectedTaskType = this.task.tipo_tarea || '';
      this.estimation = this.task.estimacion_horas || '';
      this.dueDates = {};
      if (this.task.invernadero && this.task.fecha_limite) {
        // Si hay varios invernaderos, podrías necesitar mapear varias fechas
        this.dueDates[this.task.invernadero] = this.task.fecha_limite;
      }
      this.selectedEncargado = this.task.encargado_id || '';
      this.description = this.task.descripcion || '';
    } else {
      this.selectedGreenhouses = [];
      this.selectedTaskType = '';
      this.estimation = '';
      this.dueDates = {};
      this.selectedEncargado = '';
      this.description = '';
    }
  }

  onCancel() {
    this.cancel.emit();
  }

  onSubmit() {
    // Validar que todas las fechas estén completas
    const missingDates = this.selectedGreenhouses.some(g => !this.dueDates[g]);
    if (missingDates) {
      alert('Por favor, selecciona una fecha límite para cada invernadero.');
      return;
    }
    // Emitir un array de tareas, una por invernadero
    const tareas = this.selectedGreenhouses.map(g => {
      let estimationNum = Number(this.estimation);
      if (isNaN(estimationNum)) estimationNum = 0;
      const data: any = {
        invernadero: g,
        tipo_tarea: this.selectedTaskType,
        estimacion_horas: estimationNum,
        fecha_limite: this.dueDates[g],
        encargado_id: this.selectedEncargado,
        descripcion: this.description
      };
      if (this.task && this.task.id) {
        data.id = this.task.id;
      }
      return data;
    });
    this.add.emit(tareas);
  }
}
