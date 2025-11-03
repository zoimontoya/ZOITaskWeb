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
            <button class="create-report-btn" (click)="openCreateReportModal()">
              📋 Crear Informe
            </button>
            <button class="analytics-btn" (click)="openAnalyticsModal()">
              📊 Consultar Estado de Invernaderos
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

            <!-- Selector de Estado Planta -->
            <div class="form-group">
              <label for="estadoPlanta">🌱 Estado de la Planta *</label>
              <div class="custom-dropdown" (clickOutside)="showEstadoPlantaDropdown = false">
                <div class="input-container">
                  <input 
                    type="text" 
                    placeholder="Buscar estado de planta..."
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
                      <div *ngIf="group.isFlat" 
                        class="flat-item"
                        [class.selected]="reportData.estadoPlanta === group.estados[0].nombre_estado"
                        (click)="onEstadoPlantaClick($event, group.estados[0].nombre_estado)">
                        {{group.estados[0].nombre_estado}}
                      </div>
                      
                      <!-- Elemento agrupado (normal) -->
                      <ng-container *ngIf="!group.isFlat">
                        <div class="group-header">
                          <span class="group-name">{{group.tipo}}</span>
                        </div>
                        
                        <div class="group-items">
                          <div 
                            *ngFor="let estado of group.estados" 
                            class="dropdown-item"
                            [class.selected]="reportData.estadoPlanta === estado.nombre_estado"
                            (click)="onEstadoPlantaClick($event, estado.nombre_estado)">
                            {{estado.subtipo_estado || estado.nombre_estado}}
                          </div>
                        </div>
                      </ng-container>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Porcentaje Estado Planta -->
            <div class="form-group">
              <label for="porcentajePlanta">📊 Porcentaje Estado Planta: {{reportData.porcentajePlanta}}% *</label>
              <input 
                type="range" 
                id="porcentajePlanta" 
                [(ngModel)]="reportData.porcentajePlanta"
                name="porcentajePlanta"
                min="0" 
                max="100" 
                required
                class="slider">
              <div class="slider-labels">
                <span>0%</span>
                <span>100%</span>
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

            <!-- Selector de Estado Género -->
            <div class="form-group">
              <label for="estadoGenero">⚗️ Estado del Género *</label>
              <div class="custom-dropdown" (clickOutside)="showEstadoGeneroDropdown = false">
                <div class="input-container">
                  <input 
                    type="text" 
                    placeholder="Buscar estado del género..."
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
                      <div *ngIf="group.isFlat" 
                        class="flat-item"
                        [class.selected]="reportData.estadoGenero === group.estados[0].nombre_estado"
                        (click)="onEstadoGeneroClick($event, group.estados[0].nombre_estado)">
                        {{group.estados[0].nombre_estado}}
                      </div>
                      
                      <!-- Elemento agrupado (normal) -->
                      <ng-container *ngIf="!group.isFlat">
                        <div class="group-header">
                          <span class="group-name">{{group.tipo}}</span>
                        </div>
                        
                        <div class="group-items">
                          <div 
                            *ngFor="let estado of group.estados" 
                            class="dropdown-item"
                            [class.selected]="reportData.estadoGenero === estado.nombre_estado"
                            (click)="onEstadoGeneroClick($event, estado.nombre_estado)">
                            {{estado.subtipo_estado || estado.nombre_estado}}
                          </div>
                        </div>
                      </ng-container>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Porcentaje Estado Género -->
            <div class="form-group">
              <label for="porcentajeGenero">📈 Porcentaje Estado Género: {{reportData.porcentajeGenero}}% *</label>
              <input 
                type="range" 
                id="porcentajeGenero" 
                [(ngModel)]="reportData.porcentajeGenero"
                name="porcentajeGenero"
                min="0" 
                max="100" 
                required
                class="slider">
              <div class="slider-labels">
                <span>0%</span>
                <span>100%</span>
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
      align-items: center;
      backdrop-filter: blur(5px);
    }

    .analytics-modal-content {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
      border-radius: 20px;
      width: 90%;
      max-width: 1200px;
      max-height: 90vh;
      overflow-y: auto;
      color: white;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      position: relative;
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
      min-height: 400px;
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
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
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
      .analytics-modal-content {
        width: 95%;
        padding: 1rem;
      }
      
      .invernadero-checkboxes {
        grid-template-columns: 1fr;
      }
      
      .chart-section {
        min-height: 300px;
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

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      backdrop-filter: blur(5px);
    }
    
    .modal-content {
      background: white;
      border-radius: 20px;
      width: 90%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
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
      padding: 2rem;
    }
    
    .report-form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
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
      justify-content: flex-end;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #eee;
    }
    
    .btn-cancel, .btn-create {
      padding: 0.75rem 1.5rem;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      border: none;
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
  isLoadingAnalytics = false;
  
  // Dropdown de analytics
  groupedAnalyticsInvernaderos: any[] = [];
  searchAnalyticsInvernadero = '';
  showAnalyticsInvernaderoDropdown = false;
  collapsedAnalyticsCabezales: { [key: string]: boolean } = {};

  // Datos del usuario
  userCabezales: string[] = [];

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
    estadoPlanta: '',
    porcentajePlanta: 0,
    genero: '',
    estadoGenero: '',
    porcentajeGenero: 0,
    fechaMax: '',
    descripcion: ''
  };

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

    this.isCreatingReport = true;
    const user = this.authService.getCurrentUser();

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
          console.log('📊 Datos de analytics procesados:', this.analyticsData.length, 'registros');
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
    
    // Get all unique dates and states
    const allDates = [...new Set(this.analyticsData.map((item: any) => item.Fecha))].sort((a, b) => {
      // Convertir fechas DD/MM/YYYY a objetos Date para ordenar correctamente
      const dateA = this.parseSpanishDate(a);
      const dateB = this.parseSpanishDate(b);
      return dateA.getTime() - dateB.getTime();
    });
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
            text: '🌱 Líneas sólidas Verde→Azul (●◆) = Estados de Planta  •  🧬 Líneas punteadas Rojo→Morado (▲■⭐) = Estados de Género',
            font: {
              size: 11,
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