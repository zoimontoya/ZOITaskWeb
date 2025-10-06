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
    <div class="login-page">
      <div class="login-container">
        <div class="login-header">
          <img src="/assets/task-management-logo.png" alt="ZOI Task" class="logo">
          <h1>ZOI Task Management</h1>
          <p>Gestión de tareas agrícolas</p>
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
          >
            <span *ngIf="!isLoading">Iniciar Sesión</span>
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
    }

    .login-container {
      background: white;
      padding: 2rem;
      border-radius: 15px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 400px;
      text-align: center;
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

    @media (max-width: 480px) {
      .login-container {
        margin: 1rem;
        padding: 1.5rem;
      }
    }
  `]
})
export class LoginPageComponent implements OnInit {
  username = '';
  password = '';
  errorMessage = '';
  isLoading = false;

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

  onSubmit() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = '';

    const credentials = {
      id: this.username,
      password: this.password
    };

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