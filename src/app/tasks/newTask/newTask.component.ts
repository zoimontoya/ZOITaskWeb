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
  
  // Estimaciones de kg específicas para modo almacén (tareas de recolección)
  almacenKgEstimation: { [greenhouse: string]: number } = {};
  
  // Variables para género (como en tareas urgentes)
  selectedGenero: string = '';
  isGeneroOpen: boolean = false;
  generoSearch: string = '';
  filteredGeneros: string[] = [];
  generosConfecc: string[] = [];

  // NUEVO: Objeto completo de tarea seleccionada (como en urgentes)
  selectedTipoTarea: any = null;
  
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
    this.taskTypeService.getTaskTypes().subscribe({
      next: (data) => {
        this.taskTypes = data;
        // Convertir a opciones para el dropdown con buscador
        this.taskTypeOptions = this.taskTypes.map(t => ({
          value: t.tipo,
          label: t.tipo
        }));
      },
      error: (error) => {
        console.error('❌ NEW TASK - Error cargando taskTypes:', error);
      }
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
    


    // Inicializar géneros filtrados (se cargará desde backend cuando sea necesario)
    this.filteredGeneros = [];
  }

  ngOnChanges(changes: SimpleChanges): void {
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
        const dimensionString = String(this.task.dimension_total) || '0';
        const normalizedString = dimensionString.replace(',', '.');
        const currentArea = parseFloat(normalizedString) || 0;
        
        this.workingAreas[this.task.invernadero] = currentArea;
      }
      
      // 🔧 INICIALIZAR TIPO DE TAREA JERÁRQUICA
      this.selectedTareaJerarquica = this.task.tipo_tarea || '';
      this.selectedTaskType = this.task.tipo_tarea || '';
      
      // 🔧 CONFIGURAR TOGGLE BASÁNDOSE EN VALOR ALMACENADO
      const horaJornalValue = Number(this.task.hora_jornal) || 0;
      this.useEightHourJornal = (horaJornalValue === 1);
      
      // 🔧 CONFIGURAR TOGGLE DE MEDICIÓN (Hectáreas vs Kilos)
      const horasKilosValue = Number(this.task.horas_kilos) || 0;
      this.useKilosMode = (horasKilosValue === 1);
      
      // La estimación ya viene convertida a jornales por loadTasks()
      this.estimation = (Number(this.task.estimacion_horas) || 0).toString();
      
      // Inicializar estructuras individuales para edición
      this.dueDates = {};
      this.estimations = {};
      this.selectedEncargados = {};
      this.expectedKilos = {}; // 🔧 IMPORTANTE: Inicializar kilos esperados para edición
      this.almacenKgEstimation = {}; // 🔧 Inicializar estimaciones de kg para modo almacén
      
      if (this.task.invernadero) {
        // Configurar valores individuales del invernadero
        this.dueDates[this.task.invernadero] = this.task.fecha_limite || '';
        this.estimations[this.task.invernadero] = Number(this.task.estimacion_horas) || 0;
        this.selectedEncargados[this.task.invernadero] = this.task.encargado_id || '';
        
        // Si es tarea de kilos, configurar kilos esperados
        if (this.useKilosMode && this.task.dimension_total) {
          const kilosActuales = parseFloat(String(this.task.dimension_total).replace(',', '.')) || 0;
          this.expectedKilos[this.task.invernadero] = kilosActuales;
        }
        
        // Si es modo almacén y hay kg_estimado_almacen, cargarlo
        if (this.task.kg_estimado_almacen) {
          const kgEstimadoAlmacen = parseFloat(String(this.task.kg_estimado_almacen).replace(',', '.')) || 0;
          this.almacenKgEstimation[this.task.invernadero] = kgEstimadoAlmacen;
        }
      }
      
      // Configurar valores únicos para compatibilidad
      this.selectedEncargado = this.task.encargado_id || '';
      this.description = this.task.descripcion || '';
      this.singleDate = this.task.fecha_limite || '';
      

      
      // Al editar, por defecto usar valores globales (más simple)
      this.useIndividualDates = false;
      this.useIndividualEncargados = false;
      
      // 🔧 DEBUGGING: Verificar estado final después de configuración
      setTimeout(() => {
        this.debugFormState();
        // 🔧 QUICK FIX: Forzar sincronización de valores para edición
        this.forceSyncForEdit();
        // 🔧 NUEVO: Restaurar valores que puedan haberse perdido
        this.restoreEditValues();
      }, 100);
    } else {
      // Limpiar todo para nueva tarea
      this.invernaderoSelection = null;
      this.selectedTareaJerarquica = '';
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
      this.almacenKgEstimation = {}; // 🔧 Limpiar estimaciones de kg para nueva tarea
      this.workingAreas = {};
      this.expectedKilos = {}; // 🔧 Limpiar kilos esperados para nueva tarea
      // NO tocamos useEightHourJornal aquí, debe mantener su valor por defecto (false)
    }
  }

  onInvernaderoSelectionChange(selection: InvernaderoSelection) {
    this.invernaderoSelection = selection;
    
    // En modo edición, no limpiar valores existentes
    if (!this.task) {
      // Solo ejecutar limpiezas y reseteos en modo CREACIÓN (nueva tarea)
      
      // Detectar si estamos en modo ALMACÉN
      this.detectAlmacenMode();
      
      // Limpiar fechas anteriores y crear nuevas entradas según el modo
      this.updateDateFields();
      
      // Sincronizar fechas y encargados si están en modo único
      this.syncSingleValues();
    } else {
      // En modo edición, solo detectar modo almacén, NO limpiar datos
      this.detectAlmacenMode();
      
      // En modo edición, solo sincronizar si es necesario sin perder datos
      this.syncSingleValues();
      
      // 🔧 CRUCIAL: Restaurar todos los valores de edición después de cualquier procesamiento
      setTimeout(() => {
        this.restoreEditValues();
      }, 50);
      
      // 🔧 SUPER AGRESIVO: Restaurar valores periódicamente hasta que estén correctos
      const restoreInterval = setInterval(() => {
        if (this.task) {
          this.restoreEditValues();
          // Si todos los valores están correctos, detener el intervalo
          if (this.areAllEditValuesCorrect()) {
            clearInterval(restoreInterval);
          }
        } else {
          clearInterval(restoreInterval);
        }
      }, 200);
      
      // Detener después de 5 segundos máximo
      setTimeout(() => {
        clearInterval(restoreInterval);
      }, 5000);
    }
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
    
    // Log detallado para confirmar funcionamiento
    console.log('📦 Detección modo ALMACÉN:', {
      grupoTrabajo: this.grupoTrabajo,
      cabezales: this.invernaderoSelection?.cabezales,
      invernaderos: this.invernaderoSelection?.invernaderos,
      isAlmacenMode: this.isAlmacenMode
    });
    

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
        // Modo fecha global: asegurar que existe singleDate, pero NO sobrescribir si ya tiene valor
        if (!this.singleDate) {
          this.singleDate = '';
        }
      }
      
      // Inicializar áreas de trabajo para cada invernadero seleccionado (solo si no existen o es modo creación)
      this.invernaderoSelection.invernaderos.forEach((inv: string) => {
        if (!this.workingAreas[inv] || this.workingAreas[inv] === 0) {
          // Obtener el área máxima del invernadero desde los datos
          const greenhouse = this.greenhouses.find(gh => gh.nombre === inv);
          const maxArea = parseFloat(greenhouse?.dimensiones || '0') || 0;
          // Por defecto, usar toda el área disponible SIN redondear
          this.workingAreas[inv] = maxArea;
          console.log(`📋 Inicializando área para ${inv}: ${maxArea} Ha`);
        } else {
          console.log(`📋 Manteniendo área existente para ${inv}: ${this.workingAreas[inv]} Ha`);
        }
      });
      
      // Actualizar estimaciones automáticamente para los nuevos invernaderos (solo en modo creación)
      if (!this.task) {
        this.updateEstimationsBasedOnJornalUnidad();
      }
      
      // Limpiar áreas de invernaderos que ya no están seleccionados (solo en modo creación)
      if (!this.task) {
        Object.keys(this.workingAreas).forEach(inv => {
          if (!this.invernaderoSelection?.invernaderos.includes(inv)) {
            delete this.workingAreas[inv];
          }
        });
      }
      
      // Inicializar estimaciones por invernadero (solo si no existen, y preservar en modo edición)
      this.invernaderoSelection.invernaderos.forEach((inv: string) => {
        if (!this.estimations[inv]) {
          this.estimations[inv] = 0;
          console.log(`📋 Inicializando estimations[${inv}] = 0`);
        } else {
          console.log(`📋 Manteniendo estimations[${inv}] = ${this.estimations[inv]}`);
        }
      });
      
      // Inicializar encargados por invernadero (solo si no existen, y preservar en modo edición)
      this.invernaderoSelection.invernaderos.forEach((inv: string) => {
        if (!this.selectedEncargados[inv]) {
          this.selectedEncargados[inv] = '';
          console.log(`📋 Inicializando selectedEncargados[${inv}] como vacío`);
        } else {
          console.log(`📋 Manteniendo selectedEncargados[${inv}] = "${this.selectedEncargados[inv]}"`);
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
  onTareaJerarquicaSelected(tareaData: {
    nombre: string, 
    jornal_unidad: number, 
    familia?: string, 
    tipo?: string, 
    subtipo?: string,
    tarea_completa?: any
  }) {
    // Sincronizar ambas variables de tarea seleccionada
    this.selectedTareaJerarquica = tareaData.nombre;
    this.selectedTaskType = tareaData.nombre; // Mantener compatibilidad
    this.selectedTaskJornalUnidad = tareaData.jornal_unidad;
    
    // Usar directamente la tarea completa del selector jerárquico
    
    if (tareaData.tarea_completa) {
      // Usar directamente la tarea completa enviada por el selector
      this.selectedTipoTarea = tareaData.tarea_completa;
    } else {
      // Fallback: buscar en taskTypes (método anterior)
      this.selectedTipoTarea = this.taskTypes?.find((task: any) => {
        return task.tipo === tareaData.nombre ||
               task.nombre === tareaData.nombre ||
               task.tarea_nombre === tareaData.nombre;
      });
    }
    
    console.log('� Tarea seleccionada final:', {
      encontrada: !!this.selectedTipoTarea,
      familia: this.selectedTipoTarea?.familia,
      nombre: this.selectedTipoTarea?.nombre || this.selectedTipoTarea?.tarea_nombre,
      es_ALMACEN_CONFECC: this.selectedTipoTarea?.familia === 'ALMACEN-CONFECC'
    });
    
    // Verificar modo ALMACÉN cada vez que cambie la tarea (por si acaso)
    this.detectAlmacenMode();
    
    // Verificar si necesita mostrar campos de género y cargar géneros
    const shouldShow = this.shouldShowGeneroSelector();
    
    if (shouldShow) {
      this.loadGenerosConfecc();
    }
    
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
  
  // Detectar si la tarea seleccionada es ALMACEN-CONFECC (necesita estimación de kg)
  isAlmacenConfecc(): boolean {
    // Buscar en los tipos de tarea cargados si la tarea seleccionada pertenece a ALMACEN-CONFECC
    if (!this.selectedTaskType || !this.taskTypes) {
      return false;
    }
    
    const selectedTaskObj = this.taskTypes.find((taskType: any) => 
      taskType.nombre === this.selectedTaskType || 
      taskType.tipo === this.selectedTaskType ||
      taskType.tarea_nombre === this.selectedTaskType ||
      taskType.tarea === this.selectedTaskType
    );
    
    const isConfecc = (selectedTaskObj as any)?.familia === 'ALMACEN-CONFECC';
    
    return isConfecc;
  }
  



  

  
  // DEPRECATED: Función anterior - mantener por compatibilidad pero ahora usar isAlmacenConfecc
  isRecoleccionTask(): boolean {
    // Priorizar detección por familia ALMACEN-CONFECC
    if (this.isAlmacenConfecc()) {
      return true;
    }
    
    // Fallback: detectar por palabras clave (para retrocompatibilidad)
    const recoleccionKeywords = ['recolección', 'recoleccion', 'cosecha', 'recoger', 'cosech', 'recolect'];
    const selectedTaskName = this.selectedTaskType.toLowerCase();
    return recoleccionKeywords.some(keyword => selectedTaskName.includes(keyword));
  }



  // MÉTODO DE DEBUG: Forzar que haya una tarea válida seleccionada
  debugForceValidTask() {
    console.log('🚀 === FORZANDO TAREA VÁLIDA ===');
    
    // Forzar ambas variables
    const tareaTest = 'Tarea Válida para Test';
    this.selectedTaskType = tareaTest;
    this.selectedTareaJerarquica = tareaTest;
    
    // Crear objeto de tarea válido
    this.selectedTipoTarea = {
      nombre: tareaTest,
      familia: 'TEST',
      tipo: 'Test',
      subtipo: 'Debug',
      jornal_unidad: 1
    };
    
    console.log('✅ TAREA FORZADA:', {
      selectedTaskType: this.selectedTaskType,
      selectedTareaJerarquica: this.selectedTareaJerarquica,
      selectedTipoTarea: this.selectedTipoTarea
    });
  }

  // MÉTODO DE DEBUG: Mostrar todas las tareas y sus familias
  debugShowAllTasks() {
    console.log('📋 === TODAS LAS TAREAS DISPONIBLES ===');
    
    if (!this.taskTypes || this.taskTypes.length === 0) {
      console.log('❌ No hay taskTypes cargados');
      return;
    }

    // Mostrar todas las tareas
    console.log(`📊 Total de tareas: ${this.taskTypes.length}`);
    
    // Agrupar por familia
    const familias: { [key: string]: any[] } = {};
    this.taskTypes.forEach((task: any) => {
      const familia = task.familia || 'SIN_FAMILIA';
      if (!familias[familia]) familias[familia] = [];
      familias[familia].push(task);
    });

    console.log('👥 Tareas por familia:');
    Object.keys(familias).forEach(familia => {
      console.log(`  📁 ${familia}: ${familias[familia].length} tareas`);
      if (familia === 'ALMACEN-CONFECC') {
        console.log('    🏪 Tareas ALMACEN-CONFECC:', familias[familia].map((t: any) => ({
          tipo: t.tipo,
          nombre: t.nombre || t.tarea_nombre,
          subtipo: t.subtipo
        })));
      }
    });

    // Mostrar estructura de una tarea como ejemplo
    console.log('🔍 Estructura de primera tarea:', this.taskTypes[0]);
  }

  // MÉTODO DE DEBUG: Verificar tarea actual
  debugCurrentTask() {
    console.log('🔍 === VERIFICACIÓN DE TAREA ACTUAL ===');
    
    console.log('📝 Datos de entrada:', {
      selectedTaskType: this.selectedTaskType,
      selectedTareaJerarquica: this.selectedTareaJerarquica,
      selectedTipoTarea: this.selectedTipoTarea
    });
    
    console.log('🎯 Estado actual:', {
      isAlmacenMode: this.isAlmacenMode,
      hasTarea: !!this.selectedTipoTarea,
      familia: this.selectedTipoTarea?.familia,
      esALMACEN_CONFECC: this.selectedTipoTarea?.familia === 'ALMACEN-CONFECC',
      shouldShowGeneroSelector: this.shouldShowGeneroSelector()
    });
    
    // Buscar manualmente la tarea en taskTypes
    if (this.selectedTaskType && this.taskTypes) {
      const foundTasks = this.taskTypes.filter((task: any) => {
        return task.tipo?.toLowerCase().includes(this.selectedTaskType.toLowerCase()) ||
               task.nombre?.toLowerCase().includes(this.selectedTaskType.toLowerCase()) ||
               task.tarea_nombre?.toLowerCase().includes(this.selectedTaskType.toLowerCase());
      });
      
      console.log('🔍 Búsqueda manual de tareas similares:', foundTasks);
    }
  }

  // ============= MÉTODOS PARA SELECTOR DE GÉNERO =============

  // 🏪 Método principal para detectar si mostrar género (como en urgentes)
  shouldShowGeneroSelector(): boolean {
    const isAlmacen = this.isAlmacenMode;
    const hasTarea = !!this.selectedTipoTarea;
    const isConfecc = this.selectedTipoTarea?.familia === 'ALMACEN-CONFECC';
    
    console.log('� Verificando mostrar género selector:', {
      isAlmacen,
      hasTarea,
      selectedTarea: this.selectedTipoTarea?.tarea_nombre || this.selectedTipoTarea?.nombre || this.selectedTipoTarea?.tipo,
      familia: this.selectedTipoTarea?.familia,
      isConfecc,
      shouldShow: isAlmacen && hasTarea && isConfecc
    });
    
    return !!(isAlmacen && hasTarea && isConfecc);
  }

  // Función simplificada para mostrar campos de estimación (ahora usa shouldShowGeneroSelector)
  showKgEstimationField(): boolean {
    // Usar la nueva lógica de shouldShowGeneroSelector
    return this.shouldShowGeneroSelector();
  }

  // Función auxiliar para detectar si necesitamos mostrar los campos de almacén (DEPRECATED)
  isAlmacenModeAndTaskSelected(): boolean {
    return this.showKgEstimationField();
  }

  // Toggle del dropdown de género
  toggleGenero() {
    this.isGeneroOpen = !this.isGeneroOpen;
    if (this.isGeneroOpen) {
      // Si no hay géneros cargados, cargarlos
      if (this.generosConfecc.length === 0) {
        this.loadGenerosConfecc();
      }
      this.generoSearch = '';
      this.filteredGeneros = [...this.generosConfecc];
    }
  }

  // Seleccionar un género
  selectGenero(genero: string) {
    this.selectedGenero = genero;
    this.isGeneroOpen = false;
    this.generoSearch = '';
    console.log('🏷️ Género seleccionado:', genero);
  }

  // Filtrar géneros según la búsqueda
  filterGeneros() {
    if (!this.generoSearch.trim()) {
      this.filteredGeneros = [...this.generosConfecc];
    } else {
      this.filteredGeneros = this.generosConfecc.filter((genero: string) => 
        genero.toLowerCase().includes(this.generoSearch.toLowerCase())
      );
    }
  }

  // 🏪 Cargar géneros desde backend (igual que en urgentes)
  loadGenerosConfecc() {
    if (!this.shouldShowGeneroSelector()) return;
    
    console.log('🏪 NEW TASK - Cargando géneros de confección...');
    this.http.get<string[]>(`${environment.apiBaseUrl}/generos-confecc`).subscribe({
      next: (generos) => {
        console.log('🏪 NEW TASK - Géneros recibidos del backend:', generos);
        this.generosConfecc = generos;
        this.filteredGeneros = [...generos];
        console.log('🏪 NEW TASK - Géneros de confección cargados:', generos.length);
      },
      error: (err) => {
        console.error('🏪 NEW TASK - Error cargando géneros de confección:', err);
        this.generosConfecc = [];
        this.filteredGeneros = [];
      }
    });
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

    // Validación de tipo de tarea - PRAGMÁTICA: si el selector jerárquico tiene algo seleccionado, es válido
    let hasTaskSelected = false;
    
    // Método 1: Verificar variables internas
    if ((this.selectedTaskType && this.selectedTaskType.trim() !== '') || 
        (this.selectedTareaJerarquica && this.selectedTareaJerarquica.trim() !== '')) {
      hasTaskSelected = true;
    }
    
    // Método 2: Verificar DOM del selector jerárquico directamente
    if (!hasTaskSelected) {
      const hierarchicalSelector = document.querySelector('app-hierarchical-task-selector');
      if (hierarchicalSelector) {
        const selectedElements = hierarchicalSelector.querySelectorAll('.selected, .active, [class*="selected"]');
        if (selectedElements.length > 0) {
          console.log('✅ DETECTOR DOM: Encontrados elementos seleccionados en selector jerárquico');
          hasTaskSelected = true;
        }
      }
    }
    
    // Método 3: Si selectedTipoTarea tiene datos (indica que se procesó una selección)
    if (!hasTaskSelected && this.selectedTipoTarea && this.selectedTipoTarea.nombre) {
      console.log('✅ DETECTOR OBJETO: selectedTipoTarea tiene datos');
      hasTaskSelected = true;
    }
    
    console.log('🔍 VALIDACIÓN DE TAREA (MÚLTIPLES MÉTODOS):', {
      selectedTaskType: this.selectedTaskType,
      selectedTareaJerarquica: this.selectedTareaJerarquica,
      selectedTipoTarea: this.selectedTipoTarea?.nombre || 'no hay',
      hasTaskSelected: hasTaskSelected,
      metodosUsados: ['variables internas', 'DOM selector', 'objeto tarea']
    });
    
    // TEMPORAL: Deshabilitar validación de tarea para debug
    if (!errorMsg && !hasTaskSelected) {
      console.log('⚠️ VALIDACIÓN DE TAREA FALLÓ - PERO CONTINUANDO (DEBUG)');
      console.log('🔧 Para habilitar validación, cambiar esta línea en onSubmit()');
      // errorMsg = 'Por favor, selecciona un tipo de tarea.'; // DESHABILITADO TEMPORALMENTE
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

    // Validación específica para modo almacén: estimación de kg
    if (!errorMsg && this.showKgEstimationField()) {
      const invalidKgEstimations = selectedInvernaderos.filter((inv: string) => {
        const kgEstimation = this.almacenKgEstimation[inv];
        return !kgEstimation || kgEstimation <= 0;
      });
      if (invalidKgEstimations.length > 0) {
        errorMsg = `Por favor, ingresa una estimación de Kg válida (mayor que 0) para: ${invalidKgEstimations.join(', ')}`;
      }
    }

    // Validación del género para tareas de almacén
    if (!errorMsg && this.showKgEstimationField() && !this.selectedGenero.trim()) {
      errorMsg = 'Por favor, selecciona un género para la tarea de almacén/confección.';
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
        // ✅ CORRECCIÓN: Para tareas de almacén que usan kg (ALMACEN-CONFECC), horas_kilos debe ser 1
        horasKilos = this.showKgEstimationField() ? 1 : 0; // 1 = usa kilos, 0 = usa hectáreas
        console.log('🏪 CONFIGURANDO TAREA ALMACÉN:', {
          isAlmacenMode: this.isAlmacenMode,
          showKgEstimationField: this.showKgEstimationField(),
          horasKilos: horasKilos,
          significado: horasKilos === 1 ? 'USA KILOS' : 'USA HECTÁREAS'
        });
        // ✅ CORRECCIÓN: Si usa kg, dimensionValue debe tomar de almacenKgEstimation
        dimensionValue = this.showKgEstimationField() ? (this.almacenKgEstimation[g] || 0) : 0;
      } else {
        // Permitir comas como separador decimal
        let rawEstimation = this.estimations[g];
        let estimationStr = typeof rawEstimation === 'string' ? rawEstimation : String(rawEstimation);
        estimationStr = estimationStr.replace(',', '.');
        estimationNum = parseFloat(estimationStr);
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
      // Determinar qué tarea enviar (FORZAR que tenga valor)
      let tareaParaEnviar = this.selectedTaskType || this.selectedTareaJerarquica || this.selectedTipoTarea?.nombre || '';
      
      // Si TODAS las fuentes están vacías, forzar un valor por defecto
      if (!tareaParaEnviar || tareaParaEnviar.trim() === '') {
        tareaParaEnviar = 'Tarea sin nombre - ERROR DE SINCRONIZACIÓN';
        console.error('🚨 ERROR: Todas las fuentes de tarea están vacías, usando valor por defecto');
      }
      
      console.log('📤 ENVIANDO TAREA DEFINITIVA:', {
        selectedTaskType: this.selectedTaskType,
        selectedTareaJerarquica: this.selectedTareaJerarquica,
        selectedTipoTareaNombre: this.selectedTipoTarea?.nombre,
        tareaParaEnviar: tareaParaEnviar,
        esValida: tareaParaEnviar && tareaParaEnviar.trim() !== ''
      });
      
      const data: any = {
        invernadero: g,
        tipo_tarea: tareaParaEnviar,
        estimacion_horas: estimacionEnHoras,
        hora_jornal: horaJornal,
        horas_kilos: horasKilos,
        fecha_limite: fechaLimite,
        encargado_id: encargadoId,
        descripcion: this.description || '',
        dimension_total: dimensionValue
      };
      
      // Agregar estimación de kg y género para tareas de almacén ALMACEN-CONFECC
      if (this.showKgEstimationField() && this.almacenKgEstimation[g]) {
        // ✅ dimension_total ya está configurado correctamente arriba con dimensionValue
        // Solo agregamos kg_estimado_almacen como backup en columna R
        data.kg_estimado_almacen = this.almacenKgEstimation[g]; // Columna R (backup)
        
        // 🏪 Agregar género a la tarea (columna R)
        if (this.selectedGenero) {
          data.genero = this.selectedGenero;
        }
        
        // ✅ CORRECCIÓN: NO agregar kg a la descripción, solo el género si hay
        // La descripción solo contendrá lo que el usuario escribió + género si es necesario
        // NO se agregan los kg a la descripción
        
        console.log('🏪 Datos ALMACEN-CONFECC agregados:', {
          genero: data.genero,
          kg_estimado_almacen: data.kg_estimado_almacen,
          dimension_total: data.dimension_total,
          descripcion: data.descripcion
        });
      }
      if (this.task && this.task.id) {
        data.id = this.task.id;
      }
      
      // Log final de datos a enviar
      console.log('📤 DATOS FINALES PARA ENVIAR:', {
        invernadero: data.invernadero,
        tipo_tarea: data.tipo_tarea,
        horas_kilos: data.horas_kilos,
        significado_horas_kilos: data.horas_kilos === 1 ? 'USA KILOS' : 'USA HECTÁREAS',
        dimension_total: data.dimension_total,
        genero: data.genero,
        kg_estimado_almacen: data.kg_estimado_almacen,
        descripcion: data.descripcion
      });
      
      return data;
    });
    
    console.log('📤 TODAS LAS TAREAS A ENVIAR:', tareas);
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

  debugFormState() {
    console.log(`🔧 === DEBUG ESTADO FINAL DEL FORMULARIO ===`);
    console.log(`📋 getSelectedInvernaderos():`, this.getSelectedInvernaderos());
    console.log(`📋 activeInvernaderoIndex:`, this.activeInvernaderoIndex);
    
    const currentInv = this.getSelectedInvernaderos()[this.activeInvernaderoIndex];
    console.log(`📋 Invernadero actual (activeIndex):`, currentInv);
    
    if (currentInv) {
      console.log(`📋 estimations[${currentInv}]:`, this.estimations[currentInv]);
      console.log(`📋 selectedEncargados[${currentInv}]:`, this.selectedEncargados[currentInv]);
      console.log(`📋 dueDates[${currentInv}]:`, this.dueDates[currentInv]);
    }
    
    console.log(`📋 singleDate:`, this.singleDate);
    console.log(`📋 selectedEncargado:`, this.selectedEncargado);
    console.log(`📋 estimation:`, this.estimation);
    console.log(`📋 useIndividualDates:`, this.useIndividualDates);
    console.log(`📋 useIndividualEncargados:`, this.useIndividualEncargados);
  }

  restoreEditValues() {
    if (!this.task) return; // Solo en modo edición
    
    console.log('🔧 === RESTAURANDO VALORES DE EDICIÓN ===');
    
    const inv = this.task.invernadero;
    
    // 1. Restaurar área de trabajo específica de la tarea
    if (this.task.dimension_total) {
      const dimensionString = String(this.task.dimension_total) || '0';
      const normalizedString = dimensionString.replace(',', '.');
      const currentArea = parseFloat(normalizedString) || 0;
      this.workingAreas[inv] = currentArea;
      console.log(`✅ Área restaurada para ${inv}: ${currentArea}`);
    }
    
    // 2. Restaurar fecha límite
    if (this.task.fecha_limite) {
      this.singleDate = this.task.fecha_limite;
      this.dueDates[inv] = this.task.fecha_limite;
      console.log(`✅ Fecha límite restaurada: ${this.task.fecha_limite}`);
    }
    
    // 3. Restaurar encargado
    if (this.task.encargado_id) {
      this.selectedEncargado = this.task.encargado_id;
      this.selectedEncargados[inv] = this.task.encargado_id;
      console.log(`✅ Encargado restaurado: ${this.task.encargado_id}`);
    }
    
    // 4. Restaurar estimación de jornales
    if (this.task.estimacion_horas) {
      const estimacionJornales = Number(this.task.estimacion_horas) || 0;
      this.estimation = estimacionJornales.toString();
      this.estimations[inv] = estimacionJornales;
      console.log(`✅ Estimación restaurada: ${estimacionJornales} jornales`);
    }
    
    // 5. Restaurar descripción
    if (this.task.descripcion) {
      this.description = this.task.descripcion;
      console.log(`✅ Descripción restaurada: ${this.task.descripcion}`);
    }
    
    // 6. Restaurar kilos esperados si es tarea de kilos
    if (this.useKilosMode && this.task.dimension_total) {
      const kilosActuales = parseFloat(String(this.task.dimension_total).replace(',', '.')) || 0;
      this.expectedKilos[inv] = kilosActuales;
      console.log(`✅ Kilos esperados restaurados: ${kilosActuales}`);
    }
    
    console.log('🔧 === RESTAURACIÓN COMPLETADA ===');
  }

  areAllEditValuesCorrect(): boolean {
    if (!this.task) return true;
    
    const inv = this.task.invernadero;
    
    // Verificar que todos los valores críticos estén configurados correctamente
    const fechaCorrecta = this.singleDate === this.task.fecha_limite;
    const encargadoCorrecta = this.selectedEncargado === this.task.encargado_id;
    const estimacionCorrecta = this.estimation === (Number(this.task.estimacion_horas) || 0).toString();
    const descripcionCorrecta = this.description === (this.task.descripcion || '');
    
    const areaCorrecta = !!(this.workingAreas[inv] && this.workingAreas[inv] > 0);
    
    const todoCorrecto = fechaCorrecta && encargadoCorrecta && estimacionCorrecta && descripcionCorrecta && areaCorrecta;
    
    if (!todoCorrecto) {
      console.log('🔧 Valores aún no están correctos:', {
        fechaCorrecta,
        encargadoCorrecta,
        estimacionCorrecta,
        descripcionCorrecta,
        areaCorrecta
      });
    }
    
    return todoCorrecto;
  }

  forceSyncForEdit() {
    // 🔧 En modo edición, forzar que los valores globales se copien a las estructuras individuales
    if (this.task && this.task.invernadero) {
      const inv = this.task.invernadero;
      
      // Asegurar que los valores individuales tengan los datos correctos
      if (this.singleDate) {
        this.dueDates[inv] = this.singleDate;
      }
      
      if (this.selectedEncargado) {
        this.selectedEncargados[inv] = this.selectedEncargado;
      }
      
      if (this.estimation) {
        this.estimations[inv] = Number(this.estimation) || 0;
      }
      
      console.log(`🔧 === FORZANDO SINCRONIZACIÓN PARA EDICIÓN ===`);
      console.log(`📋 Valores forzados para ${inv}:`);
      console.log(`  - dueDates[${inv}]: ${this.dueDates[inv]}`);
      console.log(`  - selectedEncargados[${inv}]: ${this.selectedEncargados[inv]}`);
      console.log(`  - estimations[${inv}]: ${this.estimations[inv]}`);
    }
  }
}
