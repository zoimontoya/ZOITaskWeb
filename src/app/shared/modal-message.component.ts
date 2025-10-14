import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal-message',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" *ngIf="visible"></div>
    <div class="modal-message" *ngIf="visible">
      <div class="modal-content">
        <h3>{{ title }}</h3>
        <div class="modal-text">{{ message }}</div>
        <button class="modal-btn" (click)="hide()">Cerrar</button>
      </div>
    </div>
  `,
  styleUrls: ['./modal-message.component.css']
})
export class ModalMessageComponent {
  @Input() title: string = 'Campos requeridos';
  @Input() message: string = '';
  visible = false;

  show(message: string, title: string = 'Campos requeridos') {
    this.message = message;
    this.title = title;
    this.visible = true;
  }

  hide() {
    this.visible = false;
  }
}
