import { Routes } from '@angular/router';
import { LoginPageComponent } from './pages/login/login-page.component';
import { MainPageComponent } from './pages/main/main-page.component';
import { AuthGuard, LoginGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/app',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginPageComponent,
    canActivate: [LoginGuard]
  },
  {
    path: 'app',
    component: MainPageComponent,
    canActivate: [AuthGuard]
  },
  {
    path: '**',
    redirectTo: '/app'
  }
];