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
import { HierarchicalTaskSelectorComponent } from '../../shared/hierarchical-task-selector/hierarchical-task-selector.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-newTask',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSelectModule, MatCheckboxModule, InvernaderoSelectorComponent, SearchableDropdownComponent, HierarchicalTaskSelectorComponent],
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
  estimation = ''; // Mantener para compatibilidad, pero ahora usar estimations
  dueDates: { [greenhouse: string]: string } = {};
  selectedEncargado = ''; // Mantener para compatibilidad, pero ahora usar selectedEncargados
  description = '';
  
  // NUEVAS PROPIEDADES PARA BLOQUES INDIVIDUALES
  estimations: { [greenhouse: string]: number } = {}; // Jornales por invernadero
  selectedEncargados: { [greenhouse: string]: string } = {}; // Encargado por invernadero
  
  // Nueva funcionalidad para fechas: por defecto global, toggle activa individual
  useIndividualDates = false; // false = global, true = individual
  singleDate = ''; // Fecha global cuando useIndividualDates es false
  
  // Nueva funcionalidad para encargados: por defecto global, toggle activa individual  
  useIndividualEncargados = false; // false = global, true = individual
  
  // Propiedades calculadas para mantener compatibilidad
  get useSingleDate(): boolean {
    return !this.useIndividualDates;
  }
  
  get useSingleEncargado(): boolean {
    return !this.useIndividualEncargados;
  }
  
  // Nueva funcionalidad para áreas de trabajo por invernadero
  workingAreas: { [greenhouse: string]: number } = {}; // Hectáreas a trabajar por invernadero
  
  // Kilos esperados por invernadero (cuando useKilosMode = true)
  expectedKilos: { [greenhouse: string]: number } = {}; // Kilos esperados por invernadero
  
  // Interruptor para horas por jornal: false = 6 horas, true = 8 horas
  useEightHourJornal: boolean = false; // Explícitamente tipado y inicializado
  
  // Interruptor para tipo de medición: false = Hectáreas, true = Kilos
  useKilosMode: boolean = false; // false = Hectáreas (0), true = Kilos (1)

  // Nuevas propiedades para el selector jerárquico de tareas
  @Input() loggedUser: User | undefined = undefined;
  selectedTareaJerarquica: string = '';
  grupoTrabajo: string = '';

  ngOnInit() {
    console.log(`INIT: useEightHourJornal = ${this.useEightHourJornal}`);
    
    // Establecer grupo de trabajo del usuario logueado
    if (this.loggedUser?.grupo_trabajo) {
      this.grupoTrabajo = this.loggedUser.grupo_trabajo;
    }
    
    // Cargar invernaderos filtrados por cabezal del usuario
    if (this.loggedUser?.cabezal) {
      this.greenhouseService.getGreenhousesByCabezal(this.loggedUser.cabezal).subscribe(data => {
        this.greenhouses = data.cabezales.flatMap(cabezal => cabezal.invernaderos);
        // Inicializar el formulario después de cargar los invernaderos
        this.initFormFromTask();
      });
    } else {
      // Fallback: cargar todos los invernaderos si no hay cabezal
      this.greenhouseService.getGreenhouses().subscribe(data => {
        this.greenhouses = data;
        // Inicializar el formulario después de cargar los invernaderos
        this.initFormFromTask();
      });
    }
    this.taskTypeService.getTaskTypes().subscribe(data => {
      this.taskTypes = data;
      // Convertir a opciones para el dropdown con buscador
      this.taskTypeOptions = this.taskTypes.map(t => ({
        value: t.tipo,
        label: t.tipo
      }));
    });
    // Obtener encargados filtrados por grupo de trabajo y cabezal
    if (this.grupoTrabajo && this.loggedUser?.cabezal) {
      this.http.get<User[]>(`${environment.apiBaseUrl}/encargados/${this.grupoTrabajo}/${this.loggedUser.cabezal}`).subscribe(encargados => {
        this.encargados = encargados;
        // Convertir a opciones para el dropdown con buscador
        this.encargadoOptions = this.encargados.map(e => ({
          value: e.id,
          label: e.name
        }));

      });
    }
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
      
      // Inicializar estructuras individuales para edición
      this.dueDates = {};
      this.estimations = {};
      this.selectedEncargados = {};
      
      if (this.task.invernadero) {
        // Configurar valores individuales del invernadero
        this.dueDates[this.task.invernadero] = this.task.fecha_limite || '';
        this.estimations[this.task.invernadero] = Number(this.task.estimacion_horas) || 0;
        this.selectedEncargados[this.task.invernadero] = this.task.encargado_id || '';
      }
      
      // Configurar valores únicos para compatibilidad
      this.selectedEncargado = this.task.encargado_id || '';
      this.description = this.task.descripcion || '';
      this.singleDate = this.task.fecha_limite || '';
      
      // Al editar, por defecto usar valores globales (más simple)
      this.useIndividualDates = false;
      this.useIndividualEncargados = false;
    } else {
      // Limpiar todo para nueva tarea
      this.invernaderoSelection = null;
      this.selectedTaskType = '';
      this.estimation = '';
      this.dueDates = {};
      this.estimations = {};
      this.selectedEncargado = '';
      this.selectedEncargados = {};
      this.description = '';
      this.useIndividualDates = false;
      this.useIndividualEncargados = false;
      this.singleDate = '';
      this.workingAreas = {};
      // NO tocamos useEightHourJornal aquí, debe mantener su valor por defecto (false)
    }
  }

  onInvernaderoSelectionChange(selection: InvernaderoSelection) {
    this.invernaderoSelection = selection;
    
    // Limpiar fechas anteriores y crear nuevas entradas según el modo
    this.updateDateFields();
    
    // Sincronizar fechas y encargados si están en modo único
    this.syncSingleValues();
  }
  
  private syncSingleValues() {
    const selectedInvernaderos = this.getSelectedInvernaderos();
    
    if (selectedInvernaderos.length > 0) {
      // Sincronizar fechas si está en modo global (no individual)
      if (!this.useIndividualDates && this.singleDate) {
        selectedInvernaderos.forEach(inv => {
          this.dueDates[inv] = this.singleDate;
        });
      }
      
      // Sincronizar encargados si está en modo global (no individual)
      if (!this.useIndividualEncargados && this.selectedEncargado) {
        selectedInvernaderos.forEach(inv => {
          this.selectedEncargados[inv] = this.selectedEncargado;
        });
      }
    }
  }
  
  onToggleClick() {
    // Cambiar manualmente el valor
    this.useIndividualDates = !this.useIndividualDates;
    
    // Llamar a la lógica de sincronización
    this.onDateModeToggle();
  }

  onDateModeToggle() {
    const selectedInvernaderos = this.getSelectedInvernaderos();
    
    if (this.useIndividualDates) {
      // Cambiamos a fechas individuales
      if (this.singleDate) {
        // Copiar fecha global a todos los invernaderos individuales
        selectedInvernaderos.forEach(inv => {
          this.dueDates[inv] = this.singleDate;
        });
      } else {
        // Si no hay fecha global, inicializar fechas vacías
        selectedInvernaderos.forEach(inv => {
          this.dueDates[inv] = '';
        });
      }
    } else {
      // Cambiamos a fecha global
      if (selectedInvernaderos.length > 0 && this.dueDates[selectedInvernaderos[0]]) {
        // Usar la primera fecha individual como global
        this.singleDate = this.dueDates[selectedInvernaderos[0]];
      }
    }
  }
  
  onEncargadoToggleClick() {
    // Cambiar manualmente el valor
    this.useIndividualEncargados = !this.useIndividualEncargados;
    
    // Llamar a la lógica de sincronización
    this.onEncargadoModeToggle();
  }

  onEncargadoModeToggle() {
    // Cambiar entre modo encargado global e individual
    if (this.useIndividualEncargados) {
      // Cambiamos a encargados individuales: copiar encargado global a todos
      if (this.selectedEncargado) {
        this.getSelectedInvernaderos().forEach(inv => {
          this.selectedEncargados[inv] = this.selectedEncargado;
        });
      }
    } else {
      // Cambiamos a encargado global: usar el primer encargado individual como global
      const selectedInvernaderos = this.getSelectedInvernaderos();
      if (selectedInvernaderos.length > 0 && this.selectedEncargados[selectedInvernaderos[0]]) {
        this.selectedEncargado = this.selectedEncargados[selectedInvernaderos[0]];
      }
    }
    this.updateEncargadoFields();
  }
  
  private updateDateFields() {
    
    if (this.invernaderoSelection && this.invernaderoSelection.invernaderos.length > 0) {
      if (this.useIndividualDates) {
        // Modo fechas individuales: crear entradas para cada invernadero si no existen
        this.invernaderoSelection.invernaderos.forEach((inv: string) => {
          if (!this.dueDates[inv]) {
            this.dueDates[inv] = '';
          }
        });
      } else {
        // Modo fecha global: asegurar que existe singleDate
        if (!this.singleDate) {
          this.singleDate = '';
        }
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
      
      // Inicializar estimaciones por invernadero
      this.invernaderoSelection.invernaderos.forEach((inv: string) => {
        if (!this.estimations[inv]) {
          this.estimations[inv] = 0;
        }
      });
      
      // Inicializar encargados por invernadero
      this.invernaderoSelection.invernaderos.forEach((inv: string) => {
        if (!this.selectedEncargados[inv]) {
          this.selectedEncargados[inv] = '';
        }
      });
    } else {
      // Si no hay invernaderos seleccionados, limpiar todo
      this.workingAreas = {};
      this.estimations = {};
      this.selectedEncargados = {};
    }
  }
  
  private updateEncargadoFields() {
    if (this.invernaderoSelection && this.invernaderoSelection.invernaderos.length > 0) {
      if (!this.useSingleEncargado) {
        // Modo encargados individuales: inicializar para cada invernadero
        this.invernaderoSelection.invernaderos.forEach((inv: string) => {
          if (!this.selectedEncargados[inv]) {
            this.selectedEncargados[inv] = '';
          }
        });
      }
    }
  }
  
  updateEncargado(invernadero: string, encargadoId: string) {
    this.selectedEncargados[invernadero] = encargadoId;
  }
  
  // Métodos para sincronizar valores globales con individuales
  onSingleDateChange() {
    if (!this.useIndividualDates && this.singleDate) {
      this.getSelectedInvernaderos().forEach(inv => {
        this.dueDates[inv] = this.singleDate;
      });
    }
  }
  
  onSingleEncargadoChange() {
    if (!this.useIndividualEncargados && this.selectedEncargado) {
      this.getSelectedInvernaderos().forEach(inv => {
        this.selectedEncargados[inv] = this.selectedEncargado;
      });
    }
  }

  // Método para manejar la selección del selector jerárquico de tareas
  onTareaJerarquicaSelected(tareaNombre: string) {
    this.selectedTareaJerarquica = tareaNombre;
    this.selectedTaskType = tareaNombre; // Mantener compatibilidad
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
    if (area === undefined || area === null || isNaN(area)) return '0,00';
    // Mostrar 2 decimales para display normal con coma decimal
    return area.toFixed(2).replace('.', ',');
  }
  
  // Getter para el área máxima
  getMaxAreaDisplay(invernaderoNombre: string): string {
    const maxArea = this.getMaxArea(invernaderoNombre);
    return maxArea.toFixed(2).replace('.', ',');
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

  updateExpectedKilos(invernaderoNombre: string, event: Event) {
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value) || 0;
    // Los kilos no tienen límite máximo, solo que sean positivos
    const clampedValue = Math.max(0, value);
    this.expectedKilos[invernaderoNombre] = clampedValue;
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

    // 3. Validar estimaciones de jornales por invernadero
    const invalidEstimations = selectedInvernaderos.filter((inv: string) => {
      const estimation = this.estimations[inv];
      return !estimation || estimation <= 0;
    });
    
    if (invalidEstimations.length > 0) {
      alert(`Por favor, ingresa una estimación de jornales válida (mayor que 0) para: ${invalidEstimations.join(', ')}`);
      return;
    }

    // 4. Validar encargados según el modo
    if (selectedInvernaderos.length === 1 || this.useIndividualEncargados) {
      // Modo encargados individuales (o un solo invernadero)
      const invalidEncargados = selectedInvernaderos.filter((inv: string) => {
        return !this.selectedEncargados[inv] || this.selectedEncargados[inv].trim() === '';
      });
      
      if (invalidEncargados.length > 0) {
        alert(`Por favor, selecciona un encargado para: ${invalidEncargados.join(', ')}`);
        return;
      }
    } else {
      // Modo encargado global (múltiples invernaderos con toggle desactivado)
      if (!this.selectedEncargado || this.selectedEncargado.trim() === '') {
        alert('Por favor, selecciona un encargado para todos los invernaderos.');
        return;
      }
    }
    
    // 5. Validar fechas según el modo
    if (selectedInvernaderos.length === 1 || this.useIndividualDates) {
      // Modo fechas individuales (o un solo invernadero)
      const missingDates = selectedInvernaderos.some((g: string) => !this.dueDates[g] || this.dueDates[g].trim() === '');
      if (missingDates) {
        alert('Por favor, selecciona una fecha límite para cada invernadero seleccionado.');
        return;
      }
    } else {
      // Modo fecha global (múltiples invernaderos con toggle desactivado)
      if (!this.singleDate || this.singleDate.trim() === '') {
        alert('Por favor, selecciona la fecha límite para todos los invernaderos.');
        return;
      }
    }
    
    // 6. Validar dimensiones según el tipo de medición
    if (this.useKilosMode) {
      // MODO KILOS: Validar que se hayan ingresado kilos esperados
      const invalidKilos = selectedInvernaderos.filter((g: string) => {
        const kilos = this.expectedKilos[g];
        return !kilos || kilos <= 0;
      });
      
      if (invalidKilos.length > 0) {
        alert(`Por favor, ingresa los kilos esperados (mayor que 0) para: ${invalidKilos.join(', ')}`);
        return;
      }
    } else {
      // MODO HECTÁREAS: Validar áreas como antes
      const invalidAreas = selectedInvernaderos.filter((g: string) => {
        const area = this.workingAreas[g];
        return !area || area <= 0;
      });
      
      if (invalidAreas.length > 0) {
        alert(`Por favor, selecciona un área de trabajo válida (mayor que 0) para: ${invalidAreas.join(', ')}`);
        return;
      }

      // Validar que las áreas no excedan el máximo disponible
      const exceedingAreas = selectedInvernaderos.filter((g: string) => {
        const area = this.workingAreas[g];
        const maxArea = this.getMaxArea(g);
        return area > maxArea;
      });

      if (exceedingAreas.length > 0) {
        alert(`El área seleccionada excede el máximo disponible para: ${exceedingAreas.join(', ')}`);
        return;
      }
    }
    
    // Emitir un array de tareas, una por invernadero
    const tareas = selectedInvernaderos.map((g: string) => {
      // Usar estimación individual del invernadero
      let estimationNum = Number(this.estimations[g]);
      if (isNaN(estimationNum)) estimationNum = 0;
      
      // Usar el área de trabajo definida por el usuario en la barra
      const workingArea = this.workingAreas[g] || 0;
      
      // Usar fecha según el modo (global o individual)
      const fechaLimite = (selectedInvernaderos.length > 1 && !this.useIndividualDates) 
        ? this.singleDate 
        : this.dueDates[g];
      
      // Usar encargado según el modo (global o individual)
      const encargadoId = (selectedInvernaderos.length > 1 && !this.useIndividualEncargados) 
        ? this.selectedEncargado 
        : this.selectedEncargados[g];
      
      // CONVERSIÓN SIMPLE: Jornales a Horas
      const horaJornal = this.useEightHourJornal ? 1 : 0; // 0=6h, 1=8h
      const factor = this.useEightHourJornal ? 8 : 6;     // Horas por jornal
      const estimacionEnHoras = estimationNum * factor;   // Conversión
      
      // TIPO DE MEDICIÓN: Hectáreas vs Kilos
      const horasKilos = this.useKilosMode ? 1 : 0; // 0=Hectáreas, 1=Kilos
      const dimensionValue = this.useKilosMode ? 
        (this.expectedKilos[g] || 0) :  // Kilos esperados
        workingArea;                     // Hectáreas seleccionadas
      
      console.log(`CONVERSIÓN ${g}: ${estimationNum} jornales × ${factor}h = ${estimacionEnHoras}h (hora_jornal=${horaJornal})`);
      console.log(`MEDICIÓN ${g}: ${this.useKilosMode ? 'KILOS' : 'HECTÁREAS'} = ${dimensionValue} (horas_kilos=${horasKilos})`);
      console.log(`ENCARGADO ${g}: ${encargadoId}`);
      
      const data: any = {
        invernadero: g,
        tipo_tarea: this.selectedTaskType,
        estimacion_horas: estimacionEnHoras, // YA EN HORAS TOTALES
        hora_jornal: horaJornal, // 0 = 6 horas, 1 = 8 horas
        horas_kilos: horasKilos, // 0 = Hectáreas, 1 = Kilos
        fecha_limite: fechaLimite,
        encargado_id: encargadoId,
        descripcion: this.description,
        dimension_total: dimensionValue // Hectáreas O Kilos esperados
      };
      if (this.task && this.task.id) {
        data.id = this.task.id;
      }
      
      return data;
    });
    
    this.add.emit(tareas);
  }
}
