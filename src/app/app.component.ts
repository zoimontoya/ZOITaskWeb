import { Component } from '@angular/core';
import { HeaderComponent } from './header/header.component';
import { UserComponent } from "./user/user.component";
import { TasksComponent } from './tasks/tasks.component';
import { UserService } from './user/user.service';
import { User } from './user/user.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [UserComponent, HeaderComponent, TasksComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})

export class AppComponent {
  users: User[] = [];
  selectedUserId?: string;
  errorMsg: string | null = null;

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

  get selectedUser() {
    return this.users.find(user => user.id === this.selectedUserId)!;
  }

  onSelectUser(id: string) {
    this.selectedUserId = id;
  }
}
