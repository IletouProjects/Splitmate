import { Component, signal } from '@angular/core';
import { Dashboard } from './features/splitmate/pages/dashboard/dashboard';

@Component({
  selector: 'app-root',
  imports: [Dashboard],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('Splitmate');
  
}
