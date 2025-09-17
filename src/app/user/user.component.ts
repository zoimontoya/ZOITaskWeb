import { Component, computed, Input, Output, EventEmitter, output } from '@angular/core';
import { User } from './user.model';
import { CardComponent } from "../shared/card/card.component";

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CardComponent],
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.css']
})

export class UserComponent {

  @Input({required: true}) userSelected! : boolean;
  @Input({required: true}) user! : User;
  @Output() select = new EventEmitter<string>();

  // avatar = input.required<string>();
  // name = input.required<string>();
  //select = output<string>();

  // imagePath = computed(() => {
  //   return 'assets/users/' + this.avatar();});

  get imagePath() {
  return 'assets/users/' + this.user.avatar;
  }

  onSelectUser() {
   this.select.emit(this.user.id);
  }

}
