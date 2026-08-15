import {
  Component,
  HostListener,
  Inject,
  PLATFORM_ID,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';

import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    SidebarComponent,
    HeaderComponent,
    ToastModule,
    ConfirmDialogModule,
  ],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css'],
})
export class MainLayoutComponent implements OnInit {
  isSidebarCollapsed = signal(false);
  isMobile = signal(false);
  showHeader = signal(true);

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  @HostListener('window:resize')
  onResize() {
    if (!isPlatformBrowser(this.platformId)) return;

    const width = window.innerWidth;
    this.isMobile.set(width < 768);

    if (this.isMobile()) {
      this.isSidebarCollapsed.set(true);
    }
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.onResize();
    }

    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.resolveHeader());

    this.resolveHeader();
  }

  toggleSidebar(value: boolean) {
    this.isSidebarCollapsed.set(value);
  }

  private resolveHeader() {
    let r = this.route;
    while (r.firstChild) r = r.firstChild;
    this.showHeader.set(r.snapshot.data['showHeader'] !== false);
  }

  changeIsLeftSidebarCollapsed(isLeftSidebarCollapsed: boolean): void {
    this.isSidebarCollapsed.set(isLeftSidebarCollapsed);
  }
}
