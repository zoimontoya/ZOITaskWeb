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
    <div class="login-container">
      <div class="login-card">
        <h2>🔐 Iniciar Sesión</h2>
        <p class="subtitle">ZOI Task Management</p>
        
        <form (ngSubmit)="onLogin()" class="login-form">
          <div class="form-group">
            <label for="id">ID de Usuario:</label>
            <input 
              type="text" 
              id="id"
              [(ngModel)]="credentials.id" 
              name="id"
              placeholder="Ingrese su ID"
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
            [disabled]="isLoading || !credentials.id || !credentials.password">
            <span *ngIf="!isLoading">🚀 Iniciar Sesión</span>
            <span *ngIf="isLoading">⏳ Iniciando...</span>
          </button>
          
          <div class="error-message" *ngIf="errorMessage">
            ❌ {{ errorMessage }}
          </div>
          
          <div class="jwt-info">
            <small>✨ Tu sesión se mantendrá durante 24 horas</small>
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
    }
    
    .login-card {
      background: white;
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 400px;
      text-align: center;
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
      color: #28a745;
      background: #f8fff8;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #d4edda;
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
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  onLogin() {
    if (!this.credentials.id || !this.credentials.password) {
      this.errorMessage = 'Por favor ingrese ID y contraseña';
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = '';
    
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