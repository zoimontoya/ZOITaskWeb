import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
        <button type="submit">Entrar</button>
      </form>
  `,
  styles: [
    `
    /* .login-outer eliminado, ahora el wrapper lo pone app.component.html */
    .login-form {
      width: 100%;
      background: #433352;
      padding: 3rem 2.5rem;
      border-radius: 16px;
      box-shadow: 0 2px 16px rgba(0,0,0,0.4);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .login-form h2 {
      color: #d0c2e1;
      font-size: 2.2rem;
      margin-bottom: 2rem;
    }
    .login-field {
      margin-bottom: 1.5rem;
      width: 100%;
    }
    .login-field label {
      color: #ab9ac0;
      font-weight: bold;
      font-size: 1.1rem;
    }
    .login-field input {
      width: 100%;
      padding: 0.8rem;
      border-radius: 6px;
      border: 1.5px solid #ab9ac0;
      background: #d0c2e1;
      font-size: 1.1rem;
      margin-top: 0.3rem;
    }
    .login-error {
      color: #ffb3b3;
      margin-bottom: 1.5rem;
      font-size: 1.1rem;
      width: 100%;
      text-align: center;
    }
    .login-form button {
      background: #9c73ca;
      color: #fff;
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

  @Output() login = new EventEmitter<{username: string, password: string}>();

  onSubmit() {
    this.error = null;
    this.login.emit({ username: this.username, password: this.password });
  }

  setError(msg: string) {
    this.error = msg;
  }
}
