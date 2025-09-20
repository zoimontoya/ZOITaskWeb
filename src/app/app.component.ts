// ...existing code...
import { Component } from '@angular/core';
import { HeaderComponent } from './header/header.component';
import { UserComponent } from "./user/user.component";
import { TasksComponent } from './tasks/tasks.component';
import { UserService } from './user/user.service';
import { User } from './user/user.model';
import { LoginComponent } from './login.component';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [UserComponent, HeaderComponent, TasksComponent, LoginComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})

export class AppComponent {
  users: User[] = [];
  selectedUserId?: string;
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

  get filteredUsers() {
    if (this.isSuperior) {
      return this.users;
    }
    return [];
  }

  get selectedUser() {
    if (this.isSuperior) {
      return this.users.find(user => user.id === this.selectedUserId)!;
    }
    if (this.isEncargado) {
      return this.loggedUser!;
    }
    return undefined;
  }

  onSelectUser(id: string) {
    this.selectedUserId = id;
  }

  onLogin({username, password}: {username: string, password: string}) {
    this.userService.login(username, password).subscribe({
      next: res => {
        if (res.success) {
          this.isAuthenticated = true;
          this.loggedUser = { id: username, name: res.name || username, rol: res.rol };
          if (res.rol && res.rol.toLowerCase() === 'superior') {
            // Cargar encargados desde backend
            this.http.get<User[]>('http://localhost:3000/encargados').subscribe(encargados => {
              this.users = encargados;
            });
          } else {
            this.users = [];
          }
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
    this.selectedUserId = undefined;
    this.errorMsg = null;
  }
}
