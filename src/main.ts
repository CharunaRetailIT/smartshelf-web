import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { ConfigService } from './app/core/services/app-config.service';
import { APP_INITIALIZER } from '@angular/core';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

// function initializeApp(configService: ConfigService) {
//   return () => configService.loadConfig();
// }
ModuleRegistry.registerModules([AllCommunityModule]);

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));


// bootstrapApplication(AppComponent, {
//   providers: [
//     provideHttpClient(),
//     {
//       provide: 'APP_CONFIG_LOADER',
//       useFactory: (configService: ConfigService) => () => configService.loadConfig(),
//       deps: [ConfigService],
//       multi: true
//     }
//   ]
// }).catch(err => console.error(err));