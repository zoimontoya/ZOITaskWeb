import { Component, Output, EventEmitter, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { GreenhouseService, Greenhouse } from '../greenhouse.service';
import { TaskTypeService, TaskType } from '../task-type.service';
import { HttpClient } from '@angular/common/http';
import { User } from '../../user/user.model';
import { InvernaderoSelectorComponent, InvernaderoSelection } from '../../shared/invernadero-selector/invernadero-selector.component';
import { SearchableDropdownComponent, DropdownOption } from '../../shared/searchable-dropdown/searchable-dropdown.component';

@Component({
  selector: 'app-newTask',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSelectModule, MatCheckboxModule, InvernaderoSelectorComponent, SearchableDropdownComponent],
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

  // Opciones para los dropdowns con buscador
  taskTypeOptions: DropdownOption[] = [];
  encargadoOptions: DropdownOption[] = [];

  // Cambiar de selectedGreenhouses a selección jerárquica múltiple
  invernaderoSelection: InvernaderoSelection | null = null;
  selectedTaskType = '';
  estimation = '';
  dueDates: { [greenhouse: string]: string } = {};
  selectedEncargado = '';
  description = '';
  
  // Nueva funcionalidad para fechas únicas o individuales
  useSingleDate = true; // Por defecto, una fecha para todos
  singleDate = ''; // Fecha única cuando useSingleDate es true
  
  // Nueva funcionalidad para áreas de trabajo por invernadero
  workingAreas: { [greenhouse: string]: number } = {}; // Hectáreas a trabajar por invernadero
  
  // Interruptor para horas por jornal: false = 6 horas, true = 8 horas
  useEightHourJornal: boolean = false; // Explícitamente tipado y inicializado

  ngOnInit() {
    console.log(`INIT: useEightHourJornal = ${this.useEightHourJornal}`);
    
    this.greenhouseService.getGreenhouses().subscribe(data => {
      this.greenhouses = data;
      // Inicializar el formulario después de cargar los invernaderos
      this.initFormFromTask();
    });
    this.taskTypeService.getTaskTypes().subscribe(data => {
      this.taskTypes = data;
      // Convertir a opciones para el dropdown con buscador
      this.taskTypeOptions = this.taskTypes.map(t => ({
        value: t.tipo,
        label: t.tipo
      }));
    });
    // Obtener encargados desde el backend
    this.http.get<User[]>('http://localhost:3000/encargados').subscribe(encargados => {
      this.encargados = encargados;
      // Convertir a opciones para el dropdown con buscador
      this.encargadoOptions = this.encargados.map(e => ({
        value: e.id,
        label: e.name
      }));
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['task']) {
      // Solo inicializar si los invernaderos ya están cargados
      if (this.greenhouses.length > 0) {
        this.initFormFromTask();
      }
      // Si no están cargados, ngOnInit se encargará de llamar initFormFromTask
    }
  }

  constructor(
    private greenhouseService: GreenhouseService,
    private taskTypeService: TaskTypeService,
    private http: HttpClient
  ) {}

  initFormFromTask() {
    if (this.task) {
      // Para la edición, el invernadero-selector se encargará de la selección inicial
      // solo configuramos el área de trabajo actual
      if (this.task.invernadero) {
        this.workingAreas = {};
        
        // SOLUCIÓN: Usar el mismo método que funciona en updateProgress
        // Manejar tanto comas como puntos decimales
        const dimensionString = this.task.dimension_total || '0';
        const normalizedString = dimensionString.replace(',', '.');
        const currentArea = parseFloat(normalizedString) || 0;
        
        this.workingAreas[this.task.invernadero] = currentArea;
      }
      
      this.selectedTaskType = this.task.tipo_tarea || '';
      
      // 🔧 CONFIGURAR TOGGLE BASÁNDOSE EN VALOR ALMACENADO
      const horaJornalValue = Number(this.task.hora_jornal) || 0;
      this.useEightHourJornal = (horaJornalValue === 1);
      
      console.log(`� === EDITANDO TAREA - CONFIGURACIÓN INICIAL ===`);
      console.log(`📋 hora_jornal desde BD: "${this.task.hora_jornal}" → ${horaJornalValue}`);
      console.log(`🎚️ Toggle configurado a: ${this.useEightHourJornal} (${this.useEightHourJornal ? '8h' : '6h'} por jornal)`);
      
      // La estimación ya viene convertida a jornales por loadTasks()
      this.estimation = (Number(this.task.estimacion_horas) || 0).toString();
      console.log(`📊 Jornales para mostrar: ${this.estimation}`);
      
      this.dueDates = {};
      if (this.task.invernadero && this.task.fecha_limite) {
        this.dueDates[this.task.invernadero] = this.task.fecha_limite;
      }
      this.selectedEncargado = this.task.encargado_id || '';
      this.description = this.task.descripcion || '';
      
      // Configurar fechas según el modo
      if (this.task.fecha_limite) {
        this.singleDate = this.task.fecha_limite;
        this.useSingleDate = true; // Por defecto al editar, usar fecha única
      }
    } else {
      this.invernaderoSelection = null;
      this.selectedTaskType = '';
      this.estimation = '';
      this.dueDates = {};
      this.selectedEncargado = '';
      this.description = '';
      this.useSingleDate = true;
      this.singleDate = '';
      this.workingAreas = {}; // Limpiar áreas de trabajo
      // NO tocamos useEightHourJornal aquí, debe mantener su valor por defecto (false)
    }
  }

  onInvernaderoSelectionChange(selection: InvernaderoSelection) {
    this.invernaderoSelection = selection;
    
    // Limpiar fechas anteriores y crear nuevas entradas según el modo
    this.updateDateFields();
  }
  
  onDateModeToggle() {
    // Cambiar entre modo fecha única y fechas individuales
    this.useSingleDate = !this.useSingleDate;
    this.updateDateFields();
  }
  
  private updateDateFields() {
    // Limpiar fechas anteriores
    this.dueDates = {};
    
    if (this.invernaderoSelection && this.invernaderoSelection.invernaderos.length > 0) {
      if (!this.useSingleDate) {
        // Modo fechas individuales: crear entradas para cada invernadero
        this.invernaderoSelection.invernaderos.forEach((inv: string) => {
          this.dueDates[inv] = '';
        });
      }
      
      // Inicializar áreas de trabajo para cada invernadero seleccionado
      this.invernaderoSelection.invernaderos.forEach((inv: string) => {
        if (!this.workingAreas[inv]) {
          // Obtener el área máxima del invernadero desde los datos
          const greenhouse = this.greenhouses.find(gh => gh.nombre === inv);
          const maxArea = parseFloat(greenhouse?.dimensiones || '0') || 0;
          // Por defecto, usar toda el área disponible SIN redondear
          this.workingAreas[inv] = maxArea;
        }
      });
      
      // Limpiar áreas de invernaderos que ya no están seleccionados
      Object.keys(this.workingAreas).forEach(inv => {
        if (!this.invernaderoSelection?.invernaderos.includes(inv)) {
          delete this.workingAreas[inv];
        }
      });
    } else {
      // Si no hay invernaderos seleccionados, limpiar áreas
      this.workingAreas = {};
    }
  }

  getSelectedInvernaderos(): string[] {
    // Durante la edición, si aún no hay selección del componente pero hay un task, mostrar ese invernadero
    if (this.task && this.task.invernadero && (!this.invernaderoSelection || this.invernaderoSelection.invernaderos.length === 0)) {
      return [this.task.invernadero];
    }
    return this.invernaderoSelection?.invernaderos || [];
  }
  
  // Método para obtener el área máxima de un invernadero
  getMaxArea(invernaderoNombre: string): number {
    const greenhouse = this.greenhouses.find(gh => gh.nombre === invernaderoNombre);
    const maxArea = parseFloat(greenhouse?.dimensiones || '0') || 0;
    // NO redondear para mantener precisión completa
    return maxArea;
  }
  
  // Método para calcular el porcentaje correctamente
  getAreaPercentage(invernaderoNombre: string): number {
    const currentArea = this.workingAreas[invernaderoNombre] || 0;
    const maxArea = this.getMaxArea(invernaderoNombre);
    if (maxArea === 0) return 0;
    return (currentArea / maxArea) * 100;
  }
  
  // Getter que fuerza la evaluación del área actual
  getCurrentAreaDisplay(invernaderoNombre: string): string {
    const area = this.workingAreas[invernaderoNombre];
    if (area === undefined || area === null || isNaN(area)) return '0.00';
    // Mostrar 2 decimales para display normal
    return area.toFixed(2);
  }
  
  // Getter para el área máxima
  getMaxAreaDisplay(invernaderoNombre: string): string {
    const maxArea = this.getMaxArea(invernaderoNombre);
    return maxArea.toFixed(2);
  }
  
  // Método para actualizar el área de trabajo de un invernadero
  updateWorkingArea(invernaderoNombre: string, event: Event) {
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value) || 0;
    const maxArea = this.getMaxArea(invernaderoNombre);
    // Asegurar que el valor esté dentro del rango válido pero SIN redondear
    const clampedValue = Math.min(Math.max(0, value), maxArea);
    this.workingAreas[invernaderoNombre] = clampedValue; // Mantener precisión completa
  }

  onCancel() {
    this.cancel.emit();
  }

  // DEBUG: Métodos de prueba temporal
  onToggleChange() {
    console.log(`🔄 Interruptor cambiado: useEightHourJornal = ${this.useEightHourJornal}`);
  }



  onSubmit() {
    console.log(`TOGGLE STATUS: useEightHourJornal = ${this.useEightHourJornal} (${this.useEightHourJornal ? '8h' : '6h'})`);
    
    // VALIDACIONES OBLIGATORIAS (todos los campos excepto descripción)
    
    // 1. Validar selección de invernaderos
    const selectedInvernaderos = this.getSelectedInvernaderos();
    if (selectedInvernaderos.length === 0) {
      alert('Por favor, selecciona al menos un invernadero.');
      return;
    }

    // 2. Validar tipo de tarea
    if (!this.selectedTaskType || this.selectedTaskType.trim() === '') {
      alert('Por favor, selecciona un tipo de tarea.');
      return;
    }

    // 3. Validar estimación de jornales
    const estimationNum = Number(this.estimation);
    if (!this.estimation || isNaN(estimationNum) || estimationNum <= 0) {
      alert('Por favor, ingresa una estimación de jornales válida (mayor que 0).');
      return;
    }

    // 4. Validar encargado
    if (!this.selectedEncargado || this.selectedEncargado.trim() === '') {
      alert('Por favor, selecciona un encargado para la tarea.');
      return;
    }
    
    // 5. Validar fechas según el modo seleccionado
    if (this.useSingleDate) {
      // Modo fecha única: validar que se haya seleccionado la fecha única
      if (!this.singleDate || this.singleDate.trim() === '') {
        alert('Por favor, selecciona la fecha límite para la tarea.');
        return;
      }
    } else {
      // Modo fechas individuales: validar que todas las fechas estén completas
      const missingDates = selectedInvernaderos.some((g: string) => !this.dueDates[g] || this.dueDates[g].trim() === '');
      if (missingDates) {
        alert('Por favor, selecciona una fecha límite para cada invernadero seleccionado.');
        return;
      }
    }
    
    // 6. Validar que se haya seleccionado un área válida para cada invernadero
    const invalidAreas = selectedInvernaderos.filter((g: string) => {
      const area = this.workingAreas[g];
      return !area || area <= 0;
    });
    
    if (invalidAreas.length > 0) {
      alert(`Por favor, selecciona un área de trabajo válida (mayor que 0) para: ${invalidAreas.join(', ')}`);
      return;
    }

    // 7. Validar que las áreas no excedan el máximo disponible
    const exceedingAreas = selectedInvernaderos.filter((g: string) => {
      const area = this.workingAreas[g];
      const maxArea = this.getMaxArea(g);
      return area > maxArea;
    });

    if (exceedingAreas.length > 0) {
      alert(`El área seleccionada excede el máximo disponible para: ${exceedingAreas.join(', ')}`);
      return;
    }
    
    // Emitir un array de tareas, una por invernadero
    const tareas = selectedInvernaderos.map((g: string) => {
      let estimationNum = Number(this.estimation);
      if (isNaN(estimationNum)) estimationNum = 0;
      
      // Usar el área de trabajo definida por el usuario en la barra
      const workingArea = this.workingAreas[g] || 0;
      
      // Usar fecha única o individual según el modo
      const fechaLimite = this.useSingleDate ? this.singleDate : this.dueDates[g];
      
      // CONVERSIÓN SIMPLE: Jornales a Horas
      const horaJornal = this.useEightHourJornal ? 1 : 0; // 0=6h, 1=8h
      const factor = this.useEightHourJornal ? 8 : 6;     // Horas por jornal
      const estimacionEnHoras = estimationNum * factor;   // Conversión
      
      console.log(`CONVERSIÓN ${g}: ${estimationNum} jornales × ${factor}h = ${estimacionEnHoras}h (hora_jornal=${horaJornal})`);      
      
      const data: any = {
        invernadero: g,
        tipo_tarea: this.selectedTaskType,
        estimacion_horas: estimacionEnHoras, // YA EN HORAS TOTALES
        hora_jornal: horaJornal, // 0 = 6 horas, 1 = 8 horas
        fecha_limite: fechaLimite,
        encargado_id: this.selectedEncargado,
        descripcion: this.description,
        dimension_total: workingArea // El valor exacto seleccionado en la barra
      };
      if (this.task && this.task.id) {
        data.id = this.task.id;
      }
      
      return data;
    });
    
    this.add.emit(tareas);
  }
}
