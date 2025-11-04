import { Component, OnInit, HostListener, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Chart, registerables } from 'chart.js';

@Component({
  selector: 'app-tecnico',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tecnico-container">
      <header class="tecnico-header">
        <div class="header-content">
          <h1>⚙️ Sistema Técnico</h1>
          <p class="subtitle">Seguimiento Estado Fruta</p>
          <button class="logout-btn" (click)="onLogout()">
            🚪 Cerrar Sesión
          </button>
        </div>
      </header>
      
      <main class="tecnico-main">
        <div class="welcome-card">
          <h2>🔧 Panel de Control Técnico</h2>
          <p>Gestiona el seguimiento del estado de la fruta de forma eficiente.</p>
          
          <div class="actions-section">
            <!-- Botón para TÉCNICOS -->
            <button *ngIf="userRole !== 'encargado'" class="create-report-btn" (click)="openCreateReportModal()">
              📋 Crear Informe Técnico
            </button>
            
            <!-- Botón para ENCARGADOS -->
            <button *ngIf="userRole === 'encargado'" class="create-manager-report-btn" (click)="openCreateManagerReportModal()">
              👔 Crear Informe de Encargado
            </button>
            
            <button class="analytics-btn" (click)="openAnalyticsModal()">
              📊 Consultar Estado de Invernaderos
            </button>
            
            <!-- Botón para CONSULTAR INFORMES DE COGIDA (todos los roles) -->
            <button class="cogida-reports-btn" (click)="openCogidaReportsModal()">
              🤏 Consultar Informes de Cogida
            </button>
          </div>
          
          <div class="info-section">
            <h3>🏠 Tus Cabezales Asignados</h3>
            <div class="cabezales-info" *ngIf="userCabezales.length > 0">
              <span *ngFor="let cabezal of userCabezales" class="cabezal-chip">{{cabezal}}</span>
            </div>
            <p *ngIf="userCabezales.length === 0" class="no-cabezales">
              No tienes cabezales asignados
            </p>
          </div>
        </div>
      </main>
    </div>

    <!-- Modal para crear informe -->
    <div class="modal-overlay" *ngIf="showCreateReportModal" (click)="onModalBackdropClick($event)">
      <div class="modal-content" (click)="onModalContentClick($event)">
        <div class="modal-header">
          <h3>📋 Crear Nuevo Informe Técnico</h3>
          <button class="close-btn" (click)="closeCreateReportModal()">✕</button>
        </div>
        
        <div class="modal-body">
          <form class="report-form" (ngSubmit)="onCreateReport()" #reportForm="ngForm">
            <!-- Selector de Invernadero -->
            <div class="form-group">
              <label for="invernadero">🏠 Invernadero *</label>
              <div class="custom-dropdown" (clickOutside)="showInvernaderoDropdown = false">
                <div class="input-container">
                  <input 
                    type="text" 
                    placeholder="Buscar invernadero..."
                    [(ngModel)]="searchInvernadero"
                    name="searchInvernadero"
                    class="dropdown-input"
                    (focus)="onInvernaderoFocus()"
                    (input)="filterInvernaderos()">
                  <span class="dropdown-arrow" (click)="toggleInvernaderoDropdown()">
                    {{showInvernaderoDropdown ? '▲' : '▼'}}
                  </span>
                </div>
                  
                <!-- Hidden input para validación -->
                <input 
                  type="hidden" 
                  [(ngModel)]="reportData.invernadero" 
                  name="invernadero" 
                  required>
                  
                <div class="dropdown-panel" *ngIf="showInvernaderoDropdown" (click)="$event.stopPropagation()">
                  <div class="dropdown-content">
                    <div *ngFor="let group of getFilteredInvernaderos()" class="group-section">
                      <div 
                        class="group-header" 
                        (click)="onCabezalClick($event, group.cabezal)">
                        <span class="group-icon">{{isCabezalCollapsed(group.cabezal) ? '▶' : '▼'}}</span>
                        <span class="group-name">{{group.cabezal}}</span>
                        <span class="group-count">({{group.invernaderos.length}})</span>
                      </div>
                      
                      <div class="group-items" *ngIf="!isCabezalCollapsed(group.cabezal)">
                        <div 
                          *ngFor="let inv of group.invernaderos" 
                          class="dropdown-item"
                          [class.selected]="reportData.invernadero === inv.nombre"
                          (click)="onInvernaderoClick($event, inv.nombre)">
                          {{inv.nombre}}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Selector de Estado Planta (MULTISELECT) -->
            <div class="form-group">
              <label for="estadoPlanta">🌱 Estados de la Planta * (Múltiples)</label>
              
              <!-- Mostrar estados seleccionados -->
              <div class="selected-items" *ngIf="selectedEstadosPlanta.length > 0">
                <span *ngFor="let estado of selectedEstadosPlanta; let i = index" 
                      class="selected-chip">
                  {{estado}}
                  <button type="button" class="remove-chip" (click)="removeEstadoPlanta(estado)">×</button>
                </span>
              </div>
              
              <div class="custom-dropdown" (clickOutside)="showEstadoPlantaDropdown = false">
                <div class="input-container">
                  <input 
                    type="text" 
                    placeholder="Buscar estados de planta..."
                    [(ngModel)]="searchEstadoPlanta"
                    name="searchEstadoPlanta"
                    class="dropdown-input"
                    (focus)="onEstadoPlantaFocus()"
                    (input)="filterEstadosPlanta()">
                  <span class="dropdown-arrow" (click)="toggleEstadoPlantaDropdown()">
                    {{showEstadoPlantaDropdown ? '▲' : '▼'}}
                  </span>
                </div>
                  
                <!-- Hidden input para validación -->
                <input 
                  type="hidden" 
                  [(ngModel)]="reportData.estadoPlanta" 
                  name="estadoPlanta" 
                  required>
                  
                <div class="dropdown-panel" *ngIf="showEstadoPlantaDropdown" (click)="$event.stopPropagation()">
                  <div class="dropdown-content">
                    <div *ngFor="let group of getFilteredEstadosPlanta()" class="group-section">
                      <!-- Elemento plano (sin agrupación) - Mismo nivel que cabeceras -->
                      <div *ngIf="group.isFlat" class="flat-item checkbox-item">
                        <label class="checkbox-label">
                          <input type="checkbox" 
                                 [checked]="selectedEstadosPlanta.includes(group.estados[0].nombre_estado)"
                                 (change)="toggleEstadoPlanta(group.estados[0].nombre_estado)">
                          <span class="checkmark"></span>
                          {{group.estados[0].nombre_estado}}
                        </label>
                      </div>
                      
                      <!-- Elemento agrupado (normal) -->
                      <ng-container *ngIf="!group.isFlat">
                        <div class="group-header">
                          <span class="group-name">{{group.tipo}}</span>
                        </div>
                        
                        <div class="group-items">
                          <div *ngFor="let estado of group.estados" class="dropdown-item checkbox-item">
                            <label class="checkbox-label">
                              <input type="checkbox" 
                                     [checked]="selectedEstadosPlanta.includes(estado.nombre_estado)"
                                     (change)="toggleEstadoPlanta(estado.nombre_estado)">
                              <span class="checkmark"></span>
                              {{estado.subtipo_estado || estado.nombre_estado}}
                            </label>
                          </div>
                        </div>
                      </ng-container>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Porcentajes Estados Planta (DINÁMICOS) -->
            <div class="form-group" *ngIf="selectedEstadosPlanta.length > 0">
              <label>📊 Porcentajes por Estado de Planta *</label>
              <div class="percentage-sliders">
                <div *ngFor="let estado of selectedEstadosPlanta; let i = index" class="slider-group">
                  <label class="slider-label">
                    🌱 {{estado}}: {{estadosPlantaPercentages[estado] || 0}}%
                  </label>
                  <input 
                    type="range" 
                    [(ngModel)]="estadosPlantaPercentages[estado]"
                    [name]="'porcentajePlanta_' + i"
                    min="0" 
                    max="100" 
                    (input)="updateReportDataPlanta()"
                    class="slider">
                  <div class="slider-labels">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Selector de Género -->
            <div class="form-group">
              <label for="genero">🔬 Género *</label>
              <div class="custom-dropdown" (clickOutside)="showGeneroDropdown = false">
                <div class="input-container">
                  <input 
                    type="text" 
                    placeholder="Buscar género..."
                    [(ngModel)]="searchGenero"
                    name="searchGenero"
                    class="dropdown-input"
                    (focus)="onGeneroFocus()"
                    (input)="filterGeneros()">
                  <span class="dropdown-arrow" (click)="toggleGeneroDropdown()">
                    {{showGeneroDropdown ? '▲' : '▼'}}
                  </span>
                </div>
                  
                <!-- Hidden input para validación -->
                <input 
                  type="hidden" 
                  [(ngModel)]="reportData.genero" 
                  name="genero" 
                  required>
                  
                <div class="dropdown-panel" *ngIf="showGeneroDropdown" (click)="$event.stopPropagation()">
                  <div class="dropdown-content">
                    <div 
                      *ngFor="let genero of getFilteredGeneros()" 
                      class="dropdown-item"
                      [class.selected]="reportData.genero === genero"
                      (click)="onGeneroClick($event, genero)">
                      {{genero}}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Selector de Estado Género (MULTISELECT) -->
            <div class="form-group">
              <label for="estadoGenero">⚗️ Estados del Género * (Múltiples)</label>
              
              <!-- Mostrar estados seleccionados -->
              <div class="selected-items" *ngIf="selectedEstadosGenero.length > 0">
                <span *ngFor="let estado of selectedEstadosGenero; let i = index" 
                      class="selected-chip">
                  {{estado}}
                  <button type="button" class="remove-chip" (click)="removeEstadoGenero(estado)">×</button>
                </span>
              </div>
              
              <div class="custom-dropdown" (clickOutside)="showEstadoGeneroDropdown = false">
                <div class="input-container">
                  <input 
                    type="text" 
                    placeholder="Buscar estados del género..."
                    [(ngModel)]="searchEstadoGenero"
                    name="searchEstadoGenero"
                    class="dropdown-input"
                    (focus)="onEstadoGeneroFocus()"
                    (input)="filterEstadosGenero()">
                  <span class="dropdown-arrow" (click)="toggleEstadoGeneroDropdown()">
                    {{showEstadoGeneroDropdown ? '▲' : '▼'}}
                  </span>
                </div>
                  
                <!-- Hidden input para validación -->
                <input 
                  type="hidden" 
                  [(ngModel)]="reportData.estadoGenero" 
                  name="estadoGenero" 
                  required>
                  
                <div class="dropdown-panel" *ngIf="showEstadoGeneroDropdown" (click)="$event.stopPropagation()">
                  <div class="dropdown-content">
                    <div *ngFor="let group of getFilteredEstadosGenero()" class="group-section">
                      <!-- Elemento plano (sin agrupación) - Mismo nivel que cabeceras -->
                      <div *ngIf="group.isFlat" class="flat-item checkbox-item">
                        <label class="checkbox-label">
                          <input type="checkbox" 
                                 [checked]="selectedEstadosGenero.includes(group.estados[0].nombre_estado)"
                                 (change)="toggleEstadoGenero(group.estados[0].nombre_estado)">
                          <span class="checkmark"></span>
                          {{group.estados[0].nombre_estado}}
                        </label>
                      </div>
                      
                      <!-- Elemento agrupado (normal) -->
                      <ng-container *ngIf="!group.isFlat">
                        <div class="group-header">
                          <span class="group-name">{{group.tipo}}</span>
                        </div>
                        
                        <div class="group-items">
                          <div *ngFor="let estado of group.estados" class="dropdown-item checkbox-item">
                            <label class="checkbox-label">
                              <input type="checkbox" 
                                     [checked]="selectedEstadosGenero.includes(estado.nombre_estado)"
                                     (change)="toggleEstadoGenero(estado.nombre_estado)">
                              <span class="checkmark"></span>
                              {{estado.subtipo_estado || estado.nombre_estado}}
                            </label>
                          </div>
                        </div>
                      </ng-container>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Porcentajes Estados Género (DINÁMICOS) -->
            <div class="form-group" *ngIf="selectedEstadosGenero.length > 0">
              <label>📈 Porcentajes por Estado de Género *</label>
              <div class="percentage-sliders">
                <div *ngFor="let estado of selectedEstadosGenero; let i = index" class="slider-group">
                  <label class="slider-label">
                    ⚗️ {{estado}}: {{estadosGeneroPercentages[estado] || 0}}%
                  </label>
                  <input 
                    type="range" 
                    [(ngModel)]="estadosGeneroPercentages[estado]"
                    [name]="'porcentajeGenero_' + i"
                    min="0" 
                    max="100" 
                    (input)="updateReportDataGenero()"
                    class="slider">
                  <div class="slider-labels">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Fecha Máxima de Recogida -->
            <div class="form-group">
              <label for="fechaMax">📅 Fecha Máxima de Recogida Estimada</label>
              <input 
                type="date" 
                id="fechaMax" 
                [(ngModel)]="reportData.fechaMax" 
                name="fechaMax"
                class="form-input">
            </div>

            <!-- Descripción -->
            <div class="form-group">
              <label for="descripcion">📝 Descripción</label>
              <textarea 
                id="descripcion" 
                [(ngModel)]="reportData.descripcion" 
                name="descripcion" 
                rows="4" 
                placeholder="Observaciones adicionales..."
                class="form-textarea"></textarea>
            </div>

            <!-- Botones -->
            <div class="form-actions">
              <button type="button" class="btn-cancel" (click)="closeCreateReportModal()">
                ❌ Cancelar
              </button>
              <button 
                type="submit" 
                class="btn-create" 
                [disabled]="!reportForm.valid || isCreatingReport">
                <span *ngIf="!isCreatingReport">✅ Crear Informe</span>
                <span *ngIf="isCreatingReport">⏳ Creando...</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Modal de confirmación para cancelar -->
    <div class="modal-overlay" *ngIf="showCancelConfirmModal" (click)="closeCancelConfirm()">
      <div class="confirm-modal" (click)="$event.stopPropagation()">
        <h3>⚠️ Confirmar Cancelación</h3>
        <p>¿Estás seguro de que quieres salir? Se perderá todo el progreso del informe.</p>
        <div class="confirm-actions">
          <button class="btn-no" (click)="closeCancelConfirm()">No, continuar</button>
          <button class="btn-yes" (click)="confirmCancel()">Sí, salir</button>
        </div>
      </div>
    </div>

    <!-- Modal de Analytics -->
    <div class="analytics-modal" *ngIf="showAnalyticsModal">
      <div class="analytics-modal-content">
        <div class="analytics-modal-header">
          <h2 class="analytics-modal-title">📊 Estado de Invernaderos - Analytics</h2>
          <button class="close-analytics-btn" (click)="closeAnalyticsModal()">✕</button>
        </div>
        
        <!-- Selector de Invernaderos -->
        <div class="invernadero-selection">
          <h3>🏠 Selecciona Invernaderos:</h3>
          
          <!-- Dropdown de Invernaderos Multi-selección -->
          <div class="form-group">
            <div class="custom-dropdown" (clickOutside)="onAnalyticsDropdownClickOutside($event)">
              <div class="input-container">
                <input 
                  type="text" 
                  placeholder="Buscar invernaderos para analytics..."
                  [(ngModel)]="searchAnalyticsInvernadero"
                  name="searchAnalyticsInvernadero"
                  class="dropdown-input"
                  (focus)="onAnalyticsInvernaderoFocus()"
                  (input)="filterAnalyticsInvernaderos()"
                  (click)="onAnalyticsInvernaderoInputClick($event)"
                  (keydown)="onAnalyticsInputKeydown($event)"
                  readonly>
                <span class="dropdown-arrow" (click)="toggleAnalyticsInvernaderoDropdown($event)">
                  {{showAnalyticsInvernaderoDropdown ? '▲' : '▼'}}
                </span>
              </div>
                
              <div class="dropdown-panel" 
                   *ngIf="showAnalyticsInvernaderoDropdown && groupedAnalyticsInvernaderos && groupedAnalyticsInvernaderos.length > 0" 
                   (click)="$event.stopPropagation()"
                   [style.display]="showAnalyticsInvernaderoDropdown ? 'block' : 'none'">
                <div class="dropdown-content">
                  <div *ngFor="let group of getFilteredAnalyticsInvernaderos(); trackBy: trackByGroupCabezal" class="group-section">
                    <div 
                      class="group-header" 
                      (click)="onAnalyticsCabezalClick($event, group.cabezal)">
                      <span class="group-icon">{{isAnalyticsCabezalCollapsed(group.cabezal) ? '▶' : '▼'}}</span>
                      <span class="group-name">{{group.cabezal}}</span>
                      <span class="group-count">({{group.invernaderos.length}})</span>
                    </div>
                    
                    <div class="group-items" *ngIf="!isAnalyticsCabezalCollapsed(group.cabezal)">
                      <div 
                        *ngFor="let inv of group.invernaderos" 
                        class="dropdown-item multi-select-item"
                        [class.selected]="selectedInvernaderos.includes(inv.nombre)"
                        (click)="onAnalyticsInvernaderoClick($event, inv.nombre)">
                        <input 
                          type="checkbox" 
                          [checked]="selectedInvernaderos.includes(inv.nombre)"
                          (click)="$event.stopPropagation()">
                        <span class="invernadero-name">{{inv.nombre}}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Chips de invernaderos seleccionados -->
          <div class="selected-chips" *ngIf="selectedInvernaderos.length > 0">
            <div class="chip" *ngFor="let inv of selectedInvernaderos">
              {{inv}}
              <span class="chip-remove" (click)="removeSelectedInvernadero(inv)">✕</span>
            </div>
          </div>
          
          <div *ngIf="isLoadingAnalytics" class="loading-invernaderos">
            <p>⏳ Cargando invernaderos...</p>
          </div>
        </div>

        <!-- Controles de Analytics -->
        <div class="analytics-controls">
          <button 
            class="update-charts-btn" 
            (click)="updateCharts()"
            [disabled]="selectedInvernaderos.length === 0 || isLoadingAnalytics">
            <span *ngIf="!isLoadingAnalytics">📈 Actualizar Gráficos</span>
            <span *ngIf="isLoadingAnalytics">⏳ Cargando...</span>
          </button>
          <p class="selection-info">
            <strong>{{selectedInvernaderos.length}}</strong> invernadero(s) seleccionado(s)
          </p>
        </div>

          <!-- Área de Gráficas -->
          <div class="charts-container" *ngIf="analyticsData.length > 0">
            <div class="chart-section">
              <h4>📊 Evolución de Estados por Fecha</h4>
              <div style="position: relative; height: 400px; width: 100%;">
                <canvas id="lineChart" class="chart-canvas"></canvas>
              </div>
            </div>
            
            <div class="chart-section">
              <h4>📈 Promedio por Estado</h4>
              <div style="position: relative; height: 400px; width: 100%;">
                <canvas id="barChart" class="chart-canvas"></canvas>
              </div>
            </div>
          </div>        <!-- Mensaje cuando no hay datos -->
        <div class="no-data-message" *ngIf="!isLoadingAnalytics && analyticsData.length === 0 && selectedInvernaderos.length > 0">
          📭 No se encontraron datos para los invernaderos seleccionados
        </div>
        
        <!-- Mensaje inicial -->
        <div class="initial-message" *ngIf="selectedInvernaderos.length === 0 && !isLoadingAnalytics">
          👆 Selecciona uno o más invernaderos para ver los gráficos
        </div>
      </div>
    </div>

    <!-- Modal para crear informe de encargado -->
    <div class="modal-overlay" *ngIf="showCreateManagerReportModal" (click)="onManagerModalBackdropClick()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>👔 Crear Nuevo Informe de Encargado</h3>
          <button class="close-btn" (click)="requestManagerCancel()">✕</button>
        </div>
        
        <form class="report-form" (ngSubmit)="onCreateManagerReport()" #managerReportForm="ngForm">
          
          <!-- Selector de Invernadero -->
          <div class="form-group">
            <label for="invernaderoManager">🏠 Invernadero *</label>
            <div class="custom-dropdown" (clickOutside)="showInvernaderoDropdown = false">
              <div class="input-container">
                <input 
                  type="text" 
                  placeholder="Seleccionar invernadero..."
                  [(ngModel)]="searchInvernadero"
                  name="searchInvernadero"
                  class="dropdown-input"
                  (focus)="onInvernaderoFocus()"
                  (input)="filterInvernaderos()">
                <span class="dropdown-arrow" (click)="toggleInvernaderoDropdown()">
                  {{showInvernaderoDropdown ? '▲' : '▼'}}
                </span>
              </div>
                
              <!-- Hidden input para validación -->
              <input 
                type="hidden" 
                [(ngModel)]="managerReportData.invernadero" 
                name="invernadero" 
                required>
                
              <div class="dropdown-panel" *ngIf="showInvernaderoDropdown">
                <div class="dropdown-content">
                  <div *ngFor="let group of getFilteredInvernaderos()" class="group-section">
                    <div class="group-header" (click)="toggleCabezal(group.cabezal)">
                      <span class="group-name">{{group.cabezal}}</span>
                      <span class="collapse-icon">{{isCabezalCollapsed(group.cabezal) ? '▼' : '▲'}}</span>
                    </div>
                    
                    <div class="group-items" *ngIf="!isCabezalCollapsed(group.cabezal)">
                      <div 
                        *ngFor="let inv of group.invernaderos" 
                        class="dropdown-item"
                        [class.selected]="managerReportData.invernadero === inv.nombre"
                        (click)="onManagerInvernaderoClick($event, inv.nombre)">
                        {{inv.nombre}}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Selector de Género -->
          <div class="form-group">
            <label for="generoManager">🔬 Género *</label>
            <div class="custom-dropdown" (clickOutside)="showGeneroDropdown = false">
              <div class="input-container">
                <input 
                  type="text" 
                  placeholder="Buscar género..."
                  [(ngModel)]="searchGenero"
                  name="searchGenero"
                  class="dropdown-input"
                  (focus)="onGeneroFocus()"
                  (input)="filterGeneros()">
                <span class="dropdown-arrow" (click)="toggleGeneroDropdown()">
                  {{showGeneroDropdown ? '▲' : '▼'}}
                </span>
              </div>
                
              <!-- Hidden input para validación -->
              <input 
                type="hidden" 
                [(ngModel)]="managerReportData.genero" 
                name="genero" 
                required>
                
              <div class="dropdown-panel" *ngIf="showGeneroDropdown">
                <div class="dropdown-content">
                  <div 
                    *ngFor="let genero of getFilteredGeneros()" 
                    class="dropdown-item"
                    [class.selected]="managerReportData.genero === genero"
                    (click)="onManagerGeneroClick($event, genero)">
                    {{genero}}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- KG Totales -->
          <div class="form-group">
            <label for="kgTotales">⚖️ KG Totales del Invernadero *</label>
            <input 
              type="number" 
              id="kgTotales" 
              [(ngModel)]="managerReportData.kgTotales"
              name="kgTotales"
              min="0"
              step="0.01"
              required
              class="form-input"
              placeholder="Ej: 1500.50">
          </div>

          <!-- Botón para agregar intervalos -->
          <div class="form-group">
            <button type="button" class="add-interval-btn" (click)="addColorationInterval()">
              🎨 Añadir Intervalos de Coloración
            </button>
          </div>

          <!-- Lista de intervalos de coloración -->
          <div class="intervals-container" *ngIf="colorationIntervals.length > 0">
            <h4>📊 Intervalos de Coloración</h4>
            
            <div *ngFor="let interval of colorationIntervals; let i = index" class="interval-item">
              <div class="interval-header">
                <span class="interval-title">Intervalo {{i + 1}}</span>
                <button type="button" class="remove-interval-btn" (click)="removeColorationInterval(interval.id)">×</button>
              </div>
              
              <div class="interval-controls">
                <div class="range-container">
                  <label>Rango de coloración (0-15): {{interval.rangeStart}} - {{interval.rangeEnd}}</label>
                  <div class="slider-container">
                    <div class="slider-labels">
                      <span>0</span>
                      <span>15</span>
                    </div>
                    <div class="dual-range-slider">
                      <input 
                        type="range" 
                        [(ngModel)]="interval.rangeStart"
                        [name]="'rangeStart_' + interval.id"
                        min="0" 
                        max="15" 
                        step="1"
                        class="slider slider-start"
                        [style.z-index]="interval.rangeStart > interval.rangeEnd - 1 ? '2' : '1'">
                      <input 
                        type="range" 
                        [(ngModel)]="interval.rangeEnd"
                        [name]="'rangeEnd_' + interval.id"
                        min="0" 
                        max="15" 
                        step="1"
                        class="slider slider-end">
                    </div>
                  </div>
                </div>
                
                <div class="kg-container">
                  <label>KG de esta coloración:</label>
                  <input 
                    type="number" 
                    [(ngModel)]="interval.kg"
                    [name]="'kg_' + interval.id"
                    min="0"
                    step="0.01"
                    class="kg-input"
                    placeholder="0.00">
                </div>
              </div>
            </div>
            
            <!-- Resumen de KG -->
            <div class="kg-summary" [class.invalid]="getTotalIntervalKg() !== managerReportData.kgTotales">
              <div class="kg-totals">
                <span>KG Asignados: {{getTotalIntervalKg()}} / {{managerReportData.kgTotales}}</span>
                <span *ngIf="getTotalIntervalKg() !== managerReportData.kgTotales" class="kg-warning">
                  ⚠️ Los KG de intervalos deben coincidir con el total
                </span>
              </div>
            </div>
          </div>

          <!-- Necesidad de Cogida -->
          <div class="form-group">
            <div class="toggle-container">
              <label class="toggle-label">
                <span class="toggle-text">🤏 Necesidad de cogida</span>
                <div class="toggle-switch">
                  <input 
                    type="checkbox" 
                    [(ngModel)]="managerReportData.necesidadCogida" 
                    name="necesidadCogida"
                    class="toggle-input">
                  <span class="toggle-slider"></span>
                </div>
              </label>
            </div>

            <!-- Razón de cogida (solo si necesidad está activada) -->
            <div class="form-group" *ngIf="managerReportData.necesidadCogida">
              <label for="razonCogida">💡 Razón de cogida</label>
              <div class="dropdown-container">
                <input 
                  type="text" 
                  [(ngModel)]="searchEstadoGeneroManager" 
                  (input)="onSearchEstadoGeneroManagerChange()" 
                  (focus)="showEstadoGeneroManagerDropdown = true"
                  (click)="toggleEstadoGeneroManagerDropdown()"
                  placeholder="Seleccionar razón de cogida..." 
                  class="dropdown-input">
                <div class="dropdown-arrow" (click)="toggleEstadoGeneroManagerDropdown()">▼</div>
                
                <div class="dropdown-list" *ngIf="showEstadoGeneroManagerDropdown">
                  <div 
                    *ngFor="let estado of filteredEstadosGeneroManager"
                    class="dropdown-item" 
                    (click)="onManagerRazonCogidaClick($event, estado)">
                    {{estado}}
                  </div>
                  <div *ngIf="filteredEstadosGeneroManager.length === 0" class="dropdown-item disabled">
                    No se encontraron estados
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Descripción -->
          <div class="form-group">
            <label for="descripcionManager">📝 Descripción Adicional</label>
            <textarea 
              id="descripcionManager" 
              [(ngModel)]="managerReportData.descripcion" 
              name="descripcion"
              class="form-input textarea"
              rows="3"
              placeholder="Descripción adicional del estado del invernadero..."></textarea>
          </div>

          <div class="form-actions">
            <button type="button" class="btn-cancel" (click)="requestManagerCancel()">
              ❌ Cancelar
            </button>
            <button type="submit" class="btn-create" [disabled]="!isManagerReportValid() || isCreatingManagerReport">
              <span *ngIf="!isCreatingManagerReport">✅ Crear Informe</span>
              <span *ngIf="isCreatingManagerReport">⏳ Creando...</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal de confirmación para salir del informe de encargado -->
    <div class="modal-overlay" *ngIf="showManagerCancelConfirmModal" (click)="closeManagerCancelConfirm()">
      <div class="confirm-modal" (click)="$event.stopPropagation()">
        <h3>⚠️ Confirmar Cancelación</h3>
        <p>¿Estás seguro de que quieres salir del informe de encargado? Se perderá todo el progreso.</p>
        <div class="confirm-actions">
          <button class="btn-no" (click)="closeManagerCancelConfirm()">No, continuar</button>
          <button class="btn-yes" (click)="confirmManagerCancel()">Sí, salir</button>
        </div>
      </div>
    </div>

    <!-- Modal para consultar informes de cogida -->
    <div class="modal-overlay" *ngIf="showCogidaReportsModal" (click)="onCogidaModalBackdropClick()">
      <div class="modal-content cogida-modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>🤏 Consultar Informes de Cogida</h3>
          <button class="close-btn" (click)="closeCogidaReportsModal()">✕</button>
        </div>
        
        <div class="modal-body">
          <!-- Selector de Invernadero -->
          <div class="form-group">
            <label for="cogidaInvernadero">🏠 Seleccionar Invernadero *</label>
            <div class="custom-dropdown" (clickOutside)="showCogidaInvernaderoDropdown = false">
              <div class="input-container">
                <input 
                  type="text" 
                  placeholder="Buscar invernadero..."
                  [(ngModel)]="searchCogidaInvernadero"
                  name="searchCogidaInvernadero"
                  class="dropdown-input"
                  (focus)="onCogidaInvernaderoFocus()"
                  (input)="filterCogidaInvernaderos()">
                <span class="dropdown-arrow" (click)="toggleCogidaInvernaderoDropdown()">
                  {{showCogidaInvernaderoDropdown ? '▲' : '▼'}}
                </span>
              </div>
                
              <div class="dropdown-panel" *ngIf="showCogidaInvernaderoDropdown">
                <div class="dropdown-content">
                  <div *ngFor="let group of getFilteredCogidaInvernaderos()" class="group-section">
                    <div class="group-header" (click)="toggleCogidaCabezal(group.cabezal)">
                      <span class="group-name">{{group.cabezal}}</span>
                      <span class="collapse-icon">{{isCogidaCabezalCollapsed(group.cabezal) ? '▼' : '▲'}}</span>
                    </div>
                    
                    <div class="group-items" *ngIf="!isCogidaCabezalCollapsed(group.cabezal)">
                      <div 
                        *ngFor="let inv of group.invernaderos" 
                        class="dropdown-item"
                        [class.selected]="selectedCogidaInvernadero === inv.nombre"
                        (click)="onCogidaInvernaderoClick($event, inv.nombre)">
                        {{inv.nombre}}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Botón de búsqueda -->
          <div class="form-group">
            <button 
              class="search-cogida-btn" 
              [disabled]="!selectedCogidaInvernadero || isLoadingCogidaReports"
              (click)="searchCogidaReports()">
              <span *ngIf="!isLoadingCogidaReports">🔍 Buscar Informes</span>
              <span *ngIf="isLoadingCogidaReports">⏳ Buscando...</span>
            </button>
          </div>

          <!-- Carrusel de fechas/informes -->
          <div class="cogida-results" *ngIf="cogidaReports.length > 0">
            <h4>📋 Informes encontrados para {{selectedCogidaInvernadero}}</h4>
            
            <!-- Navegación del carrusel -->
            <div class="carousel-navigation" *ngIf="cogidaReports.length > 1">
              <button 
                class="carousel-btn prev-btn" 
                [disabled]="activeCogidaReportIndex === 0"
                (click)="prevCogidaReport()">
                ◀ Anterior
              </button>
              
              <span class="carousel-counter">
                {{activeCogidaReportIndex + 1}} / {{cogidaReports.length}}
              </span>
              
              <button 
                class="carousel-btn next-btn" 
                [disabled]="activeCogidaReportIndex === cogidaReports.length - 1"
                (click)="nextCogidaReport()">
                Siguiente ▶
              </button>
            </div>

            <!-- Pestañas con fechas -->
            <div class="date-tabs" *ngIf="cogidaReports.length > 1">
              <button 
                *ngFor="let report of cogidaReports; let i = index" 
                class="date-tab"
                [class.active]="i === activeCogidaReportIndex"
                [class.cogida-needed]="report.necesidadcogida === '1'"
                (click)="setActiveCogidaReport(i)">
                📅 {{report.fecha}}
              </button>
            </div>

            <!-- Contenido del informe activo -->
            <div class="report-details" *ngIf="cogidaReports[activeCogidaReportIndex]">
              <div class="report-card">
                <div class="report-header">
                  <h5>📋 Informe del {{cogidaReports[activeCogidaReportIndex].fecha}}</h5>
                  <span class="report-code">Código: {{cogidaReports[activeCogidaReportIndex].codigo}}</span>
                </div>
                
                <div class="report-content">
                  <div class="report-field">
                    <strong>👤 Encargado:</strong> {{cogidaReports[activeCogidaReportIndex].nombre_encargado}}
                  </div>
                  <div class="report-field">
                    <strong>🔬 Género:</strong> {{cogidaReports[activeCogidaReportIndex].genero}}
                  </div>
                  <div class="report-field">
                    <strong>⚖️ KG Totales:</strong> {{cogidaReports[activeCogidaReportIndex].kilos}}
                  </div>
                  <div class="report-field intervals-table-container" *ngIf="cogidaReports[activeCogidaReportIndex].intervalokg && cogidaReports[activeCogidaReportIndex].kgintervalo">
                    <strong>🎨 Intervalos de Coloración y KG:</strong>
                    <div class="intervals-table">
                      <div class="table-header">
                        <div class="table-cell header-cell">Intervalo</div>
                        <div class="table-cell header-cell">KG</div>
                      </div>
                      <ng-container *ngFor="let interval of getIntervalTableData(cogidaReports[activeCogidaReportIndex]); let i = index">
                        <div class="table-row">
                          <div class="table-cell interval-cell">{{interval.range}}</div>
                          <div class="table-cell kg-cell">{{interval.kg}}</div>
                        </div>
                      </ng-container>
                    </div>
                  </div>
                  <div class="report-field" *ngIf="cogidaReports[activeCogidaReportIndex].intervalokg && !cogidaReports[activeCogidaReportIndex].kgintervalo">
                    <strong>🎨 Intervalos de Coloración:</strong> {{cogidaReports[activeCogidaReportIndex].intervalokg}}
                  </div>
                  <div class="report-field" *ngIf="!cogidaReports[activeCogidaReportIndex].intervalokg && cogidaReports[activeCogidaReportIndex].kgintervalo">
                    <strong>📊 KG por Intervalo:</strong> {{cogidaReports[activeCogidaReportIndex].kgintervalo}}
                  </div>
                  <div class="report-field">
                    <strong>🤏 Necesidad de Cogida:</strong> 
                    <span [class]="cogidaReports[activeCogidaReportIndex].necesidadcogida === '1' ? 'status-yes' : 'status-no'">
                      {{cogidaReports[activeCogidaReportIndex].necesidadcogida === '1' ? 'Sí' : 'No'}}
                    </span>
                  </div>
                  <div class="report-field" *ngIf="cogidaReports[activeCogidaReportIndex].necesidadcogida === '1' && cogidaReports[activeCogidaReportIndex].razoncogida">
                    <strong>💡 Razón de Cogida:</strong> {{cogidaReports[activeCogidaReportIndex].razoncogida}}
                  </div>
                  <div class="report-field" *ngIf="cogidaReports[activeCogidaReportIndex].descripcion">
                    <strong>📝 Descripción:</strong> {{cogidaReports[activeCogidaReportIndex].descripcion}}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Mensaje cuando no hay resultados -->
          <div class="no-results" *ngIf="cogidaSearchExecuted && cogidaReports.length === 0">
            <div class="no-results-icon">📭</div>
            <h4>No se encontraron informes</h4>
            <p>No hay informes de cogida registrados para el invernadero <strong>{{selectedCogidaInvernadero}}</strong>.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Overlay de carga global -->
    <div *ngIf="showGlobalLoading" class="global-loading-overlay">
      <div class="global-loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-message">{{loadingMessage}}</div>
      </div>
    </div>
  `,
  styles: [`
    .tecnico-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 50%, #ff6b35 100%);
    }
    
    .tecnico-header {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      padding: 2rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }
    
    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    
    .tecnico-header h1 {
      color: white;
      font-size: 2.5rem;
      margin: 0;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    
    .subtitle {
      color: rgba(255, 255, 255, 0.9);
      font-size: 1.2rem;
      margin: 0.5rem 0 0 0;
    }
    
    .logout-btn {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: 2px solid rgba(255, 255, 255, 0.3);
      padding: 0.75rem 1.5rem;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      backdrop-filter: blur(10px);
    }
    
    .logout-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      border-color: rgba(255, 255, 255, 0.5);
      transform: translateY(-2px);
    }
    
    .tecnico-main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 3rem 2rem;
    }
    
    .welcome-card {
      background: rgba(255, 255, 255, 0.95);
      padding: 3rem;
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      text-align: center;
    }
    
    .welcome-card h2 {
      color: #ff6b35;
      font-size: 2rem;
      margin-bottom: 1rem;
    }
    
    .welcome-card > p {
      color: #666;
      font-size: 1.1rem;
      margin-bottom: 2rem;
    }
    
    .actions-section {
      margin: 2rem 0;
    }
    
    .create-report-btn {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
      color: white;
      border: none;
      padding: 1rem 2rem;
      border-radius: 15px;
      font-size: 1.2rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);
    }
    
    .create-report-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(255, 107, 53, 0.4);
    }

    .analytics-btn {
      background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
      color: white;
      border: none;
      padding: 1rem 2rem;
      border-radius: 15px;
      font-size: 1.2rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(74, 144, 226, 0.3);
      margin-left: 1rem;
    }

    .analytics-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(74, 144, 226, 0.4);
    }

    .analytics-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      z-index: 9999;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      backdrop-filter: blur(5px);
      overflow-y: auto;
      padding: 1rem 0;
    }

    .analytics-modal-content {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
      border-radius: 20px;
      width: 90%;
      max-width: 1200px;
      height: auto;
      overflow: visible;
      color: white;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      position: relative;
      margin: auto;
    }

    .analytics-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid rgba(255, 255, 255, 0.2);
    }

    .analytics-modal-title {
      font-size: 2rem;
      font-weight: 700;
      margin: 0;
      color: white;
    }

    .close-analytics-btn {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 10px;
      font-size: 1.5rem;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .close-analytics-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
    }

    .invernadero-selection {
      background: rgba(255, 255, 255, 0.1);
      padding: 1.5rem;
      border-radius: 15px;
      margin-bottom: 2rem;
      backdrop-filter: blur(10px);
    }

    .invernadero-selection h3 {
      color: white;
      margin-bottom: 1rem;
      font-size: 1.3rem;
      font-weight: 600;
    }

    .invernadero-checkboxes {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .checkbox-item {
      display: flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.1);
      padding: 0.8rem;
      border-radius: 10px;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .checkbox-item:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
    }

    .checkbox-item input[type="checkbox"] {
      margin-right: 0.8rem;
      transform: scale(1.2);
      accent-color: #4a90e2;
    }

    .checkbox-item label {
      color: white;
      font-weight: 500;
      cursor: pointer;
      user-select: none;
    }

    .charts-container {
      display: flex;
      flex-direction: column;
      gap: 2rem;
      margin-top: 2rem;
      width: 100%;
    }

    .chart-section {
      background: rgba(255, 255, 255, 0.1);
      padding: 1.5rem;
      border-radius: 15px;
      backdrop-filter: blur(10px);
      width: 100%;
      height: auto;
    }

    .chart-section h4 {
      color: white;
      margin-bottom: 1rem;
      font-size: 1.2rem;
      font-weight: 600;
      text-align: center;
    }

    .chart-canvas {
      max-width: 100%;
      height: 400px !important;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 10px;
    }

    .analytics-controls {
      display: flex;
      justify-content: center;
      gap: 1rem;
      margin: 2rem 0;
    }

    .update-charts-btn {
      background: linear-gradient(135deg, #1565c0 0%, #1976d2 100%);
      color: white;
      border: none;
      padding: 0.8rem 1.5rem;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .update-charts-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);
    }

    .update-charts-btn:disabled {
      background: #6c757d;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .no-data-message {
      text-align: center;
      color: rgba(255, 255, 255, 0.8);
      font-size: 1.1rem;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 15px;
      margin: 2rem 0;
    }

    .initial-message {
      text-align: center;
      color: rgba(255, 255, 255, 0.7);
      font-size: 1.2rem;
      padding: 3rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 15px;
      margin: 2rem 0;
      border: 2px dashed rgba(255, 255, 255, 0.3);
    }

    .selection-info {
      color: rgba(255, 255, 255, 0.9);
      font-size: 0.9rem;
      margin: 0;
      display: flex;
      align-items: center;
    }

    .no-invernaderos, .loading-invernaderos {
      text-align: center;
      color: rgba(255, 255, 255, 0.8);
      padding: 1rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      margin: 1rem 0;
    }

    .analytics-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin: 2rem 0;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 15px;
    }

    .multi-select-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .multi-select-item input[type="checkbox"] {
      margin: 0;
      transform: scale(1.2);
      accent-color: #4a90e2;
    }

    .multi-select-item .invernadero-name {
      flex: 1;
    }

    .selected-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 10px;
    }

    .chip {
      background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .chip-remove {
      cursor: pointer;
      font-weight: bold;
      padding: 0.2rem;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      transition: all 0.2s ease;
    }

    .chip-remove:hover {
      background: rgba(255, 255, 255, 0.4);
      transform: scale(1.1);
    }

    @media (max-width: 768px) {
      .modal-overlay, .analytics-modal {
        padding: 0.5rem 0;
        align-items: flex-start;
      }
      
      .modal-content {
        width: 95%;
        margin: 0.5rem auto;
      }
      
      .modal-body {
        padding: 1.5rem;
      }
      
      .analytics-modal-content {
        width: 95%;
        padding: 1rem;
        margin: 0.5rem auto;
      }
      
      .invernadero-checkboxes {
        grid-template-columns: 1fr;
      }
      
      .chart-section {
        height: auto;
        padding: 1rem;
      }
      
      .chart-canvas {
        height: 300px !important;
      }
    }
    
    .info-section {
      margin-top: 2rem;
      padding: 2rem;
      background: #fff8f0;
      border-radius: 15px;
      border: 2px solid #ff6b35;
    }
    
    .info-section h3 {
      color: #ff6b35;
      margin-bottom: 1rem;
    }
    
    .cabezales-info {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: center;
    }
    
    .cabezal-chip {
      background: #ff6b35;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 500;
    }
    
    .no-cabezales {
      color: #666;
      font-style: italic;
    }

    /* Modal Styles - SIN SCROLL INTERNO */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      z-index: 1000;
      backdrop-filter: blur(5px);
      overflow-y: auto;
      padding: 1rem 0;
    }
    
    .modal-content {
      background: white;
      border-radius: 20px;
      width: 98%;
      max-width: 900px;
      height: auto;
      overflow: visible;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      margin: auto;
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem 2rem;
      border-bottom: 1px solid #eee;
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
      color: white;
      border-radius: 20px 20px 0 0;
    }
    
    .modal-header h3 {
      margin: 0;
      font-size: 1.3rem;
    }
    
    .close-btn {
      background: none;
      border: none;
      color: white;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 50%;
      transition: all 0.3s ease;
    }
    
    .close-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    
    .modal-body {
      padding: 2.5rem 2rem;
    }
    
    .report-form {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0 1.5rem; /* Separar contenido del borde */
    }
    
    .form-group label {
      font-weight: 600;
      color: #333;
      font-size: 1rem;
    }
    
    .form-select, .form-input, .form-textarea {
      padding: 0.75rem;
      border: 2px solid #e1e5e9;
      border-radius: 10px;
      font-size: 1rem;
      transition: all 0.3s ease;
    }
    
    .form-select:focus, .form-input:focus, .form-textarea:focus {
      outline: none;
      border-color: #ff6b35;
      box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
    }

    /* Estilos para desplegables con buscador */
    .searchable-select {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .search-input {
      padding: 0.5rem 0.75rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 0.9rem;
      background: #f8f9fa;
      transition: all 0.3s ease;
    }
    
    .search-input:focus {
      outline: none;
      border-color: #ff6b35;
      background: white;
      box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.1);
    }
    
    .expand-all-btn {
      padding: 0.5rem;
      background: #f8f9fa;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.3s ease;
      align-self: flex-start;
    }
    
    .expand-all-btn:hover {
      background: #e9ecef;
      border-color: #ff6b35;
    }

    /* Dropdown personalizado */
    .custom-dropdown {
      position: relative;
    }

    .input-container {
      position: relative;
      display: flex;
      align-items: center;
    }

    .dropdown-container {
      position: relative;
      display: flex;
      align-items: center;
    }

    .dropdown-list {
      position: absolute;
      top: calc(100% + 2px);
      left: -1.5rem; /* Compensar por el margin del form-group */
      right: -1.5rem; /* Compensar por el margin del form-group */
      background: white;
      border: 2px solid #e1e5e9;
      border-radius: 10px;
      max-height: 200px;
      overflow-y: auto;
      z-index: 9999; /* Muy alto para que aparezca por encima del modal */
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      transform: translateY(0); /* Para animaciones futuras */
    }

    .dropdown-item {
      padding: 0.75rem 1rem;
      cursor: pointer;
      border-bottom: 1px solid #f8f9fa;
      transition: background-color 0.2s ease;
    }

    .dropdown-item:hover {
      background-color: #f8f9fa;
    }

    .dropdown-item.disabled {
      color: #6c757d;
      cursor: not-allowed;
      font-style: italic;
    }

    .dropdown-item.disabled:hover {
      background-color: transparent;
    }

    .dropdown-input {
      width: 100%;
      padding: 0.75rem 3rem 0.75rem 0.75rem;
      border: 2px solid #e1e5e9;
      border-radius: 10px;
      font-size: 1rem;
      cursor: pointer;
      background: white;
      color: #333 !important;
      transition: all 0.3s ease;
    }

    .dropdown-arrow {
      position: absolute;
      right: 1rem;
      cursor: pointer;
      color: #666;
      font-size: 0.9rem;
      user-select: none;
      padding: 0.25rem;
      transition: color 0.3s ease;
    }

    .dropdown-arrow:hover {
      color: #ff6b35;
    }    .dropdown-input:focus {
      outline: none;
      border-color: #ff6b35;
      box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
    }
    
    .dropdown-panel {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 2px solid #ff6b35;
      border-radius: 10px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      z-index: 1000;
      max-height: 300px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .search-box {
      padding: 0.75rem;
      border-bottom: 1px solid #eee;
      background: #f8f9fa;
    }
    
    .dropdown-content {
      flex: 1;
      overflow-y: auto;
      max-height: 200px;
    }
    
    .group-section {
      border-bottom: 1px solid #f0f0f0;
    }
    
    .group-header {
      display: flex;
      align-items: center;
      padding: 0.75rem;
      background: #f8f9fa;
      cursor: pointer;
      transition: all 0.3s ease;
      font-weight: 600;
      color: #ff6b35;
    }
    
    .group-header:hover {
      background: #e9ecef;
    }

    .flat-item {
      display: flex;
      align-items: center;
      padding: 0.75rem;
      background: #f8f9fa;
      cursor: pointer;
      transition: all 0.3s ease;
      font-weight: 600;
      color: #333 !important;
      border-left: 3px solid transparent;
    }

    .flat-item:hover {
      background: #e9ecef;
      border-left-color: #ff6b35;
    }

    .flat-item.selected {
      background: rgba(255, 107, 53, 0.1);
      border-left-color: #ff6b35;
      color: #ff6b35 !important;
    }
    
    .group-icon {
      margin-right: 0.5rem;
      font-size: 0.8rem;
      transition: transform 0.3s ease;
    }
    
    .group-name {
      flex: 1;
      color: #333 !important;
    }
    
    .group-count {
      font-size: 0.8rem;
      color: #666;
      font-weight: normal;
    }
    
    .group-items {
      background: white;
    }
    
    .dropdown-item {
      padding: 0.75rem 1.5rem;
      cursor: pointer;
      transition: all 0.3s ease;
      border-left: 3px solid transparent;
      color: #333 !important;
    }
    
    .dropdown-item:hover {
      background: #f8f9fa;
      border-left-color: #ff6b35;
    }
    
    .dropdown-item.selected {
      background: rgba(255, 107, 53, 0.1);
      border-left-color: #ff6b35;
      font-weight: 600;
    }
    
    .form-textarea {
      resize: vertical;
      min-height: 100px;
    }
    
    .slider {
      width: 100%;
      height: 8px;
      border-radius: 5px;
      background: #ddd;
      outline: none;
      -webkit-appearance: none;
    }
    
    .slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #ff6b35;
      cursor: pointer;
    }
    
    .slider::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #ff6b35;
      cursor: pointer;
      border: none;
    }
    
    .slider-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
      color: #666;
      margin-top: 0.25rem;
    }
    
    .form-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin: 1.5rem -1.5rem 0 -1.5rem; /* Compensar margin del form-group */
      padding: 1.5rem 2rem;
      border-top: 1px solid #eee;
      background: rgba(248, 249, 250, 0.5);
      border-radius: 0 0 20px 20px;
    }
    
    .btn-cancel, .btn-create {
      padding: 0.75rem 1.5rem;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      border: none;
      min-width: 120px;
      max-width: 180px;
      text-align: center;
    }
    
    .btn-cancel {
      background: #f5f5f5;
      color: #666;
      border: 2px solid #ddd;
    }
    
    .btn-cancel:hover {
      background: #e9e9e9;
      border-color: #ccc;
    }
    
    .btn-create {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
      color: white;
    }
    
    .btn-create:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);
    }
    
    .btn-create:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Confirm Modal */
    .confirm-modal {
      background: white;
      padding: 2rem;
      border-radius: 15px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      max-width: 400px;
    }
    
    .confirm-modal h3 {
      color: #ff6b35;
      margin-bottom: 1rem;
    }
    
    .confirm-modal p {
      color: #666;
      margin-bottom: 2rem;
    }
    
    .confirm-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
    }
    
    .btn-no, .btn-yes {
      padding: 0.75rem 1.5rem;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      border: none;
    }
    
    .btn-no {
      background: #f5f5f5;
      color: #666;
    }
    
    .btn-no:hover {
      background: #e9e9e9;
    }
    
    .btn-yes {
      background: #dc3545;
      color: white;
    }
    
    .btn-yes:hover {
      background: #c82333;
    }

    @media (max-width: 768px) {
      .header-content {
        flex-direction: column;
        text-align: center;
      }
      
      .tecnico-header h1 {
        font-size: 2rem;
      }
      
      .welcome-card {
        padding: 2rem 1.5rem;
      }
      
      .tecnico-main {
        padding: 2rem 1rem;
      }
      
      .modal-content {
        width: 95%;
        margin: 1rem;
      }
      
      .modal-body {
        padding: 1.5rem;
      }
      
      .form-actions {
        flex-direction: column;
        margin: 1.5rem 0 0 0;
        padding: 1rem;
        gap: 0.75rem;
      }

      .btn-cancel, .btn-create {
        width: 100%;
        max-width: none;
      }
      
      .confirm-actions {
        flex-direction: column;
      }
    }

    /* Overlay de carga global */
    .global-loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      animation: fadeIn 0.3s ease-out;
    }

    .global-loading-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
      padding: 2rem;
      background-color: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      max-width: 300px;
      text-align: center;
    }

    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 4px solid #e0e0e0;
      border-top: 4px solid #ff6b35;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    .loading-message {
      font-size: 1.1rem;
      font-weight: 500;
      color: #333;
      margin: 0;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* ==================== ESTILOS MULTISELECT ==================== */
    
    .selected-items {
      margin-bottom: 0.5rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .selected-chip {
      background: linear-gradient(135deg, #ff6b35, #f7931e);
      color: white;
      padding: 0.3rem 0.8rem;
      border-radius: 20px;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      animation: slideIn 0.3s ease-out;
    }

    .remove-chip {
      background: rgba(255, 255, 255, 0.3);
      color: white;
      border: none;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .remove-chip:hover {
      background: rgba(255, 255, 255, 0.5);
      transform: scale(1.1);
    }

    .checkbox-item {
      display: flex !important;
      align-items: center;
      cursor: pointer;
      padding: 0.5rem !important;
    }

    .checkbox-item:hover {
      background: rgba(255, 107, 53, 0.1) !important;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      cursor: pointer;
      width: 100%;
      margin: 0;
      gap: 0.5rem;
    }

    .checkbox-label input[type="checkbox"] {
      margin: 0;
      width: 16px;
      height: 16px;
      accent-color: #ff6b35;
    }

    .checkmark {
      display: none; /* Usar checkbox nativo por simplicidad */
    }

    .percentage-sliders {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 1rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .slider-group {
      margin-bottom: 1rem;
      padding: 0.8rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 6px;
      border-left: 3px solid #ff6b35;
    }

    .slider-label {
      display: block;
      color: #333;
      font-weight: 600;
      margin-bottom: 0.5rem;
      font-size: 0.95rem;
    }

    .total-percentage {
      margin-top: 1rem;
      padding: 0.8rem;
      background: rgba(255, 107, 53, 0.1);
      border-radius: 6px;
      border: 2px solid #ff6b35;
      font-weight: 700;
      font-size: 1.1rem;
      text-align: center;
      transition: all 0.3s ease;
    }

    .total-percentage.invalid {
      background: rgba(220, 53, 69, 0.1);
      border-color: #dc3545;
      color: #dc3545;
    }

    .warning {
      color: #dc3545;
      font-weight: 700;
      display: block;
      margin-top: 0.3rem;
      font-size: 0.9rem;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    /* ==================== FIN ESTILOS MULTISELECT ==================== */

    /* ==================== ESTILOS INFORME DE ENCARGADO ==================== */

    .create-manager-report-btn {
      background: linear-gradient(135deg, #1565c0, #1976d2);
      color: white;
      border: none;
      padding: 0.8rem 1.5rem;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(21, 101, 192, 0.3);
    }

    .create-manager-report-btn:hover {
      background: linear-gradient(135deg, #218838, #1ea87a);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
    }

    .cogida-reports-btn {
      background: linear-gradient(135deg, #6f42c1, #5a2d91);
      color: white;
      border: none;
      padding: 0.8rem 1.5rem;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(111, 66, 193, 0.3);
    }

    .cogida-reports-btn:hover {
      background: linear-gradient(135deg, #5a2d91, #4c2577);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(111, 66, 193, 0.4);
    }

    .add-interval-btn {
      background: linear-gradient(135deg, #007bff, #0056b3);
      color: white;
      border: none;
      padding: 0.7rem 1.2rem;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      width: 100%;
    }

    .add-interval-btn:hover {
      background: linear-gradient(135deg, #0056b3, #004085);
      transform: translateY(-1px);
    }

    .intervals-container {
      margin-top: 1.5rem;
      padding: 1.5rem;
      background: rgba(0, 123, 255, 0.05);
      border-radius: 12px;
      border: 1px solid rgba(0, 123, 255, 0.2);
    }

    .intervals-container h4 {
      color: #007bff;
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
    }

    .interval-item {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border: 1px solid #e9ecef;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .interval-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .interval-title {
      font-weight: 600;
      color: #495057;
      font-size: 1rem;
    }

    .remove-interval-btn {
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .remove-interval-btn:hover {
      background: #c82333;
      transform: scale(1.1);
    }

    .interval-controls {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .range-container label,
    .kg-container label {
      display: block;
      font-weight: 600;
      color: #495057;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
    }

    .range-inputs {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .range-input,
    .kg-input {
      flex: 1;
      padding: 0.5rem;
      border: 1px solid #ced4da;
      border-radius: 4px;
      font-size: 0.9rem;
    }

    .range-input:focus,
    .kg-input:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }

    .kg-summary {
      margin-top: 1rem;
      padding: 1rem;
      background: rgba(21, 101, 192, 0.1);
      border-radius: 6px;
      border: 2px solid #1565c0;
      text-align: center;
      font-weight: 600;
      transition: all 0.3s ease;
    }

    .kg-summary.invalid {
      background: rgba(220, 53, 69, 0.1);
      border-color: #dc3545;
      color: #dc3545;
    }

    /* Estilos para sliders duales */
    .slider-container {
      margin-top: 0.5rem;
    }

    .slider-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: #666;
      margin-bottom: 0.25rem;
    }

    .dual-range-slider {
      position: relative;
      height: 20px;
    }

    .slider {
      position: absolute;
      width: 100%;
      height: 20px;
      -webkit-appearance: none;
      appearance: none;
      background: transparent;
      outline: none;
      pointer-events: none;
    }

    .slider::-webkit-slider-track {
      width: 100%;
      height: 10px;
      background: linear-gradient(to right, #e9ecef 0%, #e9ecef 100%);
      border-radius: 5px;
      border: 1px solid #ced4da;
    }

    .slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      height: 24px;
      width: 24px;
      border-radius: 50%;
      background: #007bff;
      cursor: pointer;
      border: 3px solid #fff;
      box-shadow: 0 3px 6px rgba(0,0,0,0.3);
      pointer-events: auto;
      position: relative;
      z-index: 1;
      margin-top: -9px;
    }

    .slider::-moz-range-track {
      width: 100%;
      height: 10px;
      background: linear-gradient(to right, #e9ecef 0%, #e9ecef 100%);
      border-radius: 5px;
      border: 1px solid #ced4da;
    }

    .slider::-moz-range-thumb {
      height: 24px;
      width: 24px;
      border-radius: 50%;
      background: #007bff;
      cursor: pointer;
      border: 3px solid #fff;
      box-shadow: 0 3px 6px rgba(0,0,0,0.3);
      pointer-events: auto;
    }

    .slider-start::-webkit-slider-thumb {
      background: #1565c0;
      box-shadow: 0 3px 6px rgba(21,101,192,0.4);
    }

    .slider-start::-moz-range-thumb {
      background: #1565c0;
      box-shadow: 0 3px 6px rgba(21,101,192,0.4);
    }

    .slider-end::-webkit-slider-thumb {
      background: #dc3545;
      box-shadow: 0 3px 6px rgba(220,53,69,0.4);
    }

    .slider-end::-moz-range-thumb {
      background: #dc3545;
      box-shadow: 0 3px 6px rgba(220,53,69,0.4);
    }

    /* Mejorar la visibilidad del track del slider */
    .dual-range-slider::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 10px;
      background: linear-gradient(to right, #e9ecef 0%, #e9ecef 100%);
      border: 1px solid #ced4da;
      border-radius: 5px;
      transform: translateY(-50%);
      z-index: 0;
    }

    /* Estilos para toggle */
    .toggle-container {
      margin-bottom: 1.5rem;
      padding: 1rem;
      background: rgba(248, 249, 250, 0.5);
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.1);
    }

    .toggle-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      font-weight: 500;
      padding: 0.75rem 0;
    }

    .toggle-text {
      font-size: 1rem;
    }

    .toggle-switch {
      position: relative;
      width: 60px;
      height: 34px;
    }

    .toggle-input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: 0.4s;
      border-radius: 34px;
    }

    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 26px;
      width: 26px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: 0.4s;
      border-radius: 50%;
    }

    .toggle-input:checked + .toggle-slider {
      background-color: #007bff;
    }

    .toggle-input:focus + .toggle-slider {
      box-shadow: 0 0 1px #007bff;
    }

    .toggle-input:checked + .toggle-slider:before {
      transform: translateX(26px);
    }

    .kg-totals {
      font-size: 1.1rem;
    }

    .kg-warning {
      display: block;
      margin-top: 0.5rem;
      font-size: 0.9rem;
      color: #dc3545;
    }

    @media (max-width: 768px) {
      .interval-controls {
        grid-template-columns: 1fr;
      }
    }

    /* ==================== FIN ESTILOS INFORME DE ENCARGADO ==================== */

    /* ==================== ESTILOS MODAL INFORMES DE COGIDA ==================== */

    .cogida-modal {
      max-width: 1000px;
      width: 95%;
      height: auto;
      overflow: visible;
    }

    .search-cogida-btn {
      background: linear-gradient(135deg, #6f42c1, #5a2d91);
      color: white;
      border: none;
      padding: 0.8rem 1.5rem;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      width: 100%;
    }

    .search-cogida-btn:hover:not(:disabled) {
      background: linear-gradient(135deg, #5a2d91, #4c2577);
      transform: translateY(-1px);
    }

    .search-cogida-btn:disabled {
      background: #6c757d;
      cursor: not-allowed;
      transform: none;
    }

    .cogida-results {
      margin-top: 2rem;
      padding: 1.5rem;
      background: rgba(111, 66, 193, 0.05);
      border-radius: 12px;
      border: 1px solid rgba(111, 66, 193, 0.2);
    }

    .cogida-results h4 {
      color: #6f42c1;
      margin: 0 0 1.5rem 0;
      font-size: 1.2rem;
      text-align: center;
    }

    .carousel-navigation {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 8px;
    }

    .carousel-btn {
      background: #6f42c1;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 80px;
    }

    .carousel-btn:hover:not(:disabled) {
      background: #5a2d91;
      transform: scale(1.05);
    }

    .carousel-btn:disabled {
      background: #adb5bd;
      cursor: not-allowed;
      transform: none;
    }

    .carousel-counter {
      font-weight: 600;
      color: #495057;
      padding: 0.5rem 1rem;
      background: rgba(111, 66, 193, 0.1);
      border-radius: 20px;
      font-size: 0.95rem;
    }

    .date-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      justify-content: center;
    }

    .date-tab {
      background: rgba(255, 255, 255, 0.8);
      border: 2px solid transparent;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.3s ease;
      color: #495057;
      font-weight: 500;
    }

    .date-tab:hover {
      background: rgba(111, 66, 193, 0.1);
      border-color: rgba(111, 66, 193, 0.3);
    }

    .date-tab.active {
      background: #6f42c1;
      color: white;
      border-color: #6f42c1;
      box-shadow: 0 2px 8px rgba(111, 66, 193, 0.3);
    }

    .date-tab.cogida-needed {
      background: rgba(220, 53, 69, 0.1);
      border-color: #dc3545;
      color: #dc3545;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(220, 53, 69, 0.2);
    }

    .date-tab.cogida-needed:hover {
      background: rgba(220, 53, 69, 0.2);
      border-color: #dc3545;
    }

    .date-tab.cogida-needed.active {
      background: #dc3545;
      color: white;
      border-color: #dc3545;
      box-shadow: 0 2px 12px rgba(220, 53, 69, 0.4);
    }

    .report-details {
      animation: fadeInUp 0.4s ease-out;
    }

    .report-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      border: 1px solid #e9ecef;
    }

    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #f8f9fa;
    }

    .report-header h5 {
      margin: 0;
      color: #6f42c1;
      font-size: 1.3rem;
      font-weight: 600;
    }

    .report-code {
      background: rgba(111, 66, 193, 0.1);
      color: #6f42c1;
      padding: 0.3rem 0.8rem;
      border-radius: 15px;
      font-size: 0.85rem;
      font-weight: 600;
      border: 1px solid rgba(111, 66, 193, 0.2);
    }

    .report-content {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1rem;
    }

    .report-field {
      padding: 0.75rem;
      background: rgba(248, 249, 250, 0.8);
      border-radius: 8px;
      border-left: 3px solid #6f42c1;
    }

    .report-field strong {
      color: #495057;
      display: block;
      margin-bottom: 0.3rem;
      font-size: 0.9rem;
    }

    .report-field {
      color: #333333 !important;
    }

    .report-field * {
      color: inherit !important;
    }

    .intervals-table-container {
      grid-column: 1 / -1;
    }

    .intervals-table {
      margin-top: 0.75rem;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .table-header {
      display: flex;
      background: #8e6dc9;
      color: white;
    }

    .table-row {
      display: flex;
      border-bottom: 1px solid #e9ecef;
      background: white;
    }

    .table-row:nth-child(even) {
      background: #f8f9fa;
    }

    .table-row:hover {
      background: rgba(142, 109, 201, 0.08);
    }

    .table-cell {
      flex: 1;
      padding: 0.75rem 1rem;
      text-align: center;
      border-right: 1px solid #e9ecef;
    }

    .table-cell:last-child {
      border-right: none;
    }

    .header-cell {
      font-weight: 600;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .interval-cell {
      font-weight: 600;
      color: #8e6dc9;
    }

    .kg-cell {
      font-weight: 500;
      color: #495057;
    }

    .status-yes {
      color: #1565c0;
      font-weight: 600;
      background: rgba(21, 101, 192, 0.1);
      padding: 0.2rem 0.5rem;
      border-radius: 12px;
      font-size: 0.85rem;
    }

    .status-no {
      color: #dc3545;
      font-weight: 600;
      background: rgba(220, 53, 69, 0.1);
      padding: 0.2rem 0.5rem;
      border-radius: 12px;
      font-size: 0.85rem;
    }

    .no-results {
      text-align: center;
      padding: 3rem 2rem;
      color: #6c757d;
    }

    .no-results-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
      opacity: 0.6;
    }

    .no-results h4 {
      margin: 0 0 0.5rem 0;
      color: #495057;
      font-size: 1.5rem;
    }

    .no-results p {
      margin: 0;
      font-size: 1.1rem;
      line-height: 1.5;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 768px) {
      .cogida-modal {
        width: 98%;
        margin: 1rem;
      }

      .carousel-navigation {
        flex-direction: column;
        gap: 0.5rem;
      }

      .date-tabs {
        flex-direction: column;
        align-items: center;
      }

      .report-content {
        grid-template-columns: 1fr;
      }

      .report-header {
        flex-direction: column;
        align-items: stretch;
        gap: 0.5rem;
      }
    }

    /* ==================== FIN ESTILOS MODAL INFORMES DE COGIDA ==================== */
  `]
})
export class TecnicoComponent implements OnInit {
  // Estado del modal
  showCreateReportModal = false;
  showCancelConfirmModal = false;
  isCreatingReport = false;
  
  // Estado del modal de analytics
  showAnalyticsModal = false;
  selectedInvernaderos: string[] = [];
  availableInvernaderos: string[] = [];
  analyticsData: any[] = [];
  fechasMaximas: any = {}; // Almacena las fechas máximas por invernadero
  isLoadingAnalytics = false;
  
  // Dropdown de analytics
  groupedAnalyticsInvernaderos: any[] = [];
  searchAnalyticsInvernadero = '';
  showAnalyticsInvernaderoDropdown = false;
  collapsedAnalyticsCabezales: { [key: string]: boolean } = {};

  // Datos del usuario
  userCabezales: string[] = [];
  userRole: string = ''; // Rol del usuario (técnico/encargado)

  // Datos para los desplegables
  groupedInvernaderos: any[] = [];
  groupedEstadosPlanta: any[] = [];
  groupedEstadosGenero: any[] = [];
  generos: string[] = [];
  
  // Filtros de búsqueda
  searchInvernadero = '';
  searchEstadoPlanta = '';
  searchEstadoGenero = '';
  searchGenero = '';
  
  // Estado de colapso para cabezales
  collapsedCabezales: { [key: string]: boolean } = {};
  
  // Control de dropdowns
  showInvernaderoDropdown = false;
  showEstadoPlantaDropdown = false;
  showGeneroDropdown = false;
  showEstadoGeneroDropdown = false;

  // Control de loading overlay
  showGlobalLoading = false;
  loadingMessage = '';

  // Chart.js instances
  lineChart: any = null;
  barChart: any = null;

  // Base URL for API calls
  private baseUrl = environment.apiBaseUrl;

  // Datos del informe
  reportData = {
    invernadero: '',
    estadoPlanta: '', // Se guardará como "estado1;estado2;estado3"
    porcentajePlanta: 0, // Se guardará como "porcentaje1;porcentaje2;porcentaje3"
    genero: '',
    estadoGenero: '', // Se guardará como "estado1;estado2;estado3"
    porcentajeGenero: 0, // Se guardará como "porcentaje1;porcentaje2;porcentaje3"
    fechaMax: '',
    descripcion: ''
  };

  // Nuevas propiedades para manejo multiselect
  selectedEstadosPlanta: string[] = [];
  estadosPlantaPercentages: { [estado: string]: number } = {};
  selectedEstadosGenero: string[] = [];
  estadosGeneroPercentages: { [estado: string]: number } = {};

  // Propiedades para informe de encargado
  showCreateManagerReportModal = false;
  managerReportData = {
    invernadero: '',
    genero: '',
    kgTotales: 0,
    necesidadCogida: false,
    razonCogida: '',
    descripcion: ''
  };
  colorationIntervals: Array<{id: number, rangeStart: number, rangeEnd: number, kg: number}> = [];
  nextIntervalId = 1;

  // Propiedades para dropdown de razón de cogida
  showEstadoGeneroManagerDropdown = false;
  searchEstadoGeneroManager = '';
  filteredEstadosGeneroManager: string[] = [];

  // Modal de confirmación para salir del informe de encargado
  showManagerCancelConfirmModal = false;
  isCreatingManagerReport = false;

  // Propiedades para modal de consultar informes de cogida
  showCogidaReportsModal = false;
  selectedCogidaInvernadero = '';
  searchCogidaInvernadero = '';
  showCogidaInvernaderoDropdown = false;
  cogidaReports: any[] = [];
  activeCogidaReportIndex = 0;
  isLoadingCogidaReports = false;
  cogidaSearchExecuted = false;
  collapsedCogidaCabezales: { [key: string]: boolean } = {};

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    // Register Chart.js components
    Chart.register(...registerables);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    
    // Verificar si el elemento o sus padres tienen la clase custom-dropdown
    let element: HTMLElement | null = target;
    let isInDropdown = false;
    
    while (element && element !== document.body) {
      if (element.classList?.contains('custom-dropdown')) {
        isInDropdown = true;
        break;
      }
      element = element.parentElement;
    }
    
    // Si no está dentro de un dropdown, cerrar todos
    if (!isInDropdown) {
      this.showInvernaderoDropdown = false;
      this.showEstadoPlantaDropdown = false;
      this.showGeneroDropdown = false;
      this.showEstadoGeneroDropdown = false;
      this.showAnalyticsInvernaderoDropdown = false;
    }
  }

  ngOnInit() {
    this.loadUserCabezales();
    this.loadInvernaderos();
    this.loadEstadosPlanta();
    this.loadEstadosGenero();
    this.loadGeneros();
  }

  // Cargar cabezales del usuario
  loadUserCabezales() {
    const user = this.authService.getCurrentUser();
    if (user) {
      // Obtener el rol del usuario
      this.userRole = user.rol || 'tecnico'; // Por defecto técnico
      this.http.get<any>(`${environment.apiBaseUrl}/technician/user-cabezales/${user.id}`).subscribe({
        next: (response) => {
          if (response.success) {
            this.userCabezales = response.cabezales;
            console.log('✅ Cabezales del usuario cargados:', this.userCabezales);
          }
        },
        error: (error) => {
          console.error('❌ Error cargando cabezales del usuario:', error);
        }
      });
    }
  }

  // Cargar invernaderos
  loadInvernaderos() {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.http.get<any>(`${environment.apiBaseUrl}/technician/invernaderos/${user.id}`).subscribe({
        next: (response) => {
          if (response.success) {
            this.groupedInvernaderos = response.invernaderos;
            console.log('✅ Invernaderos cargados:', this.groupedInvernaderos);
          }
        },
        error: (error) => {
          console.error('❌ Error cargando invernaderos:', error);
        }
      });
    }
  }

  // Cargar estados de planta
  loadEstadosPlanta() {
    this.http.get<any>(`${environment.apiBaseUrl}/technician/estados-planta`).subscribe({
      next: (response) => {
        if (response.success) {
          this.groupedEstadosPlanta = response.estados;
          console.log('✅ Estados de planta cargados:', this.groupedEstadosPlanta);
        }
      },
      error: (error) => {
        console.error('❌ Error cargando estados de planta:', error);
      }
    });
  }

  // Cargar estados de género
  loadEstadosGenero() {
    this.http.get<any>(`${environment.apiBaseUrl}/technician/estados-genero`).subscribe({
      next: (response) => {
        if (response.success) {
          this.groupedEstadosGenero = response.estados;
          console.log('✅ Estados de género cargados:', this.groupedEstadosGenero);
        }
      },
      error: (error) => {
        console.error('❌ Error cargando estados de género:', error);
      }
    });
  }

  // Cargar géneros
  loadGeneros() {
    this.http.get<any>(`${environment.apiBaseUrl}/technician/generos`).subscribe({
      next: (response) => {
        if (response.success) {
          this.generos = response.generos;
          console.log('✅ Géneros cargados:', this.generos);
        }
      },
      error: (error) => {
        console.error('❌ Error cargando géneros:', error);
      }
    });
  }

  // Abrir modal de crear informe
  openCreateReportModal() {
    this.showCreateReportModal = true;
    this.resetReportData();
    this.resetSearchFields();
  }

  // Resetear campos de búsqueda
  resetSearchFields() {
    this.searchInvernadero = '';
    this.searchEstadoPlanta = '';
    this.searchEstadoGenero = '';
    this.searchGenero = '';
    
    // Cerrar todos los dropdowns
    this.showInvernaderoDropdown = false;
    this.showEstadoPlantaDropdown = false;
    this.showGeneroDropdown = false;
    this.showEstadoGeneroDropdown = false;
  }

  // Cerrar modal de crear informe
  closeCreateReportModal() {
    // Cerrar todos los dropdowns primero
    this.closeAllDropdowns();
    
    // Verificar si hay datos en el formulario
    if (this.hasReportData()) {
      this.showCancelConfirmModal = true;
    } else {
      this.showCreateReportModal = false;
    }
  }

  // Verificar si hay datos en el formulario
  hasReportData(): boolean {
    return this.reportData.invernadero !== '' ||
           this.reportData.estadoPlanta !== '' ||
           this.reportData.porcentajePlanta !== 0 ||
           this.reportData.genero !== '' ||
           this.reportData.estadoGenero !== '' ||
           this.reportData.porcentajeGenero !== 0 ||
           this.reportData.fechaMax !== '' ||
           this.reportData.descripcion !== '';
  }

  // Click en fondo del modal
  onModalBackdropClick(event: Event) {
    // Primero cerrar dropdowns si están abiertos
    if (this.showInvernaderoDropdown || this.showEstadoPlantaDropdown || 
        this.showGeneroDropdown || this.showEstadoGeneroDropdown) {
      this.closeAllDropdowns();
      event.stopPropagation();
      return;
    }
    
    // Si no hay dropdowns abiertos, cerrar modal
    if (event.target === event.currentTarget) {
      this.closeCreateReportModal();
    }
  }

  onModalContentClick(event: Event) {
    // Detener propagación para evitar cerrar el modal
    event.stopPropagation();
    
    // Si el clic no fue en un dropdown, cerrar todos los dropdowns
    const target = event.target as HTMLElement;
    let element: HTMLElement | null = target;
    let isInDropdown = false;
    
    while (element && element !== event.currentTarget) {
      if (element.classList?.contains('custom-dropdown')) {
        isInDropdown = true;
        break;
      }
      element = element.parentElement;
    }
    
    if (!isInDropdown) {
      this.closeAllDropdowns();
    }
  }

  // Cerrar confirmación de cancelar
  closeCancelConfirm() {
    this.showCancelConfirmModal = false;
  }

  // Confirmar cancelación
  confirmCancel() {
    this.showCancelConfirmModal = false;
    this.showCreateReportModal = false;
    this.resetReportData();
  }

  // ==================== FUNCIONES INFORME DE ENCARGADO ====================

  // Abrir modal de informe de encargado
  openCreateManagerReportModal() {
    this.showCreateManagerReportModal = true;
    this.resetManagerReportData();
    this.resetSearchFields();
  }

  // Cerrar modal de informe de encargado
  closeCreateManagerReportModal() {
    this.showCreateManagerReportModal = false;
    this.resetManagerReportData();
  }

  // Métodos para confirmación de cancelación del informe de encargado
  requestManagerCancel() {
    this.showManagerCancelConfirmModal = true;
  }

  onManagerModalBackdropClick() {
    this.showManagerCancelConfirmModal = true;
  }

  closeManagerCancelConfirm() {
    this.showManagerCancelConfirmModal = false;
  }

  confirmManagerCancel() {
    this.showManagerCancelConfirmModal = false;
    this.showCreateManagerReportModal = false;
    this.resetManagerReportData();
  }

  // Resetear datos del informe de encargado
  resetManagerReportData() {
    this.managerReportData = {
      invernadero: '',
      genero: '',
      kgTotales: 0,
      necesidadCogida: false,
      razonCogida: '',
      descripcion: ''
    };
    this.colorationIntervals = [];
    this.nextIntervalId = 1;
    this.isCreatingManagerReport = false;
  }

  // Manejar selección de invernadero en informe de encargado
  onManagerInvernaderoClick(event: Event, nombre: string) {
    event.stopPropagation();
    this.managerReportData.invernadero = nombre;
    this.searchInvernadero = nombre;
    this.showInvernaderoDropdown = false;
    console.log('🏠 Invernadero seleccionado para manager:', nombre);
  }

  // Manejar selección de género en informe de encargado
  onManagerGeneroClick(event: Event, genero: string) {
    event.stopPropagation();
    this.managerReportData.genero = genero;
    this.searchGenero = genero;
    this.showGeneroDropdown = false;
  }

  // Agregar intervalo de coloración
  addColorationInterval() {
    const newInterval = {
      id: this.nextIntervalId++,
      rangeStart: 0,
      rangeEnd: 15,
      kg: 0
    };
    this.colorationIntervals.push(newInterval);
  }

  // Remover intervalo de coloración
  removeColorationInterval(intervalId: number) {
    this.colorationIntervals = this.colorationIntervals.filter(interval => interval.id !== intervalId);
  }

  // Obtener total de KG de intervalos
  getTotalIntervalKg(): number {
    return this.colorationIntervals.reduce((total, interval) => total + (interval.kg || 0), 0);
  }

  // Obtener todos los estados de género de forma plana
  getAllEstadosGenero(): string[] {
    const estados: string[] = [];
    this.groupedEstadosGenero.forEach(group => {
      group.estados.forEach((estado: any) => {
        estados.push(estado.nombre_estado);
      });
    });
    return estados;
  }

  // Métodos para dropdown de razón de cogida (usa los mismos estados que género)
  toggleEstadoGeneroManagerDropdown() {
    this.showEstadoGeneroManagerDropdown = !this.showEstadoGeneroManagerDropdown;
    if (this.showEstadoGeneroManagerDropdown) {
      this.filteredEstadosGeneroManager = this.getAllEstadosGenero();
      console.log('Estados disponibles para razón de cogida:', this.filteredEstadosGeneroManager);
    }
  }

  onSearchEstadoGeneroManagerChange() {
    const allEstados = this.getAllEstadosGenero();
    if (this.searchEstadoGeneroManager) {
      this.filteredEstadosGeneroManager = allEstados.filter((estado: string) =>
        estado.toLowerCase().includes(this.searchEstadoGeneroManager.toLowerCase())
      );
    } else {
      this.filteredEstadosGeneroManager = allEstados;
    }
  }

  onManagerRazonCogidaClick(event: Event, razon: string) {
    event.stopPropagation();
    this.managerReportData.razonCogida = razon;
    this.searchEstadoGeneroManager = razon;
    this.showEstadoGeneroManagerDropdown = false;
  }

  // Validar si el informe de encargado es válido
  isManagerReportValid(): boolean {
    // Validaciones básicas
    if (!this.managerReportData.invernadero || !this.managerReportData.genero || this.managerReportData.kgTotales <= 0) {
      return false;
    }

    // Si necesidad de cogida está activada, debe tener razón
    if (this.managerReportData.necesidadCogida && !this.managerReportData.razonCogida) {
      return false;
    }

    // Si hay intervalos, validar que los KG coincidan (con tolerancia)
    if (this.colorationIntervals.length > 0) {
      const totalKgIntervalos = this.getTotalIntervalKg();
      const diferencia = Math.abs(totalKgIntervalos - this.managerReportData.kgTotales);
      if (diferencia >= 0.01) {
        return false;
      }
    }

    return true;
  }

  // Crear informe de encargado
  onCreateManagerReport() {
    if (!this.isManagerReportValid()) {
      this.showLoadingOverlay('⚠️ Por favor complete todos los campos correctamente');
      setTimeout(() => this.hideLoadingOverlay(), 3000);
      return;
    }

    this.isCreatingManagerReport = true;
    
    const user = this.authService.getCurrentUser();
    const reportPayload = {
      invernadero: this.managerReportData.invernadero,
      genero: this.managerReportData.genero,
      kgTotales: this.managerReportData.kgTotales,
      necesidadCogida: this.managerReportData.necesidadCogida,
      razonCogida: this.managerReportData.razonCogida,
      intervalos: this.colorationIntervals,
      descripcion: this.managerReportData.descripcion,
      nombre_encargado: user?.name || 'Desconocido'
    };

    this.showLoadingOverlay('📋 Creando informe de encargado de cogida...');

    this.http.post(`${environment.apiBaseUrl}/technician/create-manager-report`, reportPayload, {
      headers: {
        'Authorization': `Bearer ${this.authService.getToken()}`,
        'Content-Type': 'application/json'
      }
    }).subscribe({
      next: (response: any) => {
        console.log('✅ Informe de encargado creado:', response);
        this.isCreatingManagerReport = false;
        this.hideLoadingOverlay();
        this.showLoadingOverlay(`✅ Informe de cogida creado exitosamente. Código: ${response.codigo}`);
        
        setTimeout(() => {
          this.hideLoadingOverlay();
          this.showCreateManagerReportModal = false;
          this.resetManagerReportData();
        }, 3000);
      },
      error: (error) => {
        console.error('❌ Error creando informe de encargado:', error);
        console.error('❌ Status:', error.status);
        console.error('❌ StatusText:', error.statusText);
        console.error('❌ URL:', error.url);
        this.isCreatingManagerReport = false;
        this.hideLoadingOverlay();
        
        let errorMessage = 'Error desconocido';
        if (error.status === 0) {
          errorMessage = 'No se puede conectar al servidor. Verifica que el backend esté funcionando.';
        } else {
          errorMessage = error.error?.error || error.message || `Error ${error.status}: ${error.statusText}`;
        }
        
        this.showLoadingOverlay(`❌ Error: ${errorMessage}`);
        
        setTimeout(() => {
          this.hideLoadingOverlay();
        }, 5000);
      }
    });
  }

  // ==================== FIN FUNCIONES INFORME DE ENCARGADO ====================

  // ==================== FUNCIONES CONSULTAR INFORMES DE COGIDA ====================

  // Abrir modal de consultar informes de cogida
  openCogidaReportsModal() {
    this.showCogidaReportsModal = true;
    this.resetCogidaSearch();
  }

  // Cerrar modal de consultar informes de cogida
  closeCogidaReportsModal() {
    this.showCogidaReportsModal = false;
    this.resetCogidaSearch();
  }

  // Manejar click en backdrop del modal
  onCogidaModalBackdropClick() {
    this.closeCogidaReportsModal();
  }

  // Resetear búsqueda de cogida
  resetCogidaSearch() {
    this.selectedCogidaInvernadero = '';
    this.searchCogidaInvernadero = '';
    this.cogidaReports = [];
    this.activeCogidaReportIndex = 0;
    this.isLoadingCogidaReports = false;
    this.cogidaSearchExecuted = false;
    this.showCogidaInvernaderoDropdown = false;
  }

  // Toggle dropdown de invernaderos para cogida
  toggleCogidaInvernaderoDropdown() {
    this.showCogidaInvernaderoDropdown = !this.showCogidaInvernaderoDropdown;
  }

  // Focus en input de invernadero para cogida
  onCogidaInvernaderoFocus() {
    this.showCogidaInvernaderoDropdown = true;
  }

  // Filtrar invernaderos para cogida
  filterCogidaInvernaderos() {
    // Reutilizar la lógica de filtrado existente
  }

  // Toggle cabezal para cogida
  toggleCogidaCabezal(cabezal: string) {
    this.collapsedCogidaCabezales[cabezal] = !this.collapsedCogidaCabezales[cabezal];
  }

  // Verificar si cabezal está colapsado para cogida
  isCogidaCabezalCollapsed(cabezal: string): boolean {
    return this.collapsedCogidaCabezales[cabezal] || false;
  }

  // Obtener invernaderos filtrados para cogida (reutilizar la lógica existente)
  getFilteredCogidaInvernaderos() {
    return this.getFilteredInvernaderos();
  }

  // Seleccionar invernadero para cogida
  onCogidaInvernaderoClick(event: Event, nombre: string) {
    event.stopPropagation();
    this.selectedCogidaInvernadero = nombre;
    this.searchCogidaInvernadero = nombre;
    this.showCogidaInvernaderoDropdown = false;
    console.log('🏠 Invernadero seleccionado para consulta de cogida:', nombre);
  }

  // Buscar informes de cogida
  searchCogidaReports() {
    if (!this.selectedCogidaInvernadero) {
      this.showLoadingOverlay('⚠️ Debe seleccionar un invernadero');
      setTimeout(() => this.hideLoadingOverlay(), 3000);
      return;
    }

    this.isLoadingCogidaReports = true;
    this.cogidaSearchExecuted = true;
    this.cogidaReports = [];

    const searchPayload = {
      invernadero: this.selectedCogidaInvernadero
    };

    console.log('🔍 Buscando informes de cogida para:', this.selectedCogidaInvernadero);

    this.http.post(`${this.baseUrl}/technician/cogida-reports`, searchPayload, {
      headers: {
        'Authorization': `Bearer ${this.authService.getToken()}`,
        'Content-Type': 'application/json'
      }
    }).subscribe({
      next: (response: any) => {
        console.log('✅ Informes de cogida recibidos:', response);
        this.isLoadingCogidaReports = false;
        
        if (response.success && response.reports) {
          this.cogidaReports = response.reports;
          this.activeCogidaReportIndex = 0;
          console.log(`📋 Se encontraron ${this.cogidaReports.length} informes`);
        } else {
          this.cogidaReports = [];
          console.log('📭 No se encontraron informes');
        }
      },
      error: (error) => {
        console.error('❌ Error buscando informes de cogida:', error);
        this.isLoadingCogidaReports = false;
        this.cogidaReports = [];
        
        let errorMessage = 'Error desconocido';
        if (error.status === 0) {
          errorMessage = 'No se puede conectar al servidor';
        } else {
          errorMessage = error.error?.error || error.message || `Error ${error.status}`;
        }
        
        this.showLoadingOverlay(`❌ Error: ${errorMessage}`);
        setTimeout(() => this.hideLoadingOverlay(), 5000);
      }
    });
  }

  // Navegación del carrusel - anterior
  prevCogidaReport() {
    if (this.activeCogidaReportIndex > 0) {
      this.activeCogidaReportIndex--;
    }
  }

  // Navegación del carrusel - siguiente
  nextCogidaReport() {
    if (this.activeCogidaReportIndex < this.cogidaReports.length - 1) {
      this.activeCogidaReportIndex++;
    }
  }

  // Establecer informe activo
  setActiveCogidaReport(index: number) {
    if (index >= 0 && index < this.cogidaReports.length) {
      this.activeCogidaReportIndex = index;
    }
  }

  // Procesar datos de intervalos para mostrar en tabla
  getIntervalTableData(report: any): {range: string, kg: string}[] {
    if (!report.intervalokg || !report.kgintervalo) {
      return [];
    }
    
    const intervals = report.intervalokg.split(';').map((interval: string) => interval.trim());
    const kgValues = report.kgintervalo.split(';').map((kg: string) => kg.trim());
    
    const tableData: {range: string, kg: string}[] = [];
    
    // Combinar intervalos con sus kg correspondientes
    for (let i = 0; i < Math.max(intervals.length, kgValues.length); i++) {
      tableData.push({
        range: intervals[i] || '-',
        kg: kgValues[i] || '-'
      });
    }
    
    return tableData;
  }

  // ==================== FIN FUNCIONES CONSULTAR INFORMES DE COGIDA ====================

  // Resetear datos del informe
  resetReportData() {
    this.reportData = {
      invernadero: '',
      estadoPlanta: '',
      porcentajePlanta: 0,
      genero: '',
      estadoGenero: '',
      porcentajeGenero: 0,
      fechaMax: '',
      descripcion: ''
    };
    
    // RESETEAR NUEVOS DATOS MULTISELECT
    this.selectedEstadosPlanta = [];
    this.estadosPlantaPercentages = {};
    this.selectedEstadosGenero = [];
    this.estadosGeneroPercentages = {};
    
    // Sincronizar campos de búsqueda con valores seleccionados
    this.syncSearchFields();
  }

  // Sincronizar campos de búsqueda con los valores seleccionados
  syncSearchFields() {
    this.searchInvernadero = this.reportData.invernadero;
    this.searchEstadoPlanta = this.reportData.estadoPlanta; // Mostrar nombre_estado directamente
    this.searchGenero = this.reportData.genero;
    this.searchEstadoGenero = this.reportData.estadoGenero; // Mostrar nombre_estado directamente
  }

  // Cerrar todos los dropdowns
  closeAllDropdowns() {
    this.showInvernaderoDropdown = false;
    this.showEstadoPlantaDropdown = false;
    this.showGeneroDropdown = false;
    this.showEstadoGeneroDropdown = false;
  }

  // Métodos toggle para las flechas
  toggleInvernaderoDropdown() {
    this.showInvernaderoDropdown = !this.showInvernaderoDropdown;
    if (this.showInvernaderoDropdown) {
      this.searchInvernadero = ''; // Limpiar búsqueda al abrir
    }
  }

  toggleEstadoPlantaDropdown() {
    this.showEstadoPlantaDropdown = !this.showEstadoPlantaDropdown;
    if (this.showEstadoPlantaDropdown) {
      this.searchEstadoPlanta = ''; // Limpiar búsqueda al abrir
    }
  }

  toggleGeneroDropdown() {
    this.showGeneroDropdown = !this.showGeneroDropdown;
    if (this.showGeneroDropdown) {
      this.searchGenero = ''; // Limpiar búsqueda al abrir
    }
  }

  toggleEstadoGeneroDropdown() {
    this.showEstadoGeneroDropdown = !this.showEstadoGeneroDropdown;
    if (this.showEstadoGeneroDropdown) {
      this.searchEstadoGenero = ''; // Limpiar búsqueda al abrir
    }
  }

  // Métodos de focus que limpian la búsqueda al abrir
  onInvernaderoFocus() {
    this.showInvernaderoDropdown = true;
    this.searchInvernadero = ''; // Limpiar para nueva búsqueda
  }

  onEstadoPlantaFocus() {
    this.showEstadoPlantaDropdown = true;
    this.searchEstadoPlanta = ''; // Limpiar para nueva búsqueda
  }

  onGeneroFocus() {
    this.showGeneroDropdown = true;
    this.searchGenero = ''; // Limpiar para nueva búsqueda
  }

  onEstadoGeneroFocus() {
    this.showEstadoGeneroDropdown = true;
    this.searchEstadoGenero = ''; // Limpiar para nueva búsqueda
  }

  // Métodos para loading overlay
  showLoadingOverlay(message: string = 'Procesando...') {
    this.loadingMessage = message;
    this.showGlobalLoading = true;
  }

  hideLoadingOverlay() {
    this.showGlobalLoading = false;
    this.loadingMessage = '';
  }

  // Métodos de filtrado
  getFilteredInvernaderos() {
    if (!this.searchInvernadero.trim()) return this.groupedInvernaderos;
    
    return this.groupedInvernaderos.map(grupo => ({
      ...grupo,
      invernaderos: grupo.invernaderos.filter((inv: any) => 
        inv.nombre.toLowerCase().includes(this.searchInvernadero.toLowerCase())
      )
    })).filter(grupo => grupo.invernaderos.length > 0);
  }

  getFilteredEstadosPlanta() {
    let grupos = this.searchEstadoPlanta.trim() ? 
      this.groupedEstadosPlanta.map(grupo => ({
        ...grupo,
        estados: grupo.estados.filter((estado: any) => {
          const searchText = this.searchEstadoPlanta.toLowerCase();
          const subtipo = estado.subtipo_estado?.toLowerCase() || '';
          const nombre = estado.nombre_estado?.toLowerCase() || '';
          return subtipo.includes(searchText) || nombre.includes(searchText);
        })
      })).filter(grupo => grupo.estados.length > 0) 
      : this.groupedEstadosPlanta;

    // Aplanar grupos que tienen un solo elemento sin subtipo
    return grupos.map(grupo => {
      if (grupo.estados.length === 1 && !grupo.estados[0].subtipo_estado) {
        // Si el grupo tiene un solo elemento sin subtipo, crear un grupo "plano"
        return {
          ...grupo,
          tipo: grupo.estados[0].nombre_estado, // Usar el nombre del estado como tipo
          isFlat: true // Marcar como plano para el template
        };
      }
      return grupo;
    });
  }

  getFilteredEstadosGenero() {
    let grupos = this.searchEstadoGenero.trim() ?
      this.groupedEstadosGenero.map(grupo => ({
        ...grupo,
        estados: grupo.estados.filter((estado: any) => {
          const searchText = this.searchEstadoGenero.toLowerCase();
          const subtipo = estado.subtipo_estado?.toLowerCase() || '';
          const nombre = estado.nombre_estado?.toLowerCase() || '';
          return subtipo.includes(searchText) || nombre.includes(searchText);
        })
      })).filter(grupo => grupo.estados.length > 0)
      : this.groupedEstadosGenero;

    // Aplanar grupos que tienen un solo elemento sin subtipo
    return grupos.map(grupo => {
      if (grupo.estados.length === 1 && !grupo.estados[0].subtipo_estado) {
        // Si el grupo tiene un solo elemento sin subtipo, crear un grupo "plano"
        return {
          ...grupo,
          tipo: grupo.estados[0].nombre_estado, // Usar el nombre del estado como tipo
          isFlat: true // Marcar como plano para el template
        };
      }
      return grupo;
    });
  }

  getFilteredGeneros() {
    if (!this.searchGenero.trim()) return this.generos;
    
    return this.generos.filter(genero => 
      genero.toLowerCase().includes(this.searchGenero.toLowerCase())
    );
  }

  // Alternar colapso de cabezal
  toggleCabezal(cabezal: string) {
    // Si es la primera vez, inicializar como true (colapsado por defecto)
    if (this.collapsedCabezales[cabezal] === undefined) {
      this.collapsedCabezales[cabezal] = true;
    }
    // Alternar el estado
    this.collapsedCabezales[cabezal] = !this.collapsedCabezales[cabezal];
  }

  onCabezalClick(event: Event, cabezal: string) {
    event.stopPropagation();
    event.preventDefault();
    this.toggleCabezal(cabezal);
  }

  onInvernaderoClick(event: Event, nombre: string) {
    event.stopPropagation();
    this.selectInvernadero(nombre);
  }

  onEstadoPlantaClick(event: Event, nombreEstado: string) {
    event.stopPropagation();
    this.selectEstadoPlanta(nombreEstado);
  }

  onGeneroClick(event: Event, genero: string) {
    event.stopPropagation();
    this.selectGenero(genero);
  }

  onEstadoGeneroClick(event: Event, nombreEstado: string) {
    event.stopPropagation();
    this.selectEstadoGenero(nombreEstado);
  }

  // Verificar si cabezal está colapsado
  isCabezalCollapsed(cabezal: string): boolean {
    // Si no está definido, por defecto está colapsado (true)
    return this.collapsedCabezales[cabezal] !== false;
  }

  // Expandir/contraer todos los cabezales
  toggleAllCabezales() {
    const allCollapsed = this.groupedInvernaderos.every(grupo => 
      this.isCabezalCollapsed(grupo.cabezal)
    );
    
    this.groupedInvernaderos.forEach(grupo => {
      this.collapsedCabezales[grupo.cabezal] = !allCollapsed;
    });
  }

  // Métodos para dropdown personalizado de invernaderos
  selectInvernadero(nombre: string) {
    this.reportData.invernadero = nombre;
    this.searchInvernadero = nombre;
    this.showInvernaderoDropdown = false;
  }

  hideInvernaderoDropdownDelayed() {
    setTimeout(() => {
      this.showInvernaderoDropdown = false;
    }, 150);
  }

  filterInvernaderos() {
    // El filtrado se hace en getFilteredInvernaderos()
  }

  // Métodos para dropdown personalizado de estado planta
  selectEstadoPlanta(nombreEstado: string) {
    this.reportData.estadoPlanta = nombreEstado; // Guardar nombre_estado (columna C)
    this.searchEstadoPlanta = nombreEstado; // Mostrar nombre_estado en el input también
    this.showEstadoPlantaDropdown = false;
  }

  filterEstadosPlanta() {
    // El filtrado se hace en getFilteredEstadosPlanta()
  }

  getEstadoPlantaDisplayName(estado: string): string {
    for (const group of this.groupedEstadosPlanta) {
      const foundEstado = group.estados.find((e: any) => e.nombre_estado === estado);
      if (foundEstado) {
        return foundEstado.subtipo_estado || foundEstado.nombre_estado;
      }
    }
    return estado;
  }

  // Métodos para dropdown personalizado de géneros
  selectGenero(genero: string) {
    this.reportData.genero = genero;
    this.searchGenero = genero;
    this.showGeneroDropdown = false;
  }

  filterGeneros() {
    // El filtrado se hace en getFilteredGeneros()
  }

  // Métodos para dropdown personalizado de estados de género
  selectEstadoGenero(nombreEstado: string) {
    this.reportData.estadoGenero = nombreEstado; // Guardar nombre_estado (columna C)
    this.searchEstadoGenero = nombreEstado; // Mostrar nombre_estado en el input también
    this.showEstadoGeneroDropdown = false;
  }

  filterEstadosGenero() {
    // El filtrado se hace en getFilteredEstadosGenero()
  }

  getEstadoGeneroDisplayName(estado: string): string {
    for (const group of this.groupedEstadosGenero) {
      const foundEstado = group.estados.find((e: any) => e.nombre_estado === estado);
      if (foundEstado) {
        return foundEstado.subtipo_estado || foundEstado.nombre_estado;
      }
    }
    return estado;
  }

  // ==================== NUEVAS FUNCIONES MULTISELECT ====================
  
  // Funciones para Estados de Planta Multiselect
  toggleEstadoPlanta(nombreEstado: string) {
    const index = this.selectedEstadosPlanta.indexOf(nombreEstado);
    
    if (index === -1) {
      // Agregar estado
      this.selectedEstadosPlanta.push(nombreEstado);
      this.estadosPlantaPercentages[nombreEstado] = 0;
    } else {
      // Remover estado
      this.selectedEstadosPlanta.splice(index, 1);
      delete this.estadosPlantaPercentages[nombreEstado];
    }
    
    this.updateReportDataPlanta();
  }

  removeEstadoPlanta(nombreEstado: string) {
    const index = this.selectedEstadosPlanta.indexOf(nombreEstado);
    if (index !== -1) {
      this.selectedEstadosPlanta.splice(index, 1);
      delete this.estadosPlantaPercentages[nombreEstado];
      this.updateReportDataPlanta();
    }
  }

  updateReportDataPlanta() {
    // Formatear como "estado1;estado2;estado3"
    this.reportData.estadoPlanta = this.selectedEstadosPlanta.join(';');
    
    // Formatear como "porcentaje1;porcentaje2;porcentaje3"
    const percentages = this.selectedEstadosPlanta.map(estado => 
      this.estadosPlantaPercentages[estado] || 0
    );
    this.reportData.porcentajePlanta = percentages.join(';') as any;
  }

  getTotalPercentagePlanta(): number {
    return this.selectedEstadosPlanta.reduce((total, estado) => 
      total + (this.estadosPlantaPercentages[estado] || 0), 0
    );
  }

  // Funciones para Estados de Género Multiselect
  toggleEstadoGenero(nombreEstado: string) {
    const index = this.selectedEstadosGenero.indexOf(nombreEstado);
    
    if (index === -1) {
      // Agregar estado
      this.selectedEstadosGenero.push(nombreEstado);
      this.estadosGeneroPercentages[nombreEstado] = 0;
    } else {
      // Remover estado
      this.selectedEstadosGenero.splice(index, 1);
      delete this.estadosGeneroPercentages[nombreEstado];
    }
    
    this.updateReportDataGenero();
  }

  removeEstadoGenero(nombreEstado: string) {
    const index = this.selectedEstadosGenero.indexOf(nombreEstado);
    if (index !== -1) {
      this.selectedEstadosGenero.splice(index, 1);
      delete this.estadosGeneroPercentages[nombreEstado];
      this.updateReportDataGenero();
    }
  }

  updateReportDataGenero() {
    // Formatear como "estado1;estado2;estado3"
    this.reportData.estadoGenero = this.selectedEstadosGenero.join(';');
    
    // Formatear como "porcentaje1;porcentaje2;porcentaje3"
    const percentages = this.selectedEstadosGenero.map(estado => 
      this.estadosGeneroPercentages[estado] || 0
    );
    this.reportData.porcentajeGenero = percentages.join(';') as any;
  }

  getTotalPercentageGenero(): number {
    return this.selectedEstadosGenero.reduce((total, estado) => 
      total + (this.estadosGeneroPercentages[estado] || 0), 0
    );
  }

  // ==================== FIN NUEVAS FUNCIONES ====================

  // Formatear fecha a formato europeo
  formatFechaToEuropean(fecha: string): string {
    if (!fecha) return '';
    
    const date = new Date(fecha);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  }

  // Crear informe
  onCreateReport() {
    if (this.isCreatingReport) return;

    // VALIDACIONES MULTISELECT
    if (this.selectedEstadosPlanta.length === 0) {
      this.showLoadingOverlay('⚠️ Debe seleccionar al menos un estado de planta');
      setTimeout(() => this.hideLoadingOverlay(), 3000);
      return;
    }

    if (this.selectedEstadosGenero.length === 0) {
      this.showLoadingOverlay('⚠️ Debe seleccionar al menos un estado de género');
      setTimeout(() => this.hideLoadingOverlay(), 3000);
      return;
    }

    this.isCreatingReport = true;
    const user = this.authService.getCurrentUser();

    // Actualizar reportData con los valores finales
    this.updateReportDataPlanta();
    this.updateReportDataGenero();

    // Formatear fecha máxima a formato europeo
    const fechaMaxFormatted = this.formatFechaToEuropean(this.reportData.fechaMax);

    const reportPayload = {
      ...this.reportData,
      fechaMax: fechaMaxFormatted,
      nombre_encargado: user?.name || 'Desconocido'
    };

    // Mostrar loading overlay
    this.showLoadingOverlay('Enviando informe...');

    this.http.post<any>(`${environment.apiBaseUrl}/technician/create-report`, reportPayload).subscribe({
      next: (response) => {
        this.isCreatingReport = false;
        this.hideLoadingOverlay();
        
        if (response.success) {
          console.log('✅ Informe creado exitosamente:', response);
          this.showLoadingOverlay('✅ Informe creado exitosamente');
          
          // Ocultar mensaje de éxito después de 2 segundos y cerrar modal
          setTimeout(() => {
            this.hideLoadingOverlay();
            this.showCreateReportModal = false;
            this.resetReportData();
          }, 2000);
        } else {
          this.showLoadingOverlay('❌ Error: ' + response.message);
          
          // Ocultar mensaje de error después de 3 segundos
          setTimeout(() => {
            this.hideLoadingOverlay();
          }, 3000);
        }
      },
      error: (error) => {
        this.isCreatingReport = false;
        this.hideLoadingOverlay();
        console.error('❌ Error creando informe:', error);
        
        this.showLoadingOverlay('❌ Error de conexión al crear el informe');
        
        // Ocultar mensaje de error después de 3 segundos
        setTimeout(() => {
          this.hideLoadingOverlay();
        }, 3000);
      }
    });
  }

  // Analytics Methods
  resetAnalyticsState() {
    console.log('🧹 Reseteando estado completo de analytics...');
    
    this.ngZone.run(() => {
      this.selectedInvernaderos = [];
      this.analyticsData = [];
      this.fechasMaximas = {};
      this.searchAnalyticsInvernadero = '';
      this.showAnalyticsInvernaderoDropdown = false;
      this.collapsedAnalyticsCabezales = {};
      this.isLoadingAnalytics = false;
      
      // Force change detection after reset
      this.cdr.detectChanges();
      
      console.log('✅ Estado reseteado, dropdown cerrado:', !this.showAnalyticsInvernaderoDropdown);
    });
    
    this.destroyCharts();
  }

  openAnalyticsModal() {
    console.log('🔍 Abriendo modal de analytics...');
    
    // Reset completo del estado antes de abrir
    this.resetAnalyticsState();
    
    this.ngZone.run(() => {
      this.showAnalyticsModal = true;
      this.cdr.detectChanges();
      
      console.log('✅ Modal de analytics abierto, estado limpio');
      
      // Cargar invernaderos después de que el modal esté completamente renderizado
      setTimeout(() => {
        console.log('📡 Iniciando carga de invernaderos...');
        this.loadAvailableInvernaderos();
      }, 200);
    });
  }

  closeAnalyticsModal() {
    console.log('🔒 Cerrando modal de analytics...');
    this.showAnalyticsModal = false;
    this.resetAnalyticsState();
  }

  loadAvailableInvernaderos() {
    console.log('📡 Cargando invernaderos desde la hoja "invernaderos"...');
    this.isLoadingAnalytics = true;
    
    const user = this.authService.getCurrentUser();
    if (!user) {
      console.error('❌ No hay usuario autenticado');
      this.isLoadingAnalytics = false;
      return;
    }
    
    this.http.get<any>(`${this.baseUrl}/technician/invernaderos/${user.id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).subscribe({
      next: (response) => {
        console.log('✅ Respuesta de invernaderos:', response);
        if (response.success && response.invernaderos && response.invernaderos.length > 0) {
          this.groupedAnalyticsInvernaderos = response.invernaderos;
          console.log('🏠 Invernaderos agrupados:', this.groupedAnalyticsInvernaderos);
        }
        this.isLoadingAnalytics = false;
      },
      error: (error) => {
        console.error('❌ Error loading invernaderos:', error);
        console.log('⚠️ Usando datos de prueba debido al error');
        // Datos de prueba con estructura agrupada
        this.groupedAnalyticsInvernaderos = [
          {
            cabezal: 'Cabezal A',
            invernaderos: [
              { nombre: 'Invernadero A1' },
              { nombre: 'Invernadero A2' }
            ]
          },
          {
            cabezal: 'Cabezal B', 
            invernaderos: [
              { nombre: 'Invernadero B1' },
              { nombre: 'Invernadero B2' }
            ]
          }
        ];
        this.isLoadingAnalytics = false;
      }
    });
  }

  onInvernaderoToggle(invernadero: string, event: any) {
    if (event.target.checked) {
      if (!this.selectedInvernaderos.includes(invernadero)) {
        this.selectedInvernaderos.push(invernadero);
      }
    } else {
      this.selectedInvernaderos = this.selectedInvernaderos.filter(inv => inv !== invernadero);
    }
  }

  onInvernaderoSelectionChange(event: any, invernadero: string) {
    if (event.target.checked) {
      if (!this.selectedInvernaderos.includes(invernadero)) {
        this.selectedInvernaderos.push(invernadero);
      }
    } else {
      this.selectedInvernaderos = this.selectedInvernaderos.filter(inv => inv !== invernadero);
    }
  }

  toggleInvernaderoSelection(invernadero: string) {
    if (this.selectedInvernaderos.includes(invernadero)) {
      this.selectedInvernaderos = this.selectedInvernaderos.filter(inv => inv !== invernadero);
    } else {
      this.selectedInvernaderos.push(invernadero);
    }
  }

  // Métodos del dropdown de analytics
  onAnalyticsInvernaderoFocus() {
    console.log('🎯 Analytics dropdown focus activated');
    this.ngZone.run(() => {
      this.showAnalyticsInvernaderoDropdown = true;
      this.cdr.detectChanges();
    });
  }

  onAnalyticsInvernaderoInputClick(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    console.log('📝 Analytics input clicked, opening dropdown');
    
    this.ngZone.run(() => {
      this.showAnalyticsInvernaderoDropdown = true;
      this.cdr.detectChanges();
      
      setTimeout(() => {
        console.log('🔍 Input click - dropdown state:', this.showAnalyticsInvernaderoDropdown);
        const dropdownElement = document.querySelector('.analytics-modal .dropdown-panel');
        console.log('🎯 Input click - DOM element exists:', !!dropdownElement);
      }, 50);
    });
  }

  onAnalyticsDropdownClickOutside(event: Event) {
    console.log('🌐 Click outside analytics dropdown detected');
    this.ngZone.run(() => {
      this.showAnalyticsInvernaderoDropdown = false;
      this.cdr.detectChanges();
    });
  }

  onAnalyticsInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.ngZone.run(() => {
        this.showAnalyticsInvernaderoDropdown = false;
        this.cdr.detectChanges();
      });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleAnalyticsInvernaderoDropdown();
    }
  }

  trackByGroupCabezal(index: number, group: any): string {
    return group.cabezal;
  }

  toggleAnalyticsInvernaderoDropdown(event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    console.log('🔄 Toggling analytics dropdown from', this.showAnalyticsInvernaderoDropdown, 'to', !this.showAnalyticsInvernaderoDropdown);
    
    // Use NgZone to ensure the change happens within Angular's zone
    this.ngZone.run(() => {
      this.showAnalyticsInvernaderoDropdown = !this.showAnalyticsInvernaderoDropdown;
      
      // Force change detection immediately
      this.cdr.detectChanges();
      
      console.log('✅ Analytics dropdown state after toggle:', this.showAnalyticsInvernaderoDropdown);
      
      // Additional verification with timeout
      setTimeout(() => {
        console.log('🔍 Verifying dropdown state after timeout:', this.showAnalyticsInvernaderoDropdown);
        const dropdownElement = document.querySelector('.analytics-modal .dropdown-panel');
        console.log('🎯 DOM dropdown element exists:', !!dropdownElement);
        console.log('🎯 DOM dropdown visible:', dropdownElement ? getComputedStyle(dropdownElement).display !== 'none' : false);
      }, 100);
    });
  }

  filterAnalyticsInvernaderos() {
    // El filtrado se hace en getFilteredAnalyticsInvernaderos()
  }

  getFilteredAnalyticsInvernaderos() {
    if (!this.groupedAnalyticsInvernaderos) return [];
    
    const searchTerm = this.searchAnalyticsInvernadero.toLowerCase();
    
    return this.groupedAnalyticsInvernaderos
      .map(group => ({
        ...group,
        invernaderos: group.invernaderos.filter((inv: any) =>
          inv.nombre.toLowerCase().includes(searchTerm)
        )
      }))
      .filter(group => group.invernaderos.length > 0);
  }

  onAnalyticsCabezalClick(event: Event, cabezal: string) {
    event.stopPropagation();
    this.collapsedAnalyticsCabezales[cabezal] = !this.collapsedAnalyticsCabezales[cabezal];
  }

  isAnalyticsCabezalCollapsed(cabezal: string): boolean {
    return this.collapsedAnalyticsCabezales[cabezal] || false;
  }

  onAnalyticsInvernaderoClick(event: Event, invernaderoNombre: string) {
    event.stopPropagation();
    event.preventDefault();
    
    console.log('🏠 Analytics invernadero clicked:', invernaderoNombre);
    
    if (this.selectedInvernaderos.includes(invernaderoNombre)) {
      this.selectedInvernaderos = this.selectedInvernaderos.filter(inv => inv !== invernaderoNombre);
      console.log('➖ Removed invernadero:', invernaderoNombre);
    } else {
      this.selectedInvernaderos.push(invernaderoNombre);
      console.log('➕ Added invernadero:', invernaderoNombre);
    }
    
    console.log('📋 Current selected invernaderos:', this.selectedInvernaderos);
  }

  removeSelectedInvernadero(invernadero: string) {
    this.selectedInvernaderos = this.selectedInvernaderos.filter(inv => inv !== invernadero);
  }

  updateCharts() {
    if (this.selectedInvernaderos.length === 0) {
      alert('Por favor selecciona al menos un invernadero para mostrar en los gráficos');
      return;
    }

    console.log('📊 Actualizando gráficos para invernaderos:', this.selectedInvernaderos);
    
    // Cerrar dropdown y limpiar estado antes de generar gráficas
    this.ngZone.run(() => {
      this.showAnalyticsInvernaderoDropdown = false;
      this.isLoadingAnalytics = true;
      this.cdr.detectChanges();
      
      console.log('🔒 Dropdown cerrado antes de generar gráficas');
    });
    
    // Get analytics data from backend
    const requestBody = {
      invernaderos: this.selectedInvernaderos
    };

    console.log('📡 Enviando petición de analytics:', requestBody);

    this.http.post<any>(`${this.baseUrl}/technician/analytics`, requestBody, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    }).subscribe({
      next: (response) => {
        console.log('✅ Respuesta de analytics recibida:', response);
        if (response.success) {
          this.analyticsData = response.data;
          this.fechasMaximas = response.fechasMaximas || {};
          console.log('📊 Datos de analytics procesados:', this.analyticsData.length, 'registros');
          console.log('📅 Fechas máximas recibidas:', this.fechasMaximas);
          console.log('🔍 Muestra de datos:', this.analyticsData.slice(0, 3));
          
          // Esperar un tick para que Angular renderice los canvas
          setTimeout(() => {
            this.createCharts();
          }, 100);
        }
        this.isLoadingAnalytics = false;
      },
      error: (error) => {
        console.error('❌ Error loading analytics data:', error);
        this.isLoadingAnalytics = false;
        alert('Error al cargar los datos de análisis');
      }
    });
  }

  createCharts() {
    console.log('🎨 Creando gráficos...');
    this.destroyCharts();
    
    if (this.analyticsData.length === 0) {
      console.log('⚠️ No hay datos para crear gráficos');
      return;
    }

    // Verificar que los elementos canvas existan
    const lineCanvas = document.getElementById('lineChart');
    const barCanvas = document.getElementById('barChart');
    
    if (!lineCanvas || !barCanvas) {
      console.error('❌ Canvas elements no encontrados:', { lineCanvas: !!lineCanvas, barCanvas: !!barCanvas });
      console.log('🔄 Reintentando en 200ms...');
      setTimeout(() => {
        this.createCharts();
      }, 200);
      return;
    }

    console.log('📊 Procesando datos para gráficos...');
    // Prepare data for charts
    const chartData = this.processAnalyticsData();
    console.log('✅ Datos procesados para gráficos:', chartData);
    
    // Create line chart
    console.log('📈 Creando gráfico de líneas...');
    this.createLineChart(chartData);
    
    // Create bar chart
    console.log('📊 Creando gráfico de barras...');
    this.createBarChart(chartData);
  }

  processAnalyticsData() {
    console.log('🔄 Procesando datos de analytics...');
    const processedData: any = {};
    const stateTypeMap: any = {}; // Mapeo de estado -> tipo (Planta/Genero)
    
    // Group data by invernadero and date
    this.analyticsData.forEach((item: any) => {
      const invernadero = item.Invernadero;
      const date = item.Fecha;
      const estado = item.Estado;
      const tipo = item.Tipo || 'Unknown'; // Planta o Genero
      
      if (!processedData[invernadero]) {
        processedData[invernadero] = {};
      }
      
      if (!processedData[invernadero][date]) {
        processedData[invernadero][date] = {};
      }
      
      // Store state percentages
      processedData[invernadero][date][estado] = item.Porcentaje;
      
      // Map estado to tipo for styling
      stateTypeMap[estado] = tipo;
    });
    
    // Get all unique dates from analytics data
    const analyticsDates = [...new Set(this.analyticsData.map((item: any) => item.Fecha))];
    
    // Get fechas máximas for selected invernaderos
    const fechasMaximasArray: string[] = [];
    this.selectedInvernaderos.forEach(invernadero => {
      if (this.fechasMaximas[invernadero]) {
        const fechaMax = this.fechasMaximas[invernadero].fechaMax;
        if (fechaMax && fechaMax !== '') {
          fechasMaximasArray.push(fechaMax);
          console.log(`📅 Agregando fecha máxima de ${invernadero}: ${fechaMax}`);
        }
      }
    });
    
    // Obtener fecha actual
    const today = new Date();
    const todayFormatted = this.formatDateToSpanish(today);
    
    // Combine analytics dates, fechas máximas Y FECHA ACTUAL, luego ordenar
    const allDates = [...new Set([...analyticsDates, ...fechasMaximasArray, todayFormatted])].sort((a, b) => {
      // Convertir fechas DD/MM/YYYY a objetos Date para ordenar correctamente
      const dateA = this.parseSpanishDate(a);
      const dateB = this.parseSpanishDate(b);
      return dateA.getTime() - dateB.getTime();
    });
    
    console.log('📅 Fechas de analytics:', analyticsDates);
    console.log('📅 Fechas máximas:', fechasMaximasArray);
    console.log('📅 Fecha actual:', todayFormatted);
    console.log('📅 Todas las fechas combinadas (incluyendo HOY):', allDates);
    
    const allStates = [...new Set(this.analyticsData.map((item: any) => item.Estado))];
    
    // Separate states by type
    const plantaStates = allStates.filter(state => stateTypeMap[state] === 'Planta');
    const generoStates = allStates.filter(state => stateTypeMap[state] === 'Genero');
    
    console.log('📅 Fechas encontradas:', allDates);
    console.log('� Estados de Planta:', plantaStates);
    console.log('🧬 Estados de Género:', generoStates);
    console.log('🗂️ Datos agrupados:', processedData);
    
    return {
      processedData,
      allDates,
      allStates,
      plantaStates,
      generoStates,
      stateTypeMap
    };
  }

  createLineChart(chartData: any) {
    console.log('📈 Inicializando gráfico de líneas...');
    const ctx = document.getElementById('lineChart') as HTMLCanvasElement;
    if (!ctx) {
      console.error('❌ No se encontró el elemento canvas #lineChart');
      return;
    }
    console.log('✅ Canvas encontrado:', ctx);

    // Colores con gradiente amplio - Verde a Azul para planta, Rojo a Morado para género
    const plantaColors = [
      '#006400', // Verde oscuro
      '#228B22', // Verde bosque
      '#32CD32', // Verde lima
      '#00FF7F', // Verde primavera
      '#00CED1', // Turquesa oscuro
      '#20B2AA', // Verde mar claro
      '#4682B4', // Azul acero
      '#1E90FF', // Azul dodger
      '#0000FF', // Azul puro
      '#4169E1'  // Azul real
    ]; // Gradiente Verde → Azul para estados de planta
    
    const generoColors = [
      '#8B0000', // Rojo oscuro
      '#DC143C', // Carmesí
      '#FF1493', // Rosa profundo
      '#FF4500', // Naranja rojizo
      '#FF6347', // Tomate
      '#FF69B4', // Rosa caliente
      '#DA70D6', // Orquídea
      '#9370DB', // Violeta medio
      '#8A2BE2', // Azul violeta
      '#4B0082'  // Índigo
    ]; // Gradiente Rojo → Morado para estados de género

    const datasets: any[] = [];
    
    console.log('🎯 Estados disponibles:', chartData.allStates);
    console.log('� Estados de Planta:', chartData.plantaStates);
    console.log('🧬 Estados de Género:', chartData.generoStates);
    console.log('�🏠 Invernaderos seleccionados:', this.selectedInvernaderos);
    
    // Process Planta states first
    let plantaColorIndex = 0;
    chartData.plantaStates.forEach((state: string) => {
      this.selectedInvernaderos.forEach((invernadero: string) => {
        const data = chartData.allDates.map((date: string) => {
          const value = chartData.processedData[invernadero]?.[date]?.[state];
          return value !== undefined ? value : null;
        });
        
        console.log(`🌱 Dataset para ${invernadero} - ${state}:`, data);
        
        const dataset = {
          label: `🌱 ${invernadero} - ${state}`,
          data: data,
          borderColor: plantaColors[plantaColorIndex % plantaColors.length],
          backgroundColor: plantaColors[plantaColorIndex % plantaColors.length] + '20',
          borderWidth: 3 + (plantaColorIndex % 2), // Alternar grosor 3-4
          borderDash: [], // Línea sólida para estados de planta
          fill: false,
          tension: 0.3,
          spanGaps: true,
          pointStyle: plantaColorIndex % 2 === 0 ? 'circle' : 'rectRot', // Alternar círculos y diamantes
          pointRadius: 4 + (plantaColorIndex % 2)
        };
        
        datasets.push(dataset);
        plantaColorIndex++;
      });
    });
    
    // Process Genero states second
    let generoColorIndex = 0;
    chartData.generoStates.forEach((state: string) => {
      this.selectedInvernaderos.forEach((invernadero: string) => {
        const data = chartData.allDates.map((date: string) => {
          const value = chartData.processedData[invernadero]?.[date]?.[state];
          return value !== undefined ? value : null;
        });
        
        console.log(`🧬 Dataset para ${invernadero} - ${state}:`, data);
        
        const dataset = {
          label: `🧬 ${invernadero} - ${state}`,
          data: data,
          borderColor: generoColors[generoColorIndex % generoColors.length],
          backgroundColor: generoColors[generoColorIndex % generoColors.length] + '20',
          borderWidth: 3 + (generoColorIndex % 2), // Alternar grosor 3-4
          borderDash: generoColorIndex % 3 === 0 ? [10, 5] : generoColorIndex % 3 === 1 ? [15, 5, 5, 5] : [20, 10], // Tres estilos de punteado diferentes
          fill: false,
          tension: 0.3,
          spanGaps: true,
          pointStyle: generoColorIndex % 3 === 0 ? 'triangle' : generoColorIndex % 3 === 1 ? 'rect' : 'star', // Tres estilos de punto
          pointRadius: 4 + (generoColorIndex % 3)
        };
        
        datasets.push(dataset);
        generoColorIndex++;
      });
    });
    
    console.log('📈 Datasets creados:', datasets.length);

    // Agregar líneas verticales para fechas máximas
    this.addFechasMaximasLines(datasets, chartData.allDates);

    console.log('📊 Creando datasets para gráfico de líneas:', datasets.length, 'datasets');
    console.log('📅 Labels del gráfico:', chartData.allDates);
    
    const formattedLabels = chartData.allDates.map((date: string) => this.formatDateForChart(date));
    console.log('📅 Labels formateadas:', formattedLabels);
    
    this.lineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: formattedLabels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        aspectRatio: 2,
        plugins: {
          title: {
            display: true,
            text: 'Evolución de Estados por Fecha',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20,
              generateLabels: function(chart: any) {
                const original = Chart.defaults.plugins.legend.labels.generateLabels;
                const labels = original.call(this, chart);
                
                // Group labels by type
                const plantaLabels = labels.filter((label: any) => label.text.includes('🌱'));
                const generoLabels = labels.filter((label: any) => label.text.includes('🧬'));
                
                return [
                  ...plantaLabels,
                  { text: '──────────', hidden: true, fillStyle: 'transparent', strokeStyle: 'transparent' }, // Separator
                  ...generoLabels
                ];
              }
            }
          },
          subtitle: {
            display: true,
            text: '🌱 Líneas sólidas Verde→Azul (●◆) = Estados de Planta  •  🧬 Líneas punteadas Rojo→Morado (▲■⭐) = Estados de Género  •  🔴 Marcadores rojos = Fechas máximas estimadas',
            font: {
              size: 10,
              style: 'italic'
            },
            padding: {
              bottom: 10
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Porcentaje (%)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Fecha'
            }
          }
        },
        onHover: (event: any, activeElements: any[], chart: any) => {
          // Custom hover behavior if needed
        },
        animation: {
          onComplete: (animation: any) => {
            // Dibujar líneas verticales después de completar la animación
            this.drawVerticalLines(animation.chart, chartData.allDates);
          }
        }
      }
    });
    
    console.log('✅ Gráfico de líneas creado exitosamente');
  }

  createBarChart(chartData: any) {
    console.log('📊 Inicializando gráfico de barras...');
    const ctx = document.getElementById('barChart') as HTMLCanvasElement;
    if (!ctx) {
      console.error('❌ No se encontró el elemento canvas #barChart');
      return;
    }
    console.log('✅ Canvas encontrado:', ctx);

    // Colors with wide gradient range - Green to Blue for planta, Red to Purple for genero
    const plantaColors = ['#006400', '#228B22', '#32CD32', '#00FF7F', '#00CED1', '#20B2AA', '#4682B4', '#1E90FF', '#0000FF', '#4169E1'];
    const generoColors = ['#8B0000', '#DC143C', '#FF1493', '#FF4500', '#FF6347', '#FF69B4', '#DA70D6', '#9370DB', '#8A2BE2', '#4B0082'];

    // Calculate averages separately for planta and genero states
    const plantaAverages: any = {};
    const generoAverages: any = {};
    
    console.log('📊 Calculando promedios por estado...');
    
    // Calculate averages for planta states
    chartData.plantaStates.forEach((state: string) => {
      let totalPercentage = 0;
      let count = 0;
      
      this.selectedInvernaderos.forEach((invernadero: string) => {
        chartData.allDates.forEach((date: string) => {
          const percentage = chartData.processedData[invernadero]?.[date]?.[state];
          if (percentage !== undefined) {
            totalPercentage += percentage;
            count++;
          }
        });
      });
      
      const average = count > 0 ? totalPercentage / count : 0;
      plantaAverages[state] = average;
      console.log(`🌱 Promedio para "${state}": ${average.toFixed(2)}% (${count} registros)`);
    });
    
    // Calculate averages for genero states
    chartData.generoStates.forEach((state: string) => {
      let totalPercentage = 0;
      let count = 0;
      
      this.selectedInvernaderos.forEach((invernadero: string) => {
        chartData.allDates.forEach((date: string) => {
          const percentage = chartData.processedData[invernadero]?.[date]?.[state];
          if (percentage !== undefined) {
            totalPercentage += percentage;
            count++;
          }
        });
      });
      
      const average = count > 0 ? totalPercentage / count : 0;
      generoAverages[state] = average;
      console.log(`🧬 Promedio para "${state}": ${average.toFixed(2)}% (${count} registros)`);
    });
    
    console.log('📊 Promedios calculados - Planta:', plantaAverages);
    console.log('📊 Promedios calculados - Género:', generoAverages);

    // Create datasets for grouped bar chart
    const datasets = [];
    
    if (chartData.plantaStates.length > 0) {
      datasets.push({
        label: '🌱 Estados de Planta',
        data: chartData.plantaStates.map((state: string) => plantaAverages[state]),
        backgroundColor: chartData.plantaStates.map((_: string, index: number) => plantaColors[index % plantaColors.length]),
        borderColor: chartData.plantaStates.map((_: string, index: number) => plantaColors[index % plantaColors.length]),
        borderWidth: 2
      });
    }
    
    if (chartData.generoStates.length > 0) {
      datasets.push({
        label: '🧬 Estados de Género',
        data: chartData.generoStates.map((state: string) => generoAverages[state]),
        backgroundColor: chartData.generoStates.map((_: string, index: number) => generoColors[index % generoColors.length]),
        borderColor: chartData.generoStates.map((_: string, index: number) => generoColors[index % generoColors.length]),
        borderWidth: 2
      });
    }

    // Combine labels (planta states first, then genero states)
    const combinedLabels = [...chartData.plantaStates, ...chartData.generoStates];
    const combinedData = [
      ...chartData.plantaStates.map((state: string) => plantaAverages[state]),
      ...chartData.generoStates.map((state: string) => generoAverages[state])
    ];
    const combinedColors = [
      ...chartData.plantaStates.map((_: string, index: number) => plantaColors[index % plantaColors.length]),
      ...chartData.generoStates.map((_: string, index: number) => generoColors[index % generoColors.length])
    ];

    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: combinedLabels,
        datasets: [{
          label: 'Promedio de Estados (%)',
          data: combinedData,
          backgroundColor: combinedColors,
          borderColor: combinedColors,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        aspectRatio: 2,
        plugins: {
          title: {
            display: true,
            text: 'Promedios por Tipo de Estado',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: false
          },
          subtitle: {
            display: true,
            text: '🌱 Gradiente Verde→Azul = Estados de Planta  •  🧬 Gradiente Rojo→Morado = Estados de Género',
            font: {
              size: 12,
              style: 'italic'
            },
            padding: {
              bottom: 10
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Porcentaje Promedio (%)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Estados'
            }
          }
        }
      }
    });
    
    console.log('✅ Gráfico de barras creado exitosamente');
  }

  destroyCharts() {
    if (this.lineChart) {
      this.lineChart.destroy();
      this.lineChart = null;
    }
    if (this.barChart) {
      this.barChart.destroy();
      this.barChart = null;
    }
  }

  // Agregar líneas verticales para fechas máximas
  addFechasMaximasLines(datasets: any[], allDates: string[]) {
    console.log('📅 Agregando líneas de fechas máximas...');
    console.log('🔍 Fechas máximas disponibles:', this.fechasMaximas);
    console.log('🔍 Todas las fechas en gráfica:', allDates);
    
    // Para cada invernadero seleccionado que tenga fecha máxima
    this.selectedInvernaderos.forEach((invernadero, index) => {
      if (this.fechasMaximas[invernadero]) {
        const fechaMaxInfo = this.fechasMaximas[invernadero];
        const fechaMax = fechaMaxInfo.fechaMax;
        
        console.log(`📅 Procesando fecha máxima para ${invernadero}: ${fechaMax}`);
        
        // Encontrar el índice de la fecha máxima en allDates
        let fechaMaxIndex = allDates.indexOf(fechaMax);
        
        if (fechaMaxIndex === -1) {
          console.log(`⚠️ Fecha máxima ${fechaMax} no encontrada en allDates para ${invernadero}`);
          return;
        }
        
        console.log(`✅ Fecha máxima ${fechaMax} encontrada en índice ${fechaMaxIndex} para ${invernadero}`);
        
        // Crear datos para línea vertical: dos puntos (0% y 100%) solo en la fecha máxima
        const verticalLineData = allDates.map((date, i) => {
          if (i === fechaMaxIndex) {
            return 50; // Punto en el medio para crear línea visible
          }
          return null;
        });
        
        // Dataset para marcar la fecha máxima
        const verticalLineDataset = {
          label: `� ${invernadero} - Recogida: ${fechaMax}`,
          data: verticalLineData,
          borderColor: '#FF0000', // Rojo brillante
          backgroundColor: '#FF0000',
          borderWidth: 4,
          borderDash: [], // Línea sólida para que se vea mejor
          fill: false,
          pointRadius: 8, // Punto grande y visible
          pointHoverRadius: 10,
          pointStyle: 'rect', // Cuadrado para distinguir
          tension: 0,
          spanGaps: false,
          showLine: false, // Solo mostrar el punto
          order: -1 // Mostrar encima de otros datasets
        };
        
        datasets.push(verticalLineDataset);
        console.log(`✅ Marcador de fecha máxima agregado para ${invernadero} en fecha ${fechaMax} (índice ${fechaMaxIndex})`);
      }
    });
  }

  // Dibujar líneas verticales en el canvas
  drawVerticalLines(chart: any, allDates: string[]) {
    const ctx = chart.ctx;
    const chartArea = chart.chartArea;
    
    if (!ctx || !chartArea) return;
    
    console.log('🎨 Dibujando líneas verticales...');
    
    // Obtener fecha actual en formato DD/MM/YYYY
    const today = new Date();
    const todayFormatted = this.formatDateToSpanish(today);
    
    console.log(`📅 Fecha actual: ${todayFormatted}`);
    console.log(`📊 Fechas disponibles:`, allDates.slice(0, 10), '...', allDates.slice(-10));
    
    // Buscar la fecha actual en el array completo
    let todayIndex = allDates.findIndex(date => date === todayFormatted);
    
    // Si no encontramos la fecha exacta, calcular donde debería ir cronológicamente
    if (todayIndex === -1) {
      console.log('⚠️ Fecha exacta no encontrada, calculando posición cronológica...');
      
      // Convertir fecha actual a objeto Date para comparación
      const todayDate = this.parseDateFromString(todayFormatted);
      
      // Encontrar la posición cronológica correcta
      for (let i = 0; i < allDates.length; i++) {
        const currentDate = this.parseDateFromString(allDates[i]);
        if (todayDate < currentDate) {
          todayIndex = i - 0.5; // Posición intermedia
          break;
        }
      }
      
      // Si es posterior a todas las fechas, ponerla al final
      if (todayIndex === -1) {
        todayIndex = allDates.length;
      }
    }
    
    console.log(`📍 Índice calculado para HOY: ${todayIndex}`);
    
    // Calcular posición X correcta
    let todayXPosition;
    if (todayIndex === allDates.length) {
      // Al final del gráfico
      todayXPosition = chartArea.right - 20;
    } else if (todayIndex % 1 !== 0) {
      // Posición intermedia (entre dos fechas)
      const leftIndex = Math.floor(todayIndex);
      const rightIndex = Math.ceil(todayIndex);
      const leftX = chart.scales.x.getPixelForValue(leftIndex);
      const rightX = chart.scales.x.getPixelForValue(rightIndex);
      todayXPosition = leftX + (rightX - leftX) * (todayIndex - leftIndex);
    } else {
      // Posición exacta
      todayXPosition = chart.scales.x.getPixelForValue(todayIndex);
    }
    
    // DIBUJAR LÍNEA AZUL SIEMPRE
    ctx.save();
    ctx.strokeStyle = '#00BFFF'; // Azul más intenso
    ctx.lineWidth = 4;
    ctx.setLineDash([15, 8]);
    ctx.beginPath();
    ctx.moveTo(todayXPosition, chartArea.top);
    ctx.lineTo(todayXPosition, chartArea.bottom);
    ctx.stroke();
    
    // Etiqueta más pequeña para "HOY"
    ctx.fillStyle = 'rgba(0, 191, 255, 0.9)';
    ctx.fillRect(todayXPosition - 20, chartArea.top, 40, 16);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('HOY', todayXPosition, chartArea.top + 12);
    
    ctx.restore();
    console.log(`✅ Línea "HOY" dibujada en posición X: ${todayXPosition}`);
    
    // Dibujar líneas verticales rojas para fechas máximas
    this.selectedInvernaderos.forEach((invernadero, index) => {
      if (this.fechasMaximas[invernadero]) {
        const fechaMaxInfo = this.fechasMaximas[invernadero];
        const fechaMax = fechaMaxInfo.fechaMax;
        const fechaMaxIndex = allDates.indexOf(fechaMax);
        
        if (fechaMaxIndex !== -1) {
          const xPosition = chart.scales.x.getPixelForValue(fechaMaxIndex);
          
          ctx.save();
          ctx.strokeStyle = '#FF0000'; // Rojo
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 4]);
          ctx.beginPath();
          ctx.moveTo(xPosition, chartArea.top);
          ctx.lineTo(xPosition, chartArea.bottom);
          ctx.stroke();
          
          // Etiqueta MÁS PEQUEÑA para fecha máxima
          const labelY = chartArea.top + (index * 20) + 20;
          const labelText = `${invernadero}`;
          
          ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
          ctx.fillRect(xPosition - 18, labelY - 6, 36, 12); // Más pequeño
          ctx.fillStyle = 'white';
          ctx.font = 'bold 8px Arial'; // Fuente más pequeña
          ctx.textAlign = 'center';
          ctx.fillText(labelText, xPosition, labelY + 2);
          
          ctx.restore();
          console.log(`✅ Línea roja dibujada para ${invernadero} en índice ${fechaMaxIndex} (${fechaMax})`);
        }
      }
    });
  }

  // Formatear fecha actual a formato DD/MM/YYYY  
  formatDateToSpanish(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Parsear fecha desde string DD/MM/YYYY a objeto Date
  parseDateFromString(dateStr: string): Date {
    if (!dateStr || !dateStr.includes('/')) {
      return new Date();
    }
    const [day, month, year] = dateStr.split('/');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Utility method para parsear fechas en formato DD/MM/YYYY
  parseSpanishDate(dateStr: string): Date {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      // DD/MM/YYYY -> new Date(YYYY, MM-1, DD)
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date(dateStr); // fallback
  }

  // Formatear fecha para mostrar en gráficos
  formatDateForChart(dateStr: string): string {
    try {
      const date = this.parseSpanishDate(dateStr);
      return date.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: '2-digit' 
      });
    } catch {
      return dateStr; // fallback
    }
  }

  // Logout
  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}