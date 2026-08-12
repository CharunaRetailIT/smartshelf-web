import { Component, HostListener, OnInit, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MainComponent } from './main/main/main.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { AuthComponent } from './pages/users/auth/auth.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {

  title = 'SmartShelf';

}