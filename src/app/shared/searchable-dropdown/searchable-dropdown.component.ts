import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-searchable-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="searchable-dropdown" [class.open]="isOpen">
      <label *ngIf="label" class="dropdown-label">{{ label }}</label>
      
      <!-- Header del dropdown -->
      <div class="dropdown-header" (click)="toggleDropdown()">
        <span class="selected-text">
          {{ getSelectedLabel() || placeholder }}
        </span>
        <span class="dropdown-arrow" [class.open]="isOpen">▼</span>
      </div>
      
      <!-- Contenido del dropdown -->
      <div class="dropdown-content" *ngIf="isOpen">
        <!-- Buscador interno -->
        <div class="search-container">
          <input 
            type="text" 
            class="search-input"
            [(ngModel)]="searchTerm"
            (input)="filterOptions()"
            [placeholder]="searchPlaceholder"
            #searchInput>
          <span class="search-icon">🔍</span>
        </div>
        
        <!-- Lista de opciones filtradas -->
        <div class="options-container">
          <div class="dropdown-option empty-option" 
               *ngIf="!required && filteredOptions.length > 0"
               [class.selected]="selectedValue === ''"
               (click)="selectOption('')">
            {{ emptyOptionText }}
          </div>
          
          <div class="dropdown-option" 
               *ngFor="let option of filteredOptions"
               [class.selected]="selectedValue === option.value"
               [class.disabled]="option.disabled"
               (click)="selectOption(option.value)">
            {{ option.label }}
          </div>
          
          <div class="no-results" *ngIf="filteredOptions.length === 0 && searchTerm">
            No se encontraron resultados para "{{ searchTerm }}"
          </div>
        </div>
      </div>
      
      <!-- Overlay para cerrar el dropdown -->
      <div class="dropdown-overlay" *ngIf="isOpen" (click)="closeDropdown()"></div>
    </div>
  `,
  styles: [`
    .searchable-dropdown {
      position: relative;
      width: 100%;
    }
    
    .dropdown-label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #a0c09a;
      font-size: 0.85rem;
    }
    
    .dropdown-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0.75rem;
      border: 1px solid #9dc09a;
      border-radius: 4px;
      background-color: #c2e1c4;
      cursor: pointer;
      font: inherit;
      min-height: 2.5rem;
      box-sizing: border-box;
    }
    
    .dropdown-header:hover {
      border-color: #7ab377;
    }
    
    .dropdown-header:focus-within {
      border-color: #5a9c56;
      box-shadow: 0 0 0 2px rgba(90, 156, 86, 0.2);
    }
    
    .selected-text {
      flex: 1;
      color: #333;
    }
    
    .selected-text:empty::before {
      content: attr(placeholder);
      color: #666;
    }
    
    .dropdown-arrow {
      transition: transform 0.2s ease;
      color: #666;
      font-size: 12px;
      margin-left: 0.5rem;
    }
    
    .dropdown-arrow.open {
      transform: rotate(180deg);
    }
    
    .dropdown-content {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #9dc09a;
      border-top: none;
      border-radius: 0 0 4px 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      max-height: 300px;
      overflow: hidden;
    }
    
    .search-container {
      position: relative;
      padding: 0.5rem;
      border-bottom: 1px solid #e9ecef;
      background-color: #f8f9fa;
    }
    
    .search-input {
      width: 100%;
      padding: 0.5rem 2rem 0.5rem 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      background-color: white;
      box-sizing: border-box;
    }
    
    .search-input:focus {
      outline: none;
      border-color: #5a9c56;
      box-shadow: 0 0 0 2px rgba(90, 156, 86, 0.2);
    }
    
    .search-icon {
      position: absolute;
      right: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: #666;
      pointer-events: none;
    }
    
    .options-container {
      max-height: 200px;
      overflow-y: auto;
    }
    
    .dropdown-option {
      padding: 0.75rem;
      cursor: pointer;
      border-bottom: 1px solid #f0f0f0;
      transition: background-color 0.15s ease;
    }
    
    .dropdown-option:hover {
      background-color: #f8f9fa;
    }
    
    .dropdown-option.selected {
      background-color: #e3f2fd;
      color: #1976d2;
      font-weight: 500;
    }
    
    .dropdown-option.disabled {
      color: #999;
      cursor: not-allowed;
      background-color: #f5f5f5;
    }
    
    .dropdown-option.disabled:hover {
      background-color: #f5f5f5;
    }
    
    .empty-option {
      color: #666;
      font-style: italic;
    }
    
    .no-results {
      padding: 1rem;
      text-align: center;
      color: #666;
      font-style: italic;
    }
    
    .dropdown-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 999;
    }
    
    /* Scrollbar personalizado para las opciones */
    .options-container::-webkit-scrollbar {
      width: 6px;
    }
    
    .options-container::-webkit-scrollbar-track {
      background: #f1f1f1;
    }
    
    .options-container::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;
    }
    
    .options-container::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }
  `]
})
export class SearchableDropdownComponent implements OnInit, OnDestroy {
  @Input() options: DropdownOption[] = [];
  @Input() selectedValue: string = '';
  @Input() placeholder: string = 'Seleccionar...';
  @Input() searchPlaceholder: string = 'Buscar...';
  @Input() label: string = '';
  @Input() required: boolean = false;
  @Input() emptyOptionText: string = 'Ninguno';
  
  @Output() selectionChange = new EventEmitter<string>();
  
  isOpen = false;
  searchTerm = '';
  filteredOptions: DropdownOption[] = [];
  
  ngOnInit() {
    this.filteredOptions = [...this.options];
  }
  
  ngOnDestroy() {
    // Cerrar dropdown si el componente se destruye
    this.isOpen = false;
  }
  
  toggleDropdown() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.searchTerm = '';
      this.filterOptions();
      // Focus en el input de búsqueda después de un breve delay
      setTimeout(() => {
        const searchInput = document.querySelector('.searchable-dropdown .search-input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }, 50);
    }
  }
  
  closeDropdown() {
    this.isOpen = false;
    this.searchTerm = '';
  }
  
  selectOption(value: string) {
    this.selectedValue = value;
    this.selectionChange.emit(value);
    this.closeDropdown();
  }
  
  filterOptions() {
    if (!this.searchTerm.trim()) {
      this.filteredOptions = [...this.options];
    } else {
      const searchLower = this.searchTerm.toLowerCase();
      this.filteredOptions = this.options.filter(option =>
        option.label.toLowerCase().includes(searchLower) ||
        option.value.toLowerCase().includes(searchLower)
      );
    }
  }
  
  getSelectedLabel(): string {
    const selected = this.options.find(option => option.value === this.selectedValue);
    return selected ? selected.label : '';
  }
}