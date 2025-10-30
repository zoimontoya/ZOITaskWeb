import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-page" [class.technician-mode]="isTechnicianMode">
      <div class="login-container" [class.tech-container]="isTechnicianMode">
        <!-- Toggle para cambiar modo -->
        <div class="mode-toggle">
          <label class="toggle-label">
            <span class="mode-text" [class.active]="!isTechnicianMode">👥 Trabajadores</span>
            <input type="checkbox" [(ngModel)]="isTechnicianMode" (change)="onModeChange()">
            <div class="toggle-slider"></div>
            <span class="mode-text" [class.active]="isTechnicianMode">🔧 Técnicos</span>
          </label>
        </div>

        <div class="login-header">
          <img src="/assets/task-management-logo.png" alt="ZOI Task" class="logo">
          <h1>
            <span *ngIf="!isTechnicianMode">ZOI Task Management</span>
            <span *ngIf="isTechnicianMode">Sistema Técnico ZOI</span>
          </h1>
          <p>
            <span *ngIf="!isTechnicianMode">Gestión de tareas agrícolas</span>
            <span *ngIf="isTechnicianMode">Seguimiento Estado Género</span>
          </p>
        </div>
        
        <form class="login-form" (ngSubmit)="onSubmit()" #loginForm="ngForm">
          <div class="form-group">
            <label for="username">Usuario:</label>
            <input
              id="username"
              name="username"
              type="text"
              [(ngModel)]="username"
              required
              #usernameField="ngModel"
              autocomplete="username"
              [disabled]="isLoading"
            >
          </div>
          
          <div class="form-group">
            <label for="password">Contraseña:</label>
            <input
              id="password"
              name="password"
              type="password"
              [(ngModel)]="password"
              required
              #passwordField="ngModel"
              autocomplete="current-password"
              [disabled]="isLoading"
            >
          </div>
          
          <button 
            type="submit" 
            [disabled]="!loginForm.valid || isLoading"
            class="login-button"
            [class.tech-button]="isTechnicianMode"
          >
            <span *ngIf="!isLoading && !isTechnicianMode">Iniciar Sesión</span>
            <span *ngIf="!isLoading && isTechnicianMode">⚙️ Acceso Técnico</span>
            <span *ngIf="isLoading">Verificando...</span>
          </button>
          
          <div *ngIf="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #8dfd96ff 0%, #125f1dff 100%);
      font-family: 'Poppins', sans-serif;
      transition: all 0.5s ease;
    }
    
    /* Modo técnico - fondo diferente */
    .login-page.technician-mode {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 50%, #ff6b35 100%);
    }

    .login-container {
      background: white;
      padding: 2rem;
      border-radius: 15px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 400px;
      text-align: center;
      transition: all 0.3s ease;
    }
    
    /* Modo técnico - container con borde naranja */
    .login-container.tech-container {
      border: 3px solid #ff6b35;
      box-shadow: 0 20px 40px rgba(255, 107, 53, 0.2);
    }

    .login-header {
      margin-bottom: 2rem;
    }

    .logo {
      width: 80px;
      height: 80px;
      margin-bottom: 1rem;
    }

    .login-header h1 {
      color: #333;
      margin: 0.5rem 0;
      font-size: 1.8rem;
      font-weight: 700;
    }

    .login-header p {
      color: #666;
      margin: 0;
      font-size: 0.9rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
      text-align: left;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      color: #333;
      font-weight: 500;
    }

    .form-group input {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid #e1e1e1;
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.3s ease;
      box-sizing: border-box;
    }

    .form-group input:focus {
      outline: none;
      border-color: #667eea;
    }

    .form-group input:disabled {
      background-color: #f5f5f5;
      cursor: not-allowed;
    }

    .login-button {
      width: 100%;
      padding: 0.75rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1.1rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.3s ease;
      margin-top: 1rem;
    }

    .login-button:hover:not(:disabled) {
      opacity: 0.9;
    }

    .login-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .error-message {
      color: #e74c3c;
      margin-top: 1rem;
      padding: 0.75rem;
      background: #fdf2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      font-size: 0.9rem;
    }

    /* Estilos del toggle */
    .mode-toggle {
      margin-bottom: 2rem;
      padding: 1rem;
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

    @media (max-width: 480px) {
      .login-container {
        margin: 1rem;
        padding: 1.5rem;
      }
      
      .mode-toggle {
        margin-bottom: 1.5rem;
        padding: 0.75rem;
      }
      
      .toggle-label {
        gap: 10px;
      }
      
      .mode-text {
        font-size: 0.8rem;
      }
      
      .mode-text.active {
        font-size: 0.9rem;
      }
    }
  `]
})
export class LoginPageComponent implements OnInit {
  username = '';
  password = '';
  errorMessage = '';
  isLoading = false;
  isTechnicianMode = false; // Toggle para modo técnico

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    // Si ya está autenticado, redirigir a la app
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/app']);
    }
  }
  
  onModeChange() {
    // Limpiar credenciales al cambiar modo
    this.username = '';
    this.password = '';
    this.errorMessage = '';
  }

  onSubmit() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = '';

    const credentials = {
      id: this.username,
      password: this.password
    };

    if (this.isTechnicianMode) {
      // Login para técnicos
      console.log('� Intentando login técnico');
      this.authService.loginTechnician(credentials).subscribe({
        next: (response) => {
          if (response.success) {
            console.log('✅ Login técnico exitoso, redirigiendo a /tecnico');
            this.router.navigate(['/tecnico']);
          } else {
            this.errorMessage = response.message || 'ID o contraseña incorrectos para técnico';
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('❌ Error en login técnico:', error);
          this.errorMessage = 'Error de conexión. Inténtalo de nuevo.';
          this.isLoading = false;
        }
      });
    } else {
      // Login normal para trabajadores
      console.log('🔐 Intentando login desde página de login');
      this.authService.login(credentials).subscribe({
        next: (response) => {
          if (response.success) {
            console.log('✅ Login exitoso, redirigiendo a /app');
            this.router.navigate(['/app']);
          } else {
            this.errorMessage = response.message || 'Usuario o contraseña incorrectos';
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('❌ Error en login:', error);
          this.errorMessage = 'Error de conexión. Inténtalo de nuevo.';
          this.isLoading = false;
        }
      });
    }
  }
}