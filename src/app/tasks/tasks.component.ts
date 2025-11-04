  // Filter invernaderos by search term for accordion
// ...imports y declaraciones previas...
import { Component, Input, OnInit, OnDestroy, OnChanges, ViewChild, ChangeDetectorRef } from '@angular/core';
import { TasksService } from './tasks.service';
import { Task } from './task/task.model';
import { GreenhouseService, Greenhouse } from './greenhouse.service';
import { UserService } from '../user/user.service';
import { TrabajadoresService, TrabajadorAsignado } from '../trabajadores/trabajadores.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { forkJoin } from 'rxjs';
import { AuthService, User } from '../auth/auth.service';
import { DateFormatService } from '../core/services/date-format.service';

import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { newTaskComponent } from './newTask/newTask.component';
import { AsignarTrabajadoresComponent } from '../trabajadores/asignar-trabajadores/asignar-trabajadores.component';
import { ModalMessageComponent } from '../shared/modal-message.component';
import { ConfirmExitModalComponent } from '../shared/confirm-exit-modal.component';
import { InvernaderoSelectorComponent, InvernaderoSelection } from '../shared/invernadero-selector/invernadero-selector.component';

interface TipoTarea {
  grupo_trabajo: string;
  familia: string;
  tipo: string;
  subtipo: string;
  tarea_nombre: string;
  jornal_unidad: string;
}

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, newTaskComponent, AsignarTrabajadoresComponent, ModalMessageComponent, ConfirmExitModalComponent, InvernaderoSelectorComponent],
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.css']
})
export class TasksComponent implements OnInit, OnDestroy, OnChanges {
  // Filter invernaderos by search term for accordion
  filterInvernaderosBySearch(invernaderos: Array<{ nombre: string; dimensiones: number }>): Array<{ nombre: string; dimensiones: number }> {
    const term = (this.urgentInvernaderoSearch || '').toLowerCase();
    if (!term) return invernaderos;
    return invernaderos.filter(inv => inv.nombre && inv.nombre.toLowerCase().includes(term));
  }
  // Modal de confirmación de salida
  showConfirmExitModal = false;
  pendingExitAction: (() => void) | null = null;
// ...existing code...
  // Devuelve el progreso mínimo permitido (el actual de la tarea)
  getMinProgress(): number {
    if (!this.taskToComplete) return 0;
    // Puede venir como string o number
    return Number(this.taskToComplete.progreso) || 0;
  }
  // Propiedades de usuario - ahora se obtienen del AuthService
  isEncargado: boolean = false;
  name?: string;
  userId!: string;
  loggedUser: User | undefined = undefined;
  
  // Control de carga para evitar múltiples inicializaciones
  private isInitializing = false;
  private currentUserId: string | null = null;

  isAddingTask = false;
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  showFilterMenu = false;
  selectedInvernadero: string = '';
  selectedTipo: string = '';
  selectedFechaOrden: string = 'asc'; // Por defecto: fechas límite más cercanas primero
  selectedEstado: string = 'sin-iniciar'; // Nuevo: estado seleccionado por defecto
  selectedEncargado: string = ''; // Nuevo: encargado seleccionado
  invernaderos: string[] = [];
  tiposTarea: string[] = [];
  encargados: string[] = []; // Nueva: lista de encargados
  encargadosMap: { [id: string]: string } = {}; // Nuevo: mapeo de ID a nombre
  loading = true;
  editingTask: Task | null = null;
  showDeleteModal = false;
  taskToDelete: Task | null = null;
  showCompleteModal = false;
  taskToComplete: Task | null = null;
  progressValue = 0;
  jornalesRealesValue = 0; // Campo para horas reales trabajadas (encargados ingresan horas directamente)
  kilosRecogidosValue = 0; // Campo para kilos recogidos (modo kilos)
  hectareasTrabajadasValue = 0; // Campo para hectáreas trabajadas (input directo)
  greenhouses: Greenhouse[] = [];

  // Propiedades para asignación de trabajadores
  showWorkersModal = false;
  trabajadoresAsignados: TrabajadorAsignado[] = [];
  trabajadoresValidados = false; // Flag para saber si las horas cuadran
  
  // Encargados del mismo cabezal (para validación de tareas urgentes)
  encargadosDelCabezal: string[] = [];
  
  // Invernaderos del cabezal del usuario (para filtrado de tareas)
  invernaderosDelCabezal: string[] = [];

  // Protección contra double-click
  isProcessing = false;
  
  // Sistema de notificaciones
  showNotification = false;
  notificationMessage = '';
  notificationType: 'success' | 'error' | 'warning' = 'success';
  
  // Modal de confirmación para validación
  showValidationModal = false;
  taskToValidate: Task | null = null;
  
  // Overlay de carga global
  showGlobalLoading = false;
  loadingMessage = '';
  
  // Estados de carga específicos para cada acción
  isAcceptingTask: { [taskId: string]: boolean } = {};
  isValidatingTask: { [taskId: string]: boolean } = {};
  isRejectingTask: { [taskId: string]: boolean } = {};
  
  // Modal de consultas (solo para superiores)
  showConsultasModal = false;
  consultaActiva = 'horas-trabajador'; // 'horas-trabajador' | 'horas-tarea'
  
  // Consulta de horas por trabajador
  trabajadoresDisponibles: any[] = [];
  mesesDisponibles = [
    { value: '01', name: 'Enero' },
    { value: '02', name: 'Febrero' },
    { value: '03', name: 'Marzo' },
    { value: '04', name: 'Abril' },
    { value: '05', name: 'Mayo' },
    { value: '06', name: 'Junio' },
    { value: '07', name: 'Julio' },
    { value: '08', name: 'Agosto' },
    { value: '09', name: 'Septiembre' },
    { value: '10', name: 'Octubre' },
    { value: '11', name: 'Noviembre' },
    { value: '12', name: 'Diciembre' }
  ];
  selectedTrabajador = '';
  selectedMes = '';
  selectedAno = new Date().getFullYear().toString();
  horasConsultaResultado: any = null;
  isConsultandoHoras = false;
  
  // Propiedades para consulta de horas por tarea
  tiposTareaConsulta: string[] = [];
  tareasJerarquicasConsulta: any[] = []; // Estructura jerárquica para el desplegable
  selectedTipoTareaConsulta = '';
  selectedInvernaderoConsulta = '';
  invernaderoSelectionConsulta: InvernaderoSelection | null = null;
  horasTareaResultado: any = null;
  isConsultandoHorasTarea = false;
  
  // Dropdown búsqueable para tareas
  isTaskDropdownOpen = false;
  taskSearchTerm = '';
  filteredTaskOptions: any[] = [];
  selectedTareasConsulta: any[] = []; // Array para múltiples tareas
  tareaSeleccionadaLabel = '';
  private taskDropdownTimeout: any;
  
  // Propiedades para Tareas Urgentes
  isUrgentTaskWorkersMode = false;
  showUrgentTaskModal = false;
  urgentTask = {
    invernadero: '',
    tipo_tarea: '',
    horas_trabajadas: 0,
    descripcion: '',
    hectareas_trabajadas: 0,
    dimension_total: 0,
    desarrollo_actual: 0
    ,
    matricula: ''
  };
  urgentTaskWorkers: TrabajadorAsignado[] = [];
  isCreatingUrgentTask = false;
  
  // Propiedades para selectores de tarea urgente
  isUrgentInvernaderoOpen = false;
  isUrgentTipoOpen = false;
  urgentInvernaderoSearch = '';
  urgentTipoSearch = '';
  allUrgentInvernaderos: string[] = [];
  allUrgentTipos: string[] = [];
  filteredUrgentInvernaderos: string[] = [];
  filteredUrgentTipos: string[] = [];
  urgentInvernaderosWithDimensions: { nombre: string; dimensiones: number }[] = [];

  // Accordion state for urgent invernaderos grouped by cabezal
  urgentInvernaderosByCabezal: { nombre: string; invernaderos: { nombre: string; dimensiones: number }[] }[] = [];
  expandedCabezalIndices: Set<number> = new Set();
  urgentTiposJerarquicos: { tipo: string; subtipos: string[]; hasSubtipos: boolean }[] = [];
  filteredUrgentTiposJerarquicos: { tipo: string; subtipos: string[]; hasSubtipos: boolean }[] = [];
  
  // 🏪 Propiedades para género de confección (ALMACÉN)
  generosConfecc: string[] = [];
  selectedGenero = '';
  isGeneroOpen = false;
  generoSearch = '';
  filteredGeneros: string[] = [];
  selectedTipoTarea: TipoTarea | null = null;
  allTiposTareaObjects: TipoTarea[] = []; // Para acceder a los objetos completos
  
  // Mapa para almacenar trabajadores por tarea
  taskWorkersMap: Map<string, any[]> = new Map();
  


  @ViewChild('modalMessage', { static: false }) modalMessage!: ModalMessageComponent;
  constructor(
    private taskService: TasksService, 
    private greenhouseService: GreenhouseService, 
    private userService: UserService, 
    private trabajadoresService: TrabajadoresService, 
    private http: HttpClient,
    private authService: AuthService,
    private dateFormatService: DateFormatService,
    private cdr: ChangeDetectorRef
  ) {
    console.log('🚨 TASKS COMPONENT - Constructor ejecutado, funcionalidad hectáreas activa');
  }

  // ===== MÉTODOS PARA TAREAS URGENTES =====
  
  onStartUrgentTask() {
    console.log('🚨 onStartUrgentTask - Iniciando modal de tarea urgente');
    this.showUrgentTaskModal = true;
    this.urgentTask = {
      invernadero: '',
      tipo_tarea: '',
      horas_trabajadas: 0,
      descripcion: '',
      hectareas_trabajadas: 0,
      dimension_total: 0,
      desarrollo_actual: 0
      ,
      matricula: ''
    };
    this.urgentTaskWorkers = [];
    this.isUrgentTaskWorkersMode = false; // Resetear flag
    
    // Inicializar selectores
    this.isUrgentInvernaderoOpen = false;
    this.isUrgentTipoOpen = false;
    this.urgentInvernaderoSearch = '';
    this.urgentTipoSearch = '';
    console.log('🚨 onStartUrgentTask - Cargando invernaderos urgentes...');
    this.loadUrgentInvernaderos();
    this.loadUrgentTiposTarea();
  }
  
  onCancelUrgentTask() {
    this.showConfirmExitModal = true;
    this.pendingExitAction = () => {
      this.showUrgentTaskModal = false;
      this.resetUrgentTask();
    };
  }
  
  onUrgentTaskModalOverlayClick(event: MouseEvent) {
    // Solo cerrar si se hace clic en el overlay, no en el contenido del modal
    if (event.target === event.currentTarget) {
      this.onCancelUrgentTask();
    }
  }
  
  onOpenWorkersForUrgentTask() {
    // Validar que hay horas especificadas
    if (this.urgentTask.horas_trabajadas <= 0) {
      return;
    }
    
    // Abrir modal de trabajadores para la tarea urgente
    this.isUrgentTaskWorkersMode = true;
    this.trabajadoresAsignados = [...this.urgentTaskWorkers]; // Copiar los trabajadores actuales
    this.jornalesRealesValue = this.urgentTask.horas_trabajadas; // Pasar las horas totales
    this.trabajadoresValidados = false; // Resetear validación
    this.showWorkersModal = true;
  }

  // Filter invernaderos by search term for accordion

  // =========== MÉTODOS PARA CONTROL DE HECTÁREAS EN TAREAS URGENTES ===========
  
  getSelectedInvernaderoMaxArea(): number {
    console.log('getSelectedInvernaderoMaxArea - invernadero:', this.urgentTask.invernadero);
    console.log('getSelectedInvernaderoMaxArea - dimensiones disponibles:', this.urgentInvernaderosWithDimensions);
    
    if (!this.urgentTask.invernadero) return 0;
    
    // Buscar el invernadero seleccionado en la lista con dimensiones
    const invernadero = this.urgentInvernaderosWithDimensions.find(inv => inv.nombre === this.urgentTask.invernadero);
    console.log('getSelectedInvernaderoMaxArea - invernadero encontrado:', invernadero);
    
    if (invernadero) {
      const hectareas = invernadero.dimensiones; // Las dimensiones ya vienen en hectáreas
      console.log('🚨 getSelectedInvernaderoMaxArea - dimensiones exactas:', invernadero.dimensiones);
      console.log('🚨 getSelectedInvernaderoMaxArea - typeof dimensiones:', typeof invernadero.dimensiones);
      console.log('🚨 getSelectedInvernaderoMaxArea - hectáreas devueltas:', hectareas);
      return hectareas;
    }
    return 0;
  }
  
  getUrgentHectareasPercentage(): number {
    const currentArea = this.urgentTask.hectareas_trabajadas || 0;
    const maxArea = this.getSelectedInvernaderoMaxArea();
    if (maxArea === 0) return 0;
    const percentage = (currentArea / maxArea) * 100;
    console.log('🎯 PORCENTAJE FINAL:', percentage, '- currentArea:', currentArea, '- maxArea:', maxArea);
    return percentage;
  }

  getUrgentHectareasFormattedValue(): string {
    const value = this.urgentTask.hectareas_trabajadas || 0;
    
    // Devolver el valor tal como está para evitar conflictos mientras se escribe
    return value.toString();
  }
  
  onUrgentHectareasSliderChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const newValue = parseFloat(target.value) || 0;
    const maxArea = this.getSelectedInvernaderoMaxArea();
    
    // Limitar al rango permitido y redondear a 3 decimales
    const clampedValue = Math.min(Math.max(newValue, 0), maxArea);
    this.urgentTask.hectareas_trabajadas = Math.round(clampedValue * 1000) / 1000;
    
    // Forzar actualización del input para mostrar exactamente 3 decimales
    setTimeout(() => {
      const inputElement = document.querySelector('.urgent-area-input') as HTMLInputElement;
      if (inputElement) {
        inputElement.value = this.urgentTask.hectareas_trabajadas.toFixed(3);
      }
    }, 0);
    
    this.syncUrgentDimensionValues();
  }
  
  onUrgentHectareasInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const inputValue = target.value.replace(',', '.');
    
    // Solo actualizar si el valor es válido, sin formatear mientras se escribe
    if (inputValue === '' || inputValue === '.' || inputValue.endsWith('.')) {
      // Permitir valores temporales mientras se escribe
      this.urgentTask.hectareas_trabajadas = 0;
      return;
    }
    
    const newValue = parseFloat(inputValue);
    
    if (isNaN(newValue)) {
      return;
    }
    
    if (this.urgentTask.tipo_tarea === 'Recolectar') {
      // Para kilos: permitir decimales, sin límite de hectáreas
      this.urgentTask.hectareas_trabajadas = Math.max(newValue, 0);
    } else {
      // Para hectáreas: limitar al área máxima
      const maxArea = this.getSelectedInvernaderoMaxArea();
      this.urgentTask.hectareas_trabajadas = Math.min(Math.max(newValue, 0), maxArea);
    }
    
    this.syncUrgentDimensionValues();
  }

  onUrgentValueChange() {
    // Sincronizar los valores cuando cambia el input
    this.syncUrgentDimensionValues();
  }
  
  private syncUrgentDimensionValues() {
    // Para tareas urgentes, tanto dimension_total como desarrollo_actual 
    // deben tener el valor trabajado (hectáreas o kilos según el tipo de tarea)
    if (this.urgentTask.tipo_tarea === 'Recolectar') {
      // Para kilos: usar el valor directamente
      this.urgentTask.desarrollo_actual = this.urgentTask.hectareas_trabajadas || 0;
      this.urgentTask.dimension_total = this.urgentTask.hectareas_trabajadas || 0;
    } else {
      // Para hectáreas: redondear a 3 decimales
      const roundedValue = Math.round(this.urgentTask.hectareas_trabajadas * 1000) / 1000;
      this.urgentTask.desarrollo_actual = roundedValue;
      this.urgentTask.dimension_total = roundedValue;
    }
  }
  
  private loadAllUrgentInvernaderosFallback() {
    // Cargar todos los invernaderos agrupados por cabezal para el acordeón
    this.greenhouseService.getGreenhousesGrouped().subscribe({
      next: (data) => {
        // Agrupar por cabezal para el acordeón
        this.urgentInvernaderosByCabezal = data.cabezales.map(cabezal => ({
          nombre: cabezal.nombre,
          invernaderos: cabezal.invernaderos.map(inv => ({
            nombre: inv.nombre,
            dimensiones: parseFloat(inv.dimensiones.replace(',', '.')) || 0
          }))
        }));
        // Flat list for compatibility
        const invernaderos = data.cabezales.flatMap(cabezal => cabezal.invernaderos);
        this.allUrgentInvernaderos = invernaderos.map(inv => inv.nombre).sort();
        this.urgentInvernaderosWithDimensions = invernaderos.map(inv => ({
          nombre: inv.nombre,
          dimensiones: parseFloat(inv.dimensiones.replace(',', '.')) || 0
        }));
        this.filterUrgentInvernaderos();
      },
      error: (err) => {
        console.error('Error en fallback cargando todos los invernaderos:', err);
        // Último recurso: usar solo nombres de tareas existentes (sin dimensiones)
        const allInvernaderos = new Set<string>();
        this.tasks.forEach(task => {
          if (task.invernadero && task.invernadero.trim()) {
            allInvernaderos.add(task.invernadero);
          }
        });
        this.allUrgentInvernaderos = Array.from(allInvernaderos).sort();
        this.urgentInvernaderosWithDimensions = [];
        this.urgentInvernaderosByCabezal = [];
        this.filterUrgentInvernaderos();
      }
    });
  }

  // Toggle accordion panel for cabezal index
  toggleCabezalAccordion(idx: number) {
    if (this.expandedCabezalIndices.has(idx)) {
      this.expandedCabezalIndices.delete(idx);
    } else {
      this.expandedCabezalIndices.add(idx);
    }
  }

  // Select urgent invernadero from accordion
  selectUrgentInvernaderoFromAccordion(inv: { nombre: string; dimensiones: number }) {
    this.selectUrgentInvernadero(inv.nombre);
    this.isUrgentInvernaderoOpen = false;
  }
  
  // =========== FIN MÉTODOS HECTÁREAS URGENTES ===========
  
  onSubmitUrgentTask() {
    if (this.isCreatingUrgentTask) return; // Evitar doble envío

    // Validaciones básicas
    if (!this.urgentTask.invernadero.trim() || !this.urgentTask.tipo_tarea.trim() || this.urgentTask.horas_trabajadas <= 0) {
      console.warn('[DEBUG] Falta campo obligatorio. modalMessage:', this.modalMessage);
      setTimeout(() => {
        console.warn('[DEBUG][setTimeout] Intentando mostrar modal de campos obligatorios. modalMessage:', this.modalMessage);
        if (this.modalMessage) {
          this.modalMessage.show('Debes completar todos los campos obligatorios (invernadero, tipo de tarea y horas trabajadas).', 'Campos requeridos');
          console.warn('[DEBUG][setTimeout] show() llamado para campos obligatorios.');
        } else {
          console.error('[DEBUG][setTimeout] modalMessage NO disponible.');
        }
      }, 0);
      return;
    }
    // Validar que las hectáreas trabajadas sean mayores a 0
    if (!this.urgentTask.hectareas_trabajadas || this.urgentTask.hectareas_trabajadas <= 0) {
      console.warn('[DEBUG] hectáreas <= 0. modalMessage:', this.modalMessage);
      setTimeout(() => {
        console.warn('[DEBUG][setTimeout] Intentando mostrar modal de hectáreas. modalMessage:', this.modalMessage);
        if (this.modalMessage) {
          this.modalMessage.show('Debes indicar una cantidad de hectáreas trabajadas mayor a 0.', 'Campos requeridos');
          console.warn('[DEBUG][setTimeout] show() llamado para hectáreas.');
        } else {
          console.error('[DEBUG][setTimeout] modalMessage NO disponible.');
        }
      }, 0);
      return;
    }
    // 🏪 Validación específica para tareas de confección
    if (this.shouldShowGeneroSelector() && !this.selectedGenero.trim()) {
      console.warn('[DEBUG] Falta género. modalMessage:', this.modalMessage);
      setTimeout(() => {
        console.warn('[DEBUG][setTimeout] Intentando mostrar modal de género. modalMessage:', this.modalMessage);
        if (this.modalMessage) {
          this.modalMessage.show('Debes seleccionar un género para tareas de confección.', 'Campos requeridos');
          console.warn('[DEBUG][setTimeout] show() llamado para género.');
        } else {
          console.error('[DEBUG][setTimeout] modalMessage NO disponible.');
        }
      }, 0);
      return; // Si es una tarea ALMACEN-CONFECC, el género es obligatorio
    }
    if (!this.urgentTaskWorkers || this.urgentTaskWorkers.length === 0) {
      console.warn('[DEBUG] No hay trabajadores. modalMessage:', this.modalMessage);
      setTimeout(() => {
        console.warn('[DEBUG][setTimeout] Intentando mostrar modal de trabajadores. modalMessage:', this.modalMessage);
        if (this.modalMessage) {
          this.modalMessage.show('Debes asignar al menos un trabajador a la tarea urgente.', 'Campos requeridos');
          console.warn('[DEBUG][setTimeout] show() llamado para trabajadores.');
        } else {
          console.error('[DEBUG][setTimeout] modalMessage NO disponible.');
        }
      }, 0);
      return;
    }
    this.isCreatingUrgentTask = true;
    this.showLoadingOverlay('Creando tarea urgente...');

    // Crear tarea urgente. Si el creador es SUPERIOR, marcarla directamente como Terminada
    const encargadoNombre = this.loggedUser?.nombre_completo || this.name || this.userId || '';
    const isSuperior = !this.isEncargado;
    const todayIso = new Date().toISOString().split('T')[0];
    const fechaActualizacion = new Date().toLocaleDateString('es-ES');
    // Hora jornal especial para "Manten. Vehículos"
    const horaJornalValue = this.urgentTask.tipo_tarea === 'Manten. Vehículos' ? 1 : 0;
    // Horas_kilos especial para "Recolectar" (para usar modo kilos en lugar de hectáreas)
    const horasKilosValue = this.urgentTask.tipo_tarea === 'Recolectar' ? 1 : 0;

    const tareaUrgente: any = {
      invernadero: this.urgentTask.invernadero.trim(),
      tipo_tarea: this.urgentTask.tipo_tarea.trim(),
      estimacion_horas: this.urgentTask.horas_trabajadas,
      hora_jornal: horaJornalValue,
      horas_kilos: horasKilosValue,
      jornales_reales: this.urgentTask.horas_trabajadas,
      fecha_limite: todayIso,
      encargado_id: this.userId,
      descripcion: this.buildUrgentTaskDescription(),
      nombre_superior: encargadoNombre,
      desarrollo_actual: this.urgentTask.tipo_tarea === 'Manten. Vehículos' ? String(this.urgentTask.matricula) : this.urgentTask.desarrollo_actual.toString(),
      dimension_total: this.urgentTask.tipo_tarea === 'Manten. Vehículos' ? String(this.urgentTask.matricula) : this.urgentTask.dimension_total.toString(),
      // Datos para registro directo en hoja "Horas"
      trabajadores_asignados: this.urgentTaskWorkers,
      encargado_nombre: encargadoNombre,
      es_tarea_urgente: true,
      es_superior: isSuperior // AÑADIDO - para saber si auto-validar horas
    };

    if (isSuperior) {
      // Marcar como terminada y rellenar fechas automáticamente
      tareaUrgente.proceso = 'Terminada';
      // Cuando lo valida un superior, las fechas deben coincidir con la fecha límite
      tareaUrgente.fecha_inicio = tareaUrgente.fecha_limite;
      tareaUrgente.fecha_fin = tareaUrgente.fecha_limite;
      tareaUrgente.fecha_actualizacion = tareaUrgente.fecha_limite;
      // Asegurar jornales_reales mantiene las horas indicadas
      tareaUrgente.jornales_reales = this.urgentTask.horas_trabajadas;
    } else {
      tareaUrgente.proceso = 'Por validar';
    }

    console.log('Creando tarea urgente:', tareaUrgente);

    this.taskService.addTask([tareaUrgente], this.loggedUser?.nombre_completo || this.userId).subscribe({
      next: () => {
        this.isCreatingUrgentTask = false;
        this.hideLoadingOverlay();
        this.showUrgentTaskModal = false;

        // Si hay trabajadores asignados, registrarlos
        if (this.urgentTaskWorkers.length > 0) {
          // Aquí registrarías las horas de los trabajadores
          console.log('Trabajadores para tarea urgente:', this.urgentTaskWorkers);
        }

        this.resetUrgentTask();
        this.loadTasks();
      },
      error: (err) => {
        this.isCreatingUrgentTask = false;
        this.hideLoadingOverlay();
        if (err.status === 200) {
          // Manejar respuesta exitosa que viene como error
          this.showUrgentTaskModal = false;
          this.resetUrgentTask();
          this.loadTasks();
        } else {
          console.error('Error creando tarea urgente:', err);
          if (this.modalMessage) {
            this.modalMessage.show('Error al crear la tarea urgente', 'Error');
            this.cdr.detectChanges();
          }
        }
      }
    });
  }

  ngOnInit() {
    this.greenhouseService.getGreenhouses().subscribe(data => this.greenhouses = data);
    document.addEventListener('mousedown', this.handleClickOutside);
    
    // Suscribirse a cambios en el usuario autenticado
    this.authService.currentUser$.subscribe(user => {
      console.log('🔄 TasksComponent - Usuario cambió:', user);
      
      // Evitar reinicialización si el usuario es el mismo o si ya estamos inicializando
      if (this.isInitializing) {
        console.log('⚠️ Ya inicializando, saltando cambio de usuario');
        return;
      }
      
      const newUserId = user?.id || null;
      if (newUserId !== this.currentUserId) {
        console.log(`👤 Cambio de usuario detectado: ${this.currentUserId} → ${newUserId}`);
        this.currentUserId = newUserId;
        
        if (user) {
          this.initializeUser();
        } else {
          // Usuario null, limpiar estado
          this.clearUserState();
        }
      } else {
        console.log('✅ Mismo usuario, no reinicializar');
      }
    });
    
    // Inicializar usuario desde AuthService
    this.initializeUser();
  }

  private initializeUser() {
    if (this.isInitializing) {
      console.log('⚠️ Ya inicializando usuario, saltando duplicado');
      return;
    }
    
    this.isInitializing = true;
    
    // Obtener usuario actual del AuthService
    const currentUser = this.authService.getCurrentUser();
    this.loggedUser = currentUser || undefined;
    
    console.log('🔍 TasksComponent.initializeUser() - Usuario actual:', currentUser);
    
    if (this.loggedUser) {
      this.userId = this.loggedUser.id;
      this.name = this.loggedUser.name;
      this.isEncargado = this.authService.isEncargado();
      
      console.log('👤 Usuario inicializado desde AuthService:', this.loggedUser);
      console.log('📋 Iniciando carga de tareas para:', this.isEncargado ? 'ENCARGADO' : 'SUPERIOR');
      
      // Para superiores, cargar encargados del mismo cabezal PRIMERO, luego las tareas
      if (!this.isEncargado && this.loggedUser?.grupo_trabajo && this.loggedUser?.cabezal) {
        this.loadEncargadosDelCabezal();
      } else {
        // Para encargados o superiores sin cabezal específico, cargar tareas directamente
        this.loadTasks();
      }
    } else {
      // Si no hay usuario, redirigir al login
      console.log('❌ No hay usuario autenticado, redirigiendo al login');
      this.isInitializing = false;
      this.authService.logout();
    }
  }

  private clearUserState() {
    console.log('🧹 Limpiando estado de usuario');
    this.loggedUser = undefined;
    this.userId = '';
    this.name = undefined;
    this.isEncargado = false;
    this.tasks = [];
    this.filteredTasks = [];
    this.isInitializing = false;
  }

  ngOnDestroy() {
    document.removeEventListener('mousedown', this.handleClickOutside);
  }

  ngOnChanges() {
    this.loadTasks();
  }

  toggleFilterMenu() {
    this.showFilterMenu = !this.showFilterMenu;
  }

  handleClickOutside = (event: MouseEvent) => {
    if (this.showFilterMenu) {
      const menu = document.querySelector('.filter-dropdown');
      if (menu && !menu.contains(event.target as Node)) {
        this.showFilterMenu = false;
      }
    }
    
    // Cerrar dropdowns de tarea urgente si se hace clic fuera
    if (this.isUrgentInvernaderoOpen) {
      const invernaderoDropdown = document.querySelector('.urgent-dropdown.open');
      if (invernaderoDropdown && !invernaderoDropdown.contains(event.target as Node)) {
        this.isUrgentInvernaderoOpen = false;
      }
    }
    
    if (this.isUrgentTipoOpen) {
      const tipoDropdown = document.querySelector('.urgent-dropdown.open');
      if (tipoDropdown && !tipoDropdown.contains(event.target as Node)) {
        this.isUrgentTipoOpen = false;
      }
    }
  };

  applyFilters() {
    let filtered = [...this.tasks];
    
    // Filtrar por estado seleccionado (usar progreso para tareas urgentes, proceso para tareas normales)
    switch (this.selectedEstado) {
      case 'sin-iniciar':
        filtered = filtered.filter(t => {
          return this.getTaskState(t) === 'No iniciado';
        });
        break;
      case 'en-progreso':
        // Mostrar tareas que estén iniciadas, recolectando O que tengan progreso numérico
        filtered = filtered.filter(t => {
          const estado = this.getTaskState(t);
          const esIniciada = estado === 'Iniciada';
          const esRecolectando = estado === 'Recolectando';
          const tieneProgreso = estado && !isNaN(Number(estado)) && Number(estado) > 0;
          return esIniciada || esRecolectando || tieneProgreso;
        });
        break;
      case 'terminadas':
        filtered = filtered.filter(t => {
          return this.getTaskState(t) === 'Terminada';
        });
        break;
      case 'por-validar':
        filtered = filtered.filter(t => {
          return this.getTaskState(t) === 'Por validar';
        });
        break;
    }
    
    if (this.selectedInvernadero) {
      filtered = filtered.filter(t => t.invernadero === this.selectedInvernadero);
    }
    if (this.selectedTipo) {
      filtered = filtered.filter(t => t.tipo_tarea === this.selectedTipo);
    }
    if (this.selectedEncargado) {
      filtered = filtered.filter(t => (t.encargado_nombre || t.encargado_id) === this.selectedEncargado);
    }
    if (this.selectedFechaOrden === 'asc') {
      filtered = filtered.sort((a, b) => (a.fecha_limite || '').localeCompare(b.fecha_limite || ''));
    } else {
      filtered = filtered.sort((a, b) => (b.fecha_limite || '').localeCompare(a.fecha_limite || ''));
    }
    this.filteredTasks = filtered;
  }

  resetFilters() {
    this.selectedInvernadero = '';
    this.selectedTipo = '';
    this.selectedEncargado = '';
    this.selectedFechaOrden = 'asc'; // Por defecto: fechas límite más cercanas primero
    // No resetear selectedEstado para supervisores, mantener el estado activo
    this.applyFilters();
  }

  setEstadoFilter(estado: string) {
    this.selectedEstado = estado;
    this.applyFilters();
  }

  loadTasks() {
    console.log('📋 TasksComponent.loadTasks() INICIADO');
    console.log('👤 Usuario current al cargar tareas:', this.loggedUser);
    console.log('🎫 Token disponible:', !!this.authService.getToken());
    
    // Resetear flag de inicialización al completar carga
    const wasInitializing = this.isInitializing;
    
    this.loading = true;
    this.taskService.getTasks().subscribe({
      next: (tasks) => {
        
        // CONVERSIÓN DE HORAS A JORNALES EN EL FRONTEND
        const tasksConvertidas = tasks.map(t => {
          const horaJornal = Number(t.hora_jornal) || 0;
          const horasTotales = Number(t.estimacion_horas) || 0;
          
          // Para tareas urgentes: NO hacer conversión (preservar horas directas)
          const esTareaUrgente = this.isUrgentTask(t);
          
          let estimacionParaMostrar;
          if (esTareaUrgente) {
            // Tareas urgentes: mostrar horas directas (SIN conversión)
            estimacionParaMostrar = horasTotales;
            console.log(`🚨 Tarea ${t.id} URGENTE: nombre_superior="${t.nombre_superior}", usuario="${this.loggedUser?.nombre_completo}", horas=${horasTotales}h (SIN división)`);
          } else {
            // Tareas normales: convertir a jornales
            const factorConversion = horaJornal === 1 ? 8 : 6; // 1 = 8h/jornal, 0 = 6h/jornal
            estimacionParaMostrar = horasTotales / factorConversion;
            console.log(`📊 Tarea ${t.id} NORMAL: nombre_superior="${t.nombre_superior}", usuario="${this.loggedUser?.nombre_completo}", horas=${horasTotales}h ÷ ${factorConversion} = ${estimacionParaMostrar} jornales`);
          }
          
          return {
            ...t,
            estimacion_horas: estimacionParaMostrar,
            id: String(t.id)
          };
        });
        
        
        if (this.isEncargado && this.userId) {
          // Para encargados: filtrar solo sus tareas
          const userIdNorm = String(this.userId).trim().toLowerCase();
          this.tasks = tasksConvertidas.filter(t => String(t.encargado_id).trim().toLowerCase() === userIdNorm);
        } else {
          // Para superiores: mostrar solo tareas de invernaderos de sus cabezales (y opcionalmente las que ellos mismos han creado)
          const userNameNorm = String(this.name || '').trim().toLowerCase();
          const userFullName = String(this.loggedUser?.nombre_completo || '').trim().toLowerCase();
          const userIdStr = String(this.userId || '').trim().toLowerCase();

          console.log('🔎 Invernaderos del cabezal del usuario:', this.invernaderosDelCabezal);
          this.tasks = tasksConvertidas.filter(t => {
            const taskSuperior = String(t.nombre_superior || '').trim().toLowerCase();
            // Solo mostrar tareas creadas por el usuario o cuyo invernadero pertenezca a sus cabezales
            const esCreadorDeLaTarea = taskSuperior === userNameNorm || 
                                       taskSuperior === userFullName ||
                                       taskSuperior === userIdStr;
            const tareaEnInvernaderoDeCabezal = this.isTaskInUserCabezal(t);
            if (!tareaEnInvernaderoDeCabezal && !esCreadorDeLaTarea && t.invernadero) {
              console.log(`🚫 Tarea ${t.id} (${t.invernadero}) excluida para usuario ${this.loggedUser?.nombre_completo}`);
            }
            return esCreadorDeLaTarea || tareaEnInvernaderoDeCabezal;
          });
          console.log('✅ Tareas filtradas para usuario:', this.loggedUser?.nombre_completo, this.tasks.map(t => `${t.id} (${t.invernadero})`));
        }
        this.invernaderos = Array.from(new Set(this.tasks.map(t => t.invernadero).filter(Boolean)));
        this.tiposTarea = Array.from(new Set(this.tasks.map(t => t.tipo_tarea).filter(Boolean)));
        this.encargados = Array.from(new Set(this.tasks.map(t => t.encargado_id).filter(Boolean)));
        
        // Cargar trabajadores para tareas urgentes
        this.tasks.forEach(task => {
          if (this.isUrgentTask(task)) {
            this.loadTaskWorkers(task.id);
          }
        });

        // Cargar nombres de encargados para supervisores
        if (!this.isEncargado) {
          this.loadEncargadosNames();
        } else {
          this.applyFilters();
          this.loading = false;
          if (wasInitializing) this.isInitializing = false; // Reset flag
        }
      },
      error: () => {
        this.tasks = [];
        this.filteredTasks = [];
        this.loading = false;
        if (wasInitializing) this.isInitializing = false; // Reset flag
      }
    });
  }

  loadEncargadosNames() {
    const uniqueEncargadoIds = Array.from(new Set(this.tasks.map(t => t.encargado_id).filter(Boolean)));
    let loadedCount = 0;
    
    if (uniqueEncargadoIds.length === 0) {
      this.applyFilters();
      this.loading = false;
      this.isInitializing = false; // Reset flag
      return;
    }
    
    uniqueEncargadoIds.forEach(encargadoId => {
      this.userService.getUserById(encargadoId).subscribe({
        next: (response) => {
          if (response.success && response.user) {
            this.encargadosMap[encargadoId] = response.user.name;
            
            // Actualizar las tareas con el nombre del encargado
            this.tasks.forEach(task => {
              if (task.encargado_id === encargadoId) {
                task.encargado_nombre = response.user!.name;
              }
            });
          } else {
            // Si no se encuentra el usuario, usar el ID como nombre
            this.encargadosMap[encargadoId] = encargadoId;
            this.tasks.forEach(task => {
              if (task.encargado_id === encargadoId) {
                task.encargado_nombre = encargadoId;
              }
            });
          }
          
          loadedCount++;
          if (loadedCount === uniqueEncargadoIds.length) {
            // Actualizar la lista de encargados para el filtro con los nombres
            this.encargados = Array.from(new Set(Object.values(this.encargadosMap)));
            this.applyFilters();
            this.loading = false;
            this.isInitializing = false; // Reset flag
          }
        },
        error: () => {
          // En caso de error, usar el ID como nombre
          this.encargadosMap[encargadoId] = encargadoId;
          this.tasks.forEach(task => {
            if (task.encargado_id === encargadoId) {
              task.encargado_nombre = encargadoId;
            }
          });
          
          loadedCount++;
          if (loadedCount === uniqueEncargadoIds.length) {
            // Actualizar la lista de encargados para el filtro con los nombres
            this.encargados = Array.from(new Set(Object.values(this.encargadosMap)));
            this.applyFilters();
            this.loading = false;
            this.isInitializing = false; // Reset flag
          }
        }
      });
    });
  }

  pollForTaskListChange(predicate: () => boolean, maxAttempts = 5, delayMs = 1000) {
    let attempts = 0;
    const poll = () => {
      this.loadTasks();
      attempts++;
      setTimeout(() => {
        if (!predicate() && attempts < maxAttempts) {
          poll();
        }
      }, delayMs);
    };
    poll();
  }

  onDeleteTask(task: Task) {
    // Evitar double-click
    if (this.isRejectingTask[task.id]) return;
    
    this.isRejectingTask[task.id] = true;
    this.showLoadingOverlay('Rechazando tarea...');
    
    this.taskService.deleteTask(task.id).subscribe({
      next: () => {
        this.isRejectingTask[task.id] = false;
        this.hideLoadingOverlay();
        this.showDeleteModal = false;
        this.taskToDelete = null;
        this.showNotificationMessage('Tarea rechazada exitosamente', 'success');
        this.loadTasks();
      },
      error: () => {
        this.isRejectingTask[task.id] = false;
        this.hideLoadingOverlay();
        this.showDeleteModal = false;
        this.taskToDelete = null;
        this.showNotificationMessage('Error al rechazar la tarea', 'error');
        this.loadTasks();
      }
    });
  }

  onConfirmDeleteTask(task: Task) {
    // Verificar que la tarea no esté terminada
    if (this.isTaskCompleted(task)) {
      this.showNotificationMessage('No se puede eliminar una tarea terminada.', 'warning');
      return;
    }
    this.taskToDelete = task;
    this.showDeleteModal = true;
  }

  cancelDeleteTask() {
    this.showDeleteModal = false;
    this.taskToDelete = null;
  }

  confirmDeleteTask() {
    if (this.taskToDelete) {
      this.onDeleteTask(this.taskToDelete);
    }
    this.showDeleteModal = false;
    this.taskToDelete = null;
  }

  onStartEditTask(task: Task) {
    // Verificar que la tarea no esté terminada
    if (this.isTaskCompleted(task)) {
      this.showNotificationMessage('No se puede editar una tarea terminada.', 'warning');
      return;
    }
    console.log('🔧 === INICIANDO EDICIÓN DE TAREA ===');
    console.log('📋 Datos de la tarea original:', task);
    this.editingTask = { ...task };
    console.log('📋 Datos de editingTask después de copia:', this.editingTask);
  }

  onCancelEditTask() {
    this.showConfirmExitModal = true;
    this.pendingExitAction = () => {
      this.editingTask = null;
    };
  }

  onEditTask(updatedTask: any) {
    if (!this.editingTask) return;
    const tarea = Array.isArray(updatedTask) ? updatedTask[0] : updatedTask;
    const id = tarea.id || this.editingTask.id;
    
    // CORRECCIÓN: Usar el dimension_total del formulario, no del invernadero
    // El usuario puede haber editado el área de trabajo específica
    const superiorId = this.loggedUser?.nombre_completo || this.name || this.userId || '';
    
    const tareaCompleta = {
      ...tarea,
      nombre_superior: superiorId,
      // Usar el dimension_total que viene del formulario de edición
      dimension_total: tarea.dimension_total || this.editingTask.dimension_total || '0',
      // CRÍTICO: Preservar el estado/progreso actual para evitar reseteo a "No iniciado"
      proceso: this.editingTask.proceso,
      desarrollo_actual: this.editingTask.desarrollo_actual,
      fecha_actualizacion: this.editingTask.fecha_actualizacion
    };
    
    this.showLoadingOverlay('Actualizando tarea...');
    
    this.taskService.updateTask(id, tareaCompleta).subscribe({
      next: (res: any) => {
        this.hideLoadingOverlay();
        this.editingTask = null;
        this.showNotificationMessage('Tarea actualizada exitosamente', 'success');
        this.pollForTaskListChange(() => {
          const t = this.tasks.find(t => t.id === id);
          return !!(t && t.tipo_tarea === tareaCompleta.tipo_tarea && t.descripcion === tareaCompleta.descripcion);
        });
      },
      error: (err) => {
        this.hideLoadingOverlay();
        if (err.status === 200) {
          this.editingTask = null;
          this.showNotificationMessage('Tarea actualizada exitosamente', 'success');
          this.pollForTaskListChange(() => {
            const t = this.tasks.find(t => t.id === id);
            return !!(t && t.tipo_tarea === tareaCompleta.tipo_tarea && t.descripcion === tareaCompleta.descripcion);
          });
        } else {
          this.showNotificationMessage('No se pudo editar la tarea. Puede que ya no exista.', 'error');
          this.editingTask = null;
          this.pollForTaskListChange(() => {
            const t = this.tasks.find(t => t.id === id);
            return !!(t && t.tipo_tarea === tareaCompleta.tipo_tarea && t.descripcion === tareaCompleta.descripcion);
          });
        }
      }
    });
  }

  onStartAddTask() {
    this.isAddingTask = true;
  }

  onCancelAddTask() {
    this.showConfirmExitModal = true;
    this.pendingExitAction = () => {
      this.isAddingTask = false;
    };
  }

  onAddTask(taskData: any) {
    // taskData es un array de tareas. Agregar nombre_superior a cada una
    const superiorId = this.loggedUser?.nombre_completo || this.name || this.userId || '';
    
    const tareasConSuperior = Array.isArray(taskData) 
      ? taskData.map(tarea => ({
          ...tarea,
          nombre_superior: superiorId
        }))
      : [{
          ...taskData,
          nombre_superior: superiorId
        }];
    
    const taskCount = Array.isArray(tareasConSuperior) ? tareasConSuperior.length : 1;
    this.showLoadingOverlay(`Creando ${taskCount} tarea${taskCount > 1 ? 's' : ''}...`);
    
    this.taskService.addTask(tareasConSuperior, this.loggedUser?.nombre_completo || this.userId).subscribe({
      next: () => {
        this.hideLoadingOverlay();
        this.isAddingTask = false;
        this.loadTasks();
        this.showNotificationMessage(`${taskCount} tarea${taskCount > 1 ? 's' : ''} creada${taskCount > 1 ? 's' : ''} exitosamente`, 'success');
      },
      error: (err) => {
        this.hideLoadingOverlay();
        if (err.status === 200) {
          this.isAddingTask = false;
          this.loadTasks();
          this.showNotificationMessage(`${taskCount} tarea${taskCount > 1 ? 's' : ''} creada${taskCount > 1 ? 's' : ''} exitosamente`, 'success');
        } else {
          this.showNotificationMessage('Error al crear las tareas', 'error');
        }
      }
    });
  }

  onAcceptTask(task: Task) {
    // Verificar que la tarea no esté terminada
    if (this.isTaskCompleted(task)) {
      this.showNotificationMessage('No se puede aceptar una tarea terminada.', 'warning');
      return;
    }
    
    // Evitar double-click
    if (this.isAcceptingTask[task.id]) return;
    
    this.isAcceptingTask[task.id] = true;
    this.showLoadingOverlay('Aceptando tarea...');
    
    this.taskService.acceptTask(task.id).subscribe({
      next: () => {
        console.log('Tarea aceptada correctamente');
        this.isAcceptingTask[task.id] = false;
        this.hideLoadingOverlay();
        this.showNotificationMessage('Tarea aceptada exitosamente', 'success');
        this.loadTasks(); // Recargar para ver cambios
      },
      error: (err) => {
        console.error('Error al aceptar tarea:', err);
        this.isAcceptingTask[task.id] = false;
        this.hideLoadingOverlay();
        this.showNotificationMessage('Error al aceptar la tarea. Inténtalo de nuevo.', 'error');
      }
    });
  }

  onOpenProgressModal(task: Task) {
    // Verificar que la tarea no esté terminada
    if (this.isTaskCompleted(task)) {
      this.showNotificationMessage('No se puede actualizar el progreso de una tarea terminada.', 'warning');
      return;
    }
    
    // Verificar si la tarea ya fue actualizada hoy
    if (this.isTaskUpdatedToday(task)) {
      this.showNotificationMessage('Esta tarea ya fue actualizada hoy. Podrá actualizarla mañana.', 'warning');
      return;
    }
    
    this.taskToComplete = task;
    // Usar el porcentaje real de progreso si existe, si no, 0
    this.progressValue = Number(task.progreso) || 0;
    this.jornalesRealesValue = 0; // Siempre empezar vacío para que el encargado ingrese las horas del día
    
    // Resetear validación de trabajadores
    this.trabajadoresValidados = false;
    this.trabajadoresAsignados = [];
    
    // Si está en modo kilos, inicializar kilos recogidos desde desarrollo_actual
    if (this.isKilosMode(task)) {
      this.kilosRecogidosValue = Number(task.desarrollo_actual) || 0;
    } else {
      // Si está en modo hectáreas, calcular hectáreas trabajadas basado en el progreso actual
      const totalHectares = this.parseDimension(task.dimension_total);
      this.hectareasTrabajadasValue = (totalHectares * this.progressValue) / 100;
    }
    
    this.showCompleteModal = true;
  }

  onUpdateProgressOnly() {
    if (!this.taskToComplete || this.isProcessing) return;
    // Verificar si la tarea ya fue actualizada hoy
    if (this.isTaskUpdatedToday(this.taskToComplete)) {
      this.showNotificationMessage('Esta tarea ya fue actualizada hoy. Podrá actualizarla mañana.', 'warning');
      return;
    }
    // Solo permitir actualizar si el progreso subió
    const minProgress = this.getMinProgress();
    if (!this.isKilosMode(this.taskToComplete) && Number(this.progressValue) === Number(minProgress)) {
      this.showNotificationMessage('Debes mover la barra de progreso para actualizar.', 'warning');
      return;
    }
    this.isProcessing = true;
    // Validar que se haya ingresado el número de horas reales
    if (!this.jornalesRealesValue || this.jornalesRealesValue <= 0) {
      this.showNotificationMessage('Por favor, ingresa el número de horas realmente trabajadas.', 'warning');
      this.isProcessing = false;
      return;
    }
    // Validar que se hayan asignado trabajadores
    if (!this.canProceedWithUpdate()) {
      this.showNotificationMessage('Debe asignar trabajadores y validar que las horas cuadren antes de actualizar el progreso.', 'warning');
      this.isProcessing = false;
      return;
    }
    let progressValue: number | string;
    let desarrolloValue: number;
    if (this.isKilosMode(this.taskToComplete)) {
      // MODO KILOS: Solo registrar kilos recogidos sin calcular porcentaje ni meta
      if (!this.kilosRecogidosValue || this.kilosRecogidosValue <= 0) {
        this.showNotificationMessage('Por favor, ingresa los kilos recogidos.', 'warning');
        this.isProcessing = false;
        return;
      }
      // En modo kilos: progreso siempre permanece como "Iniciada"
      progressValue = "Iniciada";
      desarrolloValue = this.kilosRecogidosValue;
      console.log(`MODO KILOS: ${this.kilosRecogidosValue} kg registrados (progreso: Iniciada)`);
    } else {
      // MODO HECTÁREAS: Solo permitir aumentar el progreso
      if (this.progressValue < minProgress) {
        this.progressValue = minProgress;
        this.showNotificationMessage('No puedes bajar el progreso de la tarea.', 'warning');
        this.isProcessing = false;
        return;
      }
      const totalHectares = this.parseDimension(this.taskToComplete.dimension_total);
      const hectareasActuales = (totalHectares * this.progressValue) / 100;
      progressValue = this.progressValue;
      desarrolloValue = hectareasActuales;
      console.log(`MODO HECTÁREAS: ${this.progressValue}% = ${hectareasActuales}/${totalHectares} Ha`);
    }
    this.showLoadingOverlay('Actualizando progreso...');
    this.taskService.updateTaskProgress(this.taskToComplete.id, progressValue, desarrolloValue, this.jornalesRealesValue, this.trabajadoresAsignados, this.name).subscribe({
      next: () => {
        console.log('Progreso actualizado correctamente');
        this.hideLoadingOverlay();
        this.showCompleteModal = false;
        this.taskToComplete = null;
        this.progressValue = 0;
        this.jornalesRealesValue = 0;
        this.kilosRecogidosValue = 0;
        this.hectareasTrabajadasValue = 0;
        this.loadTasks();
        this.isProcessing = false;
        this.showNotificationMessage('Progreso actualizado correctamente', 'success');
      },
      error: (err: any) => {
        console.error('Error al actualizar progreso:', err);
        this.hideLoadingOverlay();
        this.showNotificationMessage('Error al actualizar el progreso. Inténtalo de nuevo.', 'error');
        this.isProcessing = false;
      }
    });
  }

  onConfirmCompleteTask() {
    if (!this.taskToComplete || this.isProcessing) return;
    
    // Verificar si la tarea ya fue actualizada hoy
    if (this.isTaskUpdatedToday(this.taskToComplete)) {
      this.showNotificationMessage('Esta tarea ya fue actualizada hoy. Podrá completarla mañana.', 'warning');
      return;
    }
    
    this.isProcessing = true;
    
    // Validar que se haya ingresado el número de horas reales
    if (!this.jornalesRealesValue || this.jornalesRealesValue <= 0) {
      this.showNotificationMessage('Por favor, ingresa el número de horas realmente trabajadas para completar la tarea.', 'warning');
      this.isProcessing = false;
      return;
    }

    // Validar que se hayan asignado trabajadores
    if (!this.canProceedWithUpdate()) {
      this.showNotificationMessage('Debe asignar trabajadores y validar que las horas cuadren antes de completar la tarea.', 'warning');
      this.isProcessing = false;
      return;
    }
    
    let progressValue: number | string = 100;
    let desarrolloValue: number;
    
    if (this.isKilosMode(this.taskToComplete)) {
      // MODO KILOS: Sin restricciones de meta, solo registrar kilos recogidos
      // Para completar, mantener como "Iniciada" hasta que se termine
      progressValue = "Iniciada"; // Mantener "Iniciada" incluso al completar
      desarrolloValue = this.kilosRecogidosValue || 0;
      console.log(`COMPLETANDO MODO KILOS: ${desarrolloValue} kg recogidos (progreso: Iniciada)`);
    } else {
      // MODO HECTÁREAS: Validar que el progreso sea 100%
      if (this.progressValue !== 100) {
        this.showNotificationMessage('Para completar la tarea el progreso debe estar al 100%.', 'warning');
        this.isProcessing = false;
        return;
      }
      const totalHectares = this.parseDimension(this.taskToComplete.dimension_total);
      desarrolloValue = totalHectares; // 100% = todas las hectáreas
      console.log(`COMPLETANDO MODO HECTÁREAS: ${desarrolloValue} Ha (100%)`);
    }
    
    this.showLoadingOverlay('Terminando tarea...');
    
    // Completar directamente (actualizar progreso al 100% y completar en una sola operación)
    this.taskService.completeTaskDirect(this.taskToComplete.id, progressValue, desarrolloValue, this.jornalesRealesValue, this.trabajadoresAsignados, this.name).subscribe({
        next: () => {
          console.log('Tarea completada correctamente (operación única)');
          this.hideLoadingOverlay();
          this.showCompleteModal = false;
          this.taskToComplete = null;
          this.progressValue = 0;
          this.jornalesRealesValue = 0; // Limpiar jornales reales
          this.kilosRecogidosValue = 0; // Limpiar kilos recogidos
          this.hectareasTrabajadasValue = 0; // Limpiar hectáreas trabajadas
          this.loadTasks(); // Recargar para ver cambios
          this.isProcessing = false;
          this.showNotificationMessage('Tarea completada correctamente', 'success');
        },
        error: (err: any) => {
          console.error('Error al completar tarea:', err);
          this.hideLoadingOverlay();
          this.showNotificationMessage('Error al completar la tarea. Inténtalo de nuevo.', 'error');
          this.isProcessing = false;
        }
      });
  }

  onCancelCompleteTask() {
    this.showCompleteModal = false;
    this.taskToComplete = null;
    this.progressValue = 0;
    this.jornalesRealesValue = 0; // Limpiar jornales reales
  }

  onModalOverlayClick(event: MouseEvent) {
    // Cerrar modal al hacer clic en el overlay (fuera del modal)
    this.showConfirmExitModal = true;
    this.pendingExitAction = () => {
      this.onCancelCompleteTask();
    };
  }
  onConfirmExit() {
    if (this.pendingExitAction) {
      this.pendingExitAction();
    }
    this.showConfirmExitModal = false;
    this.pendingExitAction = null;
  }

  onCancelExit() {
    this.showConfirmExitModal = false;
    this.pendingExitAction = null;
  }

  onDeleteModalOverlayClick(event: MouseEvent) {
    // Cerrar modal de borrar al hacer clic en el overlay
    this.cancelDeleteTask();
  }

  getHectaresFromProgress(): string {
    if (!this.taskToComplete?.dimension_total) return '0';
    
    const totalHectares = this.parseDimension(this.taskToComplete.dimension_total);
    if (totalHectares === 0) return '0';
    
    const currentHectares = (totalHectares * this.progressValue) / 100;
    
    // Usar el mismo formato que formatDimensionTotal para consistencia
    return this.formatDimensionTotal(currentHectares);
  }

  // Verificar si la tarea está en modo kilos (horas_kilos = 1)
  isKilosMode(task: Task | null): boolean {
    if (!task) return false;
    // Comparación flexible para manejar tanto números como strings
    const horasKilos = task.horas_kilos;
    return horasKilos == 1 || String(horasKilos) === '1' || Number(horasKilos) === 1;
  }

  // Determinar si debe mostrar género en lugar de estimación de jornales
  shouldShowGeneroInsteadOfJornales(task: Task | null): boolean {
    if (!task) return false;
    // Mostrar género si es tarea de kilos (almacén) Y tiene género
    return this.isKilosMode(task) && !!(task.genero && task.genero.trim() !== '');
  }

  // Detectar si es tarea de recolección (campo con kilos)
  isRecoleccionTask(task: Task | null): boolean {
    if (!task) return false;
    const recoleccionKeywords = ['recolección', 'recoleccion', 'cosecha', 'recoger', 'cosech', 'recolect'];
    const taskName = task.tipo_tarea.toLowerCase();
    return recoleccionKeywords.some(keyword => taskName.includes(keyword));
  }

  // Determinar si es una tarea de almacén real (NO solo por kilos)
  isAlmacenTask(task: Task | null): boolean {
    if (!task) return false;
    
    // Si el usuario pertenece al grupo ALMACEN, todas sus tareas son de almacén
    if (this.loggedUser?.grupo_trabajo === 'ALMACEN') {
      return true;
    }
    
    // Si es tarea de recolección, NO es de almacén (aunque use kilos)
    // EXCEPCIÓN: A menos que el usuario sea del grupo ALMACEN
    if (this.isRecoleccionTask(task)) {
      return false;
    }
    
    // Una tarea es de almacén si:
    // 1. Usa kilos (horas_kilos = 1) Y
    // 2. Tiene género (indica que es ALMACEN-CONFECC) O
    // 3. Es específicamente una tarea de almacén por tipo
    const usaKilos = this.isKilosMode(task);
    const tieneGenero = !!(task.genero && task.genero.trim() !== '');
    const esAlmacenPorTipo = !!(task.tipo_tarea && (
      task.tipo_tarea.toLowerCase().includes('almac') ||
      task.tipo_tarea.toLowerCase().includes('confec') ||
      task.tipo_tarea.toLowerCase().includes('género')
    ));
    
    // Solo es almacén si usa kilos Y (tiene género O es tipo almacén)
    // Las tareas de recolección usan kilos pero NO son de almacén
    return usaKilos && (tieneGenero || esAlmacenPorTipo);
  }

  trackById(index: number, item: Task) {
    return item.id;
  }

  isNumber(value: any): boolean {
    return !isNaN(Number(value));
  }

  toNumber(value: any): number {
    return Number(value);
  }
  
  // Método para validar tareas urgentes (solo superiores) - mantenido para compatibilidad
  onValidateUrgentTask(task: Task) {
    this.onValidateUrgentTaskNew(task);
  }
  
  // Método para extraer trabajadores de la descripción de la tarea
  extraerTrabajadoresDeTarea(task: Task): any[] {
    try {
      // Buscar trabajadores en la descripción (formato: descripcion||WORKERS:json)
      const descripcion = task.descripcion || '';
      const workersPart = descripcion.split('||WORKERS:')[1];
      
      if (workersPart) {
        const trabajadoresData = JSON.parse(workersPart);
        console.log('👥 Trabajadores encontrados en tarea:', trabajadoresData);
        return trabajadoresData;
      }
      
      console.log('⚠️ No se encontraron trabajadores en la tarea, usando datos por defecto');
      return [];
    } catch (error) {
      console.error('❌ Error extrayendo trabajadores:', error);
      return [];
    }
  }

  // ===== MÉTODOS PARA SELECTORES DE TAREA URGENTE =====
  
  toggleUrgentInvernadero() {
    this.isUrgentInvernaderoOpen = !this.isUrgentInvernaderoOpen;
    if (this.isUrgentInvernaderoOpen) {
      this.isUrgentTipoOpen = false;
      this.loadUrgentInvernaderos();
      this.filterUrgentInvernaderos();
    }
  }
  
  toggleUrgentTipo() {
    this.isUrgentTipoOpen = !this.isUrgentTipoOpen;
    if (this.isUrgentTipoOpen) {
      this.isUrgentInvernaderoOpen = false;
      if (this.allUrgentTipos.length === 0) {
        this.loadUrgentTiposTarea();
      } else {
        this.filterUrgentTipos();
      }
    }
  }
  
  loadUrgentInvernaderos() {
    // Siempre cargar todos los cabezales y sus invernaderos para el acordeón
    this.greenhouseService.getGreenhousesGrouped().subscribe({
      next: (data) => {
        // Obtener los cabezales del usuario (pueden ser varios separados por ';')
        let userCabezalStr = this.loggedUser?.cabezal || '';
        let userCabezales = userCabezalStr.split(';').map(c => c.trim()).filter(Boolean);
        // Filtrar solo los cabezales a los que pertenece el usuario
        this.urgentInvernaderosByCabezal = data.cabezales
          .filter(cabezal => userCabezales.includes(cabezal.nombre))
          .map(cabezal => ({
            nombre: cabezal.nombre,
            invernaderos: cabezal.invernaderos.map(inv => ({
              nombre: inv.nombre,
              dimensiones: parseFloat((typeof inv.dimensiones === 'string' ? inv.dimensiones : String(inv.dimensiones)).replace(',', '.')) || 0
            }))
          }));
        // No expandir ningún cabezal por defecto
        this.expandedCabezalIndices = new Set();
        console.log('🚨 urgentInvernaderosByCabezal (filtrado):', this.urgentInvernaderosByCabezal);
        // Flat list para compatibilidad
        const invernaderos = this.urgentInvernaderosByCabezal.flatMap(cabezal => cabezal.invernaderos);
        this.allUrgentInvernaderos = invernaderos.map(inv => inv.nombre).sort();
        this.urgentInvernaderosWithDimensions = invernaderos.map(inv => ({
          nombre: inv.nombre,
          dimensiones: parseFloat((typeof inv.dimensiones === 'string' ? inv.dimensiones : String(inv.dimensiones)).replace(',', '.')) || 0
        }));
        this.filterUrgentInvernaderos();
      },
      error: (err) => {
        console.error('Error cargando invernaderos agrupados:', err);
        // Fallback: intentar cargar todos los invernaderos planos
        this.loadAllUrgentInvernaderosFallback();
      }
    });
  }
  
  loadUrgentTiposTarea() {
    // Cargar tipos de tarea por grupo_trabajo del usuario
    if (this.loggedUser?.grupo_trabajo) {
      this.http.get<TipoTarea[]>(`${environment.apiBaseUrl}/tipos-tarea/${this.loggedUser.grupo_trabajo}`).subscribe({
        next: (tiposTarea) => {
          // 🏪 Almacenar objetos completos para acceso a familia
          this.allTiposTareaObjects = tiposTarea;
          console.log('🏪 TODOS los tipos de tarea cargados:', tiposTarea);
          console.log('🏪 Tareas ALMACEN-CONFECC encontradas:', 
            tiposTarea.filter(t => t.familia === 'ALMACEN-CONFECC')
          );
          console.log('🏪 Todas las familias únicas:', [...new Set(tiposTarea.map(t => t.familia))]);
          
          // Crear estructura jerárquica: tipo -> subtipos
          const tiposMap = new Map<string, string[]>();
          
          tiposTarea.forEach(tarea => {
            if (tarea.tipo) {
              if (!tiposMap.has(tarea.tipo)) {
                tiposMap.set(tarea.tipo, []);
              }
              if (tarea.subtipo) {
                tiposMap.get(tarea.tipo)!.push(tarea.subtipo);
              }
            }
          });
          
          // Convertir a array jerárquico para el dropdown
          this.urgentTiposJerarquicos = Array.from(tiposMap.entries()).map(([tipo, subtipos]) => ({
            tipo,
            subtipos: subtipos.sort(),
            hasSubtipos: subtipos.length > 0
          })).sort((a, b) => a.tipo.localeCompare(b.tipo));
          
          this.filterUrgentTipos();
        },
        error: (err) => {
          console.error('Error cargando tipos de tarea por grupo_trabajo:', err);
          // Fallback: usar tipos predefinidos
          this.allUrgentTipos = [
            'Reparación urgente',
            'Limpieza imprevista', 
            'Mantenimiento correctivo',
            'Control de plagas urgente',
            'Riego de emergencia',
            'Fertilización urgente',
            'Reparación de sistemas',
            'Limpieza de equipos',
            'Revisión técnica',
            'Trabajo de emergencia',
            'Otro'
          ];
          this.filterUrgentTipos();
        }
      });
    } else {
      // Fallback: usar tipos predefinidos
      this.allUrgentTipos = [
        'Reparación urgente',
        'Limpieza imprevista',
        'Mantenimiento correctivo', 
        'Control de plagas urgente',
        'Riego de emergencia',
        'Fertilización urgente',
        'Reparación de sistemas',
        'Limpieza de equipos',
        'Revisión técnica',
        'Trabajo de emergencia',
        'Otro'
      ];
      this.filterUrgentTipos();
    }
  }
  
  filterUrgentInvernaderos() {
    if (!this.urgentInvernaderoSearch.trim()) {
      this.filteredUrgentInvernaderos = [...this.allUrgentInvernaderos];
    } else {
      const search = this.urgentInvernaderoSearch.toLowerCase();
      this.filteredUrgentInvernaderos = this.allUrgentInvernaderos.filter(inv => 
        inv.toLowerCase().includes(search)
      );
    }
  }
  
  filterUrgentTipos() {
    if (!this.urgentTipoSearch.trim()) {
      this.filteredUrgentTiposJerarquicos = [...this.urgentTiposJerarquicos];
    } else {
      const search = this.urgentTipoSearch.toLowerCase();
      this.filteredUrgentTiposJerarquicos = this.urgentTiposJerarquicos
        .map(grupo => ({
          ...grupo,
          subtipos: grupo.subtipos.filter(subtipo => 
            subtipo.toLowerCase().includes(search) || grupo.tipo.toLowerCase().includes(search)
          )
        }))
        .filter(grupo => 
          grupo.tipo.toLowerCase().includes(search) || 
          grupo.subtipos.length > 0 ||
          !grupo.hasSubtipos
        );
    }
  }
  
  selectUrgentInvernadero(invernadero: string) {
    console.log('🚨 selectUrgentInvernadero - Seleccionando:', invernadero);
    this.urgentTask.invernadero = invernadero;
    // Buscar directamente en urgentInvernaderosWithDimensions para obtener el área máxima
    const invData = this.urgentInvernaderosWithDimensions.find(inv => inv.nombre === invernadero);
    const maxArea = invData ? invData.dimensiones : 0;
    // Inicializar al 100% del área si hay área, si no, 0
    if (maxArea > 0) {
      this.urgentTask.hectareas_trabajadas = maxArea;
    } else {
      this.urgentTask.hectareas_trabajadas = 0;
    }
    this.syncUrgentDimensionValues();
    this.isUrgentInvernaderoOpen = false;
    this.urgentInvernaderoSearch = '';
    this.filterUrgentInvernaderos();
    console.log('🚨 selectUrgentInvernadero - Invernadero:', invernadero, 'Área máxima:', maxArea);
  }
  
  selectUrgentTipo(tipo: string) {
  this.isUrgentTipoOpen = false;
  this.urgentTipoSearch = '';

  // 🏪 Buscar la tarea seleccionada para verificar si es ALMACEN-CONFECC
  // El tipo puede venir como "Tipo - Subtipo" o como "Tipo" solo
  let tipoToSearch = tipo;
  let subtipoToSearch = '';

  if (tipo.includes(' - ')) {
    const parts = tipo.split(' - ');
    tipoToSearch = parts[0];
    subtipoToSearch = parts[1];
  }

  this.selectedTipoTarea = this.allTiposTareaObjects.find(t => {
    const matchTipoSubtipo = t.tipo === tipoToSearch && t.subtipo === subtipoToSearch;
    const matchTareaNombre = t.tarea_nombre === tipo;
    const constructedName = t.subtipo ? `${t.tipo} - ${t.subtipo}` : t.tipo;
    const matchConstructed = constructedName === tipo;
    return matchTipoSubtipo || matchTareaNombre || matchConstructed;
  }) || null;

  // Guardar el nombre real de la tarea
  this.urgentTask.tipo_tarea = this.selectedTipoTarea?.tarea_nombre || tipo;

  // Resetear hectáreas/kilos cuando cambia el tipo de tarea
  if (this.urgentTask.tipo_tarea === 'Recolectar') {
    // Para recolectar: empezar desde 0 kilos
    this.urgentTask.hectareas_trabajadas = 0;
    this.urgentTask.desarrollo_actual = 0;
    this.urgentTask.dimension_total = 0;
  } else {
    // Para otras tareas: empezar con el 100% del invernadero
    const maxArea = this.getSelectedInvernaderoMaxArea();
    this.urgentTask.hectareas_trabajadas = maxArea;
    this.urgentTask.desarrollo_actual = maxArea;
    this.urgentTask.dimension_total = maxArea;
  }

  if (this.shouldShowGeneroSelector()) {
    this.loadGenerosConfecc();
  }
  }

  // 🏪 Métodos para género de confección (ALMACÉN)
  isUserAlmacen(): boolean {
    console.log('🏪 Verificando usuario ALMACÉN:', {
      grupo_trabajo: this.loggedUser?.grupo_trabajo,
      isAlmacen: this.loggedUser?.grupo_trabajo === 'ALMACEN'
    });
    return this.loggedUser?.grupo_trabajo === 'ALMACEN';
  }

  shouldShowGeneroSelector(): boolean {
    const isAlmacen = this.isUserAlmacen();
    const hasTarea = !!this.selectedTipoTarea;
    const isConfecc = this.selectedTipoTarea?.familia === 'ALMACEN-CONFECC';
    
    console.log('🏪 Verificando mostrar género selector:', {
      isAlmacen,
      hasTarea,
      selectedTarea: this.selectedTipoTarea?.tarea_nombre,
      familia: this.selectedTipoTarea?.familia,
      isConfecc,
      shouldShow: isAlmacen && hasTarea && isConfecc
    });
    
    return !!(isAlmacen && hasTarea && isConfecc);
  }

  loadGenerosConfecc() {
    if (!this.shouldShowGeneroSelector()) return;
    
    console.log('🏪 Cargando géneros de confección...');
    this.http.get<string[]>(`${environment.apiBaseUrl}/generos-confecc`).subscribe({
      next: (generos) => {
        console.log('🏪 Géneros recibidos del backend:', generos);
        this.generosConfecc = generos;
        this.filteredGeneros = [...generos];
        console.log('🏪 Géneros de confección cargados:', generos.length);
      },
      error: (err) => {
        console.error('🏪 Error cargando géneros de confección:', err);
        this.generosConfecc = [];
        this.filteredGeneros = [];
      }
    });
  }

  toggleGenero() {
    this.isGeneroOpen = !this.isGeneroOpen;
    if (this.isGeneroOpen) {
      this.generoSearch = '';
      this.filteredGeneros = [...this.generosConfecc];
    }
  }

  filterGeneros() {
    if (!this.generoSearch.trim()) {
      this.filteredGeneros = [...this.generosConfecc];
    } else {
      const search = this.generoSearch.toLowerCase();
      this.filteredGeneros = this.generosConfecc.filter(genero =>
        genero.toLowerCase().includes(search)
      );
    }
  }

  selectGenero(genero: string) {
    this.selectedGenero = genero;
    this.isGeneroOpen = false;
    this.generoSearch = '';
  }

  buildUrgentTaskDescription(): string {
    let descripcion = this.urgentTask.descripcion?.trim() || '';
    
    // Si es una tarea de confección, agregar el género a la descripción
    if (this.shouldShowGeneroSelector() && this.selectedGenero) {
      if (descripcion) {
        descripcion += ` - Género: ${this.selectedGenero}`;
      } else {
        descripcion = `Género: ${this.selectedGenero}`;
      }
    }
    
    return descripcion;
  }

  resetUrgentTask() {
    this.urgentTask = {
      invernadero: '',
      tipo_tarea: '',
      horas_trabajadas: 0,
      descripcion: '',
      hectareas_trabajadas: 0,
      dimension_total: 0,
      desarrollo_actual: 0
      ,
      matricula: ''
    };
    this.urgentTaskWorkers = [];
    this.isUrgentTaskWorkersMode = false;
    
    // 🏪 Reset específico para género de confección
    this.selectedGenero = '';
    this.selectedTipoTarea = null;
    this.isGeneroOpen = false;
    this.generoSearch = '';
    this.filteredGeneros = [];
  }

  // Cargar encargados del mismo cabezal para validación de tareas urgentes
  loadEncargadosDelCabezal() {
    if (!this.loggedUser?.grupo_trabajo) {
      console.log('⚠️ Usuario sin grupo_trabajo, saltando carga de encargados del cabezal');
      this.loadTasks();
      return;
    }
    
    if (!this.loggedUser?.cabezal) {
      console.log('⚠️ Usuario sin cabezal específico, saltando carga de encargados del cabezal');
      this.loadTasks();
      return;
    }

    // Cargar tanto encargados como invernaderos del cabezal
    const encargadosRequest = this.http.get<any[]>(`${environment.apiBaseUrl}/encargados/${this.loggedUser.grupo_trabajo}/${this.loggedUser.cabezal}`);
    const invernaderosRequest = this.greenhouseService.getGreenhousesByCabezal(this.loggedUser.cabezal);
    
    // Ejecutar ambas peticiones en paralelo
    forkJoin({
      encargados: encargadosRequest,
      invernaderos: invernaderosRequest
    }).subscribe({
      next: ({ encargados, invernaderos }) => {
        this.encargadosDelCabezal = encargados.map(e => e.nombre_completo || e.nombre || e.id).filter(Boolean);
        console.log('Encargados del cabezal cargados:', this.encargadosDelCabezal);
        
        // Extraer nombres de invernaderos del cabezal
        this.invernaderosDelCabezal = invernaderos.cabezales
          .flatMap(cabezal => cabezal.invernaderos)
          .map(inv => inv.nombre);
        console.log('Invernaderos del cabezal cargados:', this.invernaderosDelCabezal);
        
        // Recargar tareas para aplicar el filtrado con la nueva información
        this.loadTasks();
      },
      error: (err) => {
        console.error('Error cargando datos del cabezal:', err);
        this.encargadosDelCabezal = [];
        this.invernaderosDelCabezal = [];
        // Recargar tareas aunque haya error
        this.loadTasks();
      }
    });
  }

  // Verificar si una tarea pertenece al cabezal del usuario
  isTaskInUserCabezal(task: Task): boolean {
    if (!task.invernadero || this.invernaderosDelCabezal.length === 0) {
      return false;
    }
    
    return this.invernaderosDelCabezal.includes(task.invernadero);
  }

  // Método para detectar si una tarea está vencida
  isTaskOverdue(task: Task): boolean {
    // Solo considerar vencidas las tareas que NO están terminadas
    if (this.isTaskCompleted(task)) {
      return false;
    }
    
    // Verificar si tiene fecha límite
    if (!task.fecha_limite) {
      return false;
    }
    
    // Usar el DateFormatService que maneja correctamente los formatos de fecha
    return this.dateFormatService.isDateOverdue(task.fecha_limite);
  }

  // Formatear dimension_total para mostrar con coma decimal (hasta 4 decimales)
  formatDimensionTotal(value: string | number): string {
    if (!value || value === 0) return '0,00';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // Si es NaN o 0, mostrar 0,00
    if (isNaN(numValue) || numValue === 0) return '0,00';
    
    // Mostrar hasta 4 decimales, eliminando ceros innecesarios al final
    let formatted = numValue.toFixed(4);
    
    // Eliminar ceros innecesarios al final
    formatted = formatted.replace(/\.?0+$/, '');
    
    // Si no hay decimales, agregar ",00"
    if (!formatted.includes('.')) {
      formatted += '.00';
    }
    
    // Reemplazar punto por coma
    return formatted.replace('.', ',');
  }

  // Método helper para convertir dimensión a número de manera consistente
  private parseDimension(value: any): number {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    // Convertir string a número manejando comas europeas
    return parseFloat(String(value).replace(',', '.')) || 0;
  }

  // Método público para obtener el máximo de hectáreas (para usar en template)
  getMaxHectares(task: Task | null): number {
    if (!task) return 0;
    return this.parseDimension(task.dimension_total);
  }

  // Método para mostrar progreso detallado como "7,8/14,35 (45%)"
  getDetailedProgress(task: any): string {
    const estado = this.getTaskState(task);
    if (!task.dimension_total || !task.desarrollo_actual || !estado) {
      return '';
    }

    // Solo mostrar para tareas con progreso numérico (no "No iniciado", "Terminada", etc.)
    const progressNum = parseFloat(estado);
    if (isNaN(progressNum)) {
      return '';
    }

    const desarrolloActual = this.formatDimensionTotal(task.desarrollo_actual);
    const dimensionTotal = this.formatDimensionTotal(task.dimension_total);
    
    return `${desarrolloActual}/${dimensionTotal} (${estado}%)`;
  }



  // Obtener información de última actualización (solo informativo, sin restricciones)
  getLastUpdateInfo(task: any): string {
    if (!task.fecha_actualizacion) return '';
    return `Última actualización: ${task.fecha_actualizacion}`;
  }

  // Métodos para asignación de trabajadores
  onOpenWorkersModal(): void {
    if (this.jornalesRealesValue <= 0) {
      this.showNotificationMessage('Primero debe especificar las horas realmente trabajadas.', 'warning');
      return;
    }
    this.showWorkersModal = true;
  }

  onCloseWorkersModal(): void {
    this.showWorkersModal = false;
    this.isUrgentTaskWorkersMode = false; // Resetear flag
  }

  onSaveWorkerAssignments(asignaciones: TrabajadorAsignado[]): void {
    if (this.isUrgentTaskWorkersMode) {
      // Modo tarea urgente
      this.urgentTaskWorkers = asignaciones;
      this.isUrgentTaskWorkersMode = false;
      console.log('Trabajadores asignados a tarea urgente:', asignaciones);
    } else {
      // Modo tarea normal
      this.trabajadoresAsignados = asignaciones;
    }
    
    this.trabajadoresValidados = true;
    this.showWorkersModal = false;
  }

  // Verificar si se pueden actualizar/completar las tareas
  canProceedWithUpdate(): boolean {
    const basicValidation = this.trabajadoresValidados && this.jornalesRealesValue > 0;
    
    // Si la tarea ya fue actualizada hoy, no se puede actualizar de nuevo
    if (this.taskToComplete && this.isTaskUpdatedToday(this.taskToComplete)) {
      return false;
    }
    
    return basicValidation;
  }

  // Obtener el estado unificado de la tarea (solo proceso ahora)
  getTaskState(task: Task): string {
    return task.proceso || 'No iniciado';
  }

  // Verificar si una tarea está terminada (unificando ambos campos)
  isTaskCompleted(task: Task): boolean {
    return this.getTaskState(task) === 'Terminada';
  }

  // Verificar si es tarea urgente: detectar por características únicas
  isUrgentTask(task: Task): boolean {
    // Tareas urgentes tienen características específicas:
    // - hora_jornal === 0 (sin cálculos de división)
    // - jornales_reales > 0 (ya tienen horas desde la creación)
    // - proceso === 'Por validar' (estado inicial de urgentes) O 'Terminada' (si ya fueron validadas)
    const horaJornal = Number(task.hora_jornal) || 0;
    const jornalesReales = Number(task.jornales_reales) || 0;
    const estadoUrgente = task.proceso === 'Por validar' || 
                         (task.proceso === 'Terminada' && jornalesReales > 0 && horaJornal === 0);
    
    return horaJornal === 0 && jornalesReales > 0 && estadoUrgente;
  }

  getWorkersValidationMessage(): string {
    // Verificar primero si la tarea ya fue actualizada hoy
    if (this.taskToComplete && this.isTaskUpdatedToday(this.taskToComplete)) {
      return '🚫 Esta tarea ya fue actualizada hoy. Podrá actualizarla mañana.';
    }
    
    if (this.jornalesRealesValue <= 0) {
      return 'Especifique las horas trabajadas';
    }
    if (!this.trabajadoresValidados) {
      return 'Debe asignar trabajadores antes de continuar';
    }
    return `✅ ${this.trabajadoresAsignados.length} trabajador(es) asignado(s)`;
  }

  // Verificar si la tarea ya fue actualizada hoy
  isTaskUpdatedToday(task: Task): boolean {
    if (!task.fecha_actualizacion) {
      return false; // Si no tiene fecha de actualización, no ha sido actualizada
    }
    
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // La fecha_actualizacion puede venir en formato DD/MM/YYYY o YYYY-MM-DD
    let fechaActualizacion: string;
    if (task.fecha_actualizacion.includes('/')) {
      // Formato DD/MM/YYYY - convertir a YYYY-MM-DD
      const parts = task.fecha_actualizacion.split('/');
      fechaActualizacion = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    } else {
      // Formato YYYY-MM-DD o similar
      fechaActualizacion = task.fecha_actualizacion.split('T')[0]; // Solo la parte de fecha
    }
    
    return fechaActualizacion === todayString;
  }

  // Resetear validación cuando cambian las horas
  onJornalesRealesChange(): void {
    this.trabajadoresValidados = false;
    this.trabajadoresAsignados = [];
  }

  // Sincronizar hectáreas trabajadas con el porcentaje
  onHectareasTrabajadasChange(): void {
    if (!this.taskToComplete) return;
    
    const totalHectares = this.parseDimension(this.taskToComplete.dimension_total);
    if (totalHectares > 0) {
      // Calcular el porcentaje basado en las hectáreas ingresadas
      this.progressValue = Math.round((this.hectareasTrabajadasValue / totalHectares) * 100);
      
      // Asegurar que no exceda el 100%
      if (this.progressValue > 100) {
        this.progressValue = 100;
        this.hectareasTrabajadasValue = totalHectares;
      }
    }
  }

  // Sincronizar porcentaje con hectáreas trabajadas
  onProgressSliderChange(): void {
    if (!this.taskToComplete) return;
    const totalHectares = this.parseDimension(this.taskToComplete.dimension_total);
    if (totalHectares > 0) {
      // Calcular las hectáreas basado en el porcentaje
      this.hectareasTrabajadasValue = parseFloat(((totalHectares * this.progressValue) / 100).toFixed(2));
    }
  }

  // Lógica para evitar que el usuario baje del progreso actual visualmente en el slider
  onProgressSliderInput(event: Event): void {
    if (!this.taskToComplete) return;
    const min = this.getMinProgress();
    const input = event.target as HTMLInputElement;
    let value = Number(input.value);
    if (value < min) {
      value = min;
      input.value = String(min);
    }
    this.progressValue = value;
    // Sincronizar hectáreas trabajadas
    const totalHectares = this.parseDimension(this.taskToComplete.dimension_total);
    if (totalHectares > 0) {
      this.hectareasTrabajadasValue = parseFloat(((totalHectares * this.progressValue) / 100).toFixed(2));
    }
  }

  // ===== MÉTODOS PARA TRABAJADORES DE TAREAS URGENTES =====
  
  loadTaskWorkers(taskId: string): void {
    if (this.taskWorkersMap.has(taskId)) {
      return; // Ya cargado
    }

    this.http.get<any[]>(`${environment.apiBaseUrl}/trabajadores-tarea/${taskId}`).subscribe({
      next: (trabajadores) => {
        this.taskWorkersMap.set(taskId, trabajadores);
      },
      error: (err) => {
        console.error('Error cargando trabajadores de tarea:', err);
        this.taskWorkersMap.set(taskId, []); // Evitar múltiples llamadas
      }
    });
  }

  getTaskWorkers(taskId: string): any[] {
    return this.taskWorkersMap.get(taskId) || [];
  }

  hasTaskWorkers(taskId: string): boolean {
    const workers = this.getTaskWorkers(taskId);
    return workers.length > 0;
  }

  // 📊 Métodos para contar tareas por estado (usar la misma lógica que applyFilters)
  getTaskCountByEstado(estado: string): number {
    return this.tasks.filter(task => {
      switch (estado) {
        case 'sin-iniciar':
          return this.getTaskState(task) === 'No iniciado';
        case 'en-progreso':
          const estadoTask = this.getTaskState(task);
          const esIniciada = estadoTask === 'Iniciada';
          const esRecolectando = estadoTask === 'Recolectando';
          const tieneProgreso = estadoTask && !isNaN(Number(estadoTask)) && Number(estadoTask) > 0;
          return esIniciada || esRecolectando || tieneProgreso;
        case 'terminadas':
          return this.getTaskState(task) === 'Terminada';
        case 'por-validar':
          return this.getTaskState(task) === 'Por validar';
        default:
          return false;
      }
    }).length;
  }

  getPendientesCount(): number {
    return this.getTaskCountByEstado('sin-iniciar');
  }

  getEnProgresoCount(): number {
    return this.getTaskCountByEstado('en-progreso');
  }

  getTerminadasCount(): number {
    return this.getTaskCountByEstado('terminadas');
  }

  getPorValidarCount(): number {
    return this.getTaskCountByEstado('por-validar');
  }

  // ===== SISTEMA DE NOTIFICACIONES =====
  
  showNotificationMessage(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    this.notificationMessage = message;
    this.notificationType = type;
    this.showNotification = true;
    
    // Auto-ocultar después de 4 segundos
    setTimeout(() => {
      this.hideNotification();
    }, 4000);
  }
  
  hideNotification(): void {
    this.showNotification = false;
    this.notificationMessage = '';
  }
  
  // ===== OVERLAY DE CARGA GLOBAL =====
  
  showLoadingOverlay(message: string = 'Procesando...'): void {
    this.loadingMessage = message;
    this.showGlobalLoading = true;
  }
  
  hideLoadingOverlay(): void {
    this.showGlobalLoading = false;
    this.loadingMessage = '';
  }
  
  // ===== MODAL DE CONFIRMACIÓN PARA VALIDACIÓN =====
  
  onValidateUrgentTaskNew(task: Task): void {
    if (this.isEncargado) {
      this.showNotificationMessage('Solo los superiores pueden validar tareas.', 'warning');
      return;
    }
    
    this.taskToValidate = task;
    this.showValidationModal = true;
  }
  
  onConfirmValidation(): void {
    if (!this.taskToValidate) return;
    
    // Evitar double-click
    if (this.isValidatingTask[this.taskToValidate.id]) return;
    
    this.isValidatingTask[this.taskToValidate.id] = true;
    this.showLoadingOverlay('Validando tarea urgente...');
    
    console.log(`🚨 FRONTEND: Validando tarea ${this.taskToValidate.id} usando taskService.completeTask`);
    
    // 🔧 CORRECCIÓN: Usar el servicio en lugar de HTTP directo para consistencia
    this.taskService.completeTask(this.taskToValidate.id).subscribe({
      next: (response: any) => {
        console.log('✅ Tarea validada correctamente:', response);
        
        // Log de información de validación de horas si está disponible
        if (response && response.validacionHoras) {
          console.log('📊 Validación de horas automática:', response.validacionHoras);
          if (response.validacionHoras.horasValidadas > 0) {
            this.showNotificationMessage(
              `Tarea validada correctamente. ${response.validacionHoras.horasValidadas} horas validadas automáticamente.`, 
              'success'
            );
          } else {
            this.showNotificationMessage('Tarea validada exitosamente. Ahora aparece como terminada.', 'success');
          }
        } else {
          this.showNotificationMessage('Tarea validada exitosamente. Ahora aparece como terminada.', 'success');
        }
        
        this.isValidatingTask[this.taskToValidate?.id || ''] = false;
        this.hideLoadingOverlay();
        this.loadTasks();
        this.onCancelValidation();
      },
      error: (err) => {
        this.isValidatingTask[this.taskToValidate?.id || ''] = false;
        this.hideLoadingOverlay();
        console.error('❌ Error al validar tarea:', err);
        this.showNotificationMessage('Error al validar la tarea. Intenta nuevamente.', 'error');
        this.onCancelValidation();
      }
    });
  }
  
  onCancelValidation(): void {
    this.showValidationModal = false;
    this.taskToValidate = null;
  }

  // ===== MODAL DE CONSULTAS (SOLO SUPERIORES) =====
  
  onOpenConsultasModal(): void {
    if (this.isEncargado) {
      this.showNotificationMessage('Solo los superiores pueden acceder a las consultas.', 'warning');
      return;
    }
    
    this.showConsultasModal = true;
    this.loadTrabajadoresDisponibles();
    this.loadTiposTareaDisponibles();
  }
  
  onCloseConsultasModal(): void {
    this.showConsultasModal = false;
    this.resetConsultaForm();
  }
  
  onSelectConsultaTab(tab: string): void {
    this.consultaActiva = tab;
    // No resetear los resultados al cambiar de pestaña
    this.resetConsultaFormFields();
  }
  
  resetConsultaForm(): void {
    this.resetConsultaFormFields();
    // Limpiar también los resultados
    this.horasConsultaResultado = null;
    this.horasTareaResultado = null;
  }
  
  resetConsultaFormFields(): void {
    this.selectedTrabajador = '';
    this.selectedMes = '';
    this.selectedAno = new Date().getFullYear().toString();
    
    // Reset para consulta de horas por tarea
    this.selectedTipoTareaConsulta = '';
    this.selectedInvernaderoConsulta = '';
    this.selectedTareasConsulta = []; // Limpiar array de tareas múltiples
    
    // Reset para dropdown búsqueable de tareas
    this.taskSearchTerm = '';
    this.tareaSeleccionadaLabel = '';
    this.isTaskDropdownOpen = false;
    if (this.taskDropdownTimeout) {
      clearTimeout(this.taskDropdownTimeout);
    }
  }
  
  loadTrabajadoresDisponibles(): void {
    // Usar TasksService para cargar trabajadores
    this.taskService.getTrabajadores().subscribe({
      next: (trabajadores: string[]) => {
        this.trabajadoresDisponibles = trabajadores;
        console.log('Trabajadores cargados:', this.trabajadoresDisponibles);
      },
      error: (err: any) => {
        console.error('Error cargando trabajadores:', err);
        this.showNotificationMessage('Error al cargar la lista de trabajadores', 'error');
      }
    });
  }
  
  loadTiposTareaDisponibles(): void {
    // Usar el mismo enfoque que hierarchical-task-selector
    if (!this.loggedUser?.grupo_trabajo) {
      console.log('Grupo de trabajo no disponible, reintentando...');
      setTimeout(() => {
        this.loadTiposTareaDisponibles();
      }, 500);
      return;
    }

    // Usar el endpoint correcto con grupo de trabajo
    this.http.get<any[]>(`${environment.apiBaseUrl}/tipos-tarea/${this.loggedUser.grupo_trabajo}`).subscribe({
      next: (tiposTarea) => {
        console.log('Tipos de tarea recibidos del backend:', tiposTarea);
        
        // Organizar jerárquicamente: Tipo → Subtipo → Tarea
        this.organizarTareasJerarquicamente(tiposTarea);
      },
      error: (err: any) => {
        console.error('Error cargando tipos de tarea desde backend:', err);
        
        // Fallback: usar los datos ya cargados si están disponibles
        if (this.allTiposTareaObjects && this.allTiposTareaObjects.length > 0) {
          this.organizarTareasJerarquicamente(this.allTiposTareaObjects);
          console.log('Usando tipos de tarea del fallback');
        } else {
          this.showNotificationMessage('Error al cargar los tipos de tarea', 'error');
        }
      }
    });
  }

  organizarTareasJerarquicamente(tiposTarea: any[]): void {
    // Crear estructura jerárquica agrupada
    const jerarquia: any = {};
    
    tiposTarea.forEach(tarea => {
      if (!tarea.tipo || !tarea.tarea_nombre) return;
      
      const tipo = tarea.tipo;
      const subtipo = tarea.subtipo || 'Sin subtipo';
      const tareaNombre = tarea.tarea_nombre;
      
      // Crear estructura: jerarquia[tipo][subtipo][tarea]
      if (!jerarquia[tipo]) {
        jerarquia[tipo] = {};
      }
      if (!jerarquia[tipo][subtipo]) {
        jerarquia[tipo][subtipo] = [];
      }
      
      // Evitar duplicados
      if (!jerarquia[tipo][subtipo].find((t: any) => t.nombre === tareaNombre)) {
        jerarquia[tipo][subtipo].push({
          nombre: tareaNombre,
          valor: tareaNombre // El valor que se enviará al seleccionar
        });
      }
    });
    
    // Convertir a array para el template
    this.tareasJerarquicasConsulta = Object.keys(jerarquia).sort().map(tipo => ({
      tipo: tipo,
      subtipos: Object.keys(jerarquia[tipo]).sort().map(subtipo => ({
        subtipo: subtipo,
        tareas: jerarquia[tipo][subtipo].sort((a: any, b: any) => a.nombre.localeCompare(b.nombre))
      }))
    }));
    
    console.log('Tareas organizadas jerárquicamente:', this.tareasJerarquicasConsulta);
    
    // Actualizar opciones filtradas para el dropdown
    this.updateFilteredTaskOptions();
  }
  
  onConsultarHorasTrabajador(): void {
    if (!this.selectedTrabajador || !this.selectedMes || !this.selectedAno) {
      this.showNotificationMessage('Debe seleccionar trabajador, mes y año', 'warning');
      return;
    }
    
    this.isConsultandoHoras = true;
    this.showLoadingOverlay('Consultando horas trabajadas...');
    
    const mes = parseInt(this.selectedMes);
    const año = parseInt(this.selectedAno);
    
    // Usar TasksService para la consulta
    this.taskService.consultarHorasTrabajador(this.selectedTrabajador, mes, año).subscribe({
      next: (resultado: any) => {
        this.horasConsultaResultado = resultado;
        this.isConsultandoHoras = false;
        this.hideLoadingOverlay();
        console.log('Resultado consulta horas:', resultado);
        
        if (resultado.totalHoras > 0) {
          this.showNotificationMessage(`Consulta completada: ${resultado.totalHoras} horas en ${resultado.totalDias} días`, 'success');
        } else {
          this.showNotificationMessage(resultado.resumen, 'warning');
        }
      },
      error: (err: any) => {
        this.isConsultandoHoras = false;
        this.hideLoadingOverlay();
        console.error('Error en consulta:', err);
        
        if (err.status === 403) {
          this.showNotificationMessage('Acceso denegado: solo superiores pueden realizar consultas', 'error');
        } else if (err.status === 400) {
          this.showNotificationMessage('Parámetros inválidos para la consulta', 'error');
        } else {
          this.showNotificationMessage('Error al consultar las horas trabajadas', 'error');
        }
      }
    });
  }
  
  onConsultarHorasTarea(): void {
    if (!this.selectedTipoTareaConsulta || !this.selectedInvernaderoConsulta || !this.selectedMes || !this.selectedAno) {
      this.showNotificationMessage('Debe seleccionar tipo de tarea, invernadero, mes y año', 'warning');
      return;
    }
    
    this.isConsultandoHorasTarea = true;
    this.showLoadingOverlay('Consultando horas por tarea...');
    
    const mes = parseInt(this.selectedMes);
    const año = parseInt(this.selectedAno);
    
    // Usar TasksService para la consulta
    this.taskService.consultarHorasTarea(this.selectedTipoTareaConsulta, this.selectedInvernaderoConsulta, mes, año).subscribe({
      next: (resultado: any) => {
        this.horasTareaResultado = resultado;
        this.isConsultandoHorasTarea = false;
        this.hideLoadingOverlay();
        
        if (resultado.totalHoras > 0) {
          this.showNotificationMessage(`Consulta completada: ${resultado.totalHoras} horas en ${resultado.totalTareas} tareas`, 'success');
        } else {
          this.showNotificationMessage(resultado.resumen, 'warning');
        }
      },
      error: (err: any) => {
        console.error('❌ Error en consulta de horas por tarea:', err);
        this.isConsultandoHorasTarea = false;
        this.hideLoadingOverlay();
        console.error('Error en consulta de horas por tarea:', err);
        
        if (err.status === 403) {
          this.showNotificationMessage('Acceso denegado: solo superiores pueden realizar consultas', 'error');
        } else if (err.status === 400) {
          this.showNotificationMessage('Parámetros inválidos para la consulta', 'error');
        } else {
          this.showNotificationMessage('Error al consultar las horas por tarea', 'error');
        }
      }
    });
  }
  
  // Método auxiliar para obtener nombre del mes
  getNombreMesSeleccionado(): string {
    const mes = this.mesesDisponibles.find(m => m.value === this.selectedMes);
    return mes ? mes.name : '';
  }

  // Método para manejar cambio de invernadero en consultas
  onInvernaderoConsultaChange(selection: InvernaderoSelection): void {
    // Almacenar la selección completa
    this.invernaderoSelectionConsulta = selection;
    
    // Para la consulta, convertimos la selección a una cadena representativa
    if (selection && (selection.invernaderos.length > 0 || selection.cabezales.length > 0)) {
      const seleccionados = [];
      
      // Agregar cabezales completos
      if (selection.cabezales.length > 0) {
        seleccionados.push(...selection.cabezales.map((c: string) => `CABEZAL-${c}`));
      }
      
      // Agregar invernaderos individuales
      if (selection.invernaderos.length > 0) {
        seleccionados.push(...selection.invernaderos);
      }
      
      // Si hay múltiples selecciones, separarlas por coma
      this.selectedInvernaderoConsulta = seleccionados.length > 0 ? seleccionados.join(',') : '';
    } else {
      this.selectedInvernaderoConsulta = '';
    }
  }

  // Método para cerrar sesión
  onLogout(): void {
    this.authService.logout();
  }

  // Métodos para el dropdown búsqueable de tareas
  openTaskDropdown(): void {
    this.isTaskDropdownOpen = true;
    this.updateFilteredTaskOptions();
  }

  closeTaskDropdownDelayed(): void {
    this.taskDropdownTimeout = setTimeout(() => {
      this.isTaskDropdownOpen = false;
    }, 200);
  }

  onTaskSearchChange(): void {
    this.updateFilteredTaskOptions();
  }

  // Método para selección múltiple
  toggleTaskSelection(value: string, label: string): void {
    const existingIndex = this.selectedTareasConsulta.findIndex(t => t.value === value);
    
    if (existingIndex >= 0) {
      // Ya está seleccionada, removerla
      this.selectedTareasConsulta.splice(existingIndex, 1);
    } else {
      // No está seleccionada, agregarla
      this.selectedTareasConsulta.push({ value, label });
    }
    
    // Actualizar la variable para compatibilidad con backend
    this.selectedTipoTareaConsulta = this.selectedTareasConsulta.map(t => t.value).join(',');
    
    if (this.taskDropdownTimeout) {
      clearTimeout(this.taskDropdownTimeout);
    }
  }

  // Verificar si una tarea está seleccionada
  isTaskSelected(value: string): boolean {
    return this.selectedTareasConsulta.some(t => t.value === value);
  }

  // Remover una tarea seleccionada
  removeSelectedTask(tarea: any): void {
    const index = this.selectedTareasConsulta.findIndex(t => t.value === tarea.value);
    if (index >= 0) {
      this.selectedTareasConsulta.splice(index, 1);
      this.selectedTipoTareaConsulta = this.selectedTareasConsulta.map(t => t.value).join(',');
    }
  }

  // Obtener label de tareas seleccionadas
  getSelectedTasksLabel(): string {
    if (this.selectedTareasConsulta.length === 0) return '';
    if (this.selectedTareasConsulta.length === 1) return this.selectedTareasConsulta[0].label;
    return `${this.selectedTareasConsulta.length} tareas seleccionadas`;
  }

  // Método para compatibilidad (mantener por si acaso)
  selectTaskOption(value: string, label: string): void {
    this.toggleTaskSelection(value, label);
  }

  private updateFilteredTaskOptions(): void {
    const searchTerm = this.taskSearchTerm.toLowerCase();
    this.filteredTaskOptions = [];

    // Primero, recopilar todas las tareas que coinciden con la búsqueda
    const matchingTasks: any[] = [];
    const tasksByTipo: { [tipo: string]: any[] } = {};

    this.tareasJerarquicasConsulta.forEach(tipoGroup => {
      tipoGroup.subtipos.forEach((subtipoGroup: any) => {
        subtipoGroup.tareas.forEach((tarea: any) => {
          const tareaMatches = tarea.nombre.toLowerCase().includes(searchTerm);
          const tipoMatches = tipoGroup.tipo.toLowerCase().includes(searchTerm);

          if (tareaMatches || tipoMatches || searchTerm === '') {
            const taskItem = {
              tipo: tipoGroup.tipo,
              tarea: tarea
            };
            matchingTasks.push(taskItem);
            
            if (!tasksByTipo[tipoGroup.tipo]) {
              tasksByTipo[tipoGroup.tipo] = [];
            }
            tasksByTipo[tipoGroup.tipo].push(taskItem);
          }
        });
      });
    });

    // Ahora construir las opciones filtradas
    Object.keys(tasksByTipo).sort().forEach(tipo => {
      const tareasDelTipo = tasksByTipo[tipo];
      
      // Solo mostrar header si hay más de una tarea en este tipo
      if (tareasDelTipo.length > 1) {
        this.filteredTaskOptions.push({
          isTipo: true,
          label: tipo,
          value: null
        });
        
        // Agregar todas las tareas de este tipo
        tareasDelTipo.forEach(taskItem => {
          this.filteredTaskOptions.push({
            isTarea: true,
            label: taskItem.tarea.nombre,
            value: taskItem.tarea.valor,
            hasHeader: true
          });
        });
      } else {
        // Si solo hay una tarea, mostrarla directamente sin header
        tareasDelTipo.forEach(taskItem => {
          this.filteredTaskOptions.push({
            isTarea: true,
            label: taskItem.tarea.nombre,
            value: taskItem.tarea.valor,
            hasHeader: false
          });
        });
      }
    });
  }
  
  // Método para agrupar detalles por invernadero
  getDetallesAgrupadosPorInvernadero(): any[] {
    if (!this.horasTareaResultado || !this.horasTareaResultado.detalles) {
      return [];
    }
    
    const agrupados: { [invernadero: string]: any } = {};
    
    this.horasTareaResultado.detalles.forEach((detalle: any) => {
      const invernadero = detalle.invernadero || 'Sin especificar';
      
      if (!agrupados[invernadero]) {
        agrupados[invernadero] = {
          invernadero: invernadero,
          totalHoras: 0,
          totalJornalesReales: 0,
          tareas: []
        };
      }
      
      agrupados[invernadero].totalHoras += parseFloat(detalle.horas) || 0;
      agrupados[invernadero].totalHoras = Math.round(agrupados[invernadero].totalHoras * 100) / 100;
      agrupados[invernadero].totalJornalesReales += parseFloat(detalle.jornalesReales) || 0;
      agrupados[invernadero].totalJornalesReales = Math.round(agrupados[invernadero].totalJornalesReales * 100) / 100;
      agrupados[invernadero].tareas.push(detalle);
    });
    
    // Ahora agrupar las tareas por tareaId dentro de cada invernadero
    Object.values(agrupados).forEach((grupo: any) => {
      const tareasPorId: { [tareaId: string]: any } = {};
      
      grupo.tareas.forEach((tarea: any) => {
        const tareaId = tarea.tareaId || 'Sin ID';
        
        if (!tareasPorId[tareaId]) {
          tareasPorId[tareaId] = {
            tareaId: tareaId,
            totalHoras: 0,
            totalJornalesReales: 0,
            registros: []
          };
        }
        
        tareasPorId[tareaId].totalHoras += parseFloat(tarea.horas) || 0;
        tareasPorId[tareaId].totalHoras = Math.round(tareasPorId[tareaId].totalHoras * 100) / 100;
        tareasPorId[tareaId].totalJornalesReales += parseFloat(tarea.jornalesReales) || 0;
        tareasPorId[tareaId].totalJornalesReales = Math.round(tareasPorId[tareaId].totalJornalesReales * 100) / 100;
        tareasPorId[tareaId].registros.push(tarea);
      });
      
      // Reemplazar las tareas con la versión agrupada
      grupo.tareasAgrupadas = Object.values(tareasPorId).sort((a: any, b: any) => 
        (a.tareaId || '').localeCompare(b.tareaId || '')
      );
    });
    
    // Convertir a array y ordenar por invernadero
    return Object.values(agrupados).sort((a: any, b: any) => 
      a.invernadero.localeCompare(b.invernadero)
    );
  }
}