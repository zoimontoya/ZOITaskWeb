import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="login-container" [class.technician-mode]="isTechnicianMode">
      <div class="login-card" [class.tech-card]="isTechnicianMode">
        <!-- Toggle para cambiar modo -->
        <div class="mode-toggle">
          <label class="toggle-label">
            <span class="mode-text" [class.active]="!isTechnicianMode">👥 Trabajadores</span>
            <input type="checkbox" [(ngModel)]="isTechnicianMode" (change)="onModeChange()">
            <div class="toggle-slider"></div>
            <span class="mode-text" [class.active]="isTechnicianMode">🔧 Técnicos</span>
          </label>
        </div>

        <h2>
          <span *ngIf="!isTechnicianMode">🔐 Iniciar Sesión</span>
          <span *ngIf="isTechnicianMode">⚙️ Login Técnico</span>
        </h2>
        <p class="subtitle">
          <span *ngIf="!isTechnicianMode">ZOI Task Management</span>
          <span *ngIf="isTechnicianMode">Sistema Técnico - Seguimiento Estado Género</span>
        </p>
        
        <form (ngSubmit)="onLogin()" class="login-form">
          <div class="form-group">
            <label for="id">ID de Usuario:</label>
            <input 
              type="text" 
              id="id"
              [(ngModel)]="credentials.id" 
              name="id"
              [placeholder]="isTechnicianMode ? 'ID de Técnico' : 'Ingrese su ID'"
              required
              [disabled]="isLoading">
          </div>
          
          <div class="form-group">
            <label for="password">Contraseña:</label>
            <input 
              type="password" 
              id="password"
              [(ngModel)]="credentials.password" 
              name="password"
              placeholder="Ingrese su contraseña"
              required
              [disabled]="isLoading">
          </div>
          
          <button 
            type="submit" 
            class="login-button"
            [class.tech-button]="isTechnicianMode"
            [disabled]="isLoading || !credentials.id || !credentials.password">
            <span *ngIf="!isLoading && !isTechnicianMode">🚀 Iniciar Sesión</span>
            <span *ngIf="!isLoading && isTechnicianMode">⚙️ Acceso Técnico</span>
            <span *ngIf="isLoading">⏳ Iniciando...</span>
          </button>
          
          <div class="error-message" *ngIf="errorMessage">
            ❌ {{ errorMessage }}
          </div>
          
          <div class="jwt-info">
            <small *ngIf="!isTechnicianMode">✨ Tu sesión se mantendrá durante 24 horas</small>
            <small *ngIf="isTechnicianMode">🔧 Acceso al sistema técnico de seguimiento</small>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      transition: all 0.5s ease;
    }
    
    /* Modo técnico - fondo diferente */
    .login-container.technician-mode {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 50%, #ff6b35 100%);
    }
    
    .login-card {
      background: white;
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 400px;
      text-align: center;
      transition: all 0.3s ease;
    }
    
    /* Modo técnico - card con borde naranja */
    .login-card.tech-card {
      border: 3px solid #ff6b35;
      box-shadow: 0 20px 40px rgba(255, 107, 53, 0.2);
    }
    
    h2 {
      color: #333;
      margin-bottom: 10px;
      font-size: 2rem;
    }
    
    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 1.1rem;
    }
    
    .login-form {
      text-align: left;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    label {
      display: block;
      margin-bottom: 8px;
      color: #333;
      font-weight: 500;
    }
    
    input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e1e5e9;
      border-radius: 10px;
      font-size: 16px;
      transition: all 0.3s ease;
      box-sizing: border-box;
    }
    
    input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    
    input:disabled {
      background-color: #f5f5f5;
      cursor: not-allowed;
    }
    
    .login-button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      margin-top: 10px;
    }
    
    .login-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }
    
    .login-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    
    .error-message {
      background: #fee;
      color: #c33;
      padding: 12px;
      border-radius: 8px;
      margin-top: 15px;
      border: 1px solid #fcc;
    }
    
    .jwt-info {
      margin-top: 20px;
      text-align: center;
    }
    
    .jwt-info small {
      color: #1565c0;
      background: #f0f7ff;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #b3d9ff;
    }
    
    /* Estilos del toggle */
    .mode-toggle {
      margin-bottom: 30px;
      padding: 15px;
      background: rgba(255,255,255,0.1);
      border-radius: 15px;
      backdrop-filter: blur(10px);
    }
    
    .toggle-label {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 15px;
      cursor: pointer;
      user-select: none;
    }
    
    .mode-text {
      font-weight: 600;
      color: #666;
      transition: all 0.3s ease;
      font-size: 0.9rem;
    }
    
    .mode-text.active {
      color: #333;
      font-size: 1rem;
      text-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    
    .toggle-label input[type="checkbox"] {
      display: none;
    }
    
    .toggle-slider {
      width: 60px;
      height: 30px;
      background: #ccc;
      border-radius: 15px;
      position: relative;
      transition: all 0.3s ease;
      cursor: pointer;
    }
    
    .toggle-slider::before {
      content: '';
      position: absolute;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: white;
      top: 2px;
      left: 2px;
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    
    /* Toggle activado (modo técnico) */
    .toggle-label input[type="checkbox"]:checked + .toggle-slider {
      background: #ff6b35;
    }
    
    .toggle-label input[type="checkbox"]:checked + .toggle-slider::before {
      transform: translateX(30px);
    }
    
    /* Botón en modo técnico */
    .login-button.tech-button {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
    }
    
    .login-button.tech-button:hover:not(:disabled) {
      box-shadow: 0 10px 20px rgba(255, 107, 53, 0.3);
    }
  `]
})
export class LoginComponent {
  credentials = {
    id: '',
    password: ''
  };
  
  isLoading = false;
  errorMessage = '';
  isTechnicianMode = false; // Toggle para modo técnico
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  onModeChange() {
    // Limpiar credenciales al cambiar modo
    this.credentials = { id: '', password: '' };
    this.errorMessage = '';
  }
  
  onLogin() {
    if (!this.credentials.id || !this.credentials.password) {
      this.errorMessage = 'Por favor ingrese ID y contraseña';
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = '';
    
    if (this.isTechnicianMode) {
      // Login para técnicos
      this.authService.loginTechnician(this.credentials).subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.success) {
            console.log('✅ Login técnico exitoso');
            this.router.navigate(['/tecnico']);
          } else {
            this.errorMessage = 'ID o contraseña incorrectos para técnico';
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = 'Error de conexión. Intente nuevamente.';
          console.error('❌ Error en login técnico:', error);
        }
      });
    } else {
      // Login normal para trabajadores
      this.authService.login(this.credentials).subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.success) {
            console.log('✅ Login exitoso con JWT');
            this.router.navigate(['/tasks']);
          } else {
            this.errorMessage = 'ID o contraseña incorrectos';
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = 'Error de conexión. Intente nuevamente.';
          console.error('❌ Error en login:', error);
        }
      });
    }
  }
}