// ...existing code...
import { Component } from '@angular/core';
import { HeaderComponent } from './header/header.component';
import { TasksComponent } from './tasks/tasks.component';
import { UserService } from './user/user.service';
import { User } from './user/user.model';
import { LoginComponent } from './login.component';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HeaderComponent, TasksComponent, LoginComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})

export class AppComponent {
  errorMsg: string | null = null;
  isAuthenticated = false;
  loggedUser?: User;

  constructor(private userService: UserService, private http: HttpClient) {}


  get isSuperior() {
    return this.loggedUser && (this.loggedUser as any).rol && (this.loggedUser as any).rol.toLowerCase() === 'superior';
  }

  get isEncargado() {
    return this.loggedUser && (this.loggedUser as any).rol && (this.loggedUser as any).rol.toLowerCase() === 'encargado';
  }

  onLogin({username, password}: {username: string, password: string}) {
    this.userService.login(username, password).subscribe({
      next: res => {
        if (res.success) {
          this.isAuthenticated = true;
          this.loggedUser = { id: username, name: res.name || username, rol: res.rol, grupo_trabajo: res.grupo_trabajo };
        } else {
          setTimeout(() => {
            const loginCmp = document.querySelector('app-login') as any;
            if (loginCmp && loginCmp.setError) loginCmp.setError('Usuario o contraseña incorrectos');
          });
        }
      },
      error: err => {
        setTimeout(() => {
          const loginCmp = document.querySelector('app-login') as any;
          if (loginCmp && loginCmp.setError) loginCmp.setError('Error de red o backend');
        });
      }
    });
  }

  logout() {
    this.isAuthenticated = false;
    this.loggedUser = undefined;
    this.errorMsg = null;
  }
}
