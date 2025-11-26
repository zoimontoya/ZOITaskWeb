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

// NUEVO: Interfaz para configuración de tarea por invernadero
interface TaskConfig {
  jornales: number;
  fechaLimite: string;
  encargado: string;
  estimacionHoras: number;
}

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

  // NUEVO: Métodos para manejar múltiples tareas
  onTareaSelectionChange(tareas: string[]) {
    console.log('🎯 Tareas seleccionadas:', tareas);
    this.selectedTareas = [...tareas];
    this.updateInvernaderoTareasConfig();
  }

  // NUEVO: Actualizar configuración cuando cambian tareas o invernaderos
  updateInvernaderoTareasConfig() {
    const invernaderos = this.getSelectedInvernaderos();
    const newConfig: { [invernadero: string]: { [tarea: string]: TaskConfig } } = {};

    invernaderos.forEach(inv => {
      newConfig[inv] = {};
      
      // Si ya existía configuración para este invernadero, preservar solo las tareas existentes
      if (this.invernaderoTareasConfig[inv]) {
        // Preservar tareas existentes (las que no han sido eliminadas específicamente)
        Object.keys(this.invernaderoTareasConfig[inv]).forEach(tarea => {
          if (this.selectedTareas.includes(tarea)) {
            newConfig[inv][tarea] = this.invernaderoTareasConfig[inv][tarea];
          }
        });
        
        // Solo agregar nuevas tareas que no existían antes
        this.selectedTareas.forEach(tarea => {
          if (!this.invernaderoTareasConfig[inv][tarea]) {
            newConfig[inv][tarea] = {
              jornales: 0,
              fechaLimite: this.singleDate,
              encargado: this.selectedEncargado,
              estimacionHoras: 0
            };
          }
        });
      } else {
        // Nuevo invernadero, crear todas las tareas
        this.selectedTareas.forEach(tarea => {
          newConfig[inv][tarea] = {
            jornales: 0,
            fechaLimite: this.singleDate,
            encargado: this.selectedEncargado,
            estimacionHoras: 0
          };
        });
      }

      // Inicializar índice activo para este invernadero
      if (!this.activeTareaIndex[inv]) {
        this.activeTareaIndex[inv] = 0;
      }
    });

    this.invernaderoTareasConfig = newConfig;
    console.log('📝 Configuración actualizada:', this.invernaderoTareasConfig);
  }

  // NUEVO: Métodos para navegación del sub-carrusel de tareas
  setActiveTarea(invernadero: string, tareaIndex: number) {
    if (tareaIndex >= 0 && tareaIndex < this.selectedTareas.length) {
      this.activeTareaIndex[invernadero] = tareaIndex;
    }
  }

  prevTarea(invernadero: string) {
    if (this.activeTareaIndex[invernadero] > 0) {
      this.activeTareaIndex[invernadero]--;
      this.updateSelectedTaskJornalUnidad(invernadero);
    }
  }

  nextTarea(invernadero: string) {
    const maxIndex = this.selectedTareas.length - 1;
    if (this.activeTareaIndex[invernadero] < maxIndex) {
      this.activeTareaIndex[invernadero]++;
      this.updateSelectedTaskJornalUnidad(invernadero);
    }
  }

  isActiveTarea(invernadero: string, tareaIndex: number): boolean {
    return this.activeTareaIndex[invernadero] === tareaIndex;
  }

  // NUEVO: Eliminar tarea específica de un invernadero
  removeTareaFromInvernadero(invernadero: string, tarea: string) {
    console.log(`🗑️ ELIMINANDO tarea "${tarea}" del invernadero "${invernadero}"`);
    console.log('Estado ANTES:', JSON.stringify(this.invernaderoTareasConfig[invernadero], null, 2));
    
    if (this.invernaderoTareasConfig[invernadero]) {
      delete this.invernaderoTareasConfig[invernadero][tarea];
      
      // Ajustar índice activo si es necesario
      const tareasRestantes = Object.keys(this.invernaderoTareasConfig[invernadero]);
      if (this.activeTareaIndex[invernadero] >= tareasRestantes.length) {
        this.activeTareaIndex[invernadero] = Math.max(0, tareasRestantes.length - 1);
      }
      
      console.log('Estado DESPUÉS:', JSON.stringify(this.invernaderoTareasConfig[invernadero], null, 2));
      console.log('Tareas restantes:', tareasRestantes);
    }
  }

  // NUEVO: Obtener tareas activas para un invernadero
  getTareasForInvernadero(invernadero: string): string[] {
    return Object.keys(this.invernaderoTareasConfig[invernadero] || {});
  }

  // NUEVO: Obtener configuración de tarea específica
  getTaskConfig(invernadero: string, tarea: string): TaskConfig | null {
    if (!this.invernaderoTareasConfig[invernadero] || !this.invernaderoTareasConfig[invernadero][tarea]) {
      return null;
    }
    return this.invernaderoTareasConfig[invernadero][tarea];
  }

  // NUEVO: Obtener configuración de tarea específica con valores por defecto
  getTaskConfigSafe(invernadero: string, tarea: string): TaskConfig {
    const config = this.getTaskConfig(invernadero, tarea);
    if (config) {
      return config;
    }
    
    // Crear configuración por defecto si no existe
    const defaultConfig: TaskConfig = {
      jornales: 0,
      fechaLimite: this.singleDate,
      encargado: this.selectedEncargado,
      estimacionHoras: 0
    };
    
    // Guardar la configuración por defecto
    if (!this.invernaderoTareasConfig[invernadero]) {
      this.invernaderoTareasConfig[invernadero] = {};
    }
    this.invernaderoTareasConfig[invernadero][tarea] = defaultConfig;
    
    return defaultConfig;
  }

  // NUEVO: Actualizar configuración de tarea específica
  updateTaskConfig(invernadero: string, tarea: string, config: Partial<TaskConfig>) {
    if (this.invernaderoTareasConfig[invernadero]?.[tarea]) {
      Object.assign(this.invernaderoTareasConfig[invernadero][tarea], config);
    }
  }

  // NUEVO: Obtener lista de todas las tareas disponibles para selección múltiple
  getAvailableTasks(): string[] {
    if (!this.taskTypes || this.taskTypes.length === 0) {
      return [];
    }
    
    // Extraer nombres únicos de todas las tareas disponibles
    return this.taskTypes.map((task: any) => task.nombre || task.tipo).filter(Boolean);
  }

  // NUEVO: Verificar si una tarea específica está seleccionada
  isTareaSelected(tarea: string): boolean {
    return this.selectedTareas.includes(tarea);
  }

  // NUEVO: Manejar selección múltiple desde el selector jerárquico
  onTareasMultipleSelected(tareas: string[]) {
    console.log('🎯 Tareas múltiples seleccionadas:', tareas);
    this.selectedTareas = [...tareas];
    this.updateInvernaderoTareasConfig();
    
    // Actualizar selectedTaskJornalUnidad para el invernadero activo
    const invernaderoActivo = this.getSelectedInvernaderos()[this.activeInvernaderoIndex];
    if (invernaderoActivo) {
      this.updateSelectedTaskJornalUnidad(invernaderoActivo);
    }
  }

  // NUEVO: Remover una tarea específica de la selección
  removeTareaFromSelection(tarea: string) {
    const index = this.selectedTareas.indexOf(tarea);
    if (index > -1) {
      this.selectedTareas.splice(index, 1);
      this.updateInvernaderoTareasConfig();
      console.log('🗑️ Tarea removida:', tarea, 'Restantes:', this.selectedTareas);
    }
  }

  // NUEVO: Toggle selección de una tarea individual (mantener para compatibilidad)
  toggleTareaSelection(tarea: string) {
    const index = this.selectedTareas.indexOf(tarea);
    if (index > -1) {
      // Remover tarea
      this.selectedTareas.splice(index, 1);
    } else {
      // Agregar tarea
      this.selectedTareas.push(tarea);
    }
    
    this.updateInvernaderoTareasConfig();
    console.log('🎯 Tareas actualizadas:', this.selectedTareas);
  }

  // NUEVO: Obtener tarea activa para un invernadero específico
  getActiveTareaForInvernadero(invernadero: string): string | null {
    const tareas = this.getTareasForInvernadero(invernadero);
    const activeIndex = this.activeTareaIndex[invernadero] || 0;
    
    if (tareas.length > 0 && activeIndex < tareas.length) {
      return tareas[activeIndex];
    }
    
    return null;
  }

  // NUEVO: Obtener tarea activa de forma segura (nunca null)
  getActiveTareaSafe(invernadero: string): string {
    const tarea = this.getActiveTareaForInvernadero(invernadero);
    return tarea || '';
  }

  // NUEVO: Verificar si hay tareas seleccionadas
  hasSelectedTareas(): boolean {
    return this.selectedTareas.length > 0;
  }
  
  // NUEVO: Verificar si hay tareas realmente configuradas (no solo seleccionadas)
  hasConfiguredTareas(): boolean {
    // Si estamos editando, NO tenemos tareas configuradas (modo tradicional)
    if (this.task) {
      console.log('📝 MODO EDICIÓN: hasConfiguredTareas = false');
      return false;
    }
    
    const selectedInvernaderos = this.getSelectedInvernaderos();
    const hasConfig = selectedInvernaderos.some(inv => this.getTareasForInvernadero(inv).length > 0);
    
    console.log('📊 DEBUG hasConfiguredTareas:', {
      selectedInvernaderos,
      hasConfig,
      totalTareas: this.getTotalConfiguredTasks(),
      isEditMode: !!this.task
    });
    
    return hasConfig;
  }
  
  // NUEVO: Obtener total de tareas configuradas
  getTotalConfiguredTasks(): number {
    const selectedInvernaderos = this.getSelectedInvernaderos();
    return selectedInvernaderos.reduce((total, inv) => total + this.getTareasForInvernadero(inv).length, 0);
  }

  // NUEVO: Limpiar todas las tareas seleccionadas
  clearAllTareas() {
    this.selectedTareas = [];
    this.invernaderoTareasConfig = {};
    this.activeTareaIndex = {};
  }

  // NUEVO: Obtener resumen de tareas por invernadero
  getTaskSummary(): { [invernadero: string]: number } {
    const summary: { [invernadero: string]: number } = {};
    
    Object.keys(this.invernaderoTareasConfig).forEach(inv => {
      summary[inv] = Object.keys(this.invernaderoTareasConfig[inv] || {}).length;
    });
    
    return summary;
  }

  // Reset índice si cambia la selección
  // Mantener solo la versión principal más abajo
  @Input() task: any = null;
  @Output() cancel = new EventEmitter<void>();
  @Output() add = new EventEmitter<any>();
  @ViewChild('modalMessage', { static: false }) modalMessage!: ModalMessageComponent;
  @ViewChild('hierarchicalTaskSelector') hierarchicalTaskSelector: any;

  ngAfterViewInit(): void {
    console.log('🔧 ngAfterViewInit - task:', this.task);
    
    // Si estamos editando, inicializar después de que la vista esté lista
    if (this.task) {
      setTimeout(() => {
        this.initFormFromTask();
        
        // Forzar actualización adicional del selector jerárquico
        setTimeout(() => {
          this.forceHierarchicalSelectorUpdate();
        }, 500);
      }, 100);
    }
  }

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
  
  // NUEVO: Selector múltiple de tareas
  selectedTareas: string[] = []; // Array de tareas seleccionadas
  availableTareas: DropdownOption[] = []; // Opciones de tareas para el selector
  
  // NUEVO: Configuración por invernadero y tarea
  // Estructura: { invernadero: { tarea: { jornales, fecha, encargado } } }
  invernaderoTareasConfig: { [invernadero: string]: { [tarea: string]: TaskConfig } } = {};
  
  // NUEVO: Índice activo del sub-carrusel de tareas (por invernadero)
  activeTareaIndex: { [invernadero: string]: number } = {};

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

  // 🔧 MÉTODO PARA FORZAR ACTUALIZACIÓN DEL SELECTOR JERÁRQUICO
  forceHierarchicalSelectorUpdate(): void {
    console.log('🔄 FORZAR SELECTOR - Datos:', {
      task_tipo_tarea: this.task?.tipo_tarea,
      selectedTareaJerarquica: this.selectedTareaJerarquica,
      hierarchicalExists: !!this.hierarchicalTaskSelector
    });
    
    if (this.hierarchicalTaskSelector) {
      const tareaASeleccionar = this.task?.tipo_tarea || this.selectedTareaJerarquica;
      
      if (tareaASeleccionar) {
        console.log('🎯 ACTUALIZANDO SELECTOR con:', tareaASeleccionar);
        
        // Forzar actualización directa
        this.hierarchicalTaskSelector.selectedTarea = tareaASeleccionar;
        this.selectedTareaJerarquica = tareaASeleccionar;
        
        // Forzar re-renderizado
        this.cdr.markForCheck();
        this.cdr.detectChanges();
        
        // Llamar setInitialSelection si existe
        if (typeof this.hierarchicalTaskSelector.setInitialSelection === 'function') {
          try {
            this.hierarchicalTaskSelector.setInitialSelection();
            console.log('✅ setInitialSelection ejecutado');
          } catch (e) {
            console.log('⚠️ Error en setInitialSelection:', e);
          }
        }
      }
    }
  }

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
      
      console.log('🔧 INICIALIZANDO EDICIÓN:', {
        tipoTarea: this.task.tipo_tarea,
        selectedTareaJerarquica: this.selectedTareaJerarquica,
        selectedTaskType: this.selectedTaskType
      });
      
      // 🚀 MARCAR QUE ESTAMOS EN MODO EDICIÓN (NO MULTI-TAREA)
      this.selectedTareas = []; // Limpiar multi-selección
      console.log('📝 MODO EDICIÓN: Limpiando selectedTareas para forzar modo tradicional');
      
      // 🔧 BUSCAR Y CONFIGURAR EL OBJETO COMPLETO DE LA TAREA
      if (this.task.tipo_tarea && this.taskTypes) {
        const foundTask = this.taskTypes.find((t: any) => t.tipo === this.task.tipo_tarea || t.nombre === this.task.tipo_tarea);
        if (foundTask) {
          this.selectedTipoTarea = foundTask;
          this.selectedTaskJornalUnidad = (foundTask as any).jornal_unidad || 0;
          console.log('✅ Tarea encontrada al editar:', foundTask);
          
          // 🔧 FORZAR ACTUALIZACIÓN DEL SELECTOR JERÁRQUICO - INMEDIATO Y RETRASOS
          this.forceHierarchicalSelectorUpdate();
          
          setTimeout(() => this.forceHierarchicalSelectorUpdate(), 50);
          setTimeout(() => this.forceHierarchicalSelectorUpdate(), 200);
          setTimeout(() => this.forceHierarchicalSelectorUpdate(), 500);
          setTimeout(() => this.forceHierarchicalSelectorUpdate(), 1000);
        } else {
          console.log('⚠️ No se encontró la tarea:', this.task.tipo_tarea, 'en', this.taskTypes);
        }
      }
      
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
    console.log('🔄 === CAMBIO DE SELECCIÓN INVERNADERO ===');
    console.log('📋 Nueva selección recibida:', selection);
    this.invernaderoSelection = selection;
    
    // En modo edición, no limpiar valores existentes
    if (!this.task) {
      console.log('✅ Modo CREACIÓN - Ejecutando detectAlmacenMode()');
      // Solo ejecutar limpiezas y reseteos en modo CREACIÓN (nueva tarea)
      
      // Detectar si estamos en modo ALMACÉN
      this.detectAlmacenMode();
      
      // Limpiar fechas anteriores y crear nuevas entradas según el modo
      this.updateDateFields();
      
      // Sincronizar fechas y encargados si están en modo único
      this.syncSingleValues();
    } else {
      console.log('📝 Modo EDICIÓN - Ejecutando detectAlmacenMode()');
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
    // Detectar modo ALMACÉN SOLO por cabezal del invernadero seleccionado
    // NO por grupo de trabajo (usuarios pueden tener "CAMPO Y ALMACEN")
    this.isAlmacenMode = false;
    
    console.log('🔍 === DETECTANDO MODO ALMACÉN ===');
    console.log('📋 invernaderoSelection:', this.invernaderoSelection);
    console.log('🏷️ cabezales disponibles:', this.invernaderoSelection?.cabezales);
    console.log('🏠 invernaderos disponibles:', this.invernaderoSelection?.invernaderos);
    
    // MÉTODO 1: Detectar por cabezales seleccionados
    if (this.invernaderoSelection && this.invernaderoSelection.cabezales && this.invernaderoSelection.cabezales.length > 0) {
      this.invernaderoSelection.cabezales.forEach(cabezal => {
        const cabezalUpper = cabezal.toUpperCase().trim();
        console.log(`🔍 Evaluando cabezal: "${cabezal}" → "${cabezalUpper}"`);
        
        // Buscar ALMACEN de forma más flexible
        if (cabezalUpper.includes('ALMACEN') || cabezalUpper.includes('ALMACÉN') || 
            cabezalUpper.includes('WAREHOUSE') || cabezalUpper.includes('DEPOSITO') ||
            cabezalUpper.includes('ALMAC')) {
          console.log(`✅ ENCONTRADO CABEZAL ALMACÉN: "${cabezal}"`);
          this.isAlmacenMode = true;
        } else {
          console.log(`❌ Cabezal NO es almacén: "${cabezal}"`);
        }
      });
    } else {
      console.log('⚠️ No hay cabezales en invernaderoSelection');
    }
    
    // MÉTODO 2: Detectar por nombres de invernaderos que contengan patrones de almacén
    if (this.invernaderoSelection && this.invernaderoSelection.invernaderos && this.invernaderoSelection.invernaderos.length > 0) {
      this.invernaderoSelection.invernaderos.forEach(invernadero => {
        const invUpper = invernadero.toUpperCase().trim();
        if (invUpper.includes('ALM') || invUpper.includes('WAREHOUSE') || invUpper.includes('DEPOSITO')) {
          this.isAlmacenMode = true;
        }
      });
    }
    
    console.log(`🏪 RESULTADO FINAL: isAlmacenMode = ${this.isAlmacenMode}`);
    console.log('='.repeat(50));
    

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
  console.log('🔍 ESTADO AL INICIO DEL SUBMIT:');
  console.log('selectedTareas (desplegable):', this.selectedTareas);
  console.log('hasConfiguredTareas():', this.hasConfiguredTareas());
  console.log('getTotalConfiguredTasks():', this.getTotalConfiguredTasks());
  
  // Interceptar validación nativa y mostrar modal personalizado si hay errores
  const selectedInvernaderos = this.getSelectedInvernaderos();
  
  console.log('📊 TAREAS POR INVERNADERO:');
  selectedInvernaderos.forEach(inv => {
    const tareasConfig = this.getTareasForInvernadero(inv);
    console.log(`${inv}: [${tareasConfig.join(', ')}] (${tareasConfig.length} tareas)`);
  });
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

    // Validación de tipo de tarea dependiendo del modo
    let hasTaskSelected = false;
    
    // Verificar si hay tareas seleccionadas (modo múltiple) o usar validación original
    if (this.selectedTareas.length > 0) {
      hasTaskSelected = true;
      console.log('🔍 TAREAS SELECCIONADAS:', this.selectedTareas);
    } else {
      // En modo simple: usar validación original
      
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
    }
    
    // Validación final de tarea
    if (!errorMsg && !hasTaskSelected) {
      if (this.selectedTareas.length > 0) {
        // Ya está validado arriba, esto no debería pasar
        errorMsg = 'Error interno de validación de tareas.';
      } else {
        console.log('⚠️ VALIDACIÓN DE TAREA FALLÓ - PERO CONTINUANDO (DEBUG)');
        console.log('🔧 Para habilitar validación, cambiar esta línea en onSubmit()');
        // errorMsg = 'Por favor, selecciona al menos una tarea.'; // DESHABILITADO TEMPORALMENTE
      }
    }

    // Validación de estimaciones (si no es modo almacén Y no hay multitareas - formato antiguo)
    if (!errorMsg && !this.isAlmacenMode && this.selectedTareas.length === 0) {
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

    // Validación de fechas (formato antiguo - solo si no hay multitareas)
    if (!errorMsg && this.selectedTareas.length === 0) {
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

    // Validación de encargados (modo tradicional - solo si no hay tareas múltiples seleccionadas)
    if (!errorMsg && this.selectedTareas.length === 0) {
      const invalidEncargados = selectedInvernaderos.filter((g: string) => !this.selectedEncargados[g] || this.selectedEncargados[g].trim() === '');
      if (invalidEncargados.length > 0) {
        if (this.useIndividualEncargados || selectedInvernaderos.length > 1) {
          errorMsg = `Por favor, selecciona un encargado para: ${invalidEncargados.join(', ')}`;
        } else {
          errorMsg = 'Por favor, selecciona un encargado para el invernadero.';
        }
      }
    }

    // Validación específica para tareas múltiples
    if (!errorMsg && this.selectedTareas.length > 0) {
      const isSimpleCase = selectedInvernaderos.length === 1 && this.selectedTareas.length === 1;
      
      console.log('🔍 VALIDACIÓN MULTITAREAS:', {
        isSimpleCase,
        useIndividualDates: this.useIndividualDates,
        useIndividualEncargados: this.useIndividualEncargados,
        singleDate: this.singleDate,
        selectedEncargado: this.selectedEncargado
      });
      
      // Solo validar campos globales si NO es caso simple y está en modo "mismo para todos"
      if (!isSimpleCase && !this.useIndividualDates) {
        if (!this.singleDate || this.singleDate.trim() === '') {
          errorMsg = 'Por favor, selecciona la fecha límite para todas las tareas.';
          console.log('❌ FALTA FECHA GLOBAL');
        }
      }
      
      if (!errorMsg && !isSimpleCase && !this.useIndividualEncargados) {
        if (!this.selectedEncargado || this.selectedEncargado.trim() === '') {
          errorMsg = 'Por favor, selecciona el encargado para todas las tareas.';
          console.log('❌ FALTA ENCARGADO GLOBAL');
        }
      }

      // Validar que cada invernadero-tarea tenga configuración completa
      // CORRECCIÓN: Solo validar tareas que realmente están configuradas por invernadero
      if (!errorMsg) {
        for (const invernadero of selectedInvernaderos) {
          const tareasParaValidar = this.getTareasForInvernadero(invernadero);
          
          console.log(`🔍 VALIDANDO ${invernadero}:`, {
            tareasDelDesplegable: this.selectedTareas,
            tareasRealesParaValidar: tareasParaValidar,
            mensaje: 'Solo validando las tareas que realmente están configuradas'
          });
          
          for (const tarea of tareasParaValidar) {
            const config = this.getTaskConfig(invernadero, tarea);
            if (!config) {
              errorMsg = `Falta configuración para ${tarea} en ${invernadero}`;
              break;
            }

            // Validar jornales (SIEMPRE requeridos)
            if (!config.jornales || config.jornales <= 0) {
              errorMsg = `Por favor, ingresa una estimación de jornales válida para ${tarea} en ${invernadero}`;
              break;
            }

            // Validar fecha límite (si es caso simple O está en modo individual)
            const needsIndividualDate = isSimpleCase || this.useIndividualDates;
            if (needsIndividualDate && (!config.fechaLimite || config.fechaLimite.trim() === '')) {
              errorMsg = `Por favor, selecciona una fecha límite para ${tarea} en ${invernadero}`;
              break;
            }

            // Validar encargado (si es caso simple O está en modo individual)
            const needsIndividualEncargado = isSimpleCase || this.useIndividualEncargados;
            if (needsIndividualEncargado && (!config.encargado || config.encargado.trim() === '')) {
              errorMsg = `Por favor, selecciona un encargado para ${tarea} en ${invernadero}`;
              break;
            }
          }
          if (errorMsg) break;
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
    // Si todo es válido, continuar con la lógica dependiendo del modo
    let tareas: any[] = [];
    
    if (this.hasConfiguredTareas()) {
      // NUEVO: Crear múltiples tareas (solo las configuradas)
      tareas = this.createMultipleTasks(selectedInvernaderos);
    } else {
      // SIN TAREAS CONFIGURADAS: No se debe crear nada
      if (this.selectedTareas.length === 0) {
        errorMsg = 'Por favor, selecciona al menos una tarea en el desplegable antes de crear.';
      } else {
        errorMsg = 'No hay tareas configuradas. Las tareas seleccionadas fueron eliminadas de todos los invernaderos.';
      }
      if (this.modalMessage) {
        this.modalMessage.show(errorMsg);
        this.cdr.markForCheck();
      }
      return;
      
      // Lógica original para modo simple (NUNCA SE EJECUTA AHORA)
      tareas = selectedInvernaderos.map((g: string) => {
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
    }
    
    console.log('📤 TODAS LAS TAREAS A ENVIAR:', tareas);
    this.add.emit(tareas);
  }

  // NUEVO: Crear múltiples tareas para el modo multi-tarea
  private createMultipleTasks(selectedInvernaderos: string[]): any[] {
    const allTasks: any[] = [];

    console.log('🎯 CREANDO MÚLTIPLES TAREAS:', {
      invernaderos: selectedInvernaderos,
      tareas: this.selectedTareas,
      configuracion: this.invernaderoTareasConfig
    });

    // Para cada invernadero
    selectedInvernaderos.forEach(invernadero => {
      // Para cada tarea ESPECÍFICA de este invernadero (no las globales)
      const tareasParaInvernadero = this.getTareasForInvernadero(invernadero);
      
      console.log(`🏠 ${invernadero} - Tareas específicas:`, tareasParaInvernadero);
      
      tareasParaInvernadero.forEach(tarea => {
        const config = this.getTaskConfigSafe(invernadero, tarea);
        
        // Calcular estimación en horas basado en jornales
        const factor = this.useEightHourJornal ? 8 : 6;
        const estimacionEnHoras = config.jornales * factor;

        // Determinar fecha límite: si no es individual, usar la global
        const fechaLimite = this.useIndividualDates ? config.fechaLimite : this.singleDate;
        
        // Determinar encargado: si no es individual, usar el global
        const encargadoId = this.useIndividualEncargados ? config.encargado : this.selectedEncargado;

        // Calcular dimensión total basada en el modo (hectáreas vs kilos)
        let dimensionTotal = 0;
        let horasKilos = 0;
        
        if (this.isAlmacenMode) {
          // Modo almacén: usar kg si aplica
          horasKilos = this.showKgEstimationField() ? 1 : 0;
          dimensionTotal = this.showKgEstimationField() ? (this.almacenKgEstimation[invernadero] || 0) : 0;
        } else {
          // Modo normal: hectáreas o kilos
          horasKilos = this.useKilosMode ? 1 : 0;
          dimensionTotal = this.useKilosMode ? 
            (this.expectedKilos[invernadero] || 0) : 
            (this.workingAreas[invernadero] || 0);
        }

        const taskData: any = {
          invernadero: invernadero,
          tipo_tarea: tarea,
          estimacion_horas: estimacionEnHoras,
          hora_jornal: this.useEightHourJornal ? 1 : 0,
          horas_kilos: horasKilos,
          fecha_limite: fechaLimite,
          encargado_id: encargadoId,
          descripcion: this.description || '',
          dimension_total: dimensionTotal
        };

        console.log('📋 Tarea creada:', {
          invernadero: taskData.invernadero,
          tarea: taskData.tipo_tarea,
          jornales: config.jornales,
          horas: estimacionEnHoras,
          fecha: taskData.fecha_limite,
          encargado: taskData.encargado_id,
          fechaSource: this.useIndividualDates ? 'individual' : 'global',
          encargadoSource: this.useIndividualEncargados ? 'individual' : 'global',
          dimension_total: taskData.dimension_total,
          horas_kilos: taskData.horas_kilos,
          dimensionSource: this.useKilosMode ? 'kilos' : 'hectáreas',
          workingArea: this.workingAreas[invernadero],
          expectedKilos: this.expectedKilos[invernadero]
        });

        allTasks.push(taskData);
      });
    });

    return allTasks;
  }

  // NUEVO: Obtener el total de tareas que se van a crear
  getTotalTasksToCreate(): number {
    if (this.selectedTareas.length === 0) {
      return this.getSelectedInvernaderos().length;
    }
    
    return this.getSelectedInvernaderos().length * this.selectedTareas.length;
  }

  // NUEVO: Obtener un resumen de lo que se va a crear
  getCreationSummary(): string {
    const invernaderos = this.getSelectedInvernaderos();
    
    if (this.selectedTareas.length === 0) {
      return `${invernaderos.length} tarea${invernaderos.length > 1 ? 's' : ''}`;
    }
    
    const totalTasks = this.getTotalTasksToCreate();
    return `${totalTasks} tareas (${this.selectedTareas.length} tipo${this.selectedTareas.length > 1 ? 's' : ''} × ${invernaderos.length} invernadero${invernaderos.length > 1 ? 's' : ''})`;
  }

  // NUEVO: Verificar si el formulario está listo para envío
  isFormReadyForSubmission(): boolean {
    const validationResult = this.getValidationStatus();
    return validationResult.isValid;
  }

  // Nueva función que devuelve el estado detallado de validación
  getValidationStatus(): {isValid: boolean, errors: string[], details: any} {
    const errors: string[] = [];
    const details: any = {};
    
    if (this.getSelectedInvernaderos().length === 0) {
      errors.push('No hay invernaderos seleccionados');
      return {isValid: false, errors, details};
    }

    // Verificar que haya tareas REALMENTE configuradas (no solo seleccionadas)
    if (!this.hasConfiguredTareas()) {
      if (this.selectedTareas.length === 0) {
        errors.push('No hay tareas seleccionadas en el desplegable');
        return {isValid: false, errors, details: {type: 'no_tasks_selected'}};
      } else {
        errors.push('No hay tareas configuradas en ningún invernadero (todas fueron eliminadas)');
        return {isValid: false, errors, details: {type: 'all_tasks_removed'}};
      }
    }
    
    const selectedInvernaderos = this.getSelectedInvernaderos();
    
    // Calcular caso simple basado en tareas REALES por invernadero, no globales
    let totalTasksRemaining = 0;
    selectedInvernaderos.forEach(inv => {
      totalTasksRemaining += this.getTareasForInvernadero(inv).length;
    });
    
    const isSimpleCase = selectedInvernaderos.length === 1 && totalTasksRemaining === 1;
    
    details.isSimpleCase = isSimpleCase;
    details.totalTasksRemaining = totalTasksRemaining;
    details.selectedInvernaderos = selectedInvernaderos;
    details.selectedTareas = this.selectedTareas;
    details.useIndividualDates = this.useIndividualDates;
    details.useIndividualEncargados = this.useIndividualEncargados;
    
    // Validar campos globales si aplica
    if (!isSimpleCase) {
      // Validar fecha global si no es individual
      if (!this.useIndividualDates) {
        if (!this.singleDate || this.singleDate.trim() === '') {
          errors.push('Falta fecha límite global (toggle desactivado pero no hay fecha)');
        }
        details.singleDate = this.singleDate;
      }
      
      // Validar encargado global si no es individual  
      if (!this.useIndividualEncargados) {
        if (!this.selectedEncargado || this.selectedEncargado.trim() === '') {
          errors.push('Falta encargado global (toggle desactivado pero no hay encargado)');
        }
        details.selectedEncargado = this.selectedEncargado;
      }
    }

    // Validar configuración por invernadero
    details.invernaderoDetails = [];
    for (const invernadero of selectedInvernaderos) {
      const invDetails: any = {invernadero, tareas: []};
      
      // Solo validar tareas que realmente existen para este invernadero
      const tareasParaInvernadero = this.getTareasForInvernadero(invernadero);
      invDetails.tareasConfiguradas = tareasParaInvernadero;
      
      if (tareasParaInvernadero.length === 0) {
        errors.push(`${invernadero}: No tiene tareas configuradas`);
        invDetails.error = 'No hay tareas';
      }
      
      for (const tarea of tareasParaInvernadero) {
        const tareaDetails: any = {tarea};
        const config = this.getTaskConfig(invernadero, tarea);
        
        tareaDetails.config = config;
        
        if (!config) {
          errors.push(`${invernadero} - ${tarea}: No tiene configuración`);
          tareaDetails.error = 'Sin configuración';
        } else {
          // Validar jornales
          if (config.jornales <= 0) {
            errors.push(`${invernadero} - ${tarea}: Jornales inválidos (${config.jornales})`);
            tareaDetails.jornadesError = true;
          }
          
          // Solo validar fecha individual si es caso simple O está en modo individual
          const needsIndividualDate = isSimpleCase || this.useIndividualDates;
          tareaDetails.needsIndividualDate = needsIndividualDate;
          if (needsIndividualDate && (!config.fechaLimite || config.fechaLimite.trim() === '')) {
            errors.push(`${invernadero} - ${tarea}: Falta fecha límite individual`);
            tareaDetails.fechaError = true;
          }
          
          // Solo validar encargado individual si es caso simple O está en modo individual
          const needsIndividualEncargado = isSimpleCase || this.useIndividualEncargados;
          tareaDetails.needsIndividualEncargado = needsIndividualEncargado;
          if (needsIndividualEncargado && (!config.encargado || config.encargado.trim() === '')) {
            errors.push(`${invernadero} - ${tarea}: Falta encargado individual`);
            tareaDetails.encargadoError = true;
          }
        }
        
        invDetails.tareas.push(tareaDetails);
      }
      
      details.invernaderoDetails.push(invDetails);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      details
    };
  }

  // DEBUG: Método para verificar el estado del sistema
  debugTaskSelection(): void {
    const validationStatus = this.getValidationStatus();
    
    console.log('🔍 DEBUG - ESTADO COMPLETO DE VALIDACIÓN:');
    console.log('===============================================');
    
    if (validationStatus.isValid) {
      console.log('✅ FORMULARIO VÁLIDO - El botón debería estar habilitado');
    } else {
      console.log('❌ FORMULARIO INVÁLIDO - Errores encontrados:');
      validationStatus.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    console.log('\n📊 DETALLES COMPLETOS:');
    console.log('isFormReady:', this.isFormReadyForSubmission());
    console.log('hasSelectedTareas:', this.hasSelectedTareas());
    console.log('validationDetails:', validationStatus.details);
    
    console.log('\n🎯 CONFIGURACIÓN ACTUAL:');
    console.log('invernaderoTareasConfig:', this.invernaderoTareasConfig);
    
    // Alert para mostrar errores en pantalla también
    if (!validationStatus.isValid) {
      const errorMsg = 'ERRORES ENCONTRADOS:\n\n' + 
                      validationStatus.errors.map((e, i) => `${i + 1}. ${e}`).join('\n') +
                      '\n\nRevisa la consola para más detalles.';
      alert(errorMsg);
    } else {
      alert('✅ FORMULARIO VÁLIDO\n\nEl botón debería estar habilitado.\nSi no lo está, puede ser un problema de Angular Change Detection.');
    }
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

  // Método para obtener el jornal_unidad de una tarea específica
  getTaskJornalUnidad(tareaName: string): number {
    if (!tareaName || !this.taskTypes) {
      console.log('📊 getTaskJornalUnidad - Sin datos:', { tareaName, taskTypesLength: this.taskTypes?.length });
      return 0;
    }
    
    const task = this.taskTypes.find((t: any) => 
      t.tarea_nombre === tareaName || t.tipo === tareaName || t.nombre === tareaName
    );
    
    const jornal = (task as any)?.jornal_unidad || 0;
    console.log('📊 getTaskJornalUnidad:', {
      tareaName,
      taskFound: !!task,
      task: task,
      jornal,
      allTasks: this.taskTypes.map((t: any) => ({ nombre: t.nombre, tarea_nombre: t.tarea_nombre, tipo: t.tipo, jornal_unidad: t.jornal_unidad }))
    });
    return jornal;
  }

  // Método para actualizar selectedTaskJornalUnidad según la tarea activa
  updateSelectedTaskJornalUnidad(invernadero: string): void {
    const tareaActiva = this.getActiveTareaSafe(invernadero);
    if (tareaActiva && this.taskTypes) {
      const task = this.taskTypes.find((t: any) => 
        t.tarea_nombre === tareaActiva || t.tipo === tareaActiva || t.nombre === tareaActiva
      );
      
      if (task) {
        this.selectedTaskJornalUnidad = (task as any).jornal_unidad || 0;
        console.log('🔄 Actualizado selectedTaskJornalUnidad para', tareaActiva, ':', this.selectedTaskJornalUnidad);
      }
    }
  }

  // Método para calcular jornales recomendados para una tarea específica
  getCalculatedJornalesForTask(invernaderoNombre: string, tareaName: string): string {
    const jornal = this.getTaskJornalUnidad(tareaName);
    const hectareas = this.workingAreas[invernaderoNombre] || 0;
    
    console.log('📊 getCalculatedJornalesForTask:', {
      tarea: tareaName,
      invernadero: invernaderoNombre,
      jornal,
      hectareas,
      shouldShowRecommendation: jornal > 0 && hectareas > 0
    });
    
    if (jornal > 0 && hectareas > 0) {
      const jornalesEstimados = jornal * hectareas;
      return jornalesEstimados.toFixed(2).replace('.', ',');
    }
    return '0,00';
  }

  // Método para calcular jornales recomendados dinámicamente
  getCalculatedJornales(invernaderoNombre: string): string {
    const jornal = this.selectedTaskJornalUnidad || 0;
    const hectareas = this.workingAreas[invernaderoNombre] || 0;
    
    console.log('📊 DEBUG getCalculatedJornales:', {
      invernaderoNombre,
      jornal,
      hectareas,
      hasConfiguredTareas: this.hasConfiguredTareas(),
      shouldShowRecommendation: jornal > 0 && hectareas > 0
    });
    
    if (jornal > 0 && hectareas > 0) {
      const jornalesEstimados = jornal * hectareas;
      return jornalesEstimados.toFixed(2).replace('.', ',');
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
