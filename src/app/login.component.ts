import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <form (ngSubmit)="onSubmit()" class="login-form">
        <h2>Iniciar sesión</h2>
        <div class="login-field">
          <label>ID de usuario</label>
          <input [(ngModel)]="username" name="username" required />
        </div>
        <div class="login-field">
          <label>Contraseña</label>
          <input [(ngModel)]="password" name="password" type="password" required />
        </div>
        <div *ngIf="error" class="login-error">{{error}}</div>
        <button type="submit" [disabled]="loading">
          {{ loading ? 'Iniciando sesión...' : 'Entrar' }}
        </button>
      </form>
  `,
  styles: [
    `
    /* .login-outer eliminado, ahora el wrapper lo pone app.component.html */
    .login-form {
      width: 100%;
      background: #335237ff;
      padding: 3rem 2.5rem;
      border-radius: 16px;
      box-shadow: 0 2px 16px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .login-form h2 {
      color: #c2e1c6ff;
      font-size: 2.2rem;
      margin-bottom: 2rem;
    }
    .login-field {
      margin-bottom: 1.5rem;
      width: 100%;
    }
    .login-field label {
      color: #9ac0a0ff;
      font-weight: bold;
      font-size: 1.1rem;
    }
    .login-field input {
      width: 100%;
      padding: 0.8rem;
      border-radius: 6px;
      border: 1.5px solid #9ac09cff;
      background: #c3e1c2ff;
      font-size: 1.1rem;
      margin-top: 0.3rem;
    }
    .login-error {
      color: #b6ffb3ff;
      margin-bottom: 1.5rem;
      font-size: 1.1rem;
      width: 100%;
      text-align: center;
    }
    .login-form button {
      background: #73ca7aff;
      color: #ffffffff;
      border: none;
      border-radius: 6px;
      padding: 0.8rem 2.5rem;
      font-size: 1.2rem;
      cursor: pointer;
      margin-top: 0.5rem;
    }
    `
  ],
  imports: [CommonModule, FormsModule]
})
export class LoginComponent {
  username = '';
  password = '';
  error: string | null = null;
  loading = false;

  @Output() login = new EventEmitter<{username: string, password: string}>();

  constructor(private authService: AuthService) {}

  onSubmit() {
    this.error = null;
    this.loading = true;
    
    this.authService.login({ id: this.username, password: this.password }).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success) {
          console.log('✅ Login exitoso, usuario autenticado');
          // AuthService ya maneja la navegación y actualización del estado
        } else {
          this.error = response.error || 'Usuario o contraseña incorrectos';
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Error de conexión con el servidor';
        console.error('❌ Error en login:', err);
      }
    });
  }

  setError(msg: string) {
    this.error = msg;
  }
}
