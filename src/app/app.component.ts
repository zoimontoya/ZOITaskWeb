// ...existing code...
import { Component } from '@angular/core';
import { HeaderComponent } from './header/header.component';
import { UserComponent } from "./user/user.component";
import { TasksComponent } from './tasks/tasks.component';
import { UserService } from './user/user.service';
import { User } from './user/user.model';
import { LoginComponent } from './login.component';

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

  constructor(private userService: UserService) {
    this.userService.getUsers().subscribe({
      next: users => {
        this.users = users;
        this.errorMsg = null;
      },
      error: err => {
        this.errorMsg = 'No se pudieron cargar los usuarios. Verifica la hoja de cálculo.';
        this.users = [];
      }
    });
  }


  get isSuperior() {
    return this.loggedUser && (this.loggedUser as any).rol && (this.loggedUser as any).rol.toLowerCase() === 'superior';
  }

  get isEncargado() {
    return this.loggedUser && (this.loggedUser as any).rol && (this.loggedUser as any).rol.toLowerCase() === 'encargado';
  }

  get filteredUsers() {
    if (this.isSuperior) {
      // Solo mostrar encargados
      return this.users.filter(u => (u as any).rol && (u as any).rol.toLowerCase() === 'encargado');
    }
    // Si es encargado, no mostrar lista
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
    // Buscar usuario por id y validar contraseña (la columna debe llamarse 'password' en la hoja)
    const user = this.users.find(u => u.id === username);
    if (user && (user as any).password === password) {
      this.isAuthenticated = true;
      this.loggedUser = user;
    } else {
      setTimeout(() => {
        const loginCmp = document.querySelector('app-login') as any;
        if (loginCmp && loginCmp.setError) loginCmp.setError('Usuario o contraseña incorrectos');
      });
    }
  }


  logout() {
    this.isAuthenticated = false;
    this.loggedUser = undefined;
    this.selectedUserId = undefined;
    this.errorMsg = null;
  }
}
