import { Component, Input, Output, EventEmitter, OnInit, OnChanges, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrabajadoresService, Trabajador, TrabajadorAsignado } from '../trabajadores.service';

@Component({
  selector: 'app-asignar-trabajadores',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asignar-trabajadores.component.html',
  styleUrls: ['./asignar-trabajadores.component.css']
})
export class AsignarTrabajadoresComponent implements OnInit {
  @Input() showModal: boolean = false;
  @Input() horasRequeridas: number = 0;
  @Input() trabajadoresAsignados: TrabajadorAsignado[] = [];
  @Output() closeModal = new EventEmitter<void>();
  @Output() saveAssignments = new EventEmitter<TrabajadorAsignado[]>();

  trabajadores: Trabajador[] = [];
  filteredTrabajadores: Trabajador[] = [];
  searchTerm: string = '';
  selectedTrabajadores: Trabajador[] = [];
  isDropdownOpen: boolean = false;

  // Lista temporal de trabajadores asignados para editar
  tempAsignados: TrabajadorAsignado[] = [];
  
  // Para asignación masiva de horas
  horasMasivas: number = 0;

  constructor(private trabajadoresService: TrabajadoresService) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const dropdown = target.closest('.form-section');
    if (!dropdown && this.isDropdownOpen) {
      this.isDropdownOpen = false;
    }
  }

  ngOnInit(): void {
    this.loadTrabajadores();
  }

  ngOnChanges(): void {
    if (this.showModal) {
      // Copiar las asignaciones actuales para editar
      this.tempAsignados = [...this.trabajadoresAsignados];
    }
  }

  loadTrabajadores(): void {
    this.trabajadoresService.getTrabajadores().subscribe({
      next: (trabajadores) => {
        this.trabajadores = trabajadores;
        this.filteredTrabajadores = trabajadores;
      },
      error: (error) => {
        console.error('Error cargando trabajadores:', error);
      }
    });
  }

  filterTrabajadores(): void {
    if (!this.searchTerm) {
      this.filteredTrabajadores = this.trabajadores;
    } else {
      this.filteredTrabajadores = this.trabajadores.filter(t =>
        t.nombre.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        t.codigo.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        t.empresa.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
  }

  toggleTrabajador(trabajador: Trabajador): void {
    const index = this.selectedTrabajadores.findIndex(t => t.codigo === trabajador.codigo);
    
    if (index >= 0) {
      // Ya está seleccionado, lo quitamos
      this.selectedTrabajadores.splice(index, 1);
    } else {
      // No está seleccionado, lo añadimos
      this.selectedTrabajadores.push(trabajador);
    }
  }

  isTrabajadorSelected(trabajador: Trabajador): boolean {
    return this.selectedTrabajadores.some(t => t.codigo === trabajador.codigo);
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) {
      this.filterTrabajadores();
    }
  }

  addSelectedTrabajadores(): void {
    if (this.selectedTrabajadores.length === 0) {
      alert('Por favor, selecciona al menos un trabajador.');
      return;
    }

    // Añadir trabajadores seleccionados que no estén ya asignados
    this.selectedTrabajadores.forEach(trabajador => {
      const yaAsignado = this.tempAsignados.find(ta => ta.trabajador.codigo === trabajador.codigo);
      if (!yaAsignado) {
        this.tempAsignados.push({
          trabajador: trabajador,
          horas: 0 // Inicializar en 0, el usuario asignará horas después
        });
      }
    });

    // Limpiar selección y cerrar dropdown
    this.selectedTrabajadores = [];
    this.searchTerm = '';
    this.filteredTrabajadores = this.trabajadores;
    this.isDropdownOpen = false;
  }

  removeTrabajador(index: number): void {
    this.tempAsignados.splice(index, 1);
  }

  updateHoras(index: number, nuevasHoras: number): void {
    if (nuevasHoras > 0) {
      this.tempAsignados[index].horas = nuevasHoras;
    }
  }

  // Asignar horas masivamente a todos los trabajadores
  asignarHorasMasivas(): void {
    if (this.horasMasivas <= 0) {
      alert('Por favor, ingrese un número de horas válido.');
      return;
    }
    
    if (this.tempAsignados.length === 0) {
      alert('Primero debe añadir trabajadores.');
      return;
    }
    
    // Asignar las mismas horas a todos los trabajadores
    this.tempAsignados.forEach(ta => {
      ta.horas = this.horasMasivas;
    });
    
    console.log(`Asignadas ${this.horasMasivas} horas a ${this.tempAsignados.length} trabajadores`);
  }

  getTotalHoras(): number {
    return this.tempAsignados.reduce((total, ta) => total + ta.horas, 0);
  }

  isValid(): boolean {
    return this.getTotalHoras() === this.horasRequeridas && 
           this.tempAsignados.length > 0 && 
           this.tempAsignados.every(ta => ta.horas > 0);
  }

  getValidationMessage(): string {
    const totalHoras = this.getTotalHoras();
    const diferencia = this.horasRequeridas - totalHoras;
    
    if (this.tempAsignados.length === 0) {
      return 'Debe asignar al menos un trabajador';
    }

    const trabajadoresSinHoras = this.tempAsignados.filter(ta => ta.horas <= 0);
    if (trabajadoresSinHoras.length > 0) {
      return `${trabajadoresSinHoras.length} trabajador(es) sin horas asignadas`;
    }
    
    if (diferencia > 0) {
      return `Faltan ${diferencia} horas por asignar`;
    } else if (diferencia < 0) {
      return `Sobran ${Math.abs(diferencia)} horas asignadas`;
    }
    
    return '✅ Las horas cuadran perfectamente';
  }

  onSave(): void {
    if (!this.isValid()) {
      alert('Las horas asignadas deben coincidir exactamente con las horas requeridas.');
      return;
    }

    this.saveAssignments.emit([...this.tempAsignados]);
    this.onClose();
  }

  onClose(): void {
    this.tempAsignados = [];
    this.selectedTrabajadores = [];
    this.searchTerm = '';
    this.isDropdownOpen = false;
    this.closeModal.emit();
  }

  onModalOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}