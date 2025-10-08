import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvernaderoService, Cabezal, Invernadero, InvernaderosResponse } from '../../invernadero.service';

export interface InvernaderoSelection {
  invernaderos: string[]; // Array de nombres de invernaderos seleccionados
  cabezales: string[]; // Array de cabezales completos seleccionados
}

@Component({
  selector: 'app-invernadero-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="invernadero-selector">
      <label class="form-label">Invernaderos:</label>
      <div class="selector-container">
        
        <!-- Indicador de carga -->
        <div *ngIf="loading" class="loading-indicator">
          Cargando invernaderos...
        </div>
        
        <!-- Desplegable principal que contiene todo -->
        <div *ngIf="!loading" class="main-dropdown">
          <!-- Header del desplegable principal -->
          <div class="main-dropdown-header" (click)="toggleMainDropdown()">
            <span class="dropdown-text">
              <span *ngIf="getSelectedCount() === 0">Seleccionar invernaderos...</span>
              <span *ngIf="getSelectedCount() > 0">{{ getSelectedCount() }} invernadero(s) seleccionado(s)</span>
            </span>
            <span class="main-dropdown-icon" [class.expanded]="isMainDropdownOpen">▼</span>
          </div>
          
          <!-- Contenido del desplegable (cabezales) -->
          <div class="main-dropdown-content" *ngIf="isMainDropdownOpen">
            <div class="cabezales-list">
              <div *ngFor="let cabezal of cabezales" class="cabezal-item">
                
                <!-- Header del cabezal -->
                <div class="cabezal-header" (click)="toggleCabezal(cabezal.nombre)">
                  <div class="cabezal-info">
                    <span class="expand-icon" [class.expanded]="expandedCabezales.has(cabezal.nombre)">
                      ▶
                    </span>
                    <span class="cabezal-name">{{ cabezal.nombre }}</span>
                    <span class="cabezal-count">({{ cabezal.invernaderos.length }} invernaderos)</span>
                  </div>
                  
                  <!-- Checkbox para todo el cabezal -->
                  <label class="cabezal-checkbox" (click)="$event.stopPropagation()">
                    <input 
                      type="checkbox" 
                      [checked]="isCabezalFullySelected(cabezal.nombre)"
                      [indeterminate]="isCabezalPartiallySelected(cabezal.nombre)"
                      (change)="toggleCabezalSelection(cabezal.nombre, $event)">
                    <span class="checkbox-label">Todo el cabezal</span>
                  </label>
                </div>
                
                <!-- Lista de invernaderos (colapsable) -->
                <div class="invernaderos-list" *ngIf="expandedCabezales.has(cabezal.nombre)">
                  <div *ngFor="let invernadero of cabezal.invernaderos" class="invernadero-item">
                    <label class="invernadero-checkbox">
                      <input 
                        type="checkbox" 
                        [value]="invernadero.nombre"
                        [checked]="selectedInvernaderos.has(invernadero.nombre)"
                        (change)="toggleInvernaderoSelection(invernadero.nombre, cabezal.nombre, $event)">
                      <span class="checkbox-label">
                                              <span class="checkbox-label">
                        {{ invernadero.nombre }} ({{ invernadero.dimensiones.toString().replace('.', ',') }}ha)
                      </span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Resumen de selección -->
        <div *ngIf="getSelectedCount() > 0" class="selection-summary">
          <h4>Seleccionados ({{ getSelectedCount() }}):</h4>
          <div class="selected-items">
            <div *ngFor="let cabezal of getSelectedCabezales()" class="selected-item cabezal-selected">
              🏭 <strong>{{ cabezal }}</strong> (cabezal completo)
            </div>
            <div *ngFor="let invernadero of getIndividualSelections()" class="selected-item">
              🏠 {{ invernadero }}
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .invernadero-selector {
      margin-bottom: 1rem;
    }
    
    .selector-container {
      position: relative;
    }
    
    .loading-indicator {
      padding: 1rem;
      text-align: center;
      color: #666;
      font-style: italic;
    }
    
    /* Estilos del desplegable principal */
    .main-dropdown {
      border: 1px solid #ddd;
      border-radius: 4px;
      background-color: #fff;
    }
    
    .main-dropdown-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background-color: #f8f9fa;
      cursor: pointer;
      user-select: none;
      border-radius: 4px;
    }
    
    .main-dropdown-header:hover {
      background-color: #e9ecef;
    }
    
    .dropdown-text {
      font-weight: 500;
      color: #48703cff;
    }
    
    .main-dropdown-icon {
      font-size: 12px;
      transition: transform 0.2s ease;
      color: #666;
    }
    
    .main-dropdown-icon.expanded {
      transform: rotate(180deg);
    }
    
    .main-dropdown-content {
      border-top: 1px solid #e9ecef;
      max-height: 300px;
      overflow-y: auto;
      background-color: #fff;
    }
    
    .cabezales-list {
      /* No padding aquí para que los items ocupen todo el ancho */
    }
    
    .cabezal-item {
      border-bottom: 1px solid #f0f0f0;
    }
    
    .cabezal-item:last-child {
      border-bottom: none;
    }
    
    .cabezal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background-color: #fff;
      cursor: pointer;
      user-select: none;
    }
    
    .cabezal-header:hover {
      background-color: #f8f9fa;
    }
    
    .cabezal-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
    }
    
    .expand-icon {
      font-size: 12px;
      transition: transform 0.2s ease;
      color: #666;
    }
    
    .expand-icon.expanded {
      transform: rotate(90deg);
    }
    
    .cabezal-name {
      font-weight: 600;
      color: #333;
    }
    
    .cabezal-count {
      font-size: 12px;
      color: #666;
    }
    
    .cabezal-checkbox {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      cursor: pointer;
    }
    
    .invernaderos-list {
      background-color: #fafafa;
      border-top: 1px solid #e9ecef;
    }
    
    .invernadero-item {
      padding: 0.5rem 1rem 0.5rem 2rem;
      border-bottom: 1px solid #f0f0f0;
    }
    
    .invernadero-item:last-child {
      border-bottom: none;
    }
    
    .invernadero-checkbox {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      width: 100%;
    }
    
    .checkbox-label {
      font-size: 14px;
      user-select: none;
    }
    
    .selection-summary {
      margin-top: 1rem;
      padding: 0.75rem;
      background-color: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 4px;
    }
    
    .selection-summary h4 {
      margin: 0 0 0.5rem 0;
      font-size: 14px;
      color: #333;
    }
    
    .selected-items {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    
    .selected-item {
      font-size: 13px;
      color: #666;
    }
    
    .cabezal-selected {
      font-weight: 600;
      color: #0056b3;
    }
    
    .form-label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }
    
    input[type="checkbox"] {
      margin: 0;
      cursor: pointer;
    }
    
    /* Estilo para checkbox indeterminado */
    input[type="checkbox"]:indeterminate {
      background-color: #007bff;
      border-color: #007bff;
    }
  `]
})
export class InvernaderoSelectorComponent implements OnInit {
  @Input() initialValue: string = '';
  @Input() cabezalFilter: string = '';  // Nuevo input para filtrar por cabezal específico
  @Output() selectionChange = new EventEmitter<InvernaderoSelection>();
  
  cabezales: Cabezal[] = [];
  loading = false;
  
  // Estado del desplegable principal
  isMainDropdownOpen = false;
  
  // Estado de expansión de cabezales
  expandedCabezales = new Set<string>();
  
  // Selecciones
  selectedInvernaderos = new Set<string>(); // Invernaderos individuales seleccionados
  selectedCabezales = new Set<string>(); // Cabezales completos seleccionados
  
  constructor(private invernaderoService: InvernaderoService) {}
  
  ngOnInit() {
    this.loadInvernaderos();
  }
  
  loadInvernaderos() {
    this.loading = true;
    
    // Usar filtrado por cabezal si se especifica
    const serviceCall = this.cabezalFilter 
      ? this.invernaderoService.getInvernaderosByCabezal(this.cabezalFilter)
      : this.invernaderoService.getInvernaderos();
    
    serviceCall.subscribe({
      next: (response: InvernaderosResponse) => {
        this.cabezales = response.cabezales;
        this.loading = false;
        
        // Si hay un valor inicial, seleccionarlo automáticamente
        if (this.initialValue) {
          this.selectInitialValue();
        }
      },
      error: (error: any) => {
        console.error('Error cargando invernaderos:', error);
        this.loading = false;
      }
    });
  }
  
  selectInitialValue() {
    // Buscar el invernadero en los cabezales y seleccionarlo
    for (const cabezal of this.cabezales) {
      const invernadero = cabezal.invernaderos.find(inv => inv.nombre === this.initialValue);
      if (invernadero) {
        // Seleccionar el invernadero
        this.selectedInvernaderos.add(this.initialValue);
        // Expandir el cabezal correspondiente
        this.expandedCabezales.add(cabezal.nombre);
        // Emitir la selección
        this.emitSelection();
        break;
      }
    }
  }
  
  toggleMainDropdown() {
    this.isMainDropdownOpen = !this.isMainDropdownOpen;
  }
  
  toggleCabezal(cabezalNombre: string) {
    if (this.expandedCabezales.has(cabezalNombre)) {
      this.expandedCabezales.delete(cabezalNombre);
    } else {
      this.expandedCabezales.add(cabezalNombre);
    }
  }
  
  toggleCabezalSelection(cabezalNombre: string, event: Event) {
    const checkbox = event.target as HTMLInputElement;
    const cabezal = this.cabezales.find(c => c.nombre === cabezalNombre);
    
    if (!cabezal) return;
    
    if (checkbox.checked) {
      // Seleccionar todo el cabezal
      this.selectedCabezales.add(cabezalNombre);
      // Remover invernaderos individuales de este cabezal
      cabezal.invernaderos.forEach((inv: Invernadero) => {
        this.selectedInvernaderos.delete(inv.nombre);
      });
    } else {
      // Deseleccionar el cabezal
      this.selectedCabezales.delete(cabezalNombre);
    }
    
    this.emitSelection();
  }
  
  toggleInvernaderoSelection(invernaderoNombre: string, cabezalNombre: string, event: Event) {
    const checkbox = event.target as HTMLInputElement;
    
    if (checkbox.checked) {
      this.selectedInvernaderos.add(invernaderoNombre);
      // Si este cabezal estaba completamente seleccionado, quitarlo
      this.selectedCabezales.delete(cabezalNombre);
    } else {
      this.selectedInvernaderos.delete(invernaderoNombre);
    }
    
    this.emitSelection();
  }
  
  isCabezalFullySelected(cabezalNombre: string): boolean {
    return this.selectedCabezales.has(cabezalNombre);
  }
  
  isCabezalPartiallySelected(cabezalNombre: string): boolean {
    if (this.selectedCabezales.has(cabezalNombre)) {
      return false; // Si está completamente seleccionado, no es parcial
    }
    
    const cabezal = this.cabezales.find(c => c.nombre === cabezalNombre);
    if (!cabezal) return false;
    
    const selectedCount = cabezal.invernaderos.filter((inv: Invernadero) => 
      this.selectedInvernaderos.has(inv.nombre)
    ).length;
    
    return selectedCount > 0 && selectedCount < cabezal.invernaderos.length;
  }
  
  getSelectedCount(): number {
    let count = 0;
    
    // Contar cabezales completos
    this.selectedCabezales.forEach(cabezalNombre => {
      const cabezal = this.cabezales.find(c => c.nombre === cabezalNombre);
      if (cabezal) {
        count += cabezal.invernaderos.length;
      }
    });
    
    // Contar invernaderos individuales
    count += this.selectedInvernaderos.size;
    
    return count;
  }
  
  getSelectedCabezales(): string[] {
    return Array.from(this.selectedCabezales);
  }
  
  getIndividualSelections(): string[] {
    return Array.from(this.selectedInvernaderos);
  }
  
  getAllSelectedInvernaderos(): string[] {
    const allSelected: string[] = [];
    
    // Agregar invernaderos de cabezales completos
    this.selectedCabezales.forEach(cabezalNombre => {
      const cabezal = this.cabezales.find(c => c.nombre === cabezalNombre);
      if (cabezal) {
        allSelected.push(...cabezal.invernaderos.map((inv: Invernadero) => inv.nombre));
      }
    });
    
    // Agregar invernaderos individuales
    allSelected.push(...this.selectedInvernaderos);
    
    return allSelected;
  }
  
  private emitSelection() {
    const selection: InvernaderoSelection = {
      invernaderos: this.getAllSelectedInvernaderos(),
      cabezales: Array.from(this.selectedCabezales)
    };
    
    this.selectionChange.emit(selection);
  }
  
  // Método para establecer selección desde el componente padre
  setSelection(invernaderos: string[]) {
    this.selectedInvernaderos.clear();
    this.selectedCabezales.clear();
    
    invernaderos.forEach(invNombre => {
      this.selectedInvernaderos.add(invNombre);
    });
    
    this.emitSelection();
  }
  
  // Método para limpiar selección
  clear() {
    this.selectedInvernaderos.clear();
    this.selectedCabezales.clear();
    this.emitSelection();
  }
}