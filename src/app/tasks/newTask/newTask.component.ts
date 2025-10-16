import { Component, Output, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, AfterViewInit, ViewChild, ChangeDetectorRef } from '@angular/core';
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
import { ModalMessageComponent } from '../../shared/modal-message.component';
import { environment } from '../../../environments/environment';


@Component({
  selector: 'app-newTask',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSelectModule, MatCheckboxModule, InvernaderoSelectorComponent, SearchableDropdownComponent, HierarchicalTaskSelectorComponent, ModalMessageComponent],
  templateUrl: './newTask.component.html',
  styleUrls: ['./newTask.component.css']
})
export class newTaskComponent implements OnInit, OnChanges, AfterViewInit {
  // Estado para el carrusel de invernaderos
  activeInvernaderoIndex: number = 0;

  // Helpers para navegación
  // Mantener solo una versión, ya existe más abajo

  setActiveInvernadero(idx: number) {
    const invernaderos = this.getSelectedInvernaderos();
    if (idx >= 0 && idx < invernaderos.length) {
      this.activeInvernaderoIndex = idx;
    }
  }

  prevInvernadero() {
    if (this.activeInvernaderoIndex > 0) {
      this.activeInvernaderoIndex--;
    }
  }

  nextInvernadero() {
    if (this.activeInvernaderoIndex < this.getSelectedInvernaderos().length - 1) {
      this.activeInvernaderoIndex++;
    }
  }

  isActiveInvernadero(idx: number): boolean {
    return this.activeInvernaderoIndex === idx;
  }

  // Reset índice si cambia la selección
  // Mantener solo la versión principal más abajo
  @Input() task: any = null;
  @Output() cancel = new EventEmitter<void>();
  @Output() add = new EventEmitter<any>();
  @ViewChild('modalMessage', { static: false }) modalMessage!: ModalMessageComponent;

  ngAfterViewInit(): void {}

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
  
  // Detectar si estamos en modo ALMACÉN
  isAlmacenMode = false;
  
  // Nueva funcionalidad para encargados: por defecto global, toggle activa individual  
  useIndividualEncargados = false; // false = global, true = individual
  
  // Para almacenar el jornal_unidad de la tarea seleccionada
  selectedTaskJornalUnidad: number = 0;
  
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
  useEightHourJornal: boolean = true; // Explícitamente tipado y inicializado
  
  // Interruptor para tipo de medición: false = Hectáreas, true = Kilos
  useKilosMode: boolean = false; // false = Hectáreas (0), true = Kilos (1)

  // Nuevas propiedades para el selector jerárquico de tareas
  @Input() loggedUser: User | undefined = undefined;
  selectedTareaJerarquica: string = '';
  grupoTrabajo: string = '';

  ngOnInit(): void {
    // Establecer grupo de trabajo del usuario logueado
    if (this.loggedUser?.grupo_trabajo) {
      this.grupoTrabajo = this.loggedUser.grupo_trabajo;
    }
    
    // Cargar invernaderos filtrados por cabezal del usuario
    if (this.loggedUser?.cabezal) {
      this.greenhouseService.getGreenhousesByCabezal(this.loggedUser.cabezal).subscribe({
        next: data => {
          this.greenhouses = data.cabezales.flatMap(cabezal => cabezal.invernaderos);
          // Inicializar el formulario después de cargar los invernaderos
          this.initFormFromTask();
        },
        error: err => {
          console.error('Error cargando invernaderos por cabezal:', err);
          // Fallback en caso de error
          this.loadAllGreenhouses();
        }
      });
    } else {
      this.loadAllGreenhouses();
    }
    this.taskTypeService.getTaskTypes().subscribe(data => {
      this.taskTypes = data;
      // Convertir a opciones para el dropdown con buscador
      this.taskTypeOptions = this.taskTypes.map(t => ({
        value: t.tipo,
        label: t.tipo
      }));
    });
    // Obtener encargados filtrados solo por grupo de trabajo (sin filtrar por cabezal)
    if (this.grupoTrabajo) {
      this.http.get<User[]>(`${environment.apiBaseUrl}/encargados/${this.grupoTrabajo}`).subscribe(encargados => {
        this.encargados = encargados;
        // Convertir a opciones para el dropdown con buscador
        this.encargadoOptions = this.encargados.map(e => ({
          value: e.id,
          label: e.name
        }));
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
  // (eliminado duplicado)
    if (changes['task']) {
      // Solo inicializar si los invernaderos ya están cargados
      if (this.greenhouses.length > 0) {
        this.initFormFromTask();
      }
      // Si no están cargados, ngOnInit se encargará de llamar initFormFromTask
    }
  }
  
  // (eliminado duplicado)

  constructor(
    private greenhouseService: GreenhouseService,
    private taskTypeService: TaskTypeService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
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
    
    // Detectar si estamos en modo ALMACÉN
    this.detectAlmacenMode();
    
    // Limpiar fechas anteriores y crear nuevas entradas según el modo
    this.updateDateFields();
    
    // Sincronizar fechas y encargados si están en modo único
    this.syncSingleValues();
  }
  
  private detectAlmacenMode() {
    // Detectar modo ALMACÉN basado en cabezales Y grupo de trabajo
    this.isAlmacenMode = false;
    
    // MÉTODO 1: Detectar por grupo de trabajo
    if (this.grupoTrabajo && this.grupoTrabajo.toUpperCase().includes('ALMACEN')) {
      this.isAlmacenMode = true;
    }
    
    // MÉTODO 2: Detectar por cabezales seleccionados
    if (this.invernaderoSelection && this.invernaderoSelection.cabezales && this.invernaderoSelection.cabezales.length > 0) {
      this.invernaderoSelection.cabezales.forEach(cabezal => {
        const cabezalUpper = cabezal.toUpperCase().trim();
        
        // Buscar ALMACEN de forma más flexible
        if (cabezalUpper.includes('ALMACEN') || cabezalUpper.includes('ALMACÉN') || 
            cabezalUpper.includes('WAREHOUSE') || cabezalUpper.includes('DEPOSITO') ||
            cabezalUpper.includes('ALMAC')) {
          this.isAlmacenMode = true;
        }
      });
    }
    
    // MÉTODO 3: Detectar por nombres de invernaderos que contengan patrones de almacén
    if (this.invernaderoSelection && this.invernaderoSelection.invernaderos && this.invernaderoSelection.invernaderos.length > 0) {
      this.invernaderoSelection.invernaderos.forEach(invernadero => {
        const invUpper = invernadero.toUpperCase().trim();
        if (invUpper.includes('ALM') || invUpper.includes('WAREHOUSE') || invUpper.includes('DEPOSITO')) {
          this.isAlmacenMode = true;
        }
      });
    }
    
    // Log mínimo para confirmar funcionamiento
    if (this.isAlmacenMode) {
      console.log('📦 Modo ALMACÉN activado');
    }
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
      
      // Actualizar estimaciones automáticamente para los nuevos invernaderos
      this.updateEstimationsBasedOnJornalUnidad();
      
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
  onTareaJerarquicaSelected(tareaData: {nombre: string, jornal_unidad: number}) {
    this.selectedTareaJerarquica = tareaData.nombre;
    this.selectedTaskType = tareaData.nombre; // Mantener compatibilidad
    this.selectedTaskJornalUnidad = tareaData.jornal_unidad;
    
    // Verificar modo ALMACÉN cada vez que cambie la tarea (por si acaso)
    this.detectAlmacenMode();
    
    // Actualizar estimaciones automáticamente basadas en jornal_unidad
    this.updateEstimationsBasedOnJornalUnidad();
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
  console.log('🟢 onSubmit ejecutado');
  // Interceptar validación nativa y mostrar modal personalizado si hay errores
    const selectedInvernaderos = this.getSelectedInvernaderos();
    let errorMsg = '';

    // Sincronizar encargado global con individuales antes de validar
    if (!this.useIndividualEncargados && this.selectedEncargado) {
      selectedInvernaderos.forEach(inv => {
        this.selectedEncargados[inv] = this.selectedEncargado;
      });
    }
    // LOG para depuración encargado
    (window as any)['__debugEncargado'] = {
      selectedEncargado: this.selectedEncargado,
      selectedEncargados: this.selectedEncargados,
      selectedInvernaderos: selectedInvernaderos
    };
    console.log('🟡 DEBUG ENCARGADO', {
      selectedEncargado: this.selectedEncargado,
      selectedEncargados: JSON.stringify(this.selectedEncargados),
      selectedInvernaderos: selectedInvernaderos
    });

    // Validación de invernaderos
    if (selectedInvernaderos.length === 0) {
      errorMsg = 'Por favor, selecciona al menos un invernadero.';
    }

    // Validación de tipo de tarea
    if (!errorMsg && (!this.selectedTaskType || this.selectedTaskType.trim() === '')) {
      errorMsg = 'Por favor, selecciona un tipo de tarea.';
    }

    // Validación de estimaciones (si no es modo almacén)
    if (!errorMsg && !this.isAlmacenMode) {
      const invalidEstimations = selectedInvernaderos.filter((inv: string) => {
        const estimation = this.estimations[inv];
        return !estimation || estimation <= 0;
      });
      if (invalidEstimations.length > 0) {
        errorMsg = `Por favor, ingresa una estimación de jornales válida (mayor que 0) para: ${invalidEstimations.join(', ')}`;
      }
    }

    // Validación de fechas
    if (!errorMsg) {
      if (selectedInvernaderos.length === 1 || this.useIndividualDates) {
        const missingDates = selectedInvernaderos.some((g: string) => !this.dueDates[g] || this.dueDates[g].trim() === '');
        if (missingDates) {
          errorMsg = 'Por favor, selecciona una fecha límite para cada invernadero seleccionado.';
        }
      } else {
        if (!this.singleDate || this.singleDate.trim() === '') {
          errorMsg = 'Por favor, selecciona la fecha límite para todos los invernaderos.';
        }
      }
    }

    // Validación de encargados (unificada)
    if (!errorMsg) {
      const invalidEncargados = selectedInvernaderos.filter((g: string) => !this.selectedEncargados[g] || this.selectedEncargados[g].trim() === '');
      if (invalidEncargados.length > 0) {
        if (this.useIndividualEncargados || selectedInvernaderos.length > 1) {
          errorMsg = `Por favor, selecciona un encargado para: ${invalidEncargados.join(', ')}`;
        } else {
          errorMsg = 'Por favor, selecciona un encargado para el invernadero.';
        }
      }
    }

    // Validación de kilos/área (si no es modo almacén)
    if (!errorMsg && !this.isAlmacenMode) {
      if (this.useKilosMode) {
        const invalidKilos = selectedInvernaderos.filter((g: string) => {
          const kilos = this.expectedKilos[g];
          return !kilos || kilos <= 0;
        });
        if (invalidKilos.length > 0) {
          errorMsg = `Por favor, ingresa los kilos esperados (mayor que 0) para: ${invalidKilos.join(', ')}`;
        }
      } else {
        const invalidAreas = selectedInvernaderos.filter((g: string) => {
          const area = this.workingAreas[g];
          return !area || area <= 0;
        });
        if (invalidAreas.length > 0) {
          errorMsg = `Por favor, selecciona un área de trabajo válida (mayor que 0) para: ${invalidAreas.join(', ')}`;
        }
        const exceedingAreas = selectedInvernaderos.filter((g: string) => {
          const area = this.workingAreas[g];
          const maxArea = this.getMaxArea(g);
          return area > maxArea;
        });
        if (!errorMsg && exceedingAreas.length > 0) {
          errorMsg = `El área seleccionada excede el máximo disponible para: ${exceedingAreas.join(', ')}`;
        }
      }
    }

    // Mostrar modal si hay error
    if (errorMsg) {
      console.log('MOSTRANDO MODAL DE ERROR:', errorMsg);
      if (this.modalMessage) {
        this.modalMessage.show(errorMsg);
        this.cdr.markForCheck();
      } else {
        console.error('DEBUG: modalMessage ViewChild es undefined');
      }
      return;
    }
    // Si todo es válido, continuar con la lógica normal
    const tareas = selectedInvernaderos.map((g: string) => {
      let estimationNum: number;
      let estimacionEnHoras: number;
      let dimensionValue: number;
      let horaJornal: number;
      let horasKilos: number;
      if (this.isAlmacenMode) {
        estimationNum = 1;
        horaJornal = 1;
        const factor = 8;
        estimacionEnHoras = estimationNum * factor;
        horasKilos = 0;
        dimensionValue = 0;
      } else {
        estimationNum = Number(this.estimations[g]);
        if (isNaN(estimationNum)) estimationNum = 0;
        horaJornal = this.useEightHourJornal ? 1 : 0;
        const factor = this.useEightHourJornal ? 8 : 6;
        estimacionEnHoras = estimationNum * factor;
        horasKilos = this.useKilosMode ? 1 : 0;
        const workingArea = this.workingAreas[g] || 0;
        dimensionValue = this.useKilosMode ? (this.expectedKilos[g] || 0) : workingArea;
      }
      const fechaLimite = (selectedInvernaderos.length > 1 && !this.useIndividualDates) ? this.singleDate : this.dueDates[g];
      const encargadoId = (selectedInvernaderos.length > 1 && !this.useIndividualEncargados) ? this.selectedEncargado : this.selectedEncargados[g];
      const data: any = {
        invernadero: g,
        tipo_tarea: this.selectedTaskType,
        estimacion_horas: estimacionEnHoras,
        hora_jornal: horaJornal,
        horas_kilos: horasKilos,
        fecha_limite: fechaLimite,
        encargado_id: encargadoId,
        descripcion: this.description || '',
        dimension_total: dimensionValue
      };
      if (this.task && this.task.id) {
        data.id = this.task.id;
      }
      return data;
    });
    this.add.emit(tareas);
  }

  // Método para actualizar estimaciones automáticamente basado en jornal_unidad
  updateEstimationsBasedOnJornalUnidad(): void {
    // Este método ya no llena automáticamente los valores
    // Solo actualiza los placeholders a través de getJornalPlaceholder()
    // El usuario verá la recomendación pero decidirá si usarla
  }

  // Método para recalcular estimación cuando cambie el área de trabajo
  updateWorkingAreaAndEstimation(invernaderoNombre: string, event: Event): void {
    // Primero actualizar el área como antes
    this.updateWorkingArea(invernaderoNombre, event);
    
    // Forzar la detección de cambios para que se actualice el placeholder
    // El placeholder se actualiza automáticamente a través de getJornalPlaceholder()
  }

  // Método para obtener el placeholder del input de jornales (ya no se usa, mantenido por compatibilidad)
  getJornalPlaceholder(invernaderoNombre: string): string {
    return 'Ej: 5,5';
  }

  // Método para calcular jornales recomendados dinámicamente
  getCalculatedJornales(invernaderoNombre: string): string {
    if (this.selectedTaskJornalUnidad > 0) {
      const hectareas = this.workingAreas[invernaderoNombre] || 0;
      if (hectareas > 0) {
        const jornalesEstimados = this.selectedTaskJornalUnidad * hectareas;
        return jornalesEstimados.toFixed(2).replace('.', ',');
      }
    }
    return '0,00';
  }

  // Método auxiliar para cargar todos los invernaderos
  private loadAllGreenhouses(): void {
    this.greenhouseService.getGreenhouses().subscribe({
      next: data => {
        this.greenhouses = data;
        // Inicializar el formulario después de cargar los invernaderos
        this.initFormFromTask();
      },
      error: err => {
        console.error('Error cargando todos los invernaderos:', err);
      }
    });
  }

  // Sincroniza el encargado global con los individuales al seleccionar uno globalmente
  onGlobalEncargadoSelected(encargadoId: string) {
    this.selectedEncargado = encargadoId;
    if (!this.useIndividualEncargados) {
      this.getSelectedInvernaderos().forEach((inv: string) => {
        this.selectedEncargados[inv] = encargadoId;
      });
    }
  }
}
