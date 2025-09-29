import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  @Output() tareaSelected = new EventEmitter<{nombre: string, jornal_unidad: number}>();

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

  constructor() { }

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
  }

  async loadTiposTarea(): Promise<void> {
    try {
      const response = await fetch(`http://localhost:3000/tipos-tarea/${this.grupoTrabajo}`);
      this.tiposTarea = await response.json();
      
      // Extraer tipos únicos directamente
      const tiposUnicos = [...new Set(this.tiposTarea.map(t => t.tipo))].filter(t => t);
      
      this.tipos = tiposUnicos.map(tipo => {
        const hasSubtareas = this.tiposTarea.some(t => t.tipo === tipo && t.subtipo);
        return {
          value: tipo,
          label: tipo,
          hasSubtareas
        };
      });
      
      // Inicializar las opciones filtradas
      this.updateFilteredOptions();
    } catch (error) {
      console.error('Error cargando tipos de tarea:', error);
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
    this.selectedTipo = value;
    this.selectedTaskLabel = label;
    this.searchTerm = '';
    this.isDropdownOpen = false;
    this.onTipoChange();
  }

  private emitSelection(): void {
    let tareaNombre = '';
    let jornalUnidad = 0;

    if (this.selectedTipo) {
      if (this.selectedTipo.includes('|')) {
        // Es un valor combinado (tipo|subtipo)
        const [tipo, subtipo] = this.selectedTipo.split('|');
        const tareaFound = this.tiposTarea.find(t => 
          t.tipo === tipo && 
          t.subtipo === subtipo
        );
        tareaNombre = tareaFound?.tarea_nombre || '';
        jornalUnidad = parseFloat(tareaFound?.jornal_unidad.replace(',', '.') || '0') || 0;
      } else {
        // Es un tipo simple sin subtipos
        const tareaFound = this.tiposTarea.find(t => 
          t.tipo === this.selectedTipo && 
          !t.subtipo
        );
        tareaNombre = tareaFound?.tarea_nombre || '';
        jornalUnidad = parseFloat(tareaFound?.jornal_unidad.replace(',', '.') || '0') || 0;
      }
    }

    this.tareaSelected.emit({
      nombre: tareaNombre,
      jornal_unidad: jornalUnidad
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