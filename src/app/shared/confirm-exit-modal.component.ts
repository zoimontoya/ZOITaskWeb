import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-exit-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" *ngIf="visible"></div>
    <div class="modal-message" *ngIf="visible">
      <div class="modal-content">
        <h3>¿Salir del formulario?</h3>
        <div class="modal-text">Si sales ahora, perderás los cambios no guardados.</div>
        <div style="display: flex; gap: 1em; justify-content: center; margin-top: 18px;">
          <button class="modal-btn" (click)="confirmExit()">Salir</button>
          <button class="modal-btn cancel" (click)="cancelExit()">Cancelar</button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./modal-message.component.css']
})
export class ConfirmExitModalComponent {
  @Input() visible = false;
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  confirmExit() {
    this.confirm.emit();
    this.visible = false;
  }
  cancelExit() {
    this.cancel.emit();
    this.visible = false;
  }
}
