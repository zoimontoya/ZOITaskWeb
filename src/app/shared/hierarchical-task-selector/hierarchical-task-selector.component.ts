import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface TipoTarea {
  grupo_trabajo: string;
  familia: string;
  tipo: string;
  subtipo: string;
  tarea_nombre: string;
  jornal_unidad: string;
}

interface TareaOption {
  value: string;
  label: string;
  hasSubtareas: boolean;
}

@Component({
  selector: 'app-hierarchical-task-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hierarchical-task-selector.component.html',
  styleUrls: ['./hierarchical-task-selector.component.css']
})
export class HierarchicalTaskSelectorComponent implements OnInit, OnChanges {
  @Input() grupoTrabajo: string = '';
  @Input() selectedTarea: string = '';
  @Output() tareaSelected = new EventEmitter<{
    nombre: string, 
    jornal_unidad: number, 
    familia?: string, 
    tipo?: string, 
    subtipo?: string,
    tarea_completa?: any
  }>();

  tiposTarea: TipoTarea[] = [];
  tipos: TareaOption[] = [];
  filteredOptions: any[] = [];

  selectedTipo: string = '';
  selectedSubtipo: string = ''; // Solo para tracking interno
  selectedTaskLabel: string = '';
  
  // Propiedades para el buscador
  searchTerm: string = '';
  isDropdownOpen: boolean = false;
  highlightedIndex: number = -1;
  closeTimeout: any;
  private apiUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    if (this.grupoTrabajo) {
      this.loadTiposTarea();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['grupoTrabajo'] && this.grupoTrabajo) {
      this.loadTiposTarea();
      this.resetSelections();
    }
    
    // Manejar cambios en selectedTarea (para modo edición)
    if (changes['selectedTarea'] && this.selectedTarea && this.tiposTarea.length > 0) {
      this.setInitialSelection();
    }
  }

  loadTiposTarea(): void {
    this.http.get<TipoTarea[]>(`${this.apiUrl}/tipos-tarea/${this.grupoTrabajo}`).subscribe({
      next: (tiposTarea) => {
        this.tiposTarea = tiposTarea;
        
        // DEBUG: Mostrar todas las tareas cargadas
        console.log('🎯 HIERARCHICAL SELECTOR - Tareas cargadas para grupo:', this.grupoTrabajo);
        console.log('📋 Total tareas:', this.tiposTarea.length);
        
        // Buscar específicamente ALMACEN-CONFECC
        const almacenConfeccTasks = this.tiposTarea.filter(t => t.familia === 'ALMACEN-CONFECC');
        console.log('🏪 HIERARCHICAL - Tareas ALMACEN-CONFECC:', almacenConfeccTasks);
        
        // Extraer tipos únicos directamente
        const tiposUnicos = [...new Set(this.tiposTarea.map(t => t.tipo))].filter(t => t);
        console.log('🎯 Tipos únicos extraídos:', tiposUnicos);
        
        this.tipos = tiposUnicos.map(tipo => {
          const hasSubtareas = this.tiposTarea.some(t => t.tipo === tipo && t.subtipo);
          return {
            value: tipo,
            label: tipo,
            hasSubtareas
          };
        });
        
        console.log('📋 Tipos procesados para dropdown:', this.tipos);
        
        // Inicializar las opciones filtradas
        this.updateFilteredOptions();
        
        // Si hay una tarea seleccionada inicialmente, configurarla
        if (this.selectedTarea) {
          this.setInitialSelection();
        }
      },
      error: (error) => {
        console.error('Error cargando tipos de tarea:', error);
      }
    });
  }

  setInitialSelection(): void {
    // Buscar la tarea en los datos cargados - intentar por tarea_nombre Y por tipo
    let tareaEncontrada = this.tiposTarea.find(t => t.tarea_nombre === this.selectedTarea);
    
    // Si no se encontró por tarea_nombre, buscar por tipo
    if (!tareaEncontrada) {
      tareaEncontrada = this.tiposTarea.find(t => t.tipo === this.selectedTarea);
    }
    
    console.log('🔧 HierarchicalTaskSelector: setInitialSelection');
    console.log('📋 Buscando tarea:', this.selectedTarea);
    console.log('📊 Tarea encontrada:', tareaEncontrada);
    console.log('📋 Datos disponibles:', this.tiposTarea.map(t => ({tipo: t.tipo, tarea_nombre: t.tarea_nombre})));
    
    if (tareaEncontrada) {
      // Si tiene subtipo, usar el formato combinado
      if (tareaEncontrada.subtipo) {
        this.selectedTipo = `${tareaEncontrada.tipo}|${tareaEncontrada.subtipo}`;
        this.selectedSubtipo = tareaEncontrada.subtipo;
      } else {
        this.selectedTipo = tareaEncontrada.tipo;
        this.selectedSubtipo = '';
      }
      
      this.selectedTaskLabel = tareaEncontrada.tarea_nombre || tareaEncontrada.tipo;
      
      console.log('✅ Configurando selección inicial:');
      console.log('  - selectedTipo:', this.selectedTipo);
      console.log('  - selectedTaskLabel:', this.selectedTaskLabel);
      
      // Emitir la selección inicial
      this.emitSelection();
    } else {
      console.log('❌ No se encontró la tarea inicial');
    }
  }



  onTipoChange(): void {
    if (this.selectedTipo) {
      // Verificar si es un valor combinado (tipo|subtipo)
      if (this.selectedTipo.includes('|')) {
        const [tipo, subtipo] = this.selectedTipo.split('|');
        this.selectedSubtipo = subtipo;
      } else {
        this.selectedSubtipo = '';
      }
    }
    
    this.emitSelection();
  }

  getSubtiposForTipo(tipoValue: string): { fullValue: string, label: string }[] {
    return this.tiposTarea
      .filter(t => t.tipo === tipoValue && t.subtipo)
      .map(t => ({
        fullValue: `${t.tipo}|${t.subtipo}`, // Combinamos tipo y subtipo
        label: t.tarea_nombre
      }));
  }

  // Métodos para el buscador
  updateFilteredOptions(): void {
    const searchLower = this.searchTerm.toLowerCase();
    this.filteredOptions = [];
    let index = 0;

    this.tipos.forEach(tipo => {
      if (!tipo.hasSubtareas) {
        // Tipo sin subtipos
        if (!searchLower || tipo.label.toLowerCase().includes(searchLower)) {
          this.filteredOptions.push({
            ...tipo,
            index: index++
          });
        }
      } else {
        // Tipo con subtipos
        const subtipos = this.getSubtiposForTipo(tipo.value);
        const filteredSubtipos = subtipos.filter(subtipo => 
          !searchLower || 
          subtipo.label.toLowerCase().includes(searchLower) ||
          tipo.label.toLowerCase().includes(searchLower)
        );

        if (filteredSubtipos.length > 0) {
          this.filteredOptions.push({
            ...tipo,
            index: index++,
            subtipos: filteredSubtipos.map(subtipo => ({
              ...subtipo,
              index: index++
            }))
          });
        }
      }
    });
  }

  onSearchChange(): void {
    this.updateFilteredOptions();
    this.highlightedIndex = -1;
  }

  openDropdown(): void {
    this.isDropdownOpen = true;
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
    }
  }

  closeDropdownDelayed(): void {
    this.closeTimeout = setTimeout(() => {
      this.isDropdownOpen = false;
    }, 150);
  }

  selectOption(value: string, label: string): void {
    console.log('🎯 HIERARCHICAL - Opción seleccionada:', { value, label });
    
    this.selectedTipo = value;
    this.selectedTaskLabel = label;
    this.searchTerm = '';
    this.isDropdownOpen = false;
    this.onTipoChange();
  }

  private emitSelection(): void {
    let tareaNombre = '';
    let jornalUnidad = 0;
    let tareaFound: TipoTarea | undefined;

    if (this.selectedTipo) {
      if (this.selectedTipo.includes('|')) {
        // Es un valor combinado (tipo|subtipo)
        const [tipo, subtipo] = this.selectedTipo.split('|');
        tareaFound = this.tiposTarea.find(t => 
          t.tipo === tipo && 
          t.subtipo === subtipo
        );
      } else {
        // Es un tipo simple sin subtipos
        tareaFound = this.tiposTarea.find(t => 
          t.tipo === this.selectedTipo && 
          !t.subtipo
        );
      }
      
      if (tareaFound) {
        tareaNombre = tareaFound.tarea_nombre || '';
        jornalUnidad = parseFloat(tareaFound.jornal_unidad.replace(',', '.') || '0') || 0;
      }
    }

    console.log('🎯 HIERARCHICAL - Emitiendo selección:', {
      selectedTipo: this.selectedTipo,
      tareaFound: tareaFound,
      tareaNombre: tareaNombre,
      jornalUnidad: jornalUnidad,
      familia: tareaFound?.familia
    });

    this.tareaSelected.emit({
      nombre: tareaNombre,
      jornal_unidad: jornalUnidad,
      familia: tareaFound?.familia,
      tipo: tareaFound?.tipo,
      subtipo: tareaFound?.subtipo,
      tarea_completa: tareaFound
    });
  }

  private resetSelections(): void {
    this.selectedTipo = '';
    this.selectedSubtipo = '';
    this.selectedTaskLabel = '';
    this.searchTerm = '';
    this.tipos = [];
    this.filteredOptions = [];
    this.isDropdownOpen = false;
  }
}