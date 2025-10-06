import { Component, OnInit, OnDestroy, Renderer2, Inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService, User } from '../../auth/auth.service';
import { HeaderComponent } from '../../header/header.component';
import { TasksComponent } from '../../tasks/tasks.component';

@Component({
  selector: 'app-main-page',
  standalone: true,
  imports: [CommonModule, HeaderComponent, TasksComponent],
  template: `
    <div class="app-container">
      <app-header>
        <button 
          id="logout-btn" 
          (click)="logout()" 
          title="Cerrar sesión"
          class="logout-button"
        >
          ⎋ Salir
        </button>
      </app-header>

      <main 
        [class.solo-tareas]="isEncargado && loggedUser && !isSuperior"
        [class.main-content]="true"
      >
        <div *ngIf="isLoading" class="loading-container">
          <div class="loading-spinner"></div>
          <p>Cargando aplicación...</p>
        </div>
        
        <div *ngIf="!isLoading && errorMsg" class="error-container">
          <p class="error-message">{{ errorMsg }}</p>
          <button (click)="retry()" class="retry-button">Reintentar</button>
        </div>
        
        <app-tasks *ngIf="!isLoading && !errorMsg"></app-tasks>
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .main-content {
      flex: 1;
      width: 90%;
      max-width: 50rem;
      margin: 2.5rem auto;
    }

    /* Estilos específicos para encargados - cuando solo ven tareas */
    .solo-tareas {
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    @media (min-width: 768px) {
      .main-content {
        margin: 4rem auto;
      }
      
      .solo-tareas {
        margin: 0 !important;
      }
    }

    .logout-button {
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 0.5rem 1rem;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      transition: background-color 0.3s ease;
    }

    .logout-button:hover {
      background: #c82333;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      text-align: center;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #007bff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      text-align: center;
    }

    .error-message {
      color: #dc3545;
      font-weight: bold;
      margin-bottom: 1rem;
      font-size: 1.1rem;
    }

    .retry-button {
      background: #007bff;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 0.75rem 1.5rem;
      cursor: pointer;
      font-size: 1rem;
      transition: background-color 0.3s ease;
    }

    .retry-button:hover {
      background: #0056b3;
    }
  `]
})
export class MainPageComponent implements OnInit, OnDestroy {
  errorMsg: string | null = null;
  isLoading = true;
  loggedUser?: User;

  constructor(
    private authService: AuthService,
    private router: Router,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit() {
    console.log('🏠 MainPageComponent iniciado');
    this.initializeApp();
  }

  ngOnDestroy() {
    // Restaurar background original al salir del componente
    const body = this.document.body;
    this.renderer.removeClass(body, 'encargado-mode');
    this.renderer.removeClass(body, 'superior-mode');
    this.renderer.setStyle(body, 'background', 'radial-gradient(circle at top left, #102310, #051905)');
  }

  private initializeApp() {
    this.isLoading = true;
    this.errorMsg = null;

    // Verificar autenticación
    if (!this.authService.isAuthenticated()) {
      console.log('❌ No autenticado, redirigiendo a login');
      this.router.navigate(['/login']);
      return;
    }

    // Suscribirse al estado del usuario
    this.authService.currentUser$.subscribe({
      next: (user) => {
        console.log('👤 Estado de usuario actualizado en MainPage:', user);
        this.loggedUser = user || undefined;
        
        if (!user) {
          // Usuario perdió la sesión, redirigir a login
          console.log('❌ Usuario perdió la sesión, redirigiendo a login');
          this.router.navigate(['/login']);
        } else {
          // Usuario cargado correctamente
          this.isLoading = false;
          console.log('✅ Usuario cargado en MainPage:', user.name);
          
          // Aplicar estilos específicos según el rol
          this.applyRoleStyles();
        }
      },
      error: (error) => {
        console.error('❌ Error cargando usuario:', error);
        this.errorMsg = 'Error cargando la aplicación';
        this.isLoading = false;
      }
    });
  }

  get isSuperior() {
    return this.authService.isSuperior();
  }

  get isEncargado() {
    return this.authService.isEncargado();
  }

  logout() {
    console.log('🚪 Cerrando sesión desde MainPage');
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  retry() {
    console.log('🔄 Reintentando carga de la aplicación');
    this.initializeApp();
  }

  private applyRoleStyles() {
    const body = this.document.body;
    
    // Limpiar clases anteriores
    this.renderer.removeClass(body, 'encargado-mode');
    this.renderer.removeClass(body, 'superior-mode');
    
    // Todos los usuarios usan el mismo fondo verde oscuro
    const backgroundGradient = 'radial-gradient(circle at top left, #102310, #051905)';
    
    if (this.isEncargado && !this.isSuperior) {
      console.log('🎨 Aplicando estilos de encargado - mismo fondo que superiores');
      this.renderer.addClass(body, 'encargado-mode');
      this.renderer.setStyle(body, 'background', backgroundGradient);
    } else {
      console.log('🎨 Aplicando estilos de superior');
      this.renderer.addClass(body, 'superior-mode');
      this.renderer.setStyle(body, 'background', backgroundGradient);
    }
  }
}