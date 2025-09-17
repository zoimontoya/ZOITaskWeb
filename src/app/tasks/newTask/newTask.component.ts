import { Component, computed, Input, Output, EventEmitter, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { type NewTask } from '../task/task.model';

@Component({
  selector: 'app-newTask',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './newTask.component.html',
  styleUrls: ['./newTask.component.css']
})

export class newTaskComponent {
  @Output() cancel = new EventEmitter<void>();
  @Output() add = new EventEmitter<NewTask>();
  enteredTitle = '';
  enteredSummary = '';
  enteredDate = '';

  onCancel() {
    this.cancel.emit();
  }

  onSubmit() {
    this.add.emit({title: this.enteredTitle, summary: this.enteredSummary, date: this.enteredDate});
  }
}
