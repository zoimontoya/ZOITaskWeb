// ...existing code...
import { Component, OnInit } from '@angular/core';
import { HeaderComponent } from './header/header.component';
import { TasksComponent } from './tasks/tasks.component';
import { AuthService, User } from './auth/auth.service';
import { LoginComponent } from './login.component';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HeaderComponent, TasksComponent, LoginComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})

export class AppComponent implements OnInit {
  errorMsg: string | null = null;
  isAuthenticated = false;
  loggedUser?: User;

  constructor(private authService: AuthService, private http: HttpClient) {}

  ngOnInit() {
    // Suscribirse a cambios en el estado de autenticación
    this.authService.currentUser$.subscribe(user => {
      this.isAuthenticated = !!user;
      this.loggedUser = user || undefined;
    });
  }

  get isSuperior() {
    return this.authService.isSuperior();
  }

  get isEncargado() {
    return this.authService.isEncargado();
  }

  onLogin({username, password}: {username: string, password: string}) {
    // LoginComponent ahora maneja el login directamente
    console.log('🔄 Login event received in AppComponent (backup)');
  }

  logout() {
    this.authService.logout();
  }
}
