import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-tecnico',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tecnico-container">
      <header class="tecnico-header">
        <div class="header-content">
          <h1>⚙️ Sistema Técnico</h1>
          <p class="subtitle">Seguimiento Estado Género</p>
          <button class="logout-btn" (click)="onLogout()">
            🚪 Cerrar Sesión
          </button>
        </div>
      </header>
      
      <main class="tecnico-main">
        <div class="welcome-card">
          <h2>🔧 Bienvenido al Sistema Técnico</h2>
          <p>Aquí podrás gestionar el seguimiento del estado de la fruta.</p>
          
          <div class="coming-soon">
            <h3>🚧 En desarrollo</h3>
            <p>Las funcionalidades técnicas se implementarán próximamente:</p>
            <ul>
              <li>📊 Dashboard de estado de género</li>
              <li>📈 Reportes técnicos</li>
              <li>🔍 Análisis de calidad</li>
              <li>⚡ Gestión de procesos</li>
            </ul>
          </div>
        </div>
      </main>
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
    
    .coming-soon {
      background: #fff8f0;
      padding: 2rem;
      border-radius: 15px;
      border: 2px solid #ff6b35;
      margin-top: 2rem;
    }
    
    .coming-soon h3 {
      color: #ff6b35;
      margin-bottom: 1rem;
    }
    
    .coming-soon p {
      color: #666;
      margin-bottom: 1rem;
    }
    
    .coming-soon ul {
      text-align: left;
      max-width: 400px;
      margin: 0 auto;
      color: #666;
    }
    
    .coming-soon li {
      margin-bottom: 0.5rem;
      padding-left: 0.5rem;
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
    }
  `]
})
export class TecnicoComponent {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}